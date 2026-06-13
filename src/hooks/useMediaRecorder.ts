// S1-T04-B — Browser mic capture via MediaRecorder.
// Owns: permission request, start/stop, chunk collection.
// Does NOT do STT — chunks handed off via onChunk callback (S1-T04-C wires this).

import { useRef, useState, useCallback } from 'react'

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'

export interface UseMediaRecorderOptions {
  onChunk?: (chunk: Blob) => void   // called per chunk — STT pipeline hooks in here
  chunkIntervalMs?: number           // how often to slice chunks, default 3000ms
  mimeType?: string                  // default: browser preference
}

export interface UseMediaRecorderReturn {
  status: RecordingStatus
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useMediaRecorder({
  onChunk,
  chunkIntervalMs = 3000,
  mimeType,
}: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    setError(null)
    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const options: MediaRecorderOptions = {}
      if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
        options.mimeType = mimeType
      }

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          onChunk?.(e.data)
        }
      }

      recorder.onerror = () => {
        setError('MediaRecorder error — recording stopped')
        setStatus('error')
        stop()
      }

      recorder.onstart = () => setStatus('recording')
      recorder.onstop  = () => setStatus('stopped')

      recorder.start(chunkIntervalMs)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Mic access denied'
      setError(msg)
      setStatus('error')
    }
  }, [onChunk, chunkIntervalMs, mimeType])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  return { status, error, start, stop }
}