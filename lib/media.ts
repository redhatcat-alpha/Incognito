/** Remove JPEG APP1 (EXIF) segments, including GPS/device metadata. */
export function stripJpegExif(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const output: number[] = [0xff, 0xd8];
  let offset = 2;
  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) { output.push(...input.slice(offset)); break; }
    const marker = input[offset + 1];
    if (marker === 0xda || marker === 0xd9) { output.push(...input.slice(offset)); break; }
    const length = (input[offset + 2] << 8) | input[offset + 3];
    if (length < 2 || offset + 2 + length > input.length) { output.push(...input.slice(offset)); break; }
    if (marker !== 0xe1) output.push(...input.slice(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return new Uint8Array(output);
}
