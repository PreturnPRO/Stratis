// S-EXP — raw PCM mic capture for streaming STT.
//
// Captures mic audio through an AudioWorklet and emits little-endian Int16
// mono PCM frames (~250ms each) via onFrame. Used instead of useMediaRecorder
// for the streaming path: raw PCM has no container, so every frame is
// independently decodable and the backend can rotate its gRPC stream
// mid-meeting without losing a WebM header.
//
// The context asks for 16kHz (what STT models want); browsers that refuse
// (Safari ties MediaStream sources to the hardware rate) fall back to the
// native rate, which is reported to the caller via beforeFlow so the backend
// can configure Google accordingly.

import { useCallback, useRef, useState } from "react";

export type PcmStreamStatus = "idle" | "starting" | "streaming" | "error";

const TARGET_SAMPLE_RATE = 16_000;
const FRAME_MS = 250;

const WORKLET_CODE = `
class StratisPcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor("stratis-pcm-tap", StratisPcmTap);
`;

export interface UsePcmStreamOptions {
  onFrame: (frame: ArrayBuffer) => void;
}

export interface UsePcmStreamReturn {
  status: PcmStreamStatus;
  error: string | null;
  /**
   * beforeFlow runs with the actual sample rate after the mic is live but
   * before the first frame is emitted — send the stt:start control message
   * from it so no audio outruns the stream setup.
   */
  start: (beforeFlow?: (sampleRate: number) => void) => Promise<void>;
  stop: () => void;
}

function floatToInt16(input: Float32Array, out: Int16Array, offset: number): void {
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[offset + i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
}

export function usePcmStream({ onFrame }: UsePcmStreamOptions): UsePcmStreamReturn {
  const [status, setStatus] = useState<PcmStreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const runningRef = useRef(false);

  const queueRef = useRef<Float32Array[]>([]);
  const queuedSamplesRef = useRef(0);
  const frameSamplesRef = useRef(TARGET_SAMPLE_RATE * (FRAME_MS / 1000));

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const teardown = useCallback(() => {
    runningRef.current = false;
    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    nodesRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    queueRef.current = [];
    queuedSamplesRef.current = 0;
  }, []);

  const drainFrames = useCallback(() => {
    const frameSamples = frameSamplesRef.current;
    while (queuedSamplesRef.current >= frameSamples) {
      const out = new Int16Array(frameSamples);
      let filled = 0;
      while (filled < frameSamples) {
        const head = queueRef.current[0];
        const take = Math.min(head.length, frameSamples - filled);
        floatToInt16(head.subarray(0, take), out, filled);
        if (take === head.length) queueRef.current.shift();
        else queueRef.current[0] = head.subarray(take);
        filled += take;
      }
      queuedSamplesRef.current -= frameSamples;
      onFrameRef.current(out.buffer);
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
  }, [teardown]);

  const start = useCallback(
    async (beforeFlow?: (sampleRate: number) => void) => {
      if (runningRef.current) return;
      setError(null);
      setStatus("starting");

      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = media;

        // Prefer a 16kHz context; retry at the native rate if this browser
        // can't bind a MediaStream source to a resampling context.
        let ctx: AudioContext;
        let source: MediaStreamAudioSourceNode;
        try {
          ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
          source = ctx.createMediaStreamSource(media);
        } catch {
          ctx = new AudioContext();
          source = ctx.createMediaStreamSource(media);
        }
        ctxRef.current = ctx;

        const workletUrl = URL.createObjectURL(
          new Blob([WORKLET_CODE], { type: "application/javascript" }),
        );
        try {
          await ctx.audioWorklet.addModule(workletUrl);
        } finally {
          URL.revokeObjectURL(workletUrl);
        }

        const tap = new AudioWorkletNode(ctx, "stratis-pcm-tap", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
        });
        // Keep the tap in the rendering graph (silently) so it gets processed.
        const mute = ctx.createGain();
        mute.gain.value = 0;

        tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
          if (!runningRef.current) return;
          queueRef.current.push(event.data);
          queuedSamplesRef.current += event.data.length;
          drainFrames();
        };

        frameSamplesRef.current = Math.round(ctx.sampleRate * (FRAME_MS / 1000));
        runningRef.current = true;
        beforeFlow?.(ctx.sampleRate);

        source.connect(tap);
        tap.connect(mute);
        mute.connect(ctx.destination);
        nodesRef.current = [source, tap, mute];

        setStatus("streaming");
      } catch (err) {
        teardown();
        const msg = err instanceof Error ? err.message : "Mic access denied";
        setError(msg);
        setStatus("error");
        throw err;
      }
    },
    [drainFrames, teardown],
  );

  return { status, error, start, stop };
}
