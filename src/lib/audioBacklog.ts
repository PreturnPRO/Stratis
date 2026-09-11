/**
 * Microphone frames captured while the meeting socket was down.
 *
 * `sendAudioFrame` returns false when the socket is not open, and every frame
 * of a reconnect — three seconds plus the handshake — used to be thrown away
 * with nothing on screen to say so. They are held here instead and uploaded as
 * one clip once the connection is back. Only speech reaches this point: the gate
 * in `usePcmStream` has already dropped the silence.
 */
export const BACKLOG_SECONDS = 30;

const BYTES_PER_SAMPLE = 2;

export interface HeldFrame {
  frame: ArrayBuffer;
  /** Epoch milliseconds at which the frame's audio began. */
  capturedAt: number;
}

export function frameDurationMs(byteLength: number, sampleRate: number): number {
  return (byteLength / BYTES_PER_SAMPLE / sampleRate) * 1000;
}

export class AudioBacklog {
  readonly sampleRate: number;
  private frames: HeldFrame[] = [];
  private heldBytes = 0;
  private droppedBytes = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  get isEmpty(): boolean {
    return this.frames.length === 0;
  }

  push(frame: ArrayBuffer, capturedAt: number): void {
    this.frames.push({ frame, capturedAt });
    this.heldBytes += frame.byteLength;
    const cap = this.sampleRate * BYTES_PER_SAMPLE * BACKLOG_SECONDS;
    while (this.heldBytes > cap && this.frames.length > 0) {
      const oldest = this.frames.shift()!;
      this.heldBytes -= oldest.frame.byteLength;
      this.droppedBytes += oldest.frame.byteLength;
    }
  }

  /** Everything held, oldest first, and how much audio the cap cost. Resets the backlog. */
  takeAll(): { frames: HeldFrame[]; droppedMs: number } {
    const out = {
      frames: this.frames,
      droppedMs: frameDurationMs(this.droppedBytes, this.sampleRate),
    };
    this.frames = [];
    this.heldBytes = 0;
    this.droppedBytes = 0;
    return out;
  }
}
