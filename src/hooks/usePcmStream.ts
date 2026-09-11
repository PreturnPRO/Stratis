
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOISE_WINDOW_FRAMES,
  PRE_ROLL_FRAMES,
  frameRms,
  isSpeechFrame,
  noiseFloorFrom,
  withinHangover,
} from "../lib/speechGate";
import {
  initialHealth,
  stepHealth,
  type CaptureAction,
  type CaptureEvent,
  type CaptureStatus,
} from "../lib/captureHealth";

export type PcmStreamStatus = "idle" | "starting" | "streaming" | "error";

const TARGET_SAMPLE_RATE = 16_000;
const FRAME_MS = 250;
/** How often capture health is checked. */
const HEALTH_TICK_MS = 1_000;

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
  /** Whether the microphone is still delivering audio. Meaningful only while streaming. */
  health: CaptureStatus;
  start: (beforeFlow?: (sampleRate: number) => void) => Promise<void>;
  stop: () => void;
  /** After `lost`: try the microphone again. */
  retry: () => void;
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
  const [health, setHealth] = useState<CaptureStatus>("live");

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const runningRef = useRef(false);

  const queueRef = useRef<Float32Array[]>([]);
  const queuedSamplesRef = useRef(0);
  const frameSamplesRef = useRef(TARGET_SAMPLE_RATE * (FRAME_MS / 1000));

  /** Rolling window of frame loudness; the gate's estimate of the room. */
  const recentRmsRef = useRef<number[]>([]);
  const lastSpeechAtRef = useRef(0);
  const preRollRef = useRef<ArrayBuffer[]>([]);

  const healthRef = useRef(initialHealth(0));
  const lastFrameAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beforeFlowRef = useRef<((sampleRate: number) => void) | undefined>(undefined);
  /** The rate the caller was last told about. A reopen on a new device can change it. */
  const sampleRateRef = useRef<number | null>(null);
  const dispatchRef = useRef<(event: CaptureEvent) => void>(() => {});

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  /** Drops the device, the context and the nodes. The recording itself carries on. */
  const releaseCapture = useCallback(() => {
    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {
      }
    }
    nodesRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.onstatechange = null;
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    queueRef.current = [];
    queuedSamplesRef.current = 0;
    // A different device has a different room: the gate relearns it.
    recentRmsRef.current = [];
    lastSpeechAtRef.current = 0;
    preRollRef.current = [];
  }, []);

  const teardown = useCallback(() => {
    runningRef.current = false;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    sampleRateRef.current = null;
    releaseCapture();
  }, [releaseCapture]);

  // The microphone belongs to the component that opened it. Without this,
  // navigating away from the meeting left the tracks live: the browser's
  // recording indicator and the OS mic light stayed on while the user looked at
  // a page with no recording UI on it at all.
  useEffect(() => teardown, [teardown]);

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

      const rms = frameRms(out);
      // Observed before it is judged: the floor is a minimum, so a loud frame
      // cannot raise it, and a quiet one has to be able to lower it immediately.
      recentRmsRef.current.push(rms);
      if (recentRmsRef.current.length > NOISE_WINDOW_FRAMES) recentRmsRef.current.shift();
      const speech = isSpeechFrame(rms, noiseFloorFrom(recentRmsRef.current));

      const nowMs = Date.now();
      if (speech) lastSpeechAtRef.current = nowMs;

      if (!withinHangover(nowMs, lastSpeechAtRef.current)) {
        // Held, not dropped: this is the audio just before someone starts.
        preRollRef.current.push(out.buffer);
        if (preRollRef.current.length > PRE_ROLL_FRAMES) preRollRef.current.shift();
        continue;
      }

      if (preRollRef.current.length > 0) {
        for (const held of preRollRef.current) onFrameRef.current(held);
        preRollRef.current = [];
      }
      onFrameRef.current(out.buffer);
    }
  }, []);

  const openCapture = useCallback(async () => {
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = media;
    const [track] = media.getAudioTracks();
    if (track) {
      track.onended = () => dispatchRef.current({ type: "track-ended", at: Date.now() });
    }

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
    ctx.onstatechange = () => {
      // "interrupted" is Safari's name for a context the system took away.
      if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
        dispatchRef.current({ type: "context-suspended", at: Date.now() });
      }
    };

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
    const mute = ctx.createGain();
    mute.gain.value = 0;

    tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!runningRef.current) return;
      lastFrameAtRef.current = Date.now();
      queueRef.current.push(event.data);
      queuedSamplesRef.current += event.data.length;
      drainFrames();
    };

    frameSamplesRef.current = Math.round(ctx.sampleRate * (FRAME_MS / 1000));
    if (sampleRateRef.current !== ctx.sampleRate) {
      sampleRateRef.current = ctx.sampleRate;
      beforeFlowRef.current?.(ctx.sampleRate);
    }

    source.connect(tap);
    tap.connect(mute);
    mute.connect(ctx.destination);
    nodesRef.current = [source, tap, mute];
  }, [drainFrames]);

  const reopen = useCallback(async () => {
    releaseCapture();
    try {
      await openCapture();
      if (!runningRef.current) {
        // Stopped while the device was reopening: do not leave it open.
        releaseCapture();
        return;
      }
      dispatchRef.current({ type: "reopen-succeeded", at: Date.now() });
    } catch (err) {
      console.warn("[speech:capture] Reopening the microphone failed:", err);
      releaseCapture();
      dispatchRef.current({ type: "reopen-failed", at: Date.now() });
    }
  }, [openCapture, releaseCapture]);

  const runAction = useCallback(
    (action: CaptureAction) => {
      if (action === "resume-context") void ctxRef.current?.resume().catch(() => {});
      else if (action === "reopen") void reopen();
    },
    [reopen],
  );

  dispatchRef.current = (event: CaptureEvent) => {
    if (!runningRef.current) return;
    const next = stepHealth(healthRef.current, event);
    healthRef.current = next.health;
    setHealth(next.health.status);
    runAction(next.action);
  };

  // A device that disappears does not always end its track first.
  useEffect(() => {
    const onDeviceChange = () => {
      const track = streamRef.current?.getAudioTracks()[0];
      if (runningRef.current && track && track.readyState === "ended") {
        dispatchRef.current({ type: "track-ended", at: Date.now() });
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
  }, []);

  const stop = useCallback(() => {
    teardown();
    setHealth("live");
    setStatus("idle");
  }, [teardown]);

  const start = useCallback(
    async (beforeFlow?: (sampleRate: number) => void) => {
      if (runningRef.current) return;
      setError(null);
      setStatus("starting");
      beforeFlowRef.current = beforeFlow;
      sampleRateRef.current = null;
      runningRef.current = true;

      try {
        await openCapture();
        const now = Date.now();
        healthRef.current = initialHealth(now);
        lastFrameAtRef.current = now;
        setHealth("live");
        tickRef.current = setInterval(() => {
          dispatchRef.current({ type: "tick", at: Date.now(), lastFrameAt: lastFrameAtRef.current });
        }, HEALTH_TICK_MS);
        setStatus("streaming");
      } catch (err) {
        teardown();
        const msg = err instanceof Error ? err.message : "Mic access denied";
        setError(msg);
        setStatus("error");
        throw err;
      }
    },
    [openCapture, teardown],
  );

  const retry = useCallback(() => {
    dispatchRef.current({ type: "retry", at: Date.now() });
  }, []);

  return { status, error, health, start, stop, retry };
}
