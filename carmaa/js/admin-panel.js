(function () {
  'use strict';
  const API = window.CARMA_API_BASE || '/api/v1';
  const gate = document.getElementById('gate');
  const gateMessage = document.getElementById('gateMessage');
  const app = document.getElementById('app');
  const view = document.getElementById('view');
  const badge = document.getElementById('sessionBadge');
  let role = '';
  let perms = [];
  const can = (k) => role === 'admin' || (k === 'staff' ? false : perms.includes(k));
  let currentTab = 'overview';
  let busy = false;
  let whoName = '';

  async function api(path, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    headers.set('Accept', 'application/json');
    if (opts.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(API + path, { ...opts, headers, credentials: 'include', cache: 'no-store' });
    const raw = await response.text(); let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!response.ok) { const e = new Error(data?.error?.message || `HTTP ${response.status}`); e.status = response.status; e.code = data?.error?.code; throw e; }
    return data;
  }

  /* ---------- tiny DOM helpers (everything is set via textContent => safe) ---------- */
  function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined && text !== null) n.textContent = String(text); if (cls) n.className = cls; return n; }
  function h(tag, cls, ...kids) { const n = el(tag, null, cls); kids.flat().forEach(k => { if (k == null || k === false) return; n.append(k.nodeType ? k : document.createTextNode(String(k))); }); return n; }
  const IC = {
    car: '<path d="M5 16.5V13l1.6-4.2A2 2 0 0 1 8.5 7.5h7a2 2 0 0 1 1.9 1.3L19 13v3.5"/><path d="M3.5 13h17M7 16.5v2M17 16.5v2"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4a6.5 6.5 0 0 1 3.5 5.6"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    pin: '<path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    play: '<path d="M7 4.5v15L19 12z"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    err: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    up2: '<path d="M7 17 17 7M8 7h9v9"/>'
  };
  const svg = (k) => { const s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ''}</svg>`; return s.firstChild; };
  function button(text, action, cls, data, icon) {
    const b = el('button', null, `btn ${cls || ''}`.trim()); b.type = 'button'; b.dataset.action = action;
    if (icon) b.append(svg(icon)); b.append(document.createTextNode(text));
    if (data) Object.entries(data).forEach(([k, v]) => b.dataset[k] = String(v));
    return b;
  }
  const chip = (text, cls, icon) => { const c = el('span', null, `chip ${cls || ''}`.trim()); if (icon) c.append(svg(icon)); c.append(document.createTextNode(text)); return c; };
  const faNumber = (v) => new Intl.NumberFormat('fa-IR').format(Number(v || 0));
  function when(v) {
    if (!v) return '';
    const t = Date.parse(v); if (!t) return String(v);
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'همین الان';
    if (s < 3600) return faNumber(Math.floor(s / 60)) + ' دقیقه پیش';
    if (s < 86400) return faNumber(Math.floor(s / 3600)) + ' ساعت پیش';
    if (s < 86400 * 30) return faNumber(Math.floor(s / 86400)) + ' روز پیش';
    try { return new Date(t).toLocaleDateString('fa-IR'); } catch (_) { return String(v); }
  }
  const initial = (n) => String(n || '؟').trim().charAt(0) || '؟';

  /* ---------- toast / modal / states ---------- */
  function toast(text, kind) {
    const wrap = document.getElementById('toasts');
    const t = h('div', `toast ${kind === 'err' ? 'err' : 'ok'}`, svg(kind === 'err' ? 'err' : 'ok'), text);
    wrap.append(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2800);
  }
  function ask({ title, text, placeholder, quick, required, okText, okClass, input }) {
    return new Promise((resolve) => {
      const ta = input === false ? null : el('textarea'); if (ta) ta.placeholder = placeholder || '';
      const err = el('div', '', 'fe');
      const done = (v) => { m.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const ok = button(okText || 'تأیید', 'x', okClass || 'pri');
      const cancel = button('انصراف', 'x', 'ghost');
      ok.onclick = () => { const v = ta ? ta.value.trim() : ''; if (required && v.length < 3) { err.textContent = 'حداقل ۳ حرف بنویسید.'; ta && ta.focus(); return; } done(v || true); };
      cancel.onclick = () => done(null);
      const q = quick ? h('div', 'quick', quick.map(t => { const b = el('button', t); b.type = 'button'; b.onclick = () => { ta.value = t; ta.focus(); err.textContent = ''; }; return b; })) : null;
      const m = h('div', 'modal', h('div', 'sheet', el('h3', title), text ? el('p', text) : null, q, ta, err, h('div', 'actions', cancel, ok)));
      m.addEventListener('mousedown', (e) => { if (e.target === m) done(null); });
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', onKey);
      document.body.append(m); (ta || ok).focus();
    });
  }
  function skeleton() { view.replaceChildren(h('div', 'sk', el('i'), el('i'), el('i'))); }
  function empty(title, sub, icon) { return h('div', 'empty', h('div', 'ei', svg(icon || 'check')), el('b', title), sub || ''); }
  function showMessage(text) { view.replaceChildren(el('div', text, 'errbox')); }
  const TITLES = {
    allads: ['همه آگهی‌ها', 'مشاهده، جستجو، ویرایش و حذف همه‌ی آگهی‌ها'],
    overview: ['داشبورد', ''],
    listings: ['بررسی آگهی‌ها', 'آگهی‌های در انتظار تأیید'],
    showrooms: ['نمایشگاه‌ها', 'درخواست‌های ثبت نمایشگاه'],
    reports: ['گزارش‌های تخلف', 'گزارش‌های کاربران درباره‌ی آگهی‌ها'],
    ads: ['کارت‌های تبلیغاتی', 'کارت‌هایی که بین آگهی‌ها در لیست آگهی‌ها نمایش داده می‌شوند'],
    banners: ['بنرهای صفحه اصلی', 'افزودن، حذف و ترتیب بنرهای اسلایدر صفحه اصلی'],
    staff: ['مدیران و دسترسی‌ها', 'تعیین مدیر و سطح دسترسی هر شماره'],
    audit: ['رویدادهای مدیریتی', 'سابقه‌ی همه‌ی اقدام‌های مدیران']
  };
  const greeting = () => { const hr = new Date().getHours(); return hr < 12 ? 'صبح بخیر' : hr < 16 ? 'ظهر بخیر' : hr < 19 ? 'عصر بخیر' : 'شب بخیر'; };
  function setHeader(tab) {
    const t = TITLES[tab] || ['', ''];
    const title = document.getElementById('pageTitle'), sub = document.getElementById('pageSub');
    const crumb = document.querySelector('.crumb'), ph = document.querySelector('.page-head'), actions = document.getElementById('pageActions');
    let gd = document.getElementById('greetDate');
    actions.querySelectorAll('.ph-extra').forEach((n) => n.remove());
    if (tab === 'overview') {
      crumb.hidden = true;
      if (!gd) { gd = h('div', 'greet-date', svg('cal'), el('span', '')); gd.id = 'greetDate'; ph.insertBefore(gd, ph.querySelector('.ph-row')); }
      gd.hidden = false; gd.lastChild.textContent = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      title.replaceChildren(document.createTextNode(greeting() + '، '), h('em', null, whoName || 'مدیر عزیز'));
      sub.textContent = 'نگاهی سریع به وضعیت بازار خودرو شما در یک نگاه.';
      if (can('listings')) actions.append(button('بررسی آگهی‌ها', 'goto', 'pri ph-extra', { tab: 'listings' }, 'car'));
    } else {
      crumb.hidden = false; if (gd) gd.hidden = true;
      document.getElementById('crumbSep').hidden = false;
      const cc = document.getElementById('crumbCur'); cc.hidden = false; cc.textContent = t[0];
      title.textContent = t[0]; sub.textContent = t[1];
    }
  }
  function setCounts(o) {
    const map = { listings: o.pending_listings, showrooms: o.pending_showrooms, reports: o.open_reports };
    Object.entries(map).forEach(([k, v]) => { const n = document.querySelector(`[data-count="${k}"]`); if (!n) return; const c = Number(v || 0); n.hidden = c < 1; n.textContent = c > 99 ? '۹۹+' : faNumber(c); });
  }
  async function refreshCounts() { try { const d = await api('/admin/overview'); setCounts(d.overview || {}); return d.overview || {}; } catch (_) { return null; } }

  /* ---------- tabs ---------- */
  /* ---------- داشبورد (طراحی نوا) ---------- */
  let gid = 0;
  const num = (v) => Number(v || 0);
  const sum = (a) => a.reduce((s, x) => s + num(x), 0);
  function smooth(p) {
    const n = p.length; if (n < 2) return '';
    const sl = (u, v) => (v[0] === u[0] ? 0 : (v[1] - u[1]) / (v[0] - u[0]));
    let d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
      const a = p[i], b = p[i + 1], pr = p[i - 1] || a, nx = p[i + 2] || b, dx = b[0] - a[0];
      const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]), cl = (y) => Math.max(lo, Math.min(hi, y));
      const c1y = cl(a[1] + sl(pr, b) * dx / 3), c2y = cl(b[1] - sl(a, nx) * dx / 3);
      d += ` C${(a[0] + dx / 3).toFixed(1)} ${c1y.toFixed(1)} ${(b[0] - dx / 3).toFixed(1)} ${c2y.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    }
    return d;
  }
  function spark(vals, color) {
    vals = vals.map((v, i, a) => { const w3 = a.slice(Math.max(0, i - 4), i + 1); return sum(w3) / w3.length; });
    const w = 120, hh = 56, n = vals.length, mx = Math.max(1, ...vals), id = 'sg' + (++gid);
    const pts = vals.map((v, i) => [w - i * (w / Math.max(1, n - 1)), hh - 5 - (v / mx) * (hh - 12)]);
    const line = smooth(pts);
    const box = el('div', null, 'spark');
    box.innerHTML = `<svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${pts[n - 1][0].toFixed(1)} ${hh} L${pts[0][0].toFixed(1)} ${hh} Z" fill="url(#${id})" stroke="none"/><path d="${line}" stroke="${color}" stroke-width="2.4" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
    return box;
  }
  function pct(cur, prev) { if (!prev) return cur ? null : 0; return Math.round((cur - prev) / prev * 1000) / 10; }
  function deltaChip(p) {
    if (p === null || p === undefined) return null;
    const c = el('span', null, 'delta' + (p < 0 ? ' neg' : '')); c.append(document.createTextNode(faNumber(Math.abs(p)).replace(/٫0$/, '') + '٪')); c.append(svg('up2')); return c;
  }
  const niceMax = (m) => { if (m <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(m / 4))); const s = m / 4 / p; return 4 * p * (s <= 1 ? 1 : s <= 2 ? 2 : s <= 5 ? 5 : 10); };
  const dayDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  function lineChart(rows, A, B) {
    const W = 600, H = 290, padR = 52, padL = 16, padT = 14, padB = 34, n = rows.length;
    const mx = niceMax(Math.max(1, ...rows.map((r) => Math.max(num(r[A]), num(r[B])))));
    const sx = (i) => W - padR - i * ((W - padR - padL) / Math.max(1, n - 1));
    const sy = (v) => padT + (1 - v / mx) * (H - padT - padB);
    const P = (k) => rows.map((r, i) => [sx(i), sy(num(r[k]))]);
    const pa = P(A), pb = P(B), la = smooth(pa), lb = smooth(pb), base = H - padB;
    let g = '';
    for (let t = 0; t <= 4; t++) { const v = mx / 4 * t, y = sy(v); g += `<line x1="${padL}" x2="${W - padR + 6}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.09)" stroke-dasharray="4 6"/><text x="${W - 6}" y="${y + 4}" text-anchor="end">${faNumber(Math.round(v))}</text>`; }
    const every = n <= 8 ? 1 : Math.ceil(n / 5); let xl = '';
    rows.forEach((r, i) => { if (i % every === 0 || i === n - 1) { const d = dayDate(r.day); xl += `<text x="${sx(i)}" y="${H - 8}" text-anchor="middle">${n <= 8 ? d.toLocaleDateString('fa-IR', { weekday: 'long' }) : d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' })}</text>`; } });
    const id = 'lc' + (++gid);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار روند"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5546f" stop-opacity=".30"/><stop offset="1" stop-color="#f5546f" stop-opacity="0"/></linearGradient></defs>${g}
      <path d="${lb} L${pb[n - 1][0]} ${base} L${pb[0][0]} ${base} Z" fill="url(#${id}b)" stroke="none"/><path d="${la} L${pa[n - 1][0]} ${base} L${pa[0][0]} ${base} Z" fill="url(#${id}a)" stroke="none"/>
      <path d="${lb}" fill="none" stroke="#f5546f" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><path d="${la}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>${xl}</svg>`;
  }
  function mountChart(host, rows) {
    const W = 600, H = 290, padR = 52, padL = 16, padT = 14, padB = 34, n = rows.length;
    host.innerHTML = lineChart(rows, 'listings', 'users');
    const svgEl = host.querySelector('svg'); if (!svgEl || n < 2) return;
    const mx = niceMax(Math.max(1, ...rows.map((r) => Math.max(num(r.listings), num(r.users)))));
    const step = (W - padR - padL) / (n - 1), sx = (i) => W - padR - i * step, sy = (v) => padT + (1 - v / mx) * (H - padT - padB);
    const NS = 'http://www.w3.org/2000/svg', mk = (t, at) => { const e = document.createElementNS(NS, t); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    const g = mk('g', { style: 'display:none;pointer-events:none' });
    const guide = mk('line', { y1: padT, y2: H - padB, stroke: 'rgba(255,255,255,.28)', 'stroke-width': 1.5, 'stroke-dasharray': '3 5' });
    const d1 = mk('circle', { r: 6, fill: '#fff', stroke: '#0c0c0f', 'stroke-width': 3 }), d2 = mk('circle', { r: 6, fill: '#f5546f', stroke: '#0c0c0f', 'stroke-width': 3 });
    g.append(guide, d1, d2); svgEl.append(g);
    const tip = h('div', 'ctip'); tip.hidden = true; host.append(tip);
    const show = (cx) => {
      const r = svgEl.getBoundingClientRect(); const x = (cx - r.left) / r.width * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((W - padR - x) / step))), row = rows[i], X = sx(i);
      g.style.display = ''; guide.setAttribute('x1', X); guide.setAttribute('x2', X);
      d1.setAttribute('cx', X); d1.setAttribute('cy', sy(num(row.listings))); d2.setAttribute('cx', X); d2.setAttribute('cy', sy(num(row.users)));
      tip.hidden = false; tip.replaceChildren(el('b', dayDate(row.day).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })),
        h('span', 'tl1', el('i'), 'آگهی جدید: ' + faNumber(num(row.listings))), h('span', 'tl2', el('i'), 'کاربر جدید: ' + faNumber(num(row.users))));
      const pctX = X / W * 100; tip.style.left = Math.max(14, Math.min(86, pctX)) + '%';
    };
    const hide = () => { g.style.display = 'none'; tip.hidden = true; };
    svgEl.addEventListener('pointermove', (e) => show(e.clientX)); svgEl.addEventListener('pointerdown', (e) => show(e.clientX));
    svgEl.addEventListener('pointerleave', hide);
  }
  function barsPanel(rows) {
    const last = rows.slice(-7), mx = Math.max(1, ...last.map((r) => num(r.listings))), top = last.reduce((b, r, i) => (num(r.listings) > num(last[b].listings) ? i : b), 0);
    const wrap = el('div', null, 'bars-v');
    last.forEach((r, i) => {
      const f = el('i'); f.style.height = Math.max(4, num(r.listings) / mx * 100) + '%'; if (i === top && num(r.listings) > 0) f.className = 'hot';
      wrap.append(h('div', 'bv', el('em', faNumber(num(r.listings))), h('div', 'bt', f), el('span', dayDate(r.day).toLocaleDateString('fa-IR', { weekday: 'short' }))));
    });
    wrap.style.direction = 'rtl';
    const total = sum(last.map((r) => r.listings));
    return h('section', 'panel', h('div', 'panel-h', h('div', null, el('h3', 'ثبت آگهی در ۷ روز اخیر'), el('small', total ? `جمعاً ${faNumber(total)} آگهی` : 'در این هفته آگهی جدیدی ثبت نشده'))), wrap);
  }
  const STATUS_META = [['published', 'منتشرشده', '#F5F5F7', 'check'], ['pending', 'در انتظار تأیید', '#fbbf24', 'clock'], ['rejected', 'ردشده', '#f5546f', 'x'], ['archived', 'بایگانی/حذف‌شده', '#6d6d78', 'box']];
  function donut(parts, total) {
    const R = 80, C = 2 * Math.PI * R, cap = 18; let acc = 0, segs = '';
    if (!total) segs = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="#26262c" stroke-width="${cap}"/>`;
    parts.forEach(([, , color, , n]) => { if (!n) return; const frac = n / total, len = Math.max(0.5, frac * C - cap - 8); segs += `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${color}" stroke-width="${cap}" stroke-linecap="round" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-(acc + (cap + 8) / 2)}"/>`; acc += frac * C; });
    const w = el('div', null, 'donut-wrap'); w.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true">${segs}</svg>`;
    w.append(h('div', 'donut-c', el('b', faNumber(total)), el('span', 'کل آگهی‌ها')));
    return w;
  }
  function fmtMoney(t) { t = num(t); if (t >= 1e9) return [faNumber(Math.round(t / 1e8) / 10), 'میلیارد تومان']; if (t >= 1e6) return [faNumber(Math.round(t / 1e5) / 10), 'میلیون تومان']; return [faNumber(t), 'تومان']; }
  const AUDIT_FA = { 'listing.review': 'بررسی آگهی', 'listing.update': 'ویرایش آگهی', 'listing.delete': 'حذف آگهی', 'showroom.review': 'بررسی نمایشگاه', 'report.update': 'رسیدگی به گزارش', 'user.status': 'تغییر وضعیت کاربر' };
  const NOTIF_KEY = 'carmaAdminSeen';
  const seenGet = () => { try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}') || {}; } catch (_) { return {}; } };
  const seenSet = (o) => { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(o)); } catch (_) {} };
  let lastOverview = {};
  function renderNotifs(o) {
    lastOverview = o || lastOverview; o = lastOverview;
    const seen = seenGet(), list = document.getElementById('notifList');
    const items = [
      ['pending_listings', 'a', 'car', (n) => [`${faNumber(n)} آگهی`, ' در انتظار تأیید است'], 'listings', 'listings'],
      ['pending_showrooms', 'w', 'store', (n) => [`${faNumber(n)} نمایشگاه`, ' منتظر بررسی است'], 'showrooms', 'showrooms'],
      ['open_reports', 'i', 'flag', (n) => [`${faNumber(n)} گزارش تخلف`, ' باز است'], 'reports', 'reports']
    ].filter((x) => num(o[x[0]]) > 0 && can(x[5]));
    list.replaceChildren();
    let unread = 0;
    items.forEach(([key, tone, icon, txt, tab]) => {
      const n = num(o[key]), isNew = n > num(seen[key]); if (isNew) unread++;
      const t = txt(n); const b = el('button', null, 'nt' + (isNew ? '' : ' read')); b.type = 'button'; b.dataset.action = 'goto'; b.dataset.tab = tab;
      const ic = el('span', null, 'ic ' + tone); ic.append(svg(icon));
      b.append(ic, h('span', 't', h('span', null, el('b', t[0]), t[1]), el('small', 'همین الان')), el('i', null, 'u'));
      list.append(b);
    });
    if (!items.length) list.append(el('div', 'اعلان تازه‌ای نیست. همه‌چیز مرتب است.', 'nt-empty'));
    document.getElementById('bellDot').hidden = unread === 0;
  }
  function markAllRead() { const o = lastOverview, s = {}; ['pending_listings', 'pending_showrooms', 'open_reports'].forEach((k) => { s[k] = num(o[k]); }); seenSet(s); renderNotifs(o); }

  async function loadOverview() {
    const [ovR, stR, ltR, auR] = await Promise.allSettled([
      api('/admin/overview'), api('/admin/stats?days=30'),
      can('listings') ? api('/admin/listings-all?status=all&limit=8') : Promise.reject(new Error('no-perm')),
      can('audit') ? api('/admin/audit-logs?limit=6') : Promise.reject(new Error('no-perm'))
    ]);
    if (ovR.status === 'rejected') throw ovR.reason;
    const o = ovR.value.overview || {}; setCounts(o); renderNotifs(o);
    const st = stR.status === 'fulfilled' ? stR.value : null;
    const rows = st && Array.isArray(st.series) ? st.series : [];
    const colA = (k) => rows.map((r) => num(r[k]));
    const half = (k) => { const a = colA(k), m = Math.floor(a.length / 2); return [sum(a.slice(m)), sum(a.slice(0, m))]; };
    const out = [];

    /* KPI */
    const K = (label, value, unit, icon, c, bg, tab, key, sparkColor) => {
      const n = el(tab ? 'button' : 'div', null, 'stat'); if (tab) { n.type = 'button'; n.dataset.action = 'goto'; n.dataset.tab = tab; }
      const ic = el('div', null, 'ic'); ic.style.setProperty('--c', c); ic.style.setProperty('--bgc', bg); ic.append(svg(icon));
      const dl = key && rows.length ? (() => { const [cur, prev] = half(key); return deltaChip(pct(cur, prev)); })() : null;
      n.append(h('div', 'top-r', ic, dl), el('span', label, 'l'), el('b', value), unit ? el('span', unit, 'u') : null);
      if (key && rows.length) n.append(spark(colA(key), sparkColor || c));
      return n;
    };
    const rev = rows.length ? fmtMoney(sum(colA('revenue'))) : [faNumber(num(o.paid_orders_30d)), 'پرداخت موفق در ۳۰ روز'];
    const stats = h('div', 'stats',
      K(rows.length ? 'درآمد ۳۰ روز اخیر' : 'پرداخت‌های ۳۰ روز', rev[0], rows.length ? rev[1] : rev[1], 'cash', '#0b0c0e', 'linear-gradient(145deg,#ffffff,#c9c9d0)', null, rows.length ? 'revenue' : null, '#ffffff'),
      K('کاربران فعال', faNumber(num(o.active_users)), rows.length ? `${faNumber(sum(colA('users')))} کاربر جدید در ۳۰ روز` : '', 'users', '#1a0a0e', 'linear-gradient(145deg,#ff6b84,#e23a58)', null, 'users', '#f5546f'),
      K('آگهی‌های در انتظار', faNumber(num(o.pending_listings)), rows.length ? `${faNumber(sum(colA('listings')))} آگهی جدید در ۳۰ روز` : 'منتظر تأیید شما', 'car', '#2a1d00', 'linear-gradient(145deg,#fcd34d,#d99a0b)', can('listings') ? 'listings' : null, 'listings', '#fbbf24'),
      K('گزارش‌های باز', faNumber(num(o.open_reports)), 'گزارش تخلف کاربران', 'flag', '#ffffff', 'linear-gradient(145deg,#3a3a42,#26262c)', can('reports') ? 'reports' : null, 'reports', '#f5546f'));
    out.push(stats);

    /* روند */
    if (rows.length) {
      let span = 7; const chartHost = el('div', null, 'chart-host'); const bigHost = el('div', null, 'big-n');
      const draw = () => {
        const sl = rows.slice(-span), prev = rows.slice(-span * 2, -span);
        const tot = sum(sl.map((r) => r.listings)), tp = sum(prev.map((r) => r.listings));
        bigHost.replaceChildren(el('b', faNumber(tot)), el('span', 'آگهی جدید'), deltaChip(prev.length === span ? pct(tot, tp) : null));
        mountChart(chartHost, sl);
      };
      const seg = h('div', 'seg-t', ...[[7, 'هفته'], [30, 'ماه']].map(([d, l]) => { const b = el('button', l); b.type = 'button'; if (d === span) b.className = 'on'; b.onclick = () => { span = d; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); draw(); }; return b; }));
      draw();
      out.push(h('div', 'dash-2 wide',
        h('section', 'panel glow', h('div', 'panel-h', h('div', null, el('h3', 'روند ثبت آگهی و کاربر جدید'), el('small', 'بر اساس تاریخ ثبت در سایت'))), bigHost, seg,
          h('div', 'legend-r', (() => { const a = el('span', 'آگهی‌ها'); a.style.setProperty('--c', '#fff'); const b = el('span', 'کاربران جدید'); b.style.setProperty('--c', '#f5546f'); return [a, b]; })()), chartHost),
        (() => {
          const bs = Object.fromEntries((st.listings_by_status || []).map((x) => [x.status, num(x.n)]));
          const parts = STATUS_META.map(([k, l, c, ic]) => [k, l, c, ic, num(bs[k])]); const total = sum(parts.map((p) => p[4]));
          const panel = h('section', 'panel', h('div', 'panel-h', h('div', null, el('h3', 'وضعیت آگهی‌ها'), el('small', 'همه‌ی آگهی‌های ثبت‌شده'))), donut(parts, total));
          parts.forEach(([, l, c, ic, n]) => { const i = el('div', null, 'ic sw'); i.style.setProperty('--c', c); i.style.setProperty('--bgc', 'rgba(255,255,255,.05)'); i.append(svg(ic)); panel.append(h('div', 'lrow', i, el('span', l, 'n'), el('span', faNumber(n), 'v'), el('b', total ? faNumber(Math.round(n / total * 100)) + '٪' : '۰٪', 'p'))); });
          return panel;
        })()));
    }

    /* صف بررسی + برندها */
    const q = (label, n, tab, icon, c, bg) => { const b = el('button', null, 'mrow'); b.type = 'button'; b.dataset.action = 'goto'; b.dataset.tab = tab; const i = el('span', null, 'mav'); i.style.background = bg; i.style.color = c; i.append(svg(icon)); b.append(i, h('div', 'mm', el('div', label, 'mt'), el('small', n ? 'منتظر بررسی' : 'موردی در صف نیست')), chip(faNumber(n), n ? (tab === 'reports' ? 'bad' : 'warn') : 'ok')); return b; };
    const queue = h('section', 'panel', h('div', 'panel-h', h('div', null, el('h3', 'صف بررسی'), el('small', 'کارهای منتظر شما'))));
    if (can('listings')) queue.append(q('آگهی‌های در انتظار تأیید', num(o.pending_listings), 'listings', 'car', 'var(--warn)', 'var(--warnbg)'));
    if (can('showrooms')) queue.append(q('نمایشگاه‌های در انتظار', num(o.pending_showrooms), 'showrooms', 'store', 'var(--info)', 'var(--infobg)'));
    if (can('reports')) queue.append(q('گزارش‌های تخلف باز', num(o.open_reports), 'reports', 'flag', 'var(--bad)', 'var(--badbg)'));
    const makes = st && st.top_makes && st.top_makes.length ? (() => {
      const mx = Math.max(1, ...st.top_makes.map((m) => num(m.n)));
      const p = h('section', 'panel', h('div', 'panel-h', h('div', null, el('h3', 'برندهای پرآگهی'), el('small', 'آگهی‌های منتشرشده'))));
      const bars = el('div', null, 'bars');
      st.top_makes.forEach((m) => { const f = el('i'); f.style.width = Math.max(4, num(m.n) / mx * 100) + '%'; bars.append(h('div', 'bar-r', h('div', 'h', el('b', m.make), el('span', faNumber(num(m.n)) + ' آگهی')), h('div', 't', f))); });
      p.append(bars); return p;
    })() : null;
    const barsP = rows.length ? barsPanel(rows) : null;
    if (barsP || makes) out.push(h('div', 'dash-2 eq', barsP, makes));

    /* آخرین آگهی‌ها + فعالیت‌ها */
    const lastItems = ltR.status === 'fulfilled' ? (ltR.value.items || []) : null;
    let latest = null;
    if (lastItems) {
      let flt = 'all'; const host = el('div');
      const drawL = () => {
        const f = lastItems.filter((x) => flt === 'all' || x.status === flt).slice(0, 6);
        host.replaceChildren(...(f.length ? f.map((x) => {
          const img = Array.isArray(x.photos) && x.photos[0] && x.photos[0].url; const who = x.display_name || 'کاربر';
          const av = el('span', null, 'mav'); if (img) { const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; av.append(i); } else av.textContent = initial(who);
          const stt = ALL_BADGE[x.status] || [x.status || '', ''];
          const b = el('button', null, 'mrow'); b.type = 'button'; b.dataset.action = 'goto'; b.dataset.tab = x.status === 'pending' ? 'listings' : 'allads';
          b.append(av, h('div', 'mm', el('div', x.ad_title || x.title || 'بدون عنوان', 'mt'), el('small', [who, [x.make, x.model].filter(Boolean).join(' ')].filter(Boolean).join(' · '))),
            h('div', 'me', chip(stt[0], stt[1] + ' dotc'), el('span', x.price_negotiable || !x.price_toman ? 'توافقی' : faNumber(x.price_toman), 'pr')));
          return b;
        }) : [el('div', 'آگهی‌ای در این دسته نیست.', 'nt-empty')]));
      };
      const tabs = h('div', 'tabs-r', ...[['all', 'همه'], ['pending', 'در انتظار'], ['published', 'منتشرشده'], ['rejected', 'ردشده']].map(([k, l]) => { const b = el('button', l); b.type = 'button'; if (k === flt) b.className = 'on'; b.onclick = () => { flt = k; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); drawL(); }; return b; }));
      drawL();
      latest = h('section', 'panel', h('div', 'panel-h', h('div', null, el('h3', 'آخرین آگهی‌ها'), el('small', 'تازه‌ترین آگهی‌های ثبت‌شده'))), tabs, host);
    }
    let activity = null;
    const au = auR.status === 'fulfilled' ? (auR.value.items || []) : null;
    if (au) {
      activity = h('section', 'panel', h('div', 'panel-h', h('div', null, el('h3', 'فعالیت‌های اخیر'), el('small', 'اقدام‌های مدیران'))));
      if (!au.length) activity.append(el('div', 'هنوز رویدادی ثبت نشده.', 'nt-empty'));
      au.forEach((x) => { const i = el('span', null, 'ic a'); i.append(svg('clock')); activity.append(h('div', 'dot-t', i, h('div', null, el('b', AUDIT_FA[x.action] || x.action || 'رویداد'), el('small', when(x.created_at))))); });
    }
    out.push(h('div', 'dash-2 eq', queue, activity));
    if (latest) out.push(latest);
    out.push(el('p', 'هر تغییر مدیریتی از API عبور می‌کند و در رویدادهای مدیریتی ثبت می‌شود.', 'note'));
    view.replaceChildren(h('div', 'dash', ...out));
  }
  async function loadListings() {
    const data = await api('/admin/listings?status=pending&limit=100'); const rows = data.items || [];
    const n = document.querySelector('[data-count="listings"]'); if (n) { n.hidden = !rows.length; n.textContent = faNumber(rows.length); }
    if (!rows.length) { view.replaceChildren(empty('آگهی‌ای در انتظار نیست', 'همه‌ی آگهی‌ها بررسی شده‌اند.')); return; }
    const list = el('div', null, 'rows');
    rows.forEach((x) => {
      const img = x.cover_url || x.cover_image || x.image_url || x.photo_url || x.thumbnail_url;
      const thumb = el('div', null, 'thumb'); if (img) { const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; thumb.append(i); } else thumb.append(svg('car'));
      const chips = el('div', null, 'chips');
      const mm = [x.make, x.model].filter(Boolean).join(' '); if (mm) chips.append(chip(mm, 'info', 'car'));
      if (x.year) chips.append(chip(String(x.year), '', 'cal')); if (x.city) chips.append(chip(x.city, '', 'pin'));
      if (x.created_at) chips.append(chip(when(x.created_at), '', 'clock'));
      const main = h('div', 'grow', el('h3', x.title || 'بدون عنوان'), el('div', x.price_toman ? faNumber(x.price_toman) + ' تومان' : 'قیمت توافقی', 'price'), chips);
      const c = h('article', 'card', h('div', 'row', thumb, main));
      if (x.rejection_reason) c.append(el('div', 'دلیل رد قبلی: ' + x.rejection_reason, 'alertline'));
      const who = x.display_name || 'کاربر';
      c.append(h('div', 'owner', el('span', initial(who), 'av'), h('div', null, el('b', who), el('small', x.phone_e164 || ''))));
      c.append(h('div', 'actions', button('تأیید و انتشار', 'listing-publish', 'ok solid', { id: x.id }, 'check'), button('رد آگهی', 'listing-reject', 'bad', { id: x.id }, 'x'), button('بایگانی', 'listing-archive', 'warn', { id: x.id }, 'box')));
      list.append(c);
    });
    view.replaceChildren(list);
  }
  async function loadShowrooms() {
    const data = await api('/admin/showrooms?status=pending'); const rows = data.items || [];
    const n = document.querySelector('[data-count="showrooms"]'); if (n) { n.hidden = !rows.length; n.textContent = faNumber(rows.length); }
    if (!rows.length) { view.replaceChildren(empty('نمایشگاهی در انتظار نیست', 'درخواست جدیدی برای بررسی وجود ندارد.')); return; }
    const list = el('div', null, 'rows');
    rows.forEach((x) => {
      const chips = el('div', null, 'chips'); if (x.city) chips.append(chip(x.city, '', 'pin')); if (x.created_at) chips.append(chip(when(x.created_at), '', 'clock'));
      const thumb = el('div', null, 'thumb'); thumb.append(svg('store'));
      const c = h('article', 'card', h('div', 'row', thumb, h('div', 'grow', el('h3', x.name || 'نمایشگاه'), chips)));
      const desc = [x.address, x.description].filter(Boolean).join('\n'); if (desc) c.append(el('div', desc, 'body'));
      const who = x.owner_name || 'مالک';
      c.append(h('div', 'owner', el('span', initial(who), 'av'), h('div', null, el('b', who), el('small', x.phone_e164 || ''))));
      c.append(h('div', 'actions', button('تأیید نمایشگاه', 'showroom-approve', 'ok solid', { id: x.id }, 'check'), button('رد نمایشگاه', 'showroom-reject', 'bad', { id: x.id }, 'x')));
      list.append(c);
    });
    view.replaceChildren(list);
  }
  let reportStatus = 'new';
  async function loadReports(status) {
    if (status) reportStatus = status;
    const data = await api(`/admin/reports?status=${encodeURIComponent(reportStatus)}&limit=100`);
    const seg = el('div', null, 'seg'); [['new', 'جدید'], ['reviewing', 'در حال بررسی'], ['resolved', 'حل‌شده'], ['dismissed', 'ردشده']].forEach(([k, l]) => { const b = button(l, 'report-filter', k === reportStatus ? 'on' : '', { status: k }); b.className = k === reportStatus ? 'on' : ''; seg.append(b); });
    const rows = data.items || [];
    if (!rows.length) { view.replaceChildren(seg, empty('گزارشی در این وضعیت نیست', '', 'flag')); return; }
    const list = el('div', null, 'rows');
    rows.forEach((x) => {
      const st = { new: ['جدید', 'bad'], reviewing: ['در حال بررسی', 'warn'], resolved: ['حل‌شده', 'ok'], dismissed: ['ردشده', ''] }[x.status] || [x.status || '', ''];
      const chips = h('div', 'chips', chip(String(x.reason || 'تخلف'), 'warn', 'flag'), chip(st[0], st[1]), x.created_at ? chip(when(x.created_at), '', 'clock') : null);
      const c = h('article', 'card', el('h3', x.listing_title || 'گزارش آگهی'), chips);
      if (x.details) c.append(el('div', x.details, 'body'));
      const rp = x.reporter_name || 'نامشخص';
      c.append(h('div', 'owner', el('span', initial(rp), 'av'), h('div', null, el('b', 'گزارش‌دهنده: ' + rp), el('small', x.reporter_phone || ''))));
      const acts = el('div', null, 'actions');
      if (x.status === 'new') acts.append(button('شروع بررسی', 'report-review', '', { id: x.id }, 'play'));
      if (x.status === 'new' || x.status === 'reviewing') acts.append(button('حل‌شده', 'report-resolve', 'ok solid', { id: x.id }, 'check'), button('رد گزارش', 'report-dismiss', 'bad', { id: x.id }, 'x'));
      if (acts.children.length) c.append(acts);
      list.append(c);
    });
    view.replaceChildren(seg, list);
  }
  async function loadAudit() {
    const data = await api('/admin/audit-logs?limit=100'); const rows = data.items || [];
    if (!rows.length) { view.replaceChildren(empty('هنوز رویدادی ثبت نشده', '', 'clock')); return; }
    const tl = el('div', null, 'tl');
    rows.forEach((x) => {
      const ev = h('div', 'ev', h('div', null, el('b', x.action || 'رویداد'), ' ', chip(`${x.target_type || ''}/${x.target_id || ''}`, '')),
        el('div', `${when(x.created_at)} · مدیر ${x.actor_id || 'سیستم'} · درخواست ${x.request_id || '—'}`, 'm'));
      const meta = x.metadata && Object.keys(x.metadata).length ? JSON.stringify(x.metadata, null, 2) : '';
      if (meta) ev.append(h('details', null, el('summary', 'جزئیات'), el('pre', meta)));
      tl.append(ev);
    });
    view.replaceChildren(tl);
  }
  /* ---------- generic form modal ---------- */
  function formModal({ title, text, body, okText, onSubmit }) {
    return new Promise((resolve) => {
      const err = el('div', '', 'fe');
      const done = (v) => { m.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const ok = button(okText || 'ذخیره', 'x', 'pri'); const cancel = button('انصراف', 'x', 'ghost');
      cancel.onclick = () => done(null);
      ok.onclick = async () => { err.textContent = ''; ok.disabled = true; try { const r = await onSubmit(); done(r === undefined ? true : r); } catch (e) { err.textContent = e.message || 'ناموفق بود.'; ok.disabled = false; } };
      const m = h('div', 'modal', h('div', 'sheet wide', el('h3', title), text ? el('p', text) : null, body, err, h('div', 'actions', cancel, ok)));
      m.addEventListener('mousedown', (e) => { if (e.target === m) done(null); });
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', onKey); document.body.append(m);
    });
  }
  const field = (label, control) => h('label', 'fld', el('span', label), control);
  function selectEl(options, value) { const s = el('select'); options.forEach(([v, l]) => { const o = el('option', l); o.value = v; s.append(o); }); s.value = value; return s; }

  /* ---------- ad cards (between listing cards) ---------- */
  const adLocalInput = (v) => { if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  function adField(label, node, hint) { return h('label', 'adf-f', el('span', label), node, hint ? el('small', hint) : null); }
  function adInp(type, value, attrs) { const i = el('input'); i.type = type; i.value = value == null ? '' : String(value); Object.entries(attrs || {}).forEach(([k, v]) => i.setAttribute(k, v)); return i; }
  function adForm(card) {
    return new Promise((resolve) => {
      const c = card || {};
      const title = adInp('text', c.title, { maxlength: 80, placeholder: 'مثلاً: بیمه بدنه با ۲۰٪ تخفیف' });
      const desc = el('textarea'); desc.maxLength = 240; desc.value = c.description || ''; desc.placeholder = 'توضیح کوتاه (اختیاری)';
      const image = adInp('url', c.imageUrl, { placeholder: 'https://… یا آپلود تصویر', dir: 'ltr', maxlength: 500 });
      const file = adInp('file', '', { accept: 'image/jpeg,image/png,image/webp' });
      const up = el('small', '');
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0]; if (!f) return; up.textContent = 'در حال آپلود…';
        try { const fd = new FormData(); fd.append('file', f, f.name || 'ad.jpg'); const r = await fetch(API + '/uploads/images', { method: 'POST', body: fd, credentials: 'include' }); const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || 'آپلود ناموفق بود.'); image.value = d.image.public_url; up.textContent = 'تصویر آپلود شد ✓'; }
        catch (e) { up.textContent = e.message || 'آپلود ناموفق بود.'; }
      });
      const link = adInp('text', c.linkUrl, { placeholder: 'https://example.com یا /مسیر-داخلی', dir: 'ltr', maxlength: 500 });
      const cta = adInp('text', c.ctaText == null ? 'مشاهده' : c.ctaText, { maxlength: 24 });
      const badge = adInp('text', c.badgeText == null ? 'تبلیغ' : c.badgeText, { maxlength: 16 });
      const pos = adInp('number', c.position || 4, { min: 1, max: 50 });
      const rep = adInp('number', c.repeatEvery || 0, { min: 0, max: 50 });
      const order = adInp('number', c.sortOrder || 0, { min: -1000, max: 1000 });
      const from = adInp('datetime-local', adLocalInput(c.startsAt));
      const to = adInp('datetime-local', adLocalInput(c.endsAt));
      const active = adInp('checkbox', ''); active.checked = c.isActive !== false;
      const err = el('div', '', 'fe');
      const done = (v) => { m.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const save = button(card ? 'ذخیره تغییرات' : 'ساخت کارت', 'x', 'pri');
      const cancel = button('انصراف', 'x', 'ghost');
      cancel.onclick = () => done(null);
      save.onclick = () => {
        if (!title.value.trim()) { err.textContent = 'عنوان کارت را وارد کنید.'; title.focus(); return; }
        const l = link.value.trim(), im = image.value.trim();
        const okUrl = (u) => !u || /^https:\/\/\S+$/i.test(u) || /^\/(?!\/)\S*$/.test(u);
        if (!okUrl(l) || !okUrl(im)) { err.textContent = 'آدرس‌ها باید با https:// یا / شروع شوند.'; return; }
        done({ title: title.value.trim(), description: desc.value.trim(), imageUrl: im, linkUrl: l, ctaText: cta.value.trim(), badgeText: badge.value.trim(),
          position: Math.max(1, Math.min(50, parseInt(pos.value, 10) || 4)), repeatEvery: Math.max(0, Math.min(50, parseInt(rep.value, 10) || 0)), sortOrder: parseInt(order.value, 10) || 0,
          startsAt: from.value ? new Date(from.value).toISOString() : null, endsAt: to.value ? new Date(to.value).toISOString() : null, isActive: active.checked });
      };
      const m = h('div', 'modal', h('div', 'sheet adf', el('h3', card ? 'ویرایش کارت تبلیغاتی' : 'کارت تبلیغاتی جدید'),
        adField('عنوان', title), adField('توضیح', desc), adField('تصویر', image, 'آدرس تصویر یا آپلود از دستگاه'), file, up,
        adField('لینک مقصد', link, 'خالی بگذارید تا کارت کلیک‌پذیر نباشد'),
        h('div', 'adf-row', adField('متن دکمه', cta), adField('برچسب', badge)),
        h('div', 'adf-row', adField('بعد از چند آگهی؟', pos, 'مثلاً ۴ = بعد از آگهی چهارم'), adField('تکرار هر … آگهی', rep, '۰ = فقط یک‌بار'), adField('اولویت', order, 'کمتر = بالاتر')),
        h('div', 'adf-row', adField('شروع (اختیاری)', from), adField('پایان (اختیاری)', to)),
        h('label', 'adf-chk', active, el('span', 'کارت فعال باشد')),
        err, h('div', 'actions', cancel, save)));
      m.addEventListener('mousedown', (e) => { if (e.target === m) done(null); });
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', onKey); document.body.append(m); title.focus();
    });
  }
  let adsCache = [];
  async function loadAds() {
    if (!can('banners')) { showMessage('به این بخش دسترسی ندارید.'); return; }
    const data = await api('/admin/ad-cards'); const rows = adsCache = data.items || [];
    const top = h('div', 'ads-top', button('کارت تبلیغاتی جدید', 'ad-new', 'pri', null, 'check'));
    if (!rows.length) { view.replaceChildren(top, empty('هنوز کارت تبلیغاتی نساخته‌اید', 'با دکمه‌ی بالا اولین کارت را بسازید تا بین آگهی‌ها نمایش داده شود.', 'cash')); return; }
    const list = el('div', null, 'rows');
    rows.forEach((x) => {
      const thumb = el('div', null, 'thumb'); if (x.imageUrl) { const i = el('img'); i.src = x.imageUrl; i.alt = ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; thumb.append(i); } else thumb.append(svg('cash'));
      const now = Date.now(); const expired = x.endsAt && Date.parse(x.endsAt) < now; const waiting = x.startsAt && Date.parse(x.startsAt) > now;
      const st = !x.isActive ? ['متوقف', ''] : expired ? ['منقضی', 'bad'] : waiting ? ['زمان‌بندی‌شده', 'info'] : ['فعال', 'ok'];
      const chips = h('div', 'chips', chip(st[0], st[1]), chip('بعد از آگهی ' + faNumber(x.position) + (x.repeatEvery ? ' · تکرار هر ' + faNumber(x.repeatEvery) : ''), '', 'pin'),
        chip('بازدید ' + faNumber(x.views), '', 'play'), chip('کلیک ' + faNumber(x.clicks) + (x.views ? ' (' + faNumber(Math.round(x.clicks / x.views * 1000) / 10) + '٪)' : ''), 'info', 'check'));
      const c = h('article', 'card', h('div', 'row', thumb, h('div', 'grow', el('h3', x.title), x.description ? el('div', x.description, 'body') : null, chips)));
      c.append(h('div', 'actions', button('ویرایش', 'ad-edit', '', { id: x.id }), button(x.isActive ? 'توقف' : 'فعال‌سازی', 'ad-toggle', x.isActive ? 'warn' : 'ok', { id: x.id }), button('حذف', 'ad-delete', 'bad', { id: x.id }, 'x')));
      list.append(c);
    });
    view.replaceChildren(top, list);
  }
  async function adAction(a, b) {
    const x = adsCache.find((r) => r.id === b.dataset.id);
    if (a === 'ad-new') { const d = await adForm(null); if (!d) return; await api('/admin/ad-cards', { method: 'POST', body: JSON.stringify(d) }); toast('کارت تبلیغاتی ساخته شد'); }
    else if (a === 'ad-edit' && x) { const d = await adForm(x); if (!d) return; await api('/admin/ad-cards/' + encodeURIComponent(x.id), { method: 'PATCH', body: JSON.stringify(d) }); toast('تغییرات ذخیره شد'); }
    else if (a === 'ad-toggle' && x) { await api('/admin/ad-cards/' + encodeURIComponent(x.id), { method: 'PATCH', body: JSON.stringify({ isActive: !x.isActive }) }); toast(x.isActive ? 'کارت متوقف شد' : 'کارت فعال شد'); }
    else if (a === 'ad-delete' && x) { if (!await ask({ title: 'حذف کارت تبلیغاتی', text: 'این کارت برای همیشه حذف می‌شود.', input: false, okText: 'حذف', okClass: 'bad' })) return; await api('/admin/ad-cards/' + encodeURIComponent(x.id), { method: 'DELETE' }); toast('کارت حذف شد'); }
    await renderTab('ads', true);
  }
  /* ---------- banners ---------- */
  let bannerCache = [];
  const ACTIONS = [['none', 'بدون لینک'], ['goSell', 'صفحه ثبت آگهی'], ['browseDealers', 'صفحه نمایشگاه‌ها'], ['goListings', 'لیست آگهی‌ها'], ['goNews', 'اخبار'], ['url', 'لینک دلخواه (https)']];
  const actionLabel = (a) => (ACTIONS.find((x) => x[0] === a) || [0, a])[1];
  async function uploadImage(file) {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(API + '/uploads/images', { method: 'POST', body: fd, credentials: 'include', cache: 'no-store' });
    const raw = await r.text(); let d = null; try { d = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!r.ok) throw new Error(d?.error?.message || 'آپلود تصویر ناموفق بود.');
    return d.image;
  }
  async function bannerForm(cur) {
    const file = el('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp';
    const prev = el('div', null, 'bn-prev'); if (cur) { const i = el('img'); i.src = cur.image_url; i.alt = ''; prev.append(i); }
    file.onchange = () => { const f = file.files[0]; if (!f) return; prev.replaceChildren(); const i = el('img'); i.src = URL.createObjectURL(f); i.alt = ''; prev.append(i); };
    const act = selectEl(ACTIONS, cur ? cur.action : 'none');
    const url = el('input'); url.type = 'url'; url.dir = 'ltr'; url.placeholder = 'https://example.com/…'; url.value = cur?.link_url || '';
    const urlF = field('آدرس لینک', url);
    const alt = el('input'); alt.maxLength = 160; alt.placeholder = 'توضیح کوتاه تصویر (اختیاری)'; alt.value = cur?.alt || '';
    const sync = () => { urlF.hidden = act.value !== 'url'; }; act.onchange = sync; sync();
    const hint = el('p', 'پیشنهاد: تصویر افقی ۱۶:۹ (مثلاً ۱۶۷۲×۹۴۱) و حداکثر ۶ مگابایت.', 'hint');
    const body = h('div', 'form', prev, cur ? null : field('تصویر بنر', file), cur ? null : hint, field('با کلیک روی بنر', act), urlF, field('متن جایگزین', alt));
    const ok = await formModal({ title: cur ? 'ویرایش بنر' : 'افزودن بنر', body, okText: cur ? 'ذخیره' : 'آپلود و افزودن', onSubmit: async () => {
      if (act.value === 'url' && !/^(https:\/\/|\/(?!\/))\S+$/.test(url.value.trim())) throw new Error('آدرس باید با https:// یا / شروع شود.');
      const base = { action: act.value, alt: alt.value.trim() }; if (act.value === 'url') base.linkUrl = url.value.trim();
      if (cur) { await api('/admin/banners/' + encodeURIComponent(cur.id), { method: 'PATCH', body: JSON.stringify(base) }); return true; }
      if (!file.files[0]) throw new Error('یک تصویر انتخاب کنید.');
      const img = await uploadImage(file.files[0]);
      await api('/admin/banners', { method: 'POST', body: JSON.stringify({ imageId: img.id, ...base }) }); return true;
    } });
    if (ok) { toast(cur ? 'بنر ذخیره شد' : 'بنر اضافه شد'); await loadBanners(); }
  }
  async function loadBanners() {
    const data = await api('/admin/banners'); const rows = bannerCache = data.items || [];
    const top = h('div', 'toolbar', button('افزودن بنر', 'banner-add', 'pri', null, 'plus'), el('span', `${faNumber(rows.filter((x) => x.active).length)} بنر فعال از ${faNumber(rows.length)} (حداکثر ۱۲)`, 'muted'));
    if (!rows.length) { view.replaceChildren(top, empty('بنری وجود ندارد', 'بخش بنر صفحه اصلی خالی نمایش داده می‌شود؛ یک بنر اضافه کنید.', 'check')); return; }
    const list = el('div', null, 'rows');
    rows.forEach((x, i) => {
      const img = el('img'); img.src = x.image_url; img.alt = ''; img.loading = 'lazy';
      const chips = h('div', 'chips', chip(x.active ? 'فعال' : 'غیرفعال', x.active ? 'ok' : 'warn'), chip(actionLabel(x.action), 'info'), x.action === 'url' && x.link_url ? chip(x.link_url.slice(0, 40), '') : null);
      const acts = h('div', 'actions',
        button('', 'banner-move', '', { id: x.id, dir: 'up' }, 'up'), button('', 'banner-move', '', { id: x.id, dir: 'down' }, 'down'),
        button('ویرایش', 'banner-edit', '', { id: x.id }, 'edit'),
        button(x.active ? 'غیرفعال' : 'فعال‌سازی', 'banner-toggle', x.active ? 'warn' : 'ok', { id: x.id, on: x.active ? '0' : '1' }),
        button('حذف', 'banner-del', 'bad', { id: x.id }, 'trash'));
      acts.children[0].disabled = i === 0; acts.children[1].disabled = i === rows.length - 1;
      acts.children[0].setAttribute('aria-label', 'بالاتر'); acts.children[1].setAttribute('aria-label', 'پایین‌تر');
      list.append(h('article', 'card', h('div', 'bn-row', h('div', 'bn-thumb', img), h('div', 'grow', el('h3', `بنر ${faNumber(i + 1)}`), x.alt ? el('div', x.alt, 'muted') : null, chips)), acts));
    });
    view.replaceChildren(top, list);
  }

  /* ---------- staff & permissions ---------- */
  let staffCache = [];
  const PERM_LABELS = { listings: 'بررسی آگهی‌ها', showrooms: 'بررسی نمایشگاه‌ها', reports: 'گزارش‌های تخلف', banners: 'بنرهای صفحه اصلی', users: 'تعلیق/فعال‌سازی کاربران', audit: 'مشاهده رویدادها' };
  async function staffForm(cur) {
    const phone = el('input'); phone.type = 'tel'; phone.dir = 'ltr'; phone.inputMode = 'numeric'; phone.placeholder = '09xxxxxxxxx'; phone.maxLength = 16;
    if (cur) { phone.value = cur.phone_e164 || ''; phone.disabled = true; }
    const roleSel = selectEl([['moderator', 'ناظر (دسترسی محدود)'], ['admin', 'مدیر اصلی (دسترسی کامل)']], cur ? cur.role : 'moderator');
    const boxes = el('div', null, 'perms');
    const checks = Object.entries(PERM_LABELS).map(([k, l]) => { const c = el('input'); c.type = 'checkbox'; c.value = k; c.checked = !!cur && (cur.permissions || []).includes(k); boxes.append(h('label', 'chk', c, el('span', l))); return c; });
    const permF = h('div', 'fld', el('span', 'دسترسی‌ها'), boxes);
    const sync = () => { const a = roleSel.value === 'admin'; permF.hidden = a; }; roleSel.onchange = sync; sync();
    const note = el('p', 'مدیر اصلی به همه‌ی بخش‌ها از جمله همین صفحه دسترسی دارد. اگر این شماره هنوز ثبت‌نام نکرده، با اولین ورود فعال می‌شود.', 'hint');
    const body = h('div', 'form', field('شماره موبایل', phone), field('نقش', roleSel), permF, note);
    const ok = await formModal({ title: cur ? 'ویرایش دسترسی' : 'افزودن مدیر', body, okText: 'ذخیره', onSubmit: async () => {
      const payload = { role: roleSel.value, permissions: roleSel.value === 'admin' ? [] : checks.filter((c) => c.checked).map((c) => c.value) };
      if (payload.role === 'moderator' && !payload.permissions.length) throw new Error('حداقل یک دسترسی انتخاب کنید.');
      if (cur) await api('/admin/staff/' + encodeURIComponent(cur.id), { method: 'PATCH', body: JSON.stringify(payload) });
      else { if (!/^(\+?98|0)?9\d{9}$/.test(digits(phone.value))) throw new Error('شماره موبایل معتبر نیست.'); await api('/admin/staff', { method: 'POST', body: JSON.stringify({ phone: '+98' + phoneCore(phone.value), ...payload }) }); }
      return true;
    } });
    if (ok) { toast('ذخیره شد'); await loadStaff(); }
  }
  async function loadStaff() {
    if (role !== 'admin') { showMessage('این بخش فقط برای مدیر اصلی در دسترس است.'); return; }
    const data = await api('/admin/staff'); staffCache = data.items || []; const inv = data.invites || [];
    const top = h('div', 'toolbar', button('افزودن مدیر', 'staff-add', 'pri', null, 'plus'));
    const list = el('div', null, 'rows');
    staffCache.forEach((x) => {
      const isAdmin = x.role === 'admin';
      const chips = el('div', null, 'chips'); chips.append(chip(isAdmin ? 'مدیر اصلی' : 'ناظر', isAdmin ? 'ok' : 'info'));
      if (x.status !== 'active') chips.append(chip('غیرفعال', 'bad'));
      if (isAdmin) chips.append(chip('دسترسی کامل', '')); else (x.permissions || []).forEach((p) => chips.append(chip(PERM_LABELS[p] || p, '')));
      const who = x.display_name || 'بدون نام';
      list.append(h('article', 'card', h('div', 'owner', el('span', initial(who), 'av'), h('div', 'grow', el('b', who), el('small', x.phone_e164 || ''))), chips,
        h('div', 'actions', button('ویرایش دسترسی', 'staff-edit', '', { id: x.id }, 'edit'), button('حذف دسترسی', 'staff-del', 'bad', { id: x.id }, 'trash'))));
    });
    inv.forEach((x) => {
      const chips = h('div', 'chips', chip('منتظر اولین ورود', 'warn'), chip(x.role === 'admin' ? 'مدیر اصلی' : 'ناظر', 'info'), ...(x.role === 'admin' ? [] : (x.permissions || []).map((p) => chip(PERM_LABELS[p] || p, ''))));
      list.append(h('article', 'card', h('div', 'owner', el('span', '+', 'av'), h('div', 'grow', el('b', 'دعوت‌شده'), el('small', x.phone_e164))), chips, h('div', 'actions', button('لغو دعوت', 'invite-del', 'bad', { phone: x.phone_e164 }, 'x'))));
    });
    view.replaceChildren(top, list.children.length ? list : empty('هنوز مدیری اضافه نشده', '', 'users'));
  }

  /* ---------- همه‌ی آگهی‌ها: مشاهده، جستجو، ویرایش، حذف ---------- */
  const allState = { status: 'published', q: '', page: 1, items: [] };
  const ALL_STATUS = [['published', 'منتشرشده'], ['pending', 'در انتظار'], ['rejected', 'ردشده'], ['archived', 'حذف‌شده'], ['all', 'همه']];
  const ALL_BADGE = { published: ['منتشرشده', 'ok'], pending: ['در انتظار', 'warn'], rejected: ['ردشده', 'bad'], archived: ['حذف‌شده', ''] };
  async function loadAllListings() {
    const qs = `status=${encodeURIComponent(allState.status)}&page=${allState.page}&limit=20` + (allState.q ? `&q=${encodeURIComponent(allState.q)}` : '');
    const data = await api('/admin/listings-all?' + qs);
    const rows = data.items || []; allState.items = rows;
    const total = Number(data.total || 0), pages = Math.max(1, Math.ceil(total / 20));
    const seg = el('div', null, 'seg');
    ALL_STATUS.forEach(([k, l]) => seg.append(button(l, 'all-filter', k === allState.status ? 'on' : '', { status: k })));
    const q = el('input'); q.type = 'search'; q.id = 'allQ'; q.className = 'all-q'; q.value = allState.q;
    q.placeholder = 'جستجو: عنوان، برند، مدل، شهر، نام یا شماره صاحب آگهی';
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); allState.q = q.value.trim(); allState.page = 1; loadAllListings().catch((err) => toast(err.message || 'ناموفق بود.', 'err')); } });
    const bar = h('div', 'all-bar', q, button('جستجو', 'all-search', 'pri'));
    const head = el('p', `${faNumber(total)} آگهی`, 'note');
    if (!rows.length) { view.replaceChildren(seg, bar, head, empty('آگهی‌ای پیدا نشد', 'فیلتر یا عبارت جستجو را تغییر دهید.', 'car')); return; }
    const list = el('div', null, 'rows');
    rows.forEach((x) => {
      const img = Array.isArray(x.photos) && x.photos[0] && x.photos[0].url;
      const thumb = el('div', null, 'thumb'); if (img) { const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; thumb.append(i); } else thumb.append(svg('car'));
      const st = ALL_BADGE[x.status] || [x.status || '', ''];
      const chips = el('div', null, 'chips');
      chips.append(chip(st[0], st[1]));
      const mm = [x.make, x.model].filter(Boolean).join(' '); if (mm) chips.append(chip(mm, 'info', 'car'));
      if (x.year) chips.append(chip(String(x.year), '', 'cal')); if (x.city) chips.append(chip(x.city, '', 'pin'));
      if (x.created_at) chips.append(chip(when(x.created_at), '', 'clock'));
      const price = x.price_negotiable || !x.price_toman ? 'قیمت توافقی' : faNumber(x.price_toman) + ' تومان';
      const main = h('div', 'grow', el('h3', x.ad_title || x.title || 'بدون عنوان'), el('div', price, 'price'), chips);
      const c = h('article', 'card', h('div', 'row', thumb, main));
      if (x.status === 'rejected' && x.rejection_reason) c.append(el('div', 'دلیل رد: ' + x.rejection_reason, 'alertline'));
      const who = x.display_name || 'کاربر';
      c.append(h('div', 'owner', el('span', initial(who), 'av'), h('div', null, el('b', who), el('small', x.phone_e164 || ''))));
      const acts = el('div', null, 'actions');
      if (x.status === 'archived') acts.append(button('بازگردانی و انتشار', 'all-restore', 'ok solid', { id: x.id }, 'check'));
      else acts.append(button('ویرایش', 'all-edit', '', { id: x.id }, 'edit'), button('حذف آگهی', 'all-del', 'bad', { id: x.id }, 'trash'));
      c.append(acts);
      list.append(c);
    });
    const pager = pages > 1 ? h('div', 'pager',
      allState.page > 1 ? button('صفحهٔ قبل', 'all-page', '', { page: allState.page - 1 }) : null,
      el('span', `صفحهٔ ${faNumber(allState.page)} از ${faNumber(pages)}`),
      allState.page < pages ? button('صفحهٔ بعد', 'all-page', '', { page: allState.page + 1 }) : null) : null;
    view.replaceChildren(seg, bar, head, list, pager);
  }
  async function allEdit(id) {
    const x = allState.items.find((i) => i.id === id); if (!x) return;
    const adT = adInp('text', x.ad_title || '', { maxlength: 80, placeholder: 'اگر پر باشد، در سایت به‌جای «برند + مدل» نمایش داده می‌شود' });
    const make = adInp('text', x.make, { maxlength: 80 });
    const model = adInp('text', x.model, { maxlength: 100 });
    const year = adInp('text', x.year, { inputmode: 'numeric', maxlength: 4, dir: 'ltr' });
    const city = adInp('text', x.city, { maxlength: 80 });
    const price = adInp('text', x.price_toman == null ? '' : x.price_toman, { inputmode: 'numeric', dir: 'ltr', placeholder: 'تومان' });
    const neg = el('input'); neg.type = 'checkbox'; neg.checked = !!x.price_negotiable;
    const desc = el('textarea'); desc.maxLength = 5000; desc.value = x.description || '';
    const body = h('div', 'form',
      field('عنوان آگهی', adT), field('برند', make), field('مدل', model), field('سال', year), field('شهر', city),
      field('قیمت (تومان)', price), h('label', 'chk', neg, el('span', 'قیمت توافقی')), field('توضیحات', desc));
    const ok = await formModal({ title: 'ویرایش آگهی', body, okText: 'ذخیره', onSubmit: async () => {
      const payload = {};
      const put = (k, v, old) => { if (String(v) !== String(old == null ? '' : old)) payload[k] = v; };
      if (!make.value.trim() || !model.value.trim()) throw new Error('برند و مدل نمی‌تواند خالی باشد.');
      if (city.value.trim().length < 2) throw new Error('شهر معتبر نیست.');
      const yr = Number(digits(year.value));
      if (!yr || yr < 1950 || yr > new Date().getFullYear() + 1) throw new Error('سال معتبر نیست.');
      put('adTitle', adT.value.trim(), x.ad_title);
      put('make', make.value.trim(), x.make); put('model', model.value.trim(), x.model);
      put('year', yr, x.year); put('city', city.value.trim(), x.city);
      const pd = digits(price.value); const pv = pd ? Number(pd) : null;
      if (String(pv == null ? '' : pv) !== String(x.price_toman == null ? '' : x.price_toman)) payload.priceToman = pv;
      if (neg.checked !== !!x.price_negotiable) payload.priceNegotiable = neg.checked;
      put('description', desc.value.trim(), x.description);
      if (!Object.keys(payload).length) throw new Error('تغییری انجام نشده است.');
      await api('/admin/listings/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(payload) });
      return true;
    } });
    if (ok) { toast('آگهی ویرایش شد'); await loadAllListings(); }
  }
  async function allDelete(id) {
    const x = allState.items.find((i) => i.id === id); if (!x) return;
    const okAsk = await ask({ title: 'حذف آگهی', text: `«${x.ad_title || x.title || 'آگهی'}» از سایت و از حساب صاحبش برداشته می‌شود. نسخه‌اش در تب «حذف‌شده» می‌ماند و قابل بازگردانی است.`, input: false, okText: 'حذف آگهی', okClass: 'bad' });
    if (!okAsk) return;
    await api('/admin/listings/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('آگهی حذف شد'); await loadAllListings(); refreshCounts();
  }

  async function renderTab(tab = currentTab, quiet) {
    currentTab = tab; setHeader(tab);
    document.querySelectorAll('.nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (!quiet) skeleton();
    try {
      if (tab === 'overview') await loadOverview(); else if (tab === 'listings') await loadListings(); else if (tab === 'allads') await loadAllListings();
      else if (tab === 'showrooms') await loadShowrooms(); else if (tab === 'reports') await loadReports();
      else if (tab === 'ads') await loadAds(); else if (tab === 'banners') await loadBanners(); else if (tab === 'staff') await loadStaff(); else await loadAudit();
    } catch (error) { showMessage(error.message || 'دریافت اطلاعات ناموفق بود.'); }
  }

  /* ---------- actions ---------- */
  function fadeOut(btn) { const c = btn.closest('.card'); if (c) { c.classList.add('out'); return new Promise(r => setTimeout(r, 280)); } return Promise.resolve(); }
  async function reviewListing(id, status, btn) {
    let reason = '';
    if (status === 'rejected') {
      reason = await ask({ title: 'رد آگهی', text: 'دلیل برای صاحب آگهی نمایش داده می‌شود.', placeholder: 'دلیل رد آگهی…', required: true, okText: 'رد آگهی', okClass: 'bad',
        quick: ['تصویر نامناسب یا ناواضح', 'اطلاعات ناقص یا نادرست', 'قیمت غیرواقعی', 'آگهی تکراری', 'مغایر با قوانین سایت'] });
      if (!reason) return false;
    } else if (status === 'archived') {
      if (!await ask({ title: 'بایگانی آگهی', text: 'آگهی از لیست بررسی خارج و بایگانی می‌شود.', input: false, okText: 'بایگانی', okClass: 'warn' })) return false;
    }
    await api(`/admin/listings/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify({ status, reason: typeof reason === 'string' ? reason : '' }) });
    await fadeOut(btn); toast(status === 'published' ? 'آگهی منتشر شد' : status === 'rejected' ? 'آگهی رد شد' : 'آگهی بایگانی شد');
    await renderTab('listings', true); return true;
  }
  async function reviewShowroom(id, status, btn) {
    let reason = '';
    if (status === 'rejected') { const r = await ask({ title: 'رد نمایشگاه', text: 'دلیل رد (اختیاری)', placeholder: 'دلیل…', okText: 'رد نمایشگاه', okClass: 'bad' }); if (r === null) return false; reason = typeof r === 'string' ? r : ''; }
    await api(`/admin/showrooms/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
    await fadeOut(btn); toast(status === 'approved' ? 'نمایشگاه تأیید شد' : 'نمایشگاه رد شد'); await renderTab('showrooms', true); return true;
  }
  async function reviewReport(id, status, btn) {
    let resolutionNote = '';
    if (status === 'resolved') { const r = await ask({ title: 'حل گزارش', text: 'یادداشت (اختیاری)', placeholder: 'چه اقدامی انجام شد؟', okText: 'ثبت به‌عنوان حل‌شده', okClass: 'ok solid' }); if (r === null) return false; resolutionNote = typeof r === 'string' ? r : ''; }
    await api(`/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, resolutionNote }) });
    await fadeOut(btn); toast('وضعیت گزارش به‌روز شد'); await renderTab('reports', true); refreshCounts(); return true;
  }
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-tab],[data-action="goto"]')) closeAll();
    const nav = event.target.closest('[data-tab]'); if (nav) { await renderTab(nav.dataset.tab); window.scrollTo({ top: 0 }); return; }
    const b = event.target.closest('[data-action]'); if (!b || busy || b.dataset.action === 'x') return; const a = b.dataset.action;
    if (a === 'goto') { await renderTab(b.dataset.tab); window.scrollTo({ top: 0 }); return; }
    busy = true; b.disabled = true;
    try {
      if (a.startsWith('ad-')) await adAction(a, b);
      else if (a === 'listing-publish') await reviewListing(b.dataset.id, 'published', b);
      else if (a === 'listing-reject') await reviewListing(b.dataset.id, 'rejected', b);
      else if (a === 'listing-archive') await reviewListing(b.dataset.id, 'archived', b);
      else if (a === 'all-filter') { allState.status = b.dataset.status; allState.page = 1; await loadAllListings(); }
      else if (a === 'all-search') { allState.q = ((document.getElementById('allQ') || {}).value || '').trim(); allState.page = 1; await loadAllListings(); }
      else if (a === 'all-page') { allState.page = Number(b.dataset.page) || 1; await loadAllListings(); window.scrollTo({ top: 0 }); }
      else if (a === 'all-edit') await allEdit(b.dataset.id);
      else if (a === 'all-del') await allDelete(b.dataset.id);
      else if (a === 'all-restore') { await api(`/admin/listings/${encodeURIComponent(b.dataset.id)}/review`, { method: 'PATCH', body: JSON.stringify({ status: 'published', reason: '' }) }); toast('آگهی دوباره منتشر شد'); await loadAllListings(); refreshCounts(); }
      else if (a === 'showroom-approve') await reviewShowroom(b.dataset.id, 'approved', b);
      else if (a === 'showroom-reject') await reviewShowroom(b.dataset.id, 'rejected', b);
      else if (a === 'report-filter') await loadReports(b.dataset.status);
      else if (a === 'report-review') await reviewReport(b.dataset.id, 'reviewing', b);
      else if (a === 'report-resolve') await reviewReport(b.dataset.id, 'resolved', b);
      else if (a === 'report-dismiss') await reviewReport(b.dataset.id, 'dismissed', b);
      else if (a === 'banner-add') await bannerForm(null);
      else if (a === 'banner-edit') await bannerForm(bannerCache.find((x) => x.id === b.dataset.id));
      else if (a === 'banner-toggle') { await api('/admin/banners/' + encodeURIComponent(b.dataset.id), { method: 'PATCH', body: JSON.stringify({ active: b.dataset.on === '1' }) }); toast('ذخیره شد'); await loadBanners(); }
      else if (a === 'banner-move') { await api('/admin/banners/' + encodeURIComponent(b.dataset.id) + '/move', { method: 'POST', body: JSON.stringify({ dir: b.dataset.dir }) }); await loadBanners(); }
      else if (a === 'banner-del') { if (await ask({ title: 'حذف بنر', text: 'این بنر از صفحه اصلی برداشته می‌شود.', input: false, okText: 'حذف', okClass: 'bad' })) { await api('/admin/banners/' + encodeURIComponent(b.dataset.id), { method: 'DELETE' }); toast('بنر حذف شد'); await loadBanners(); } }
      else if (a === 'staff-add') await staffForm(null);
      else if (a === 'staff-edit') await staffForm(staffCache.find((x) => x.id === b.dataset.id));
      else if (a === 'staff-del') { if (await ask({ title: 'حذف دسترسی مدیریتی', text: 'این شماره به کاربر عادی تبدیل می‌شود (داده‌ها و آگهی‌هایش حفظ می‌شود).', input: false, okText: 'حذف دسترسی', okClass: 'bad' })) { await api('/admin/staff/' + encodeURIComponent(b.dataset.id), { method: 'DELETE' }); toast('دسترسی حذف شد'); await loadStaff(); } }
      else if (a === 'invite-del') { await api('/admin/staff-invites/' + encodeURIComponent(b.dataset.phone), { method: 'DELETE' }); toast('دعوت لغو شد'); await loadStaff(); }
    } catch (error) { toast(error.message || 'عملیات ناموفق بود.', 'err'); }
    finally { busy = false; b.disabled = false; }
  });
  /* ---------- پوسته: منوی کشویی، اعلان‌ها، منوی حساب، جستجو ---------- */
  const sideEl = document.getElementById('side'), scrimEl = document.getElementById('scrim');
  function closeAll() { sideEl.classList.remove('open'); scrimEl.hidden = true; ['bellPop', 'avPop'].forEach((id) => { document.getElementById(id).hidden = true; }); ['bellBtn', 'avBtn'].forEach((id) => document.getElementById(id).setAttribute('aria-expanded', 'false')); }
  function togglePop(popId, btnId) { const p = document.getElementById(popId), open = p.hidden; closeAll(); p.hidden = !open; document.getElementById(btnId).setAttribute('aria-expanded', String(open)); }
  document.getElementById('menuBtn').addEventListener('click', () => { closeAll(); sideEl.classList.add('open'); scrimEl.hidden = false; });
  document.getElementById('sideClose').addEventListener('click', closeAll);
  scrimEl.addEventListener('click', closeAll);
  document.getElementById('bellBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePop('bellPop', 'bellBtn'); });
  document.getElementById('avBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePop('avPop', 'avBtn'); });
  document.getElementById('markAll').addEventListener('click', markAllRead);
  document.addEventListener('click', (e) => { if (!e.target.closest('.pop-wrap')) { ['bellPop', 'avPop'].forEach((id) => { document.getElementById(id).hidden = true; }); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault(); const v = document.getElementById('searchInput').value.trim();
    if (!can('listings')) { toast('برای جستجوی آگهی دسترسی ندارید.', 'err'); return; }
    allState.q = v; allState.status = 'all'; allState.page = 1; renderTab('allads'); window.scrollTo({ top: 0 });
  });
  document.getElementById('refreshBtn').addEventListener('click', () => renderTab(currentTab));
  document.getElementById('logoutButton').addEventListener('click', async () => { try { await api('/auth/logout', { method: 'POST', body: '{}' }); } catch (_) {} location.href = '/'; });
  const $=(id)=>document.getElementById(id);
  const loginBox=$('login');
  function toLatin(s){return String(s||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));}
  function digits(s){return toLatin(s).replace(/\D/g,'');}
  function phoneCore(v){let d=digits(v);if(d.startsWith('98')&&d.length>=12)d=d.slice(2);if(d.startsWith('0'))d=d.slice(1);return d.slice(0,10);}
  function phoneOk(v){return /^9\d{9}$/.test(phoneCore(v));}
  function fmtPhone(v){const d=phoneCore(v);return [d.slice(0,3),d.slice(3,6),d.slice(6,10)].filter(Boolean).join(' ');}
  function lgErr(t){$('lgErr').textContent=t||'';}
  function showGate(msg,withLogout){loginBox.hidden=true;gate.hidden=false;gateMessage.textContent=msg;$('gateLogout').hidden=!withLogout;}
  function showLogin(){gate.hidden=true;app.hidden=true;loginBox.hidden=false;badge.textContent='نشست وارد نشده';setTimeout(()=>$('lgPhone').focus(),50);}
  async function enterPanel(user){
    role=user?.role||'';perms=Array.isArray(user?.permissions)?user.permissions:[];
    if(!['admin','moderator'].includes(role)){badge.textContent='بدون مجوز مدیریت';showGate('این حساب نقش مدیریتی ندارد.',true);return;}
    const isAdmin=role==='admin';badge.textContent=user?.display_name||user?.displayName||user?.phone_e164||user?.phone||'نشست فعال';
    document.getElementById('whoRole').textContent=isAdmin?'مدیر اصلی':'ناظر';
    document.querySelectorAll('[data-perm]').forEach(n=>{n.hidden=!can(n.dataset.perm);});
    whoName=(user?.display_name||user?.displayName||'').trim();document.getElementById('whoAv').textContent=(whoName||(isAdmin?'مدیر':'ناظر')).charAt(0);
    gate.hidden=true;loginBox.hidden=true;app.hidden=false;await renderTab('overview');
  }
  let cdTimer=null;
  function startCooldown(sec){
    clearInterval(cdTimer);let left=sec;const b=$('lgResend');
    const tick=()=>{if(left<=0){clearInterval(cdTimer);b.disabled=false;b.textContent='ارسال مجدد کد';return;}b.disabled=true;b.textContent='ارسال مجدد کد تا '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+' دیگر';left--;};
    tick();cdTimer=setInterval(tick,1000);
  }
  const otpBoxes=()=>Array.from(document.querySelectorAll('#lgOtp input'));
  const otpValue=()=>otpBoxes().map(x=>digits(x.value).slice(0,1)).join('');
  function otpUpdate(){$('lgVerify').disabled=otpValue().length!==6;}
  async function sendCode(){
    const core=phoneCore($('lgPhone').value);lgErr('');
    $('lgSend').disabled=true;$('lgResend').disabled=true;
    try{
      const r=await api('/auth/otp/request',{method:'POST',body:JSON.stringify({phone:'+98'+core})});
      $('lgStep1').hidden=true;$('lgStep2').hidden=false;
      $('lgSub').textContent='کد ۶ رقمی ارسال‌شده به 0'+core+' را وارد کنید.';
      otpBoxes().forEach(x=>x.value='');otpUpdate();startCooldown(Number(r?.resendAfterSeconds)||60);
      setTimeout(()=>otpBoxes()[0].focus(),50);
    }catch(e){lgErr(e.message||'ارسال کد ناموفق بود.');$('lgSend').disabled=!phoneOk($('lgPhone').value);if($('lgStep2').hidden===false)$('lgResend').disabled=false;}
  }
  async function verifyCode(){
    const core=phoneCore($('lgPhone').value);lgErr('');$('lgVerify').disabled=true;
    try{
      await api('/auth/otp/verify',{method:'POST',body:JSON.stringify({phone:'+98'+core,code:otpValue()})});
      const me=await api('/auth/me');await enterPanel(me?.user);
    }catch(e){lgErr(e.message||'کد نادرست است.');otpBoxes().forEach(x=>x.value='');otpUpdate();otpBoxes()[0].focus();}
  }
  $('lgPhone').addEventListener('input',(e)=>{e.target.value=fmtPhone(e.target.value);$('lgSend').disabled=!phoneOk(e.target.value);});
  $('lgPhone').addEventListener('keydown',(e)=>{if(e.key==='Enter'&&phoneOk(e.target.value))sendCode();});
  $('lgSend').addEventListener('click',sendCode);
  $('lgResend').addEventListener('click',sendCode);
  $('lgVerify').addEventListener('click',verifyCode);
  $('lgBack').addEventListener('click',()=>{clearInterval(cdTimer);$('lgStep2').hidden=true;$('lgStep1').hidden=false;lgErr('');$('lgSend').disabled=!phoneOk($('lgPhone').value);$('lgPhone').focus();});
  otpBoxes().forEach((box,i,all)=>{
    box.addEventListener('input',()=>{const d=digits(box.value);if(d.length>1){d.slice(0,6).split('').forEach((c,k)=>{if(all[k])all[k].value=c;});all[Math.min(d.length,6)-1].focus();}else{box.value=d;if(d&&all[i+1])all[i+1].focus();}otpUpdate();if(otpValue().length===6)verifyCode();});
    box.addEventListener('keydown',(e)=>{if(e.key==='Backspace'&&!box.value&&all[i-1]){all[i-1].focus();all[i-1].value='';otpUpdate();}if(e.key==='Enter'&&otpValue().length===6)verifyCode();});
    box.addEventListener('paste',(e)=>{const d=digits((e.clipboardData||window.clipboardData).getData('text'));if(!d)return;e.preventDefault();d.slice(0,6).split('').forEach((c,k)=>{if(all[k])all[k].value=c;});all[Math.min(d.length,6)-1].focus();otpUpdate();if(otpValue().length===6)verifyCode();});
  });
  $('gateLogout').addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST',body:'{}'});}catch(_){}location.reload();});
  (async()=>{
    try{
      const data=await api('/auth/me');await enterPanel(data?.user);
    }catch(error){
      if(error.status===401){showLogin();return;}
      badge.textContent='خطای اتصال';showGate('بررسی نشست امکان‌پذیر نشد؛ اتصال بک‌اند را بررسی کنید.',false);
    }
  })();
})();
