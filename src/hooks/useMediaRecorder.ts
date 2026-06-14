// S1-T04-B — Browser mic capture via MediaRecorder.
// Owns: permission request, start/stop, chunk collection.
// Does NOT do STT — chunks handed off via onChunk callback.
//
// MVP note:
// Do NOT use MediaRecorder.start(timeslice) for Deepgram REST uploads.
// Later WebM chunks can be container fragments and Deepgram may reject them.
// Instead, record short standalone clips: start recorder -> stop after interval
// -> emit one complete Blob -> immediately start a new recorder on same stream.

import { useRef, useState, useCallback } from "react";

export type RecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "error";

export interface UseMediaRecorderOptions {
  onChunk?: (chunk: Blob) => void;
  chunkIntervalMs?: number;
  mimeType?: string;
}

export interface UseMediaRecorderReturn {
  status: RecordingStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

const DEFAULT_MIME_TYPE = "audio/webm";

export function useMediaRecorder({
  onChunk,
  chunkIntervalMs = 5000,
  mimeType,
}: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const partsRef = useRef<Blob[]>([]);

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    clearSegmentTimer();

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    mediaRecorderRef.current = null;
    cleanupStream();
    setStatus("stopped");
  }, [clearSegmentTimer, cleanupStream]);

  const start = useCallback(async () => {
    if (runningRef.current) return;

    setError(null);
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      runningRef.current = true;

      const startSegment = () => {
        if (!runningRef.current || !streamRef.current) return;

        clearSegmentTimer();
        partsRef.current = [];

        const options: MediaRecorderOptions = {};

        if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
          options.mimeType = mimeType;
        }

        const recorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            partsRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          runningRef.current = false;
          clearSegmentTimer();
          mediaRecorderRef.current = null;
          cleanupStream();
          setError("MediaRecorder error — recording stopped");
          setStatus("error");
        };

        recorder.onstart = () => {
          setStatus("recording");
        };

        recorder.onstop = () => {
          clearSegmentTimer();

          const parts = partsRef.current;
          partsRef.current = [];
          mediaRecorderRef.current = null;

          if (parts.length > 0) {
            const type =
              recorder.mimeType ||
              parts[0]?.type ||
              mimeType ||
              DEFAULT_MIME_TYPE;

            const completeBlob = new Blob(parts, { type });
            onChunk?.(completeBlob);
          }

          if (runningRef.current) {
            startSegment();
          } else {
            cleanupStream();
            setStatus("stopped");
          }
        };

        recorder.start();

        segmentTimerRef.current = setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, chunkIntervalMs);
      };

      startSegment();
    } catch (err) {
      runningRef.current = false;
      cleanupStream();

      const msg = err instanceof Error ? err.message : "Mic access denied";
      setError(msg);
      setStatus("error");
    }
  }, [
    onChunk,
    chunkIntervalMs,
    mimeType,
    clearSegmentTimer,
    cleanupStream,
  ]);

  return { status, error, start, stop };
}