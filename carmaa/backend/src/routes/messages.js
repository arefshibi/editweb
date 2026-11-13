import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { parsePositiveInt } from '../util.js';
import { validateUuidParam } from '../validation.js';
import { saveMedia, removeMedia, mediaUrl } from '../services/media.js';
import { notifyNewMessageBySms } from '../services/message-sms.js';

const router = Router();
router.param('id', validateUuidParam);
router.param('mid', validateUuidParam);
const messageLimit = createRateLimiter({ name: 'send-message', windowSeconds: 60, max: 30, key: (req) => req.auth?.userId || req.ip });
const summarySql = `SELECT c.id,c.buyer_id,c.seller_id,c.listing_id,c.created_at,c.updated_at,
 CASE WHEN l.id IS NULL THEN jsonb_build_object('id','','title','گفتگوی مستقیم','storyChat',true) ELSE
 jsonb_build_object('id',l.id,'title',l.title,'year',l.year,'city',l.city,'price_toman',l.price_toman,
  'photo', (SELECT i.public_url FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=l.id ORDER BY li.position LIMIT 1)) END AS listing,
 CASE WHEN c.buyer_id=$1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,
 CASE WHEN c.buyer_id=$1 THEN COALESCE(NULLIF(seller.nickname,''),seller.display_name) ELSE COALESCE(NULLIF(buyer.nickname,''),buyer.display_name) END AS other_name,
 CASE WHEN c.buyer_id=$1 THEN seller.avatar_url ELSE buyer.avatar_url END AS other_avatar,
 (SELECT CASE m.kind WHEN 'image' THEN COALESCE(NULLIF(m.body,''),'📷 عکس') WHEN 'voice' THEN '🎤 پیام صوتی' ELSE m.body END FROM messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND m.created_at>COALESCE(cc.cleared_at,'epoch'::timestamptz) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
 (SELECT max(created_at) FROM messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND m.created_at>COALESCE(cc.cleared_at,'epoch'::timestamptz)) AS last_message_at,
 (SELECT count(*)::int FROM messages m LEFT JOIN conversation_reads cr ON cr.conversation_id=m.conversation_id AND cr.user_id=$1
  WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.deleted_at IS NULL AND m.created_at>COALESCE(cr.last_read_at,'epoch'::timestamptz) AND m.created_at>COALESCE(cc.cleared_at,'epoch'::timestamptz)) AS unread_count
 FROM conversations c LEFT JOIN listings l ON l.id=c.listing_id JOIN users buyer ON buyer.id=c.buyer_id JOIN users seller ON seller.id=c.seller_id LEFT JOIN conversation_clears cc ON cc.conversation_id=c.id AND cc.user_id=$1`;

router.use(authRequired);
router.get('/conversations', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 2_000), pageSize = parsePositiveInt(req.query.page_size, 50, 100), offset=(page-1)*pageSize;
    const { rows } = await pool.query(`${summarySql} WHERE (c.buyer_id=$1 OR c.seller_id=$1) AND (cc.cleared_at IS NULL OR EXISTS(SELECT 1 FROM messages mm WHERE mm.conversation_id=c.id AND mm.deleted_at IS NULL AND mm.created_at>cc.cleared_at)) ORDER BY c.updated_at DESC LIMIT ${pageSize} OFFSET ${offset}`, [req.auth.userId]);
    res.json({ items: rows, page, pageSize });
  } catch (error) { next(error); }
});

router.post('/conversations/direct', async (req, res, next) => {
  try {
    const parsed = z.object({ user_id: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_USER', message: 'کاربر مقصد معتبر نیست.' } });
    const targetId = parsed.data.user_id;
    if (targetId === req.auth.userId) return res.status(400).json({ error: { code: 'SELF_CHAT', message: 'نمی‌توانید با خودتان گفتگو بسازید.' } });
    const conversation = await transaction(async (client) => {
      const pair = [req.auth.userId, targetId].sort();
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`direct-chat:${pair[0]}:${pair[1]}`]);
      const target = await client.query("SELECT id FROM users WHERE id=$1 AND status='active' AND deleted_at IS NULL", [targetId]);
      if (!target.rows[0]) throw Object.assign(new Error('کاربر پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      const blocked = await client.query('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1', [req.auth.userId, targetId]);
      if (blocked.rows[0]) throw Object.assign(new Error('امکان شروع این گفتگو وجود ندارد.'), { status: 403, code: 'CHAT_BLOCKED' });
      const existing = await client.query(`SELECT id FROM conversations WHERE ((buyer_id=$1 AND seller_id=$2) OR (buyer_id=$2 AND seller_id=$1)) ORDER BY (listing_id IS NULL) DESC, updated_at DESC LIMIT 1`, [req.auth.userId, targetId]);
      if (existing.rows[0]) return existing.rows[0];
      const created = await client.query('INSERT INTO conversations(listing_id,buyer_id,seller_id) VALUES(NULL,$1,$2) RETURNING id', [req.auth.userId, targetId]);
      return created.rows[0];
    });
    const { rows } = await pool.query(`${summarySql} WHERE c.id=$2 AND (c.buyer_id=$1 OR c.seller_id=$1)`, [req.auth.userId, conversation.id]);
    res.status(201).json({ conversation: rows[0] });
  } catch (error) { next(error); }
});

router.post('/conversations', async (req, res, next) => {
  try {
    const parsed = z.object({ listing_id: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_LISTING', message: 'آگهی معتبر نیست.' } });
    const result = await transaction(async (client) => {
      const { rows } = await client.query("SELECT id,owner_id,status FROM listings WHERE id=$1 AND status='published' AND expires_at>now() FOR SHARE", [parsed.data.listing_id]);
      const listing = rows[0];
      if (!listing) throw Object.assign(new Error('آگهی پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      if (listing.owner_id === req.auth.userId) throw Object.assign(new Error('نمی‌توانید با خودتان گفتگو بسازید.'), { status: 400, code: 'SELF_CHAT' });
      const blocked = await client.query('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1', [req.auth.userId, listing.owner_id]);
      if (blocked.rows[0]) throw Object.assign(new Error('امکان شروع این گفتگو وجود ندارد.'), { status: 403, code: 'CHAT_BLOCKED' });
      const pair = [req.auth.userId, listing.owner_id].sort();
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`direct-chat:${pair[0]}:${pair[1]}`]);
      const existing = await client.query(
        `SELECT id FROM conversations WHERE ((buyer_id=$1 AND seller_id=$2) OR (buyer_id=$2 AND seller_id=$1)) ORDER BY (listing_id IS NULL) DESC, updated_at DESC LIMIT 1`,
        [req.auth.userId, listing.owner_id]);
      if (existing.rows[0]) return existing.rows[0];
      const { rows: convRows } = await client.query(
        `INSERT INTO conversations(listing_id,buyer_id,seller_id) VALUES($1,$2,$3)
         ON CONFLICT(listing_id,buyer_id,seller_id) DO UPDATE SET updated_at=conversations.updated_at RETURNING id`,
        [listing.id, req.auth.userId, listing.owner_id]);
      return convRows[0];
    });
    const { rows } = await pool.query(`${summarySql} WHERE c.id=$2 AND (c.buyer_id=$1 OR c.seller_id=$1)`, [req.auth.userId, result.id]);
    res.status(201).json({ conversation: rows[0] });
  } catch (error) { next(error); }
});

// Delete a conversation for ME only: older messages are hidden for this user, the other person keeps everything.
router.delete('/conversations/:id', messageLimit, async (req, res, next) => {
  try {
    const member = await pool.query('SELECT 1 FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)', [req.params.id, req.auth.userId]);
    if (!member.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    await pool.query('INSERT INTO conversation_clears(conversation_id,user_id,cleared_at) VALUES($1,$2,now()) ON CONFLICT (conversation_id,user_id) DO UPDATE SET cleared_at=now()', [req.params.id, req.auth.userId]);
    res.json({ deleted: true });
  } catch (error) { next(error); }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${summarySql} WHERE c.id=$2 AND (c.buyer_id=$1 OR c.seller_id=$1) LIMIT 1`, [req.auth.userId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    res.json({ conversation: rows[0] });
  } catch (error) { next(error); }
});

router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const member = await pool.query('SELECT 1 FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)', [req.params.id, req.auth.userId]);
    if (!member.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    // Read receipts: the other participant's last_read_at decides whether MY messages were seen.
    const otherRead = await pool.query('SELECT last_read_at FROM conversation_reads WHERE conversation_id=$1 AND user_id<>$2 LIMIT 1', [req.params.id, req.auth.userId]);
    const otherReadAt = otherRead.rows[0] ? otherRead.rows[0].last_read_at : null;
    const { rows } = await pool.query(
      `SELECT m.id,m.body AS text,m.created_at,(m.sender_id=$2) AS is_mine,m.sender_id,
        (m.sender_id=$2 AND $3::timestamptz IS NOT NULL AND m.created_at<=$3::timestamptz) AS is_read,
        m.edited_at,m.kind,m.media_url,m.media_mime,m.media_meta,m.story_ref,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('emoji',t.emoji,'count',t.n) ORDER BY t.n DESC) FROM (SELECT emoji,count(*)::int AS n FROM message_likes ml WHERE ml.message_id=m.id GROUP BY emoji) t),'[]'::jsonb) AS reactions,
        (SELECT emoji FROM message_likes ml WHERE ml.message_id=m.id AND ml.user_id=$2) AS my_reaction
       FROM messages m WHERE m.conversation_id=$1 AND m.deleted_at IS NULL AND m.created_at>COALESCE((SELECT cc.cleared_at FROM conversation_clears cc WHERE cc.conversation_id=$1 AND cc.user_id=$2),'epoch'::timestamptz) ORDER BY m.created_at DESC LIMIT ${limit}`,
      [req.params.id, req.auth.userId, otherReadAt]);
    res.json({ items: rows.reverse().map(shapeMessage), other_last_read_at: otherReadAt });
  } catch (error) { next(error); }
});

// Photos / voice messages and story snapshots travel as extra columns; the client only ever sees the shaped form.
function shapeMessage(row) {
  const { media_url: url, media_mime: mime, media_meta: meta, story_ref: story, ...rest } = row;
  return { ...rest, media: url ? { type: rest.kind, url, mime, ...(meta || {}) } : null, story: story || null };
}

async function insertMessage(req, conversationId, { body, kind = 'text', media = null, storyId = null }) {
  let notifyTo = null;
  let notifyMeta = null;
  const result = await transaction(async (client) => {
    const { rows } = await client.query('SELECT id,buyer_id,seller_id FROM conversations WHERE id=$1 FOR UPDATE', [conversationId]);
    const c = rows[0];
    if (!c || (c.buyer_id !== req.auth.userId && c.seller_id !== req.auth.userId)) throw Object.assign(new Error('گفتگو پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
    const other = c.buyer_id === req.auth.userId ? c.seller_id : c.buyer_id;
    const block = await client.query('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1', [req.auth.userId, other]);
    if (block.rows[0]) throw Object.assign(new Error('امکان ارسال پیام وجود ندارد.'), { status: 403, code: 'CHAT_BLOCKED' });
    // Serialize a user's send quota across different concurrent conversations.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`message-send:${req.auth.userId}`]);
    const recent = await client.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE kind<>'text' AND created_at > now()-interval '1 day')::int AS media FROM messages WHERE sender_id=$1 AND created_at > now()-interval '1 day'", [req.auth.userId]);
    const lastMinute = await client.query("SELECT count(*)::int AS n FROM messages WHERE sender_id=$1 AND created_at > now()-interval '1 minute'", [req.auth.userId]);
    if (lastMinute.rows[0].n >= 20) throw Object.assign(new Error('تعداد پیام‌ها در مدت کوتاه بیش از حد مجاز است.'), { status: 429, code: 'MESSAGE_RATE_LIMIT' });
    if (kind !== 'text' && recent.rows[0].media >= 150) throw Object.assign(new Error('سقف ارسال عکس و پیام صوتی امروز پر شده است.'), { status: 429, code: 'MEDIA_DAILY_LIMIT' });
    // The story snapshot is built from the database, never from client-supplied URLs or captions.
    let storyRef = null;
    if (storyId) {
      const st = await client.query('SELECT s.id,s.caption,i.public_url FROM stories s JOIN images i ON i.id=s.image_id WHERE s.id=$1 AND s.owner_id=$2 AND s.expires_at>now()', [storyId, other]);
      if (!st.rows[0]) throw Object.assign(new Error('این استوری دیگر در دسترس نیست.'), { status: 404, code: 'STORY_NOT_FOUND' });
      storyRef = { id: st.rows[0].id, thumb: st.rows[0].public_url, caption: String(st.rows[0].caption || '').slice(0, 80) };
    }
    const { rows: created } = await client.query(
      `INSERT INTO messages(conversation_id,sender_id,body,kind,media_url,media_mime,media_meta,story_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,body AS text,created_at,(sender_id=$2) AS is_mine,kind,media_url,media_mime,media_meta,story_ref`,
      [c.id, req.auth.userId, body, kind, media?.url || null, media?.mime || null, media?.meta ? JSON.stringify(media.meta) : null, storyRef ? JSON.stringify(storyRef) : null]);
    await client.query('UPDATE conversations SET updated_at=now() WHERE id=$1', [c.id]);
    await client.query('INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,\'message\',\'پیام جدید\',\'پیام جدیدی برای شما ارسال شده است.\',$2)', [other, { conversationId: c.id, messageId: created[0].id }]);
    notifyTo = other;
    notifyMeta = { conversationId: c.id, messageId: created[0].id };
    return shapeMessage(created[0]);
  });
  if (notifyTo) notifyNewMessageBySms(notifyTo, notifyMeta);
  return result;
}

router.post('/conversations/:id/messages', messageLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ text: z.string().trim().min(1).max(3000), story_id: z.string().uuid().optional() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_MESSAGE', message: 'متن پیام باید بین ۱ تا ۳۰۰۰ نویسه باشد.' } });
    const message = await insertMessage(req, req.params.id, { body: parsed.data.text, storyId: parsed.data.story_id || null });
    res.status(201).json({ message });
  } catch (error) { next(error); }
});

// Photo / voice message: multipart with `file` plus kind, caption?, duration?, wave?.
const mediaLimit = createRateLimiter({ name: 'chat-media', windowSeconds: 3600, max: 60, key: (req) => req.auth?.userId || req.ip });
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 6, parts: 8 } });
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Magic-byte results for browser recordings: Chrome/Firefox give webm/ogg, Safari gives an mp4 container.
const AUDIO_EXT = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'video/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'video/mp4': 'm4a' };
const mediaFields = z.object({
  kind: z.enum(['image', 'voice']),
  caption: z.string().trim().max(1000).optional().default(''),
  duration: z.coerce.number().min(0).max(180).optional(),
  wave: z.string().regex(/^[0-9](,[0-9]){0,63}$/).optional()
}).strict();

router.post('/conversations/:id/media', mediaLimit, (req, res, next) => {
  mediaUpload.single('file')(req, res, (uploadError) => {
    if (uploadError) return res.status(400).json({ error: { code: 'INVALID_UPLOAD', message: 'فایل ارسالی معتبر نیست یا حجم آن بیش از ۴ مگابایت است.' } });
    next();
  });
}, async (req, res, next) => {
  let key;
  try {
    const fields = mediaFields.safeParse(req.body);
    if (!fields.success || !req.file?.buffer) return res.status(400).json({ error: { code: 'INVALID_MEDIA', message: 'فایل یا اطلاعات ارسال معتبر نیست.' } });
    const member = await pool.query('SELECT 1 FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)', [req.params.id, req.auth.userId]);
    if (!member.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    const type = await fileTypeFromBuffer(req.file.buffer);
    const { kind, caption, duration, wave } = fields.data;
    let data, mime, meta;
    if (kind === 'image') {
      if (!type || !IMAGE_TYPES.has(type.mime)) return res.status(400).json({ error: { code: 'INVALID_IMAGE', message: 'نوع فایل تصویر پشتیبانی نمی‌شود.' } });
      const metadata = await sharp(req.file.buffer, { limitInputPixels: 25_000_000, failOn: 'error' }).metadata();
      if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000) return res.status(400).json({ error: { code: 'INVALID_IMAGE_DIMENSIONS', message: 'ابعاد تصویر معتبر نیست.' } });
      const out = await sharp(req.file.buffer, { limitInputPixels: 25_000_000, failOn: 'error' })
        .rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
      key = `${crypto.randomUUID()}.webp`; data = out.data; mime = 'image/webp'; meta = { w: out.info.width, h: out.info.height };
    } else {
      const ext = type && AUDIO_EXT[type.mime];
      if (!ext || req.file.buffer.length < 600) return res.status(400).json({ error: { code: 'INVALID_AUDIO', message: 'فرمت پیام صوتی پشتیبانی نمی‌شود.' } });
      if (!duration || duration < 0.5) return res.status(400).json({ error: { code: 'INVALID_AUDIO', message: 'پیام صوتی خیلی کوتاه است.' } });
      key = `${crypto.randomUUID()}.${ext}`; data = req.file.buffer; mime = ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
      meta = { dur: Math.round(duration * 10) / 10, ...(wave ? { wave: wave.split(',').map(Number) } : {}) };
    }
    await saveMedia(key, data);
    const message = await insertMessage(req, req.params.id, { body: kind === 'image' ? caption : '', kind, media: { url: mediaUrl(key), mime, meta } });
    res.status(201).json({ message });
  } catch (error) {
    if (key) await removeMedia(key);
    if (error?.name === 'Error' && /unsupported image format|Input buffer contains unsupported image format|corrupt|VipsJpeg/.test(error.message)) {
      return res.status(400).json({ error: { code: 'INVALID_IMAGE', message: 'فایل تصویر سالم نیست.' } });
    }
    next(error);
  }
});

// Typing indicator: short-lived, in-memory (a typing state is only useful for a few seconds,
// so it is intentionally not stored in the database).
const TYPING_TTL_MS = 5000;
const typingState = new Map(); // `${conversationId}:${userId}` -> timestamp
setInterval(() => { const now = Date.now(); for (const [k, t] of typingState) if (now - t > TYPING_TTL_MS * 4) typingState.delete(k); }, 30000).unref?.();
const typingLimit = createRateLimiter({ name: 'typing', windowSeconds: 60, max: 60, key: (req) => req.auth?.userId || req.ip });
async function typingPeers(conversationId, userId) {
  const { rows } = await pool.query('SELECT buyer_id,seller_id FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)', [conversationId, userId]);
  const c = rows[0];
  return c ? (c.buyer_id === userId ? c.seller_id : c.buyer_id) : null;
}
router.post('/conversations/:id/typing', typingLimit, async (req, res, next) => {
  try {
    const other = await typingPeers(req.params.id, req.auth.userId);
    if (!other) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    if (req.body && req.body.typing === false) typingState.delete(`${req.params.id}:${req.auth.userId}`);
    else typingState.set(`${req.params.id}:${req.auth.userId}`, Date.now());
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.get('/conversations/:id/typing', async (req, res, next) => {
  try {
    const other = await typingPeers(req.params.id, req.auth.userId);
    if (!other) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    const t = typingState.get(`${req.params.id}:${other}`);
    // Piggy-back the other person's last_read_at so "seen" updates arrive on the 2 s typing poll.
    const rd = await pool.query('SELECT last_read_at FROM conversation_reads WHERE conversation_id=$1 AND user_id=$2', [req.params.id, other]);
    res.json({ typing: Boolean(t && Date.now() - t < TYPING_TTL_MS), other_read_at: rd.rows[0] ? rd.rows[0].last_read_at : null });
  } catch (error) { next(error); }
});

// Reactions: one emoji per user per message (either participant may react to any message of the conversation).
const REACTION_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '😢', '🔥'];
const EDIT_WINDOW_HOURS = 24;
const likeLimit = createRateLimiter({ name: 'message-like', windowSeconds: 60, max: 90, key: (req) => req.auth?.userId || req.ip });
const editLimit = createRateLimiter({ name: 'message-edit', windowSeconds: 60, max: 30, key: (req) => req.auth?.userId || req.ip });
async function reactionSummary(messageId, userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('emoji',emoji,'count',n) ORDER BY n DESC) FROM (SELECT emoji,count(*)::int AS n FROM message_likes WHERE message_id=$1 GROUP BY emoji) t),'[]'::jsonb) AS reactions,
            (SELECT emoji FROM message_likes WHERE message_id=$1 AND user_id=$2) AS my_reaction`, [messageId, userId]);
  return rows[0];
}
async function setReaction(req, res, next, emoji) {
  try {
    const msg = await pool.query(
      `SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id
       WHERE m.id=$1 AND m.conversation_id=$2 AND m.deleted_at IS NULL AND (c.buyer_id=$3 OR c.seller_id=$3)`, [req.params.mid, req.params.id, req.auth.userId]);
    if (!msg.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'پیام پیدا نشد.' } });
    if (emoji) await pool.query('INSERT INTO message_likes(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji', [req.params.mid, req.auth.userId, emoji]);
    else await pool.query('DELETE FROM message_likes WHERE message_id=$1 AND user_id=$2', [req.params.mid, req.auth.userId]);
    res.json(await reactionSummary(req.params.mid, req.auth.userId));
  } catch (error) { next(error); }
}
router.post('/conversations/:id/messages/:mid/react', likeLimit, async (req, res, next) => {
  const parsed = z.object({ emoji: z.string().max(16).nullable() }).strict().safeParse(req.body);
  if (!parsed.success || (parsed.data.emoji !== null && !REACTION_EMOJIS.includes(parsed.data.emoji))) return res.status(400).json({ error: { code: 'INVALID_REACTION', message: 'واکنش نامعتبر است.' } });
  return setReaction(req, res, next, parsed.data.emoji);
});
// Backward-compatible heart endpoint.
router.post('/conversations/:id/messages/:mid/like', likeLimit, async (req, res, next) => {
  const parsed = z.object({ liked: z.boolean() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_LIKE', message: 'درخواست نامعتبر است.' } });
  return setReaction(req, res, next, parsed.data.liked ? '❤️' : null);
});

// Edit own message (text only, within EDIT_WINDOW_HOURS).
router.patch('/conversations/:id/messages/:mid', editLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ text: z.string().trim().min(1).max(3000) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_MESSAGE', message: 'متن پیام باید بین ۱ تا ۳۰۰۰ نویسه باشد.' } });
    const { rows } = await pool.query(
      `UPDATE messages m SET body=$4, edited_at=now()
       FROM conversations c
       WHERE m.id=$1 AND m.conversation_id=$2 AND c.id=m.conversation_id AND (c.buyer_id=$3 OR c.seller_id=$3)
         AND m.sender_id=$3 AND m.kind='text' AND m.deleted_at IS NULL AND m.created_at > now() - make_interval(hours => ${EDIT_WINDOW_HOURS})
       RETURNING m.id, m.body AS text, m.created_at, m.edited_at, true AS is_mine`, [req.params.mid, req.params.id, req.auth.userId, parsed.data.text]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_EDITABLE', message: 'این پیام قابل ویرایش نیست.' } });
    res.json({ message: rows[0] });
  } catch (error) { next(error); }
});

// Delete own message for everyone (soft delete; keeps the row for abuse reports).
router.delete('/conversations/:id/messages/:mid', editLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE messages m SET deleted_at=now() FROM conversations c
       WHERE m.id=$1 AND m.conversation_id=$2 AND c.id=m.conversation_id AND (c.buyer_id=$3 OR c.seller_id=$3)
         AND m.sender_id=$3 AND m.deleted_at IS NULL RETURNING m.id`, [req.params.mid, req.params.id, req.auth.userId]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'پیام پیدا نشد.' } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/conversations/:id/read', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO conversation_reads(conversation_id,user_id,last_read_at)
       SELECT id,$2,now() FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)
       ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_read_at=now() RETURNING conversation_id`, [req.params.id, req.auth.userId]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'گفتگو پیدا نشد.' } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.delete('/users/:id/block', messageLimit, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.auth.userId, req.params.id]);
    res.json({ blocked: false });
  } catch (error) { next(error); }
});
router.get('/blocks', async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT u.id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS display_name,u.username,b.created_at FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC LIMIT 200", [req.auth.userId]);
    res.json({ items: rows });
  } catch (error) { next(error); }
});

router.post('/users/:id/block', messageLimit, async (req, res, next) => {
  try {
    if (req.params.id === req.auth.userId) return res.status(400).json({ error: { code: 'INVALID_BLOCK', message: 'این عملیات معتبر نیست.' } });
    const other = await pool.query("SELECT id FROM users WHERE id=$1 AND status='active'", [req.params.id]);
    if (!other.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'کاربر پیدا نشد.' } });
    await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.auth.userId, req.params.id]);
    res.json({ blocked: true });
  } catch (error) { next(error); }
});

// Reports are created through /api/v1/reports, which validates referenced resources and membership.

export default router;
