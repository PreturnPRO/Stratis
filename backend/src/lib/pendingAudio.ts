/**
 * Audio that arrived for a recogniser which is not open yet.
 *
 * A Google stream opens asynchronously. `sttStream.ts` used to write each chunk
 * with `stream?.write(...)`, so everything that arrived during the open was
 * discarded — and the server closes an idle stream after 8 seconds, so the
 * first words after every pause landed in that window, pre-roll included.
 *
 * Held audio cannot simply be flushed the moment the stream opens: Google
 * requires streaming audio at approximately real time. So release is a token
 * bucket — a short burst, then real-time pace. The queue catches up during the
 * silences the speech gate already produces.
 */

/** Google's per-request ceiling for streaming audio. */
export const MAX_REQUEST_BYTES = 25_000;
/** Beyond this much held audio, the oldest goes. */
export const QUEUE_SECONDS = 10;
/**
 * Audio that may be written at once before pacing starts. Not measured: the
 * probe was refused on language codes before any audio was accepted, and the
 * settings were kept (spec §2). Two seconds covers the pre-roll burst plus one
 * open's worth of speech.
 */
export const BURST_SECONDS = 2;

const BYTES_PER_SAMPLE = 2;

/** Splits on an even byte so a 16-bit sample is never cut in half. */
export function splitChunk(chunk: Buffer, maxBytes: number): Buffer[] {
  const size = maxBytes - (maxBytes % BYTES_PER_SAMPLE);
  if (chunk.length <= size) return [chunk];
  const parts: Buffer[] = [];
  for (let offset = 0; offset < chunk.length; offset += size) {
    parts.push(chunk.subarray(offset, Math.min(offset + size, chunk.length)));
  }
  return parts;
}

export class PendingAudio {
  readonly bytesPerSecond: number;
  private readonly capacityBytes: number;
  private readonly burstBytes: number;
  private chunks: Buffer[] = [];
  private queuedBytes = 0;
  private tokens: number;
  private lastRefillAt: number | null = null;

  constructor(sampleRateHertz: number) {
    this.bytesPerSecond = sampleRateHertz * BYTES_PER_SAMPLE;
    this.capacityBytes = this.bytesPerSecond * QUEUE_SECONDS;
    this.burstBytes = this.bytesPerSecond * BURST_SECONDS;
    this.tokens = this.burstBytes;
  }

  get size(): number {
    return this.queuedBytes;
  }

  /** Queues a chunk. Returns how many bytes were dropped from the front to stay under the cap. */
  push(chunk: Buffer): number {
    for (const piece of splitChunk(chunk, MAX_REQUEST_BYTES)) {
      this.chunks.push(piece);
      this.queuedBytes += piece.length;
    }
    let dropped = 0;
    while (this.queuedBytes > this.capacityBytes && this.chunks.length > 0) {
      const head = this.chunks.shift()!;
      this.queuedBytes -= head.length;
      dropped += head.length;
    }
    return dropped;
  }

  /** The chunks that may be written now without running ahead of real time beyond the burst. */
  release(now: number): Buffer[] {
    this.refill(now);
    const out: Buffer[] = [];
    while (this.chunks.length > 0 && this.chunks[0].length <= this.tokens) {
      const head = this.chunks.shift()!;
      this.queuedBytes -= head.length;
      this.tokens -= head.length;
      out.push(head);
    }
    return out;
  }

  /** Everything, ignoring pace — for a flush at the end of a meeting. */
  releaseAll(): Buffer[] {
    const out = this.chunks;
    this.chunks = [];
    this.queuedBytes = 0;
    return out;
  }

  clear(): void {
    this.chunks = [];
    this.queuedBytes = 0;
  }

  private refill(now: number): void {
    if (this.lastRefillAt === null) {
      this.lastRefillAt = now;
      return;
    }
    const elapsedMs = Math.max(0, now - this.lastRefillAt);
    this.lastRefillAt = now;
    this.tokens = Math.min(this.burstBytes, this.tokens + (elapsedMs / 1000) * this.bytesPerSecond);
  }
}
