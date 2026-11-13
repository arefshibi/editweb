import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';

const useS3 = Boolean(config.S3_BUCKET && config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY);
const s3 = useS3 ? new S3Client({
  region: config.S3_REGION,
  endpoint: config.S3_ENDPOINT || undefined,
  forcePathStyle: config.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
}) : null;

export async function initMedia() {
  if (!useS3) await fs.mkdir(config.mediaRoot, { recursive: true, mode: 0o750 });
}
const MEDIA_KEY_RE = /^[0-9a-f-]{36}\.(webp|webm|ogg|m4a)$/i;
const MEDIA_TYPES = { webp: 'image/webp', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4' };
export async function saveMedia(key, buffer) {
  if (!MEDIA_KEY_RE.test(key)) throw new Error('Invalid generated media key');
  if (useS3) {
    const ext = key.split('.').pop().toLowerCase();
    await s3.send(new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: `media/${key}`, Body: buffer, ContentType: MEDIA_TYPES[ext], CacheControl: 'public, max-age=31536000, immutable' }));
    return;
  }
  const dest = path.resolve(config.mediaRoot, key);
  if (!dest.startsWith(path.resolve(config.mediaRoot) + path.sep)) throw new Error('Invalid media path');
  await fs.writeFile(dest, buffer, { flag: 'wx', mode: 0o640 });
}
export async function removeMedia(key) {
  if (!MEDIA_KEY_RE.test(key)) return;
  if (useS3) await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: `media/${key}` })).catch(() => {});
  else await fs.unlink(path.resolve(config.mediaRoot, key)).catch(() => {});
}
export function mediaUrl(key) { return `${config.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '')}/${encodeURIComponent(key)}`; }
export function mediaUsesS3() { return useS3; }
