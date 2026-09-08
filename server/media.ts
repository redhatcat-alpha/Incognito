import { stripJpegExif, stripPngMetadata, stripWebpMetadata } from '@/lib/media';

export const MEDIA_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type MediaContentType = keyof typeof MEDIA_TYPES;
export type MediaExtension = (typeof MEDIA_TYPES)[MediaContentType];

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_INTENT_TTL_MS = 15 * 60 * 1000;

export function extensionForContentType(contentType: string): MediaExtension | null {
  return MEDIA_TYPES[contentType as MediaContentType] ?? null;
}

export function hasValidSignature(bytes: Uint8Array, extension: MediaExtension): boolean {
  if (extension === 'jpg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export function stripMediaMetadata(source: Uint8Array, extension: MediaExtension): Uint8Array {
  if (extension === 'jpg') return stripJpegExif(source);
  if (extension === 'png') return stripPngMetadata(source);
  return stripWebpMetadata(source);
}
