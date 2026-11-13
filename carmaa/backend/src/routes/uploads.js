import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { Router } from 'express';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { saveMedia, removeMedia, mediaUrl } from '../services/media.js';

const router = Router();
const uploadLimit = createRateLimiter({ name: 'image-upload', windowSeconds: 3600, max: 40, key: (req) => req.auth?.userId || req.ip });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 1, fields: 2, parts: 3 }, fileFilter: (_req, file, cb) => {
  // Content type is checked again against the magic bytes after buffering.
  if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype)) return cb(new Error('Unsupported image content type'));
  cb(null, true);
} });

router.post('/images', authRequired, uploadLimit, (req, res, next) => {
  upload.single('file')(req, res, (uploadError) => {
    if (uploadError) return res.status(400).json({ error: { code: 'INVALID_UPLOAD', message: 'تصویر باید JPEG، PNG یا WebP و حداکثر ۶ مگابایت باشد.' } });
    next();
  });
}, async (req, res, next) => {
  let key;
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'فایل تصویر را انتخاب کنید.' } });
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !['image/jpeg','image/png','image/webp'].includes(type.mime)) return res.status(400).json({ error: { code: 'INVALID_IMAGE', message: 'نوع فایل تصویر پشتیبانی نمی‌شود.' } });
    const metadata = await sharp(req.file.buffer, { limitInputPixels: 25_000_000, failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000) return res.status(400).json({ error: { code: 'INVALID_IMAGE_DIMENSIONS', message: 'ابعاد تصویر معتبر نیست.' } });
    const output = await sharp(req.file.buffer, { limitInputPixels: 25_000_000, failOn: 'error' })
      .rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (output.data.length > 10 * 1024 * 1024) return res.status(400).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'حجم تصویر پس از پردازش بیش از حد مجاز است.' } });
    key = `${crypto.randomUUID()}.webp`;
    await saveMedia(key, output.data);
    const image = await transaction(async (client) => {
      // Serializes the quota check for this owner so parallel uploads cannot bypass it.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`image-quota:${req.auth.userId}`]);
      const usage = await client.query('SELECT count(*)::int AS count,coalesce(sum(byte_size),0)::bigint AS bytes FROM images WHERE owner_id=$1', [req.auth.userId]);
      const count = Number(usage.rows[0]?.count || 0);
      const bytes = Number(usage.rows[0]?.bytes || 0);
      if (count >= 200 || bytes + output.data.length > 250 * 1024 * 1024) {
        throw Object.assign(new Error('سقف ذخیره‌سازی تصاویر حساب شما پر شده است. تصاویر بدون استفاده را حذف کنید یا با پشتیبانی تماس بگیرید.'), { status: 413, code: 'IMAGE_QUOTA_EXCEEDED' });
      }
      const inserted = await client.query(
        'INSERT INTO images(owner_id,object_key,public_url,mime_type,byte_size,width,height) VALUES($1,$2,$3,\'image/webp\',$4,$5,$6) RETURNING id,public_url,mime_type,byte_size,width,height,created_at',
        [req.auth.userId,key,mediaUrl(key),output.data.length,output.info.width,output.info.height]);
      return inserted.rows[0];
    });
    res.status(201).json({ image });
  } catch (error) {
    if (key) await removeMedia(key);
    if (error?.name === 'Error' && /unsupported image format|Input buffer contains unsupported image format|corrupt|VipsJpeg/.test(error.message)) {
      return res.status(400).json({ error: { code: 'INVALID_IMAGE', message: 'فایل تصویر سالم نیست.' } });
    }
    next(error);
  }
});

router.get('/mine', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,public_url,mime_type,byte_size,width,height,created_at FROM images WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 200', [req.auth.userId]);
    res.json({ items: rows });
  } catch (error) { next(error); }
});

export default router;
