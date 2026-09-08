import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const mediaRoot = resolve(process.env.MEDIA_DIR || 'data/media');

function safePath(objectKey: string): string {
  const normalized = objectKey.replaceAll('\\', '/').replace(/^\/+/, '');
  const path = resolve(mediaRoot, normalized);
  if (path !== mediaRoot && !path.startsWith(`${mediaRoot}/`)) throw new Error('MEDIA_FILE_INVALID');
  return path;
}

export async function writeLocalObject(objectKey: string, bytes: Uint8Array): Promise<void> {
  const path = safePath(objectKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function readLocalObject(objectKey: string): Promise<Buffer | null> {
  try {
    return await readFile(safePath(objectKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function statLocalObject(objectKey: string): Promise<{ size: number } | null> {
  try {
    const result = await stat(safePath(objectKey));
    return { size: result.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
