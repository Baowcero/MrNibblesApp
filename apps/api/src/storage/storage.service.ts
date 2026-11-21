import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { AppError } from '../common/app-error.js';

const TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  'image/webp': {
    ext: 'webp',
    magic: (b: Buffer) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
} as const;
export const PHOTO_CONTENT_TYPES = Object.keys(TYPES);

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const KEY_PATTERN = /^deliveries\/([0-9a-f-]{36})\/\d{4}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Returns the distributor id inside a delivery photo key, or null if the key is not a valid photo key. */
export function parsePhotoKey(key: string): { distributorId: string; mime: string } | null {
  const m = KEY_PATTERN.exec(key);
  return m ? { distributorId: m[1]!, mime: MIME_BY_EXT[m[2]!]! } : null;
}

/**
 * Photo storage. Files are kept on disk under STORAGE_DIR (default ./storage).
 * TODO: add the DigitalOcean Spaces driver (S3 compatible) before production, behind this same interface.
 */
@Injectable()
export class StorageService {
  private root = () => resolve(process.env.STORAGE_DIR ?? './storage');

  private path(key: string): string {
    const full = resolve(join(this.root(), key));
    if (!full.startsWith(this.root() + '/')) throw new AppError(400, 'invalid_key', 'Invalid file key');
    return full;
  }

  async putDeliveryPhoto(distributorId: string, body: unknown, contentType: string | undefined) {
    const type = TYPES[(contentType ?? '').split(';')[0]!.trim() as keyof typeof TYPES];
    if (!type) throw new AppError(415, 'unsupported_media_type', 'Send a JPEG, PNG or WebP photo');
    if (!Buffer.isBuffer(body) || body.length === 0) throw new AppError(400, 'empty_photo', 'No photo received');
    if (!type.magic(body)) throw new AppError(400, 'invalid_photo', 'That file is not a valid photo');

    const key = `deliveries/${distributorId}/${new Date().getUTCFullYear()}/${randomUUID()}.${type.ext}`;
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
    return { key, size: body.length };
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.path(key))).isFile();
    } catch {
      return false;
    }
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }
}
