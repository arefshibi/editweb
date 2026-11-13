// Live updates: Postgres LISTEN/NOTIFY -> Server-Sent Events.
// Triggers (migration 014) publish tiny hints {t:topic[,u:userId][,c:conversationId]} on channel `carmaa_live`.
// Every API process listens and forwards them to its connected browsers. Hints carry no content: browsers
// re-fetch through the normal authorised API. Private topics (u set) reach only that user's connections.
import crypto from 'node:crypto';
import pg from 'pg';
import { Router } from 'express';
import { config } from './config.js';
import { authOptional } from './middleware/security.js';

const CHANNEL = 'carmaa_live';
const PUBLIC_TOPICS = new Set(['listings', 'showrooms', 'stories', 'news']);
const PRIVATE_TOPICS = new Set(['notifications', 'messages']);
const MAX_PER_KEY = 6, MAX_TOTAL = 8000, FLUSH_MS = 250, HEARTBEAT_MS = 25_000;
const clients = new Map(); // id -> { res, userId, key }
const perKey = new Map();
let pending = new Map(), flushTimer = null;

function flush() {
  flushTimer = null;
  const batch = [...pending.values()]; pending = new Map();
  for (const ev of batch) {
    const data = `data: ${JSON.stringify(ev.c ? { t: ev.t, c: ev.c } : { t: ev.t })}\n\n`;
    for (const cl of clients.values()) {
      if (ev.u && cl.userId !== ev.u) continue;
      try { cl.res.write(data); } catch { /* connection closing */ }
    }
  }
}
function enqueue(ev) {
  if (!ev || typeof ev.t !== 'string') return;
  const isPrivate = PRIVATE_TOPICS.has(ev.t);
  if (!isPrivate && !PUBLIC_TOPICS.has(ev.t)) return;
  if (isPrivate && typeof ev.u !== 'string') return;
  pending.set(`${ev.t}|${ev.u || ''}|${ev.c || ''}`, { t: ev.t, u: isPrivate ? ev.u : undefined, c: typeof ev.c === 'string' ? ev.c.slice(0, 40) : undefined });
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

let listener = null, stopped = false, retry = 0;
async function startListener() {
  if (stopped) return;
  const client = new pg.Client({
    connectionString: config.DATABASE_URL,
    application_name: 'carmaa-live',
    ssl: config.isProduction && config.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });
  listener = client;
  const again = () => {
    if (listener === client) listener = null;
    try { client.removeAllListeners(); client.on('error', () => {}); client.end().catch(() => {}); } catch { /* ignore */ }
    if (!stopped) setTimeout(startListener, Math.min(30_000, 1000 * 2 ** Math.min(retry++, 5))).unref?.();
  };
  client.on('error', again);
  client.on('end', again);
  client.on('notification', (msg) => { try { enqueue(JSON.parse(msg.payload)); } catch { /* ignore bad payload */ } });
  try { await client.connect(); await client.query(`LISTEN ${CHANNEL}`); retry = 0; }
  catch { again(); }
}
export function startLive() { stopped = false; startListener(); }
export async function stopLive() {
  stopped = true;
  for (const cl of clients.values()) { try { cl.res.end(); } catch { /* ignore */ } }
  clients.clear();
  if (listener) { try { await listener.end(); } catch { /* ignore */ } }
}

const router = Router();
router.get('/', authOptional, (req, res) => {
  const key = req.auth?.userId || req.ip || 'unknown';
  if (clients.size >= MAX_TOTAL || (perKey.get(key) || 0) >= MAX_PER_KEY) return res.status(429).json({ error: { code: 'TOO_MANY_STREAMS', message: 'تعداد اتصال زنده بیش از حد مجاز است.' } });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Content-Encoding': 'identity',   // keeps proxies from compressing/buffering the stream
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n: connected\n\n');
  const id = crypto.randomUUID();
  clients.set(id, { res, userId: req.auth?.userId || null, key });
  perKey.set(key, (perKey.get(key) || 0) + 1);
  const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(beat); clients.delete(id);
    const n = (perKey.get(key) || 1) - 1; if (n <= 0) perKey.delete(key); else perKey.set(key, n);
  });
});
export default router;
