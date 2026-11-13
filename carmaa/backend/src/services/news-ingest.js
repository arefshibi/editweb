import crypto from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';
import { ALLOWED_HOSTS, allowed, fetchArticle } from '../routes/news.js';

/* Automatic car news:
   1. read every configured RSS/Atom feed (config.NEWS_FEEDS),
   2. for each article not stored yet (newest first, max PER_RUN per cycle) find its real cover photo,
   3. ask the Claude API for a Persian title + short summary + category,
   4. store it in news_items; the site shows it through GET /api/v1/news/items.
   An article is only stored when it has a cover photo AND a successful translation, so a failure just retries next cycle. */

const CATEGORIES = ['خودروهای جدید', 'برقی', 'بازار', 'فراخوان'];
const PER_RUN = 8;
const MAX_AGE_MS = 14 * 24 * 3600_000;
const KEEP_ROWS = 300;
const MAX_FEED_BYTES = 2 * 1024 * 1024;

export function parseFeeds(spec) {
  return String(spec || '').split(',').map((part) => {
    const i = part.indexOf('|');
    if (i < 1) return null;
    const name = part.slice(0, i).trim().slice(0, 80);
    try { const url = new URL(part.slice(i + 1).trim()); return url.protocol === 'https:' && name ? { name, url } : null; } catch { return null; }
  }).filter(Boolean);
}

const decode = (v) => String(v || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const stripTags = (v) => decode(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? m[1] : ''; };

/* Minimal RSS 2.0 / Atom reader: returns [{ title, link, description, published }] */
export function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title'));
    let link = stripTags(tag(b, 'link'));
    if (!link) { const m = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(b); link = m ? decode(m[1]) : ''; }
    const description = stripTags(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content')).slice(0, 1200);
    const when = new Date(stripTags(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    if (!title || !link || Number.isNaN(when.getTime())) continue;
    out.push({ title, link, description, published: when });
  }
  return out;
}

async function readCapped(res, max) {
  const reader = res.body.getReader(); const chunks = []; let total = 0;
  while (total < max) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); total += value.length; }
  try { await reader.cancel(); } catch { /* ignore */ }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CarMaaBot/1.0)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
  if (!res.ok) throw new Error(`feed ${feed.name} HTTP ${res.status}`);
  return parseFeed(await readCapped(res, MAX_FEED_BYTES));
}

const buildPrompt = (item, source) => `You are the editor of a Persian car-news site. Rewrite this article for Persian readers.
Return ONLY a JSON object: {"category": one of ${JSON.stringify(CATEGORIES)}, "title": "<Persian headline, max 110 chars>", "summary": "<Persian summary, 1-2 sentences, max 260 chars>"}
Rules: write in Persian (Farsi) only; use only facts present in the text, never invent numbers or names; keep brand/model names in Latin letters; category "فراخوان" = recalls/safety, "برقی" = EV news, "بازار" = prices/sales/market, otherwise "خودروهای جدید".

Source: ${source}
Title: ${item.title}
Text: ${item.description || '(no text)'}`;
const HAS_PERSIAN = /[؀-ۿ]/;
function guessCategory(text) {
  const t = String(text || '').toLowerCase();
  if (/\brecall|nhtsa|safety defect|rückruf|rueckruf/.test(t)) return 'فراخوان';
  if (/\bev\b|electric|\bbev\b|battery|elektro|tesla|charging|ladesäule|stromer/.test(t)) return 'برقی';
  if (/price|pricing|sales|market|msrp|discount|preis|verkauf|markt/.test(t)) return 'بازار';
  return CATEGORIES[0];
}
export function parseModelReply(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) throw new Error('no JSON in model reply');
  const j = JSON.parse(m[0]);
  const title = String(j.title || '').trim().slice(0, 300);
  const summary = String(j.summary || '').trim().slice(0, 1200);
  if (!title || !HAS_PERSIAN.test(title)) throw new Error('title is not Persian');
  return { category: CATEGORIES.includes(j.category) ? j.category : CATEGORIES[0], title, summary };
}
async function chatCompletions(name, { baseUrl, key, model }, prompt) {
  const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(45_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 700, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
  const data = await res.json();
  return parseModelReply(data?.choices?.[0]?.message?.content);
}
async function anthropicTranslate(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(30_000),
    headers: { 'content-type': 'application/json', 'x-api-key': config.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: config.NEWS_AI_MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}`);
  const data = await res.json();
  return parseModelReply((data.content || []).map((c) => c.text || '').join(''));
}
async function myMemory(text) {
  const q = String(text || '').trim().slice(0, 450);
  if (!q) return '';
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', q); url.searchParams.set('langpair', 'Autodetect|fa');
  if (config.MYMEMORY_EMAIL) url.searchParams.set('de', config.MYMEMORY_EMAIL);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`mymemory HTTP ${res.status}`);
  const data = await res.json();
  const out = String(data?.responseData?.translatedText || '').trim();
  if (Number(data?.responseStatus) !== 200 || !out) throw new Error(`mymemory status ${data?.responseStatus}`);
  return out;
}
async function myMemoryTranslate(item) {
  const title = (await myMemory(item.title)).slice(0, 300);
  if (!HAS_PERSIAN.test(title)) throw new Error('mymemory title is not Persian');
  let summary = '';
  try { summary = item.description ? (await myMemory(item.description.slice(0, 450))).slice(0, 600) : ''; } catch { summary = ''; }
  return { category: guessCategory(`${item.title} ${item.description}`), title, summary };
}
const PROVIDERS = {
  huggingface: { enabled: () => !!config.HF_TOKEN, run: (p) => chatCompletions('huggingface', { baseUrl: config.HF_BASE_URL, key: config.HF_TOKEN, model: config.HF_MODEL }, p) },
  custom: { enabled: () => !!(config.NEWS_LLM_BASE_URL && config.NEWS_LLM_API_KEY && config.NEWS_LLM_MODEL), run: (p) => chatCompletions('custom', { baseUrl: config.NEWS_LLM_BASE_URL, key: config.NEWS_LLM_API_KEY, model: config.NEWS_LLM_MODEL }, p) },
  anthropic: { enabled: () => !!config.ANTHROPIC_API_KEY, run: (p) => anthropicTranslate(p) },
  mymemory: { enabled: () => true, run: (_p, item) => myMemoryTranslate(item) },
};
export const activeProviders = () => String(config.NEWS_PROVIDERS || '').split(',').map((x) => x.trim().toLowerCase()).filter((n) => PROVIDERS[n] && PROVIDERS[n].enabled());
export async function translate(item, source) {
  const prompt = buildPrompt(item, source);
  const errors = [];
  for (const name of activeProviders()) {
    try { const t = await PROVIDERS[name].run(prompt, item); return { ...t, provider: name }; }
    catch (error) { errors.push(`${name}: ${error.message}`); console.warn(JSON.stringify({ level: 'warn', event: 'news_translate_failed', provider: name, message: error.message })); }
  }
  if (config.NEWS_ALLOW_UNTRANSLATED === 'true') {
    return { category: guessCategory(`${item.title} ${item.description}`), title: item.title.slice(0, 300), summary: String(item.description || '').slice(0, 260), provider: 'untranslated' };
  }
  throw new Error(`all translators failed (${errors.join(' | ') || 'none configured'})`);
}

const idFor = (url) => `a${crypto.createHash('sha1').update(url).digest('hex').slice(0, 16)}`;
let running = false;

export async function ingestNews() {
  if (running) return { added: 0, skipped: 'busy' };
  running = true;
  let added = 0, failed = 0, noImage = 0, candidateCount = 0;
  const byProvider = {};
  try {
    const feeds = parseFeeds(config.NEWS_FEEDS);
    feeds.forEach((f) => { ALLOWED_HOSTS.add(f.url.hostname.toLowerCase()); });
    const candidates = [];
    for (const feed of feeds) {
      try {
        for (const it of await fetchFeed(feed)) {
          if (Date.now() - it.published.getTime() > MAX_AGE_MS || it.published.getTime() > Date.now() + 3600_000) continue;
          let u; try { u = new URL(it.link); } catch { continue; }
          u.hash = '';
          if (u.protocol !== 'https:') continue;
          ALLOWED_HOSTS.add(u.hostname.toLowerCase());
          candidates.push({ ...it, link: u.toString(), source: feed.name });
        }
      } catch (error) { console.warn(JSON.stringify({ level: 'warn', event: 'news_feed_failed', feed: feed.name, message: error.message })); }
    }
    candidates.sort((a, b) => b.published - a.published);
    candidateCount = candidates.length;
    const have = new Set((await pool.query('SELECT url FROM news_items WHERE url = ANY($1)', [candidates.map((c) => c.link)])).rows.map((r) => r.url));
    for (const it of candidates.filter((c) => !have.has(c.link))) {
      if (added >= PER_RUN) break;
      try {
        const target = new URL(it.link);
        if (!allowed(target)) continue;
        const image = await fetchArticle(target);
        if (!image) { noImage += 1; continue; }
        const t = await translate(it, it.source);
        await pool.query(
          `INSERT INTO news_items(id,source,url,category,title,summary,image,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (url) DO NOTHING`,
          [idFor(it.link), it.source, it.link, t.category, t.title, t.summary, image, it.published]);
        added += 1; byProvider[t.provider] = (byProvider[t.provider] || 0) + 1;
      } catch (error) { failed += 1; console.warn(JSON.stringify({ level: 'warn', event: 'news_item_failed', url: it.link, message: error.message })); }
    }
    await pool.query('DELETE FROM news_items WHERE id NOT IN (SELECT id FROM news_items ORDER BY published_at DESC LIMIT $1)', [KEEP_ROWS]);
    console.log(JSON.stringify({ level: 'info', event: 'news_ingest_cycle', feeds: feeds.length, candidates: candidateCount, added, failed, noImage, byProvider }));
    return { added, failed, noImage, byProvider };
  } finally { running = false; }
}

let timer = null;
export function startNewsIngest() {
  if (!config.NEWS_INGEST_MINUTES || config.NODE_ENV === 'test') return;
  console.log(JSON.stringify({ level: 'info', event: 'news_ingest_enabled', providers: activeProviders() }));
  const run = () => ingestNews().catch((e) => console.warn(JSON.stringify({ level: 'warn', event: 'news_ingest_failed', message: e.message })));
  setTimeout(run, 20_000).unref?.();
  timer = setInterval(run, config.NEWS_INGEST_MINUTES * 60_000); timer.unref?.();
}
export function stopNewsIngest() { if (timer) clearInterval(timer); timer = null; }
