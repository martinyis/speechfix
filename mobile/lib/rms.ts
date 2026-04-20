const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LUT = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) B64_LUT[B64.charCodeAt(i)] = i;

export function computeRMS(base64: string): number {
  const clean = base64.replace(/[=\s]/g, '');
  const n = clean.length;
  const byteLen = (n * 3) >> 2;
  if (byteLen < 2) return 0;

  let sumSq = 0;
  let sampleCount = 0;
  let byteIdx = 0;
  let prevByte = 0;

  for (let i = 0; i < n; i += 4) {
    const a = B64_LUT[clean.charCodeAt(i)];
    const b = i + 1 < n ? B64_LUT[clean.charCodeAt(i + 1)] : 0;
    const c = i + 2 < n ? B64_LUT[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < n ? B64_LUT[clean.charCodeAt(i + 3)] : 0;

    const b0 = (a << 2) | (b >> 4);
    const b1 = ((b & 15) << 4) | (c >> 2);
    const b2 = ((c & 3) << 6) | d;

    const triplet = [b0, b1, b2];
    const count = i + 2 < n ? (i + 3 < n ? 3 : 2) : 1;

    for (let j = 0; j < count; j++) {
      if (byteIdx % 2 === 1) {
        let sample = (triplet[j] << 8) | prevByte;
        if (sample >= 0x8000) sample -= 0x10000;
        sumSq += sample * sample;
        sampleCount++;
      }
      prevByte = triplet[j];
      byteIdx++;
    }
  }

  if (sampleCount === 0) return 0;
  const rms = Math.sqrt(sumSq / sampleCount);
  const linear = Math.min(rms / 1500, 1);
  return Math.pow(linear, 0.6);
}
