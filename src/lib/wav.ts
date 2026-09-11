/**
 * 16-bit mono PCM as a WAV file.
 *
 * The clip route decodes with Google's `autoDecodingConfig`, which needs a
 * container: raw PCM carries no sample rate. `Int16Array` buffers are
 * little-endian on every platform Stratis runs on, which is what WAV stores.
 */
export function encodeWav(frames: ArrayBuffer[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = frames.reduce((n, f) => n + f.byteLength, 0);
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (const f of frames) {
    out.set(new Uint8Array(f), offset);
    offset += f.byteLength;
  }
  return out;
}
