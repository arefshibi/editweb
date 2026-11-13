import { pool } from '../db.js';
import { config } from '../config.js';
import { sendSms } from './notification-sms.js';

// Weekly showroom report: every Tehran Friday (from WEEKLY_REPORT_HOUR, default 10:00) each approved
// showroom gets an in-app notification with its last-7-days numbers, and optionally an SMS
// (only when WEEKLY_REPORT_SMS=true). Dedupe is the UNIQUE(showroom_id, week_key) row.
const TZ = 'Asia/Tehran';
const DAY = 86_400_000;
const FA = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (n) => String(Math.round(Number(n) || 0)).replace(/[0-9]/g, (d) => FA[d]);
const cut = (s, n) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const smsOn = () => process.env.WEEKLY_REPORT_SMS === 'true';
const reportHour = () => { const n = Number(process.env.WEEKLY_REPORT_HOUR); return Number.isInteger(n) && n >= 0 && n <= 21 ? n : 10; };

export function tehranClock(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: p.weekday };
}

export async function collectStats(db, { ownerId, showroomId }, from, to) {
  const win = [ownerId, from, to];
  const [ev, top, chats, offers, follows, active] = await Promise.all([
    db.query(
      `SELECT count(*) FILTER (WHERE e.event_type='view')::int AS views,
              count(*) FILTER (WHERE e.event_type='contact_click')::int AS contacts,
              count(*) FILTER (WHERE e.event_type='favorite')::int AS favorites,
              count(*) FILTER (WHERE e.event_type='share')::int AS shares
         FROM listing_interaction_events e JOIN listings l ON l.id=e.listing_id
        WHERE l.owner_id=$1 AND e.created_at>=$2 AND e.created_at<$3`, win),
    db.query(
      `SELECT l.id, l.title, count(*)::int AS views
         FROM listing_interaction_events e JOIN listings l ON l.id=e.listing_id
        WHERE l.owner_id=$1 AND e.event_type='view' AND e.created_at>=$2 AND e.created_at<$3
        GROUP BY l.id, l.title ORDER BY views DESC, l.id LIMIT 1`, win),
    db.query(
      `SELECT count(DISTINCT m.sender_id)::int AS n
         FROM messages m JOIN conversations c ON c.id=m.conversation_id
        WHERE c.seller_id=$1 AND m.sender_id<>$1 AND m.deleted_at IS NULL AND m.created_at>=$2 AND m.created_at<$3`, win),
    db.query(
      `SELECT count(*)::int AS n FROM listing_offers o JOIN listings l ON l.id=o.listing_id
        WHERE l.owner_id=$1 AND o.created_at>=$2 AND o.created_at<$3`, win),
    db.query('SELECT count(*)::int AS n FROM follows WHERE followed_showroom_id=$1 AND created_at>=$2 AND created_at<$3', [showroomId, from, to]),
    db.query("SELECT count(*)::int AS n FROM listings WHERE owner_id=$1 AND status='published' AND expires_at>now()", [ownerId]),
  ]);
  const e = ev.rows[0] || {};
  const t = top.rows[0];
  return {
    views: e.views || 0, contacts: e.contacts || 0, favorites: e.favorites || 0, shares: e.shares || 0,
    chats: chats.rows[0]?.n || 0, offers: offers.rows[0]?.n || 0, followers: follows.rows[0]?.n || 0,
    activeListings: active.rows[0]?.n || 0,
    top: t ? { id: t.id, title: t.title, views: t.views } : null,
  };
}

export function buildTexts(name, s) {
  const bits = [`${fa(s.views)} بازدید`];
  if (s.chats) bits.push(`${fa(s.chats)} مشتری پیام داد`);
  if (s.contacts) bits.push(`${fa(s.contacts)} تماس`);
  if (s.offers) bits.push(`${fa(s.offers)} پیشنهاد قیمت`);
  if (s.followers) bits.push(`${fa(s.followers)} دنبال‌کنندهٔ جدید`);
  let body = bits.join(' · ');
  if (s.top && s.top.views > 0) body += `\nپربازدیدترین: ${cut(s.top.title, 40)} (${fa(s.top.views)} بازدید)`;
  const site = process.env.SITE_ADDRESS || 'carma-app.ir';
  const sms = `کارما: این هفته ${cut(name, 30)} ${fa(s.views)} بازدید${s.chats ? ` و ${fa(s.chats)} مشتری پیام‌دهنده` : ''} داشت.`
    + (s.top && s.top.views > 0 ? `\nپربازدیدترین: ${cut(s.top.title, 28)}` : '') + `\n${site}`;
  return { title: 'گزارش هفتگی نمایشگاه', body: body.slice(0, 480), sms };
}

const smsReady = () => smsOn() && config.MELIPAYAMAK_ADV_URL && config.MELIPAYAMAK_FROM && !config.DEV_OTP_CODE;

// dry=true only prints; sms=false skips the SMS but still writes the report + notification.
export async function runWeekly({ db = pool, now = new Date(), dry = false, sms = true, send = sendSms, log = console.log } = {}) {
  const weekKey = tehranClock(now).ymd;
  const from = new Date(now.getTime() - 7 * DAY);
  const { rows } = await db.query(
    `SELECT s.id, s.owner_id, s.name, u.phone_e164, u.sms_notify
       FROM showrooms s JOIN users u ON u.id=s.owner_id
      WHERE s.status='approved' AND u.status='active' AND u.deleted_at IS NULL ORDER BY s.created_at`);
  const out = { weekKey, checked: rows.length, created: 0, sms: 0, skipped: 0 };
  for (const sr of rows) {
    try {
      const stats = await collectStats(db, { ownerId: sr.owner_id, showroomId: sr.id }, from, now);
      // Nothing to show (no live ads, or a completely silent week): skip — a zero report only discourages.
      if (!stats.activeListings || (!stats.views && !stats.chats && !stats.contacts)) { out.skipped += 1; continue; }
      const t = buildTexts(sr.name, stats);
      if (dry) { log(`[dry] ${sr.name}\n  ${t.body.replace(/\n/g, '\n  ')}\n  SMS: ${t.sms.replace(/\n/g, ' | ')}`); out.created += 1; continue; }
      const ins = await db.query(
        'INSERT INTO showroom_weekly_reports(showroom_id,owner_id,week_key,stats) VALUES($1,$2,$3,$4) ON CONFLICT (showroom_id,week_key) DO NOTHING RETURNING id',
        [sr.id, sr.owner_id, weekKey, stats]);
      if (!ins.rows[0]) { out.skipped += 1; continue; }
      out.created += 1;
      // sms_processed_at is set up-front so the generic notification-SMS worker never texts this a second time.
      await db.query(
        "INSERT INTO notifications(user_id,type,title,body,data,sms_processed_at) VALUES($1,'weekly_report',$2,$3,$4,now())",
        [sr.owner_id, t.title, t.body, { showroomId: sr.id, weekKey, stats }]);
      if (sms && smsReady() && sr.sms_notify) {
        const phone = sr.phone_e164;
        const to = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
        try {
          await send(to, t.sms);
          await db.query('UPDATE showroom_weekly_reports SET sms_sent_at=now() WHERE id=$1', [ins.rows[0].id]);
          out.sms += 1;
        } catch (error) { console.warn('weekly report SMS failed:', error.message); }
      }
    } catch (error) { console.warn('weekly report error:', error.message); }
  }
  return out;
}

let timer = null;
let doneKey = '';
export function startWeeklyReport() {
  if (timer || process.env.WEEKLY_REPORT_ENABLED === 'false') return;
  const tick = async () => {
    const c = tehranClock();
    if (c.weekday !== 'Fri' || c.hour < reportHour() || c.hour > 21 || doneKey === c.ymd) return;
    doneKey = c.ymd;
    try { console.log(JSON.stringify({ level: 'info', event: 'weekly_report_done', ...(await runWeekly({})) })); }
    catch (error) { doneKey = ''; console.warn('weekly report tick:', error.message); }
  };
  timer = setInterval(() => { tick(); }, 15 * 60_000);
  timer.unref?.();
  setTimeout(() => { tick(); }, 120_000).unref?.();
  console.log(JSON.stringify({ level: 'info', event: 'weekly_report_started', hour: reportHour(), sms: smsOn() }));
}
export function stopWeeklyReport() { if (timer) { clearInterval(timer); timer = null; } }
