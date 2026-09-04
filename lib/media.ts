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

function chunkType(input: Uint8Array, offset: number): string {
  return String.fromCharCode(...input.slice(offset + 4, offset + 8));
}

/** Strip common textual/EXIF chunks from PNG while preserving image data. */
export function stripPngMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 24) return input;
  const output: number[] = Array.from(input.slice(0, 8));
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0);
    const end = offset + 12 + length;
    if (end > input.length) return input;
    const type = chunkType(input, offset);
    if (!['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) output.push(...input.slice(offset, end));
    offset = end;
  }
  return new Uint8Array(output);
}

/** Strip EXIF/XMP chunks from RIFF WebP. */
export function stripWebpMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 12) return input;
  const output: number[] = Array.from(input.slice(0, 12));
  let offset = 12;
  while (offset + 8 <= input.length) {
    const type = String.fromCharCode(...input.slice(offset, offset + 4));
    const size = new DataView(input.buffer, input.byteOffset + offset + 4, 4).getUint32(0, true);
    const end = offset + 8 + size + (size % 2);
    if (end > input.length) return input;
    if (type !== 'EXIF' && type !== 'XMP ') output.push(...input.slice(offset, end));
    offset = end;
  }
  const view = new DataView(new Uint8Array(output).buffer);
  view.setUint32(4, output.length - 8, true);
  return new Uint8Array(output);
}
