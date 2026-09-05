import assert from 'node:assert/strict';
import test from 'node:test';
import { stripJpegExif, stripPngMetadata, stripWebpMetadata } from '../lib/media.ts';

test('stripJpegExif removes APP1 segments', () => {
  const source = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 6, 69, 88, 73, 70, 0xff, 0xd9]);
  assert.deepEqual(Array.from(stripJpegExif(source)), [0xff, 0xd8, 0xff, 0xd9]);
});

test('stripPngMetadata removes textual chunks', () => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const text = [0, 0, 0, 4, 116, 69, 88, 116, 97, 98, 99, 100, 0, 0, 0, 0];
  const iend = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  assert.deepEqual(Array.from(stripPngMetadata(Uint8Array.from([...signature, ...text, ...iend]))), [...signature, ...iend]);
});

test('stripWebpMetadata removes EXIF chunk', () => {
  const header = [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80];
  const exif = [69, 88, 73, 70, 4, 0, 0, 0, 1, 2, 3, 4];
  const output = stripWebpMetadata(Uint8Array.from([...header, ...exif]));
  assert.equal(output.length, 12);
});
