/**
 * The silence gate that sits between the microphone and the recogniser.
 *
 * Chirp does not return nothing when it is fed nothing. Given room tone, a fan,
 * a laptop, or four people not talking, it returns its best guess at what that
 * could have been — digits, "ครับ", half a sentence — and each of those became a
 * transcript row nobody said, which the AI then reasoned over and the summary
 * reported. Nothing downstream can repair it: by the time text exists, the fact
 * that the room was silent is gone.
 *
 * So audio does not leave the browser unless something is being said. The
 * threshold is relative to the room rather than absolute — a quiet office and a
 * café have noise floors two orders of magnitude apart, and any fixed number is
 * deaf in one or wide open in the other.
 *
 * Kept apart from `usePcmStream` because this is the part that has to be right
 * and the part that can be checked without a microphone.
 */

/** A frame is speech when it is this many times above the tracked noise floor. */
export const SPEECH_OVER_FLOOR = 2.5;

/**
 * Hard floor, about -48 dBFS, below which nothing counts as speech however
 * quiet the room. Without it a near-silent input drives the floor toward zero
 * and every ratio clears it.
 */
export const ABSOLUTE_SPEECH_RMS = 0.004;

/**
 * The floor is the quietest frame in this window, which is why the estimator
 * cannot be fooled by the thing it is trying to measure. An averaging estimator
 * has a bootstrap deadlock: it only learns the room while it believes nobody is
 * speaking, so a room noisier than its starting guess is heard as speech
 * forever and it never adapts — the exact case (a café, an air conditioner)
 * this gate exists for. A minimum over a window has no such state to get stuck
 * in: fifteen seconds of any real meeting contains at least one quiet frame.
 */
export const NOISE_WINDOW_FRAMES = 60;

/**
 * The floor may not be tracked above this, about -30 dBFS.
 *
 * Two jobs. It bounds the damage when someone is already mid-sentence as
 * recording starts and the window holds nothing but speech — without it the
 * floor would be set from that speech and gate the speaker out. And no meeting
 * room has a noise floor this high; past it something is wrong with the input,
 * and a gate that stayed shut would silently record nothing.
 */
export const MAX_TRACKED_FLOOR = 0.03;

/**
 * Keep streaming this long after the last speech frame. Endings are quiet — the
 * tail of a sentence sits under the threshold — and cutting at the last loud
 * frame truncates the final word of every utterance. It also bridges the gaps
 * inside a turn, so an ordinary sentence is one stretch of audio and not six.
 */
export const HANGOVER_MS = 1_200;

/**
 * Frames held back and sent when speech starts, so the recogniser gets the
 * onset. Without this every utterance loses its first consonant, which is worse
 * than losing the utterance: "ตกลง" arriving as "กลง" is a wrong transcript
 * rather than a missing one.
 */
export const PRE_ROLL_FRAMES = 3;

/** Root-mean-square of one 16-bit frame, normalised to 0..1. */
export function frameRms(frame: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const s = frame[i] / 0x8000;
    sum += s * s;
  }
  return Math.sqrt(sum / frame.length);
}

/**
 * The room's noise level: the quietest frame recently seen, capped.
 *
 * `recent` is the caller's ring of the last `NOISE_WINDOW_FRAMES` RMS values,
 * newest anywhere — order does not matter to a minimum. An empty window means
 * nothing has been heard yet, which reads as the absolute floor.
 */
export function noiseFloorFrom(recent: readonly number[]): number {
  if (recent.length === 0) return ABSOLUTE_SPEECH_RMS;
  let min = Infinity;
  for (const value of recent) if (value < min) min = value;
  return Math.min(min, MAX_TRACKED_FLOOR);
}

export function isSpeechFrame(rms: number, noiseFloor: number): boolean {
  return rms > Math.max(ABSOLUTE_SPEECH_RMS, noiseFloor * SPEECH_OVER_FLOOR);
}

/** True while the stream stays open after the last speech frame. */
export function withinHangover(now: number, lastSpeechAt: number): boolean {
  return now - lastSpeechAt < HANGOVER_MS;
}
