/* CarMaa — بازار همکاران (نسخهٔ ساده و سریع، v3). فقط برای نمایشگاه‌های تأییدشده. همهٔ متن‌ها با textContent ساخته می‌شوند (بدون innerHTML).
   همهٔ امکانات نسخهٔ قبل حفظ شده؛ فقط چیدمان ساده‌تر شده: ۴ بخش + دکمهٔ مرکزی «ثبت»، فرم‌های دو‌سطحی (اصلی / جزئیات بیشتر)،
   پیشنهادها بر اساس «نیاز به اقدام»، و بخش «من» با زیرتب. APIها دقیقاً همان‌ها هستند. */
(function () {
  'use strict';
  if (window.__CM_PARTNERS__) return; window.__CM_PARTNERS__ = true;

  var api = function (p, o) {
    if (!window.CARMA_API || !window.CARMA_API.request) return Promise.reject(new Error('اتصال به سرور برقرار نیست.'));
    return window.CARMA_API.request('/partners' + p, o);
  };
  var post = function (p, body) { return api(p, { method: 'POST', body: JSON.stringify(body || {}) }); };
  var DIG = '۰۱۲۳۴۵۶۷۸۹';
  var fd = function (n) { return String(n).replace(/\d/g, function (d) { return DIG[d]; }); };
  var fa = function (n) { try { return Number(n).toLocaleString('fa-IR'); } catch (_) { return String(n); } };
  var toEn = function (s) { return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return DIG.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/٫/g, '.'); };
  var num = function (v) { var s = toEn(v).replace(/[^\d.]/g, ''); return s ? Number(s) : null; };
  function money(t) {
    if (t == null) return '';
    if (t >= 1e9) return fa(Math.round(t / 1e8) / 10) + ' میلیارد تومان';
    return fa(Math.round(t / 1e6)) + ' میلیون تومان';
  }
  function moneyExact(m) { // m = میلیون تومان؛ برای نمایش زندهٔ مبلغ زیر فیلد
    if (m == null || isNaN(m)) return '';
    m = Math.round(m); if (m <= 0) return '';
    var b = Math.floor(m / 1000), r = m % 1000, s = [];
    if (b) s.push(fa(b) + ' میلیارد'); if (r) s.push(fa(r) + ' میلیون');
    return s.join(' و ') + ' تومان';
  }
  function ymt(y) { return y >= 1700 ? fd(y) + ' (' + fd(y - 621) + ')' : fd(y); }
  function yearsText(a, b) {
    if (a && b) return a === b ? ymt(a) : fd(a) + ' تا ' + fd(b);
    if (a) return 'از ' + fd(a);
    if (b) return 'تا ' + fd(b);
    return '';
  }
  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return fa(Math.max(1, Math.round(s / 60))) + ' دقیقه پیش';
    if (s < 86400) return fa(Math.round(s / 3600)) + ' ساعت پیش';
    return fa(Math.round(s / 86400)) + ' روز پیش';
  }
  function daysLeft(iso) { return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)); }
  function h(tag, props) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (c) { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    }
    return e;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M21 21l-4.3-4.3' }]],
    tune: [['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }], ['circle', { cx: 15, cy: 7, r: 2 }], ['circle', { cx: 9, cy: 17, r: 2 }]],
    bookmark: [['path', { d: 'M6 3h12v18l-6-4-6 4V3z' }]],
    star: [['path', { d: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z' }]],
    chat: [['path', { d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' }]],
    x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    zap: [['path', { d: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
    shield: [['path', { d: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z' }], ['path', { d: 'M9 12l2.2 2.2L15.5 10' }]],
    swap: [['path', { d: 'M7 7h12l-3-3M17 17H5l3 3' }]],
    trend: [['path', { d: 'M3 17l6-6 4 4 8-8M15 7h6v6' }]],
    grid: [['rect', { x: 3, y: 3, width: 7, height: 7, rx: 2 }], ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 2 }], ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 2 }], ['rect', { x: 14, y: 14, width: 7, height: 7, rx: 2 }]],
    user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c0-4 3.6-7 8-7s8 3 8 7' }]],
    bell: [['path', { d: 'M6 9a6 6 0 1 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9zM10 20a2 2 0 0 0 4 0' }]],
    eye: [['path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    back: [['path', { d: 'M15 6l-6 6 6 6' }]],
    flag: [['path', { d: 'M5 21V4M5 4h11l-2 4 2 4H5' }]],
  };
  function ic(name, size, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 18); s.setAttribute('height', size || 18);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
    (ICONS[name] || []).forEach(function (n) { var el = document.createElementNS(SVGNS, n[0]); Object.keys(n[1]).forEach(function (k) { el.setAttribute(k, n[1][k]); }); s.append(el); });
    return s;
  }

  var DEALS = { cash: 'نقد', exchange: 'معاوضه', installment: 'اقساط', consignment: 'حق‌العمل' };
  var TAGS = { fast: 'سریع', honest: 'صادق', fair_price: 'قیمت منصفانه', good_docs: 'مدارک کامل', professional: 'حرفه‌ای', late: 'دیرکرد', unresponsive: 'دیر پاسخ' };
  var REASONS = { fake: 'آگهی صوری/نادرست', sold: 'قبلاً فروخته شده', spam: 'تبلیغ/اسپم', abuse: 'رفتار نامناسب', other: 'سایر' };
  var OFFER_ST = { pending: 'در انتظار پاسخ', accepted: 'پذیرفته شد', declined: 'رد شد', withdrawn: 'پس گرفته شد', completed: 'معامله انجام شد' };
  var TIER_NEXT = { 1: ['همکار فعال', 1], 2: ['همکار حرفه‌ای', 5], 3: ['همکار برتر', 15], 4: null };
  var SORTS = [['new', 'تازه‌ترین'], ['urgent', 'فوری‌ها اول'], ['price_asc', 'ارزان‌ترین'], ['price_desc', 'گران‌ترین'], ['expiring', 'در آستانهٔ انقضا']];

  var CSS = [
    ":root{--cmp-bg:#0e0e10;--cmp-s1:#232328;--cmp-s2:#323239;--cmp-s3:#45454d;--cmp-line:rgba(255,255,255,.12);--cmp-tx:#fff;--cmp-mu:rgba(235,235,245,.58);--cmp-mu2:rgba(235,235,245,.8);--cmp-ac:#c6f432;--cmp-acx:#0b0f02;--cmp-red:#ff453a;--cmp-grn:#30d158;--cmp-amb:#ff9f0a;--cmp-blue:#0071E3;--cmp-pur:#bf5af2}",
    ".cmp{position:fixed;inset:0;z-index:100000;background:var(--cmp-bg);color:var(--cmp-tx);display:flex;flex-direction:column;direction:rtl;font-family:inherit;font-size:15px;animation:cmp-in .2s ease;-webkit-font-smoothing:antialiased}",
    "@keyframes cmp-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes cmp-up{from{transform:translateY(100%)}to{transform:none}}",
    ".cmp *,.cmp-sheet *,.cmp-nav *{box-sizing:border-box}.cmp button,.cmp-sheet button,.cmp-nav button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s ease,opacity .12s ease,background .15s ease}.cmp button:active,.cmp-sheet button:active,.cmp-nav button:active{opacity:.7}",
    ".cmp button:focus-visible,.cmp input:focus-visible,.cmp-sheet button:focus-visible,.cmp-sheet input:focus-visible,.cmp-sheet select:focus-visible,.cmp-sheet textarea:focus-visible,.cmp-nav button:focus-visible,.cmp summary:focus-visible,.cmp-sheet summary:focus-visible{outline:2px solid var(--cmp-blue);outline-offset:2px}",
    ".cmp-top{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top,0px) + 8px) max(16px,calc((100% - 720px)/2)) 10px;background:rgba(38,38,40,.82);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);position:relative;z-index:6}",
    ".cmp-top .cmp-ttl{flex:1;min-width:0}.cmp-top h2{margin:0;font-size:24px;font-weight:800;line-height:1.35}.cmp-top p{margin:0;font-size:12.5px;color:var(--cmp-mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".cmp-ib{background:var(--cmp-s2);border:0;color:var(--cmp-tx);width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;position:relative;flex:none;padding:0}.cmp-ib.sm{width:32px;height:32px}",
    ".cmp-ib.on{background:var(--cmp-ac);color:var(--cmp-acx)}.cmp-ib i{position:absolute;top:-4px;left:-4px;background:var(--cmp-red);color:#fff;font-style:normal;font-size:10px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}",
    ".cmp-body{flex:1;overflow:auto;padding:0 16px calc(env(safe-area-inset-bottom,0px) + 112px);overscroll-behavior:contain;-webkit-overflow-scrolling:touch}",
    ".cmp-wrap{max-width:720px;margin-inline:auto}",
    ".cmp-nav{position:fixed;inset-inline:0;bottom:0;z-index:100001;background:rgba(30,30,35,.88);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);border-top:.5px solid var(--cmp-line);padding:6px 8px calc(env(safe-area-inset-bottom,0px) + 4px);direction:rtl}",
    ".cmp-nav-in{display:grid;grid-template-columns:1fr 1fr 70px 1fr 1fr;align-items:end;max-width:560px;margin-inline:auto}",
    ".cmp-nb{background:none;border:0;color:var(--cmp-mu);display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;border-radius:12px;font-size:10.5px;font-weight:500;position:relative;min-height:50px;justify-content:center}.cmp-nb.on{color:var(--cmp-ac);font-weight:700}",
    ".cmp-nb i{position:absolute;top:2px;right:calc(50% - 22px);background:var(--cmp-red);color:#fff;font-style:normal;font-size:10px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}",
    ".cmp-add{background:none;border:0;color:var(--cmp-mu);display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;font-weight:500;padding:0 0 6px}.cmp-add b{width:50px;height:50px;border-radius:50%;background:var(--cmp-ac);color:var(--cmp-acx);display:flex;align-items:center;justify-content:center;margin-top:-20px;box-shadow:0 6px 18px rgba(198,244,50,.25)}",
    ".cmp-stick{position:sticky;top:0;z-index:5;background:var(--cmp-bg);padding:8px 0;display:flex;gap:8px;align-items:center}",
    ".cmp-search{display:flex;align-items:center;gap:8px;background:var(--cmp-s1);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);border-radius:12px;padding:0 12px;color:var(--cmp-mu);flex:1;min-width:0}.cmp-search input{flex:1;background:none;border:0;color:var(--cmp-tx);font-size:16px;padding:11px 0;font-family:inherit;min-width:0;outline:0}.cmp-search input::placeholder{color:var(--cmp-mu)}.cmp-search:focus-within{box-shadow:0 0 0 2px rgba(0,113,227,.5)}",
    ".cmp-seg{display:flex;gap:2px;background:var(--cmp-s1);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);border-radius:11px;padding:2px;margin:12px 0}.cmp-seg button{flex:1;padding:8px 6px;border-radius:9px;border:0;background:none;color:var(--cmp-mu2);font-size:13px;font-weight:500;min-height:34px;white-space:nowrap}.cmp-seg button.on{background:var(--cmp-s3);color:var(--cmp-tx);font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.35)}",
    ".cmp-chips{display:flex;gap:8px;margin:0 -16px 6px;padding:2px 16px;overflow-x:auto;scrollbar-width:none}.cmp-chips::-webkit-scrollbar{display:none}",
    ".cmp-chip{flex:none;padding:7px 14px;border-radius:99px;border:0;background:var(--cmp-s1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);color:var(--cmp-mu2);font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:5px;min-height:34px}.cmp-chip.on{background:rgba(198,244,50,.16);color:var(--cmp-ac);font-weight:700}.cmp-chip.rm{background:var(--cmp-s2);color:var(--cmp-tx)}",
    ".cmp-stat{font-size:12.5px;color:var(--cmp-mu);margin:4px 4px 12px}.cmp-stat b{color:var(--cmp-mu2);font-weight:700}",
    ".cmp-card{background:var(--cmp-s1);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);border-radius:20px;padding:16px;margin-bottom:12px;position:relative;animation:cmp-in .22s ease both}.cmp-card.tap{cursor:pointer}.cmp-card.tap:active{background:var(--cmp-s2)}.cmp-card.urgent{box-shadow:inset 0 0 0 1.5px rgba(255,69,58,.55)}.cmp-card.need{box-shadow:inset 0 0 0 1.5px rgba(198,244,50,.6)}",
    ".cmp-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cmp-grow{flex:1;min-width:0}.cmp-badge{font-size:11.5px;padding:3px 10px;border-radius:99px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}",
    ".cmp-lbl{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--cmp-mu2)}.cmp-lbl i{width:8px;height:8px;border-radius:50%;background:currentColor}.cmp-lbl.have{color:var(--cmp-grn)}.cmp-lbl.want{color:var(--cmp-amb)}",
    ".cmp-have{background:rgba(48,209,88,.16);color:var(--cmp-grn)}.cmp-want{background:rgba(255,159,10,.16);color:var(--cmp-amb)}.cmp-hot{background:rgba(255,69,58,.16);color:var(--cmp-red)}.cmp-mute{background:var(--cmp-s2);color:var(--cmp-mu2)}.cmp-blue{background:rgba(0,113,227,.16);color:#2997FF}",
    ".cmp-t1{background:var(--cmp-s2);color:var(--cmp-mu2)}.cmp-t2{background:rgba(0,113,227,.16);color:#2997FF}.cmp-t3{background:rgba(191,90,242,.16);color:#d49bff}.cmp-t4{background:rgba(255,159,10,.16);color:#ffb340}",
    ".cmp-title{font-size:18px;font-weight:700;line-height:1.45;margin:0}.cmp-meta{font-size:13px;color:var(--cmp-mu);line-height:1.8}.cmp-note{font-size:14px;color:var(--cmp-mu2);margin:12px 0 0;line-height:1.9;white-space:pre-wrap;word-break:break-word}.cmp-note.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".cmp-price{font-size:20px;font-weight:800;color:var(--cmp-tx);margin:6px 0 0}.cmp-price small{font-size:12px;color:var(--cmp-grn);font-weight:600;margin-inline-start:8px}",
    ".cmp-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.cmp-tag{font-size:12px;padding:4px 10px;border-radius:99px;background:var(--cmp-s2);color:var(--cmp-mu2);border:0}",
    ".cmp-thumb{width:84px;height:84px;border-radius:16px;object-fit:cover;background:var(--cmp-s2);flex:none}",
    ".cmp-sr{display:flex;align-items:center;gap:10px;padding:12px 0 0;margin-top:14px;border-top:.5px solid var(--cmp-line);width:100%;background:none;border-inline:0;border-bottom:0;color:inherit;text-align:right}",
    ".cmp-sr.box{border:0;border-radius:16px;padding:12px;margin:0 0 8px;background:var(--cmp-s1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09)}",
    ".cmp-av{width:38px;height:38px;border-radius:50%;background:var(--cmp-s3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;overflow:hidden;flex:none;color:var(--cmp-ac)}.cmp-av img{width:100%;height:100%;object-fit:cover}.cmp-av.lg{width:56px;height:56px;font-size:23px}",
    ".cmp-sn{font-size:14.5px;font-weight:700;display:flex;align-items:center;gap:5px}.cmp-star{color:var(--cmp-amb)}.cmp-sr .cmp-badge{padding:2px 8px;font-size:11px}",
    ".cmp-btn{white-space:nowrap;border:0;border-radius:14px;padding:10px 16px;font-size:15px;background:var(--cmp-ac);color:var(--cmp-acx);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:46px}.cmp-btn.sub{background:var(--cmp-s2);color:var(--cmp-tx);font-weight:600}.cmp-btn.red{background:rgba(255,69,58,.16);color:var(--cmp-red)}.cmp-btn.sm{padding:7px 14px;min-height:36px;font-size:13px;border-radius:12px}.cmp-btn:disabled{opacity:.45}.cmp-btn.full{width:100%}.cmp-btn.ico{width:46px;padding:0;flex:none}",
    ".cmp-acts{display:flex;gap:8px;margin-top:14px}.cmp-acts .cmp-btn{flex:1}.cmp-sh-f .cmp-acts .cmp-btn:first-child:not(:last-child){flex:2}.cmp-acts .cmp-btn.ico{flex:none}.cmp-acts.wrap{flex-wrap:wrap}.cmp-acts.wrap .cmp-btn{min-width:96px;white-space:normal;text-align:center;line-height:1.5}.cmp-acts.wrap .cmp-btn:first-child{flex:2 1 150px}",
    ".cmp-save{background:none;border:0;color:var(--cmp-mu);padding:6px;border-radius:10px;margin:-6px}.cmp-save.on{color:var(--cmp-ac)}.cmp-save.on svg{fill:var(--cmp-ac)}",
    ".cmp-empty{text-align:center;color:var(--cmp-mu);padding:48px 16px;font-size:14px;line-height:2}.cmp-empty b{display:block;color:var(--cmp-tx);font-size:17px;margin-bottom:4px}.cmp-empty .cmp-btn{margin-top:14px}",
    ".cmp-h{font-size:19px;font-weight:800;margin:24px 2px 10px;display:flex;align-items:center;gap:8px}.cmp-h span{font-size:13px;color:var(--cmp-mu);font-weight:500;margin-inline-start:auto}.cmp-h.need{color:var(--cmp-tx)}",
    ".cmp-sum{background:var(--cmp-s2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);border-radius:14px;padding:12px 14px;margin-top:14px}.cmp-sum-k{font-size:12px;color:var(--cmp-mu)}.cmp-sum-t{font-size:16px;font-weight:700;margin-top:2px;line-height:1.5}.cmp-sum-v{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:6px}.cmp-sum-v b{font-size:19px;font-weight:800;color:var(--cmp-ac)}.cmp-sum-v span{font-size:12.5px;color:var(--cmp-mu)}",
    ".cmp-quote{font-size:14px;color:var(--cmp-mu2);line-height:1.9;margin-top:12px;padding-inline-start:12px;border-inline-start:3px solid var(--cmp-s3);white-space:pre-wrap;word-break:break-word}",
    ".cmp-stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.cmp-st3{background:var(--cmp-s2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);border-radius:14px;padding:10px 6px;text-align:center}.cmp-st3 b{display:block;font-size:19px;font-weight:800}.cmp-st3 span{font-size:11.5px;color:var(--cmp-mu)}",
    ".cmp-grp{background:var(--cmp-s1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);border-radius:18px;overflow:hidden;margin-bottom:12px}.cmp-grp>button{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;border-bottom:.5px solid var(--cmp-line);padding:14px 16px;color:var(--cmp-tx);text-align:right;font-size:14.5px;min-height:52px}.cmp-grp>button:last-child{border-bottom:0}",
    ".cmp-sheet{position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:flex-end;direction:rtl;font-family:inherit;font-size:15px}",
    ".cmp-form{background:var(--cmp-s1);color:var(--cmp-tx);width:100%;max-height:92%;display:flex;flex-direction:column;border-radius:28px 28px 0 0;animation:cmp-up .26s cubic-bezier(.2,.8,.2,1)}",
    ".cmp-sh-h{padding:6px 18px 0;touch-action:none}.cmp-grab{width:38px;height:5px;border-radius:3px;background:var(--cmp-s3);margin:4px auto 8px}.cmp-sh-t{display:flex;align-items:center;gap:10px;padding-bottom:12px}.cmp-sh-t b{flex:1;font-size:18px;font-weight:800;min-width:0}",
    ".cmp-sh-b{flex:1;overflow:auto;padding:0 18px 16px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}",
    ".cmp-sh-f{padding:10px 18px calc(env(safe-area-inset-bottom,0px) + 12px);border-top:.5px solid var(--cmp-line);background:var(--cmp-s1)}.cmp-sh-f:empty{display:none}.cmp-sh-f .cmp-acts{margin-top:0}",
    ".cmp-f{display:block;margin:14px 0 0}.cmp-f>span{display:block;font-size:13px;color:var(--cmp-mu);margin:0 4px 6px}",
    ".cmp-sheet input,.cmp-sheet textarea,.cmp-sheet select{width:100%;background:var(--cmp-s2);border:0;border-radius:13px;color:var(--cmp-tx);padding:12px 14px;font-size:16px;font-family:inherit;min-height:48px}.cmp-sheet select{appearance:none;-webkit-appearance:none}.cmp-sheet textarea{resize:none;line-height:1.8}",
    ".cmp-sheet input:focus,.cmp-sheet textarea:focus,.cmp-sheet select:focus{box-shadow:0 0 0 2px rgba(0,113,227,.55);outline:0}.cmp-sheet input:disabled{opacity:.5}",
    ".cmp-two{display:flex;gap:8px}.cmp-two>*{flex:1;min-width:0}.cmp-hint{font-size:12.5px;color:var(--cmp-mu);margin:6px 4px 0;line-height:1.8;min-height:0}.cmp-hint.live{color:var(--cmp-ac);font-weight:600}.cmp-err{color:var(--cmp-red);font-size:13px;min-height:0;margin-bottom:8px}.cmp-err:empty{display:none}",
    ".cmp-opts{display:flex;gap:8px;flex-wrap:wrap}.cmp-opt{padding:8px 15px;border-radius:99px;border:0;background:var(--cmp-s2);color:var(--cmp-mu2);font-size:14px;min-height:38px}.cmp-opt.on{background:var(--cmp-ac);color:var(--cmp-acx);font-weight:700}",
    ".cmp-kinds{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.cmp-kind{text-align:right;padding:14px;border-radius:16px;border:0;background:var(--cmp-s2);color:var(--cmp-mu2)}.cmp-kind b{display:block;font-size:15px;color:var(--cmp-tx);margin-bottom:2px}.cmp-kind span{font-size:12px;line-height:1.7;display:block}.cmp-kind.on{box-shadow:inset 0 0 0 2px var(--cmp-ac);background:rgba(198,244,50,.08)}.cmp-kind.on b{color:var(--cmp-ac)}",
    ".cmp-more{margin-top:18px;border:0;border-radius:16px;background:var(--cmp-s2)}.cmp-more>summary{list-style:none;cursor:pointer;padding:14px 16px;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;min-height:48px}.cmp-more>summary::-webkit-details-marker{display:none}.cmp-more>summary::after{content:\"\";margin-inline-start:auto;width:8px;height:8px;border-inline-end:2px solid var(--cmp-mu);border-bottom:2px solid var(--cmp-mu);transform:rotate(45deg);transition:transform .2s}.cmp-more[open]>summary::after{transform:rotate(-135deg)}.cmp-more>summary small{color:var(--cmp-mu);font-weight:500;font-size:12px}.cmp-more-b{padding:0 16px 16px}",
    ".cmp-more .cmp-sheet input,.cmp-more input,.cmp-more textarea,.cmp-more select{background:var(--cmp-s3)}",
    ".cmp-rail{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}.cmp-rail::-webkit-scrollbar{display:none}.cmp-lst{flex:none;width:120px;background:var(--cmp-s2);border:0;border-radius:16px;padding:6px;color:var(--cmp-tx);text-align:right}.cmp-lst.on{box-shadow:inset 0 0 0 2px var(--cmp-ac)}.cmp-lst img,.cmp-lst .ph{width:100%;height:60px;border-radius:11px;object-fit:cover;background:var(--cmp-s3);display:block}.cmp-lst b{display:block;font-size:12.5px;margin-top:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.cmp-lst span{font-size:11px;color:var(--cmp-mu)}",
    ".cmp-stars{display:flex;gap:8px;justify-content:center;margin:12px 0 6px}.cmp-stars button{background:none;border:0;color:var(--cmp-s3);padding:2px}.cmp-stars button.on{color:var(--cmp-amb)}.cmp-stars button.on svg{fill:var(--cmp-amb)}",
    ".cmp-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}.cmp-kpi{background:var(--cmp-s1);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);border-radius:18px;padding:14px}.cmp-kpi b{font-size:24px;font-weight:800;display:block}.cmp-kpi span{font-size:12.5px;color:var(--cmp-mu)}",
    ".cmp-rep{background:var(--cmp-s1);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);border-radius:22px;padding:18px;margin:12px 0 0}.cmp-bar{height:6px;border-radius:3px;background:var(--cmp-s3);overflow:hidden;margin:14px 0 8px}.cmp-bar i{display:block;height:100%;background:var(--cmp-ac);border-radius:3px}",
    ".cmp-todo{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;padding:14px 16px;color:var(--cmp-tx);text-align:right;font-size:14.5px;min-height:52px}.cmp-todo svg:first-child{color:var(--cmp-ac)}.cmp-todo svg:last-child{margin-inline-start:auto;color:var(--cmp-mu)}",
    ".cmp-ring{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800;flex:none;background:conic-gradient(var(--cmp-ac) calc(var(--p)*1%),var(--cmp-s3) 0);position:relative}.cmp-ring::before{content:\"\";position:absolute;inset:5px;border-radius:50%;background:var(--cmp-s1)}.cmp-ring span{position:relative}",
    ".cmp-review{border-top:.5px solid var(--cmp-line);padding:12px 0;font-size:13.5px}",
    ".cmp-toast{position:fixed;right:50%;transform:translateX(50%);bottom:calc(env(safe-area-inset-bottom,0px) + 100px);background:rgba(58,58,60,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#fff;padding:12px 20px;border-radius:99px;font-size:14px;z-index:100020;box-shadow:0 8px 28px rgba(0,0,0,.5);max-width:88vw;text-align:center;direction:rtl}",
    ".cmp-sk{height:150px;border-radius:20px;margin-bottom:12px;background:linear-gradient(90deg,var(--cmp-s1),var(--cmp-s2),var(--cmp-s1));background-size:200% 100%;animation:cmp-sk 1.3s linear infinite}@keyframes cmp-sk{to{background-position:-200% 0}}",
    "@media(prefers-reduced-motion:reduce){.cmp,.cmp-form,.cmp-card,.cmp-sk{animation:none}}",
    "@media(min-width:760px){.cmp-form{max-width:560px;margin-inline:auto;border-radius:28px;max-height:90%}.cmp-sheet{align-items:center}}",
    "/*cmpfix-start*/",
    ":root{--cmp-bg:#08090b;--cmp-s1:#1b1c21;--cmp-s2:#272930;--cmp-s3:#363842;--cmp-line:rgba(255,255,255,.09);--cmp-mu:rgba(235,235,245,.55);--cmp-mu2:rgba(235,235,245,.82)}",
    ".cmp{background:#08090b!important}",
    ".cmp-top{background:rgba(29,29,31,.9)!important}",
    ".cmp-stick{background:#08090b!important}",
    ".cmp-card{background:#1b1c21!important;border-radius:22px!important;padding:16px!important;margin-bottom:14px!important;display:flex!important;flex-direction:column!important;gap:12px!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),0 8px 22px rgba(0,0,0,.55)!important}",
    ".cmp-card.tap:active{background:#23252b!important}",
    ".cmp-card.urgent{box-shadow:inset 0 0 0 1.5px rgba(255,69,58,.5),0 8px 22px rgba(0,0,0,.55)!important}",
    ".cmp-card.need{box-shadow:inset 0 0 0 1.5px rgba(198,244,50,.45),0 8px 22px rgba(0,0,0,.55)!important}",
    ".cmp-card>*{margin:0!important}",
    ".cmp-card>.cmp-row:first-child{flex-wrap:nowrap!important;align-items:center!important;gap:8px!important}",
    ".cmp-card>.cmp-row:first-child[style*=\"border-bottom\"]{padding:0 0 12px!important;border-bottom:1px solid rgba(255,255,255,.08)!important}",
    ".cmp-card .cmp-meta{color:rgba(235,235,245,.55)!important;font-size:12.5px!important;line-height:1.7!important}",
    ".cmp-lbl{padding:4px 11px!important;border-radius:99px!important;font-size:12px!important;gap:6px!important}",
    ".cmp-lbl i{width:6px!important;height:6px!important}",
    ".cmp-lbl.have{background:rgba(48,209,88,.13)!important;color:#4ade80!important}",
    ".cmp-lbl.want{background:rgba(255,159,10,.13)!important;color:#ffb340!important}",
    ".cmp-save{margin:0!important;padding:4px!important;color:rgba(235,235,245,.5)!important}",
    ".cmp-title{font-size:19px!important;font-weight:800!important;line-height:1.4!important}",
    ".cmp-price{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:8px!important;font-size:17px!important;font-weight:800!important;margin:8px 0 0!important}",
    ".cmp-price small{margin:0!important;padding:2px 9px!important;border-radius:99px!important;background:rgba(48,209,88,.13)!important;color:#4ade80!important;font-size:11.5px!important;font-weight:600!important}",
    ".cmp-tags{margin:0!important;gap:6px!important}",
    ".cmp-tag{background:#272930!important;color:rgba(235,235,245,.8)!important;font-size:12px!important;padding:4px 11px!important}",
    ".cmp-note,.cmp-note.clamp{margin:0!important;font-size:13.5px!important;line-height:1.85!important;color:rgba(235,235,245,.78)!important}",
    ".cmp-sr{margin:0!important;padding:12px 0 0!important;border-top:1px solid rgba(255,255,255,.08)!important;gap:10px!important;align-items:center!important}",
    ".cmp-sr>.cmp-grow{display:flex;flex-direction:column;gap:5px}",
    ".cmp-sr>.cmp-grow .cmp-row{gap:6px!important}",
    ".cmp-sr>.cmp-meta{align-self:center;flex:none}",
    ".cmp-av{width:42px!important;height:42px!important;background:#2b2d35!important}",
    ".cmp-sn{font-size:14.5px!important}",
    ".cmp-acts{margin:0!important;gap:8px!important}",
    ".cmp-acts .cmp-btn{min-height:48px!important;border-radius:15px!important}",
    ".cmp-acts .cmp-btn.sub{background:#2b2d35!important;color:#fff!important}",
    ".cmp-acts .cmp-btn.ico{width:48px!important;flex:none!important}",
    ".cmp-ring::before{background:#1b1c21!important}",
    ".cmp-seg,.cmp-chip,.cmp-search{background:#1b1c21!important}",
    ".cmp-chip.on{background:rgba(198,244,50,.14)!important}",
    ".cmp-seg button.on{background:#363842!important}",
    ".cmp-grp,.cmp-kpi,.cmp-rep{background:#1b1c21!important}",
    ".cmp-sum,.cmp-st3,.cmp-sr.box{background:#272930!important}",
    "/*cmpfix-end*/",
    "/*cmpfix2-start*/",
    "html body .cmp .cmp-card,html body .cmp .cmp-card.tap{background:#2a2d34!important;background-image:none!important;border:0!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 10px 26px rgba(0,0,0,.6)!important;filter:none!important;opacity:1!important}",
    "html body .cmp .cmp-card::before,html body .cmp .cmp-card::after{content:none!important;display:none!important}",
    "html body .cmp .cmp-card.tap:active{background:#32353d!important}",
    "html body .cmp .cmp-card.urgent{box-shadow:inset 0 0 0 1.5px rgba(255,69,58,.6),0 10px 26px rgba(0,0,0,.6)!important}",
    "html body .cmp .cmp-card.need{box-shadow:inset 0 0 0 1.5px rgba(198,244,50,.5),0 10px 26px rgba(0,0,0,.6)!important}",
    "html body .cmp .cmp-card .cmp-sr{border-top:1px solid rgba(255,255,255,.12)!important}",
    "html body .cmp .cmp-card>.cmp-row:first-child[style*=\"border-bottom\"]{border-bottom:1px solid rgba(255,255,255,.12)!important}",
    "html body .cmp .cmp-card .cmp-tag{background:#3A3A3D!important}",
    "html body .cmp .cmp-card .cmp-acts .cmp-btn.sub{background:#3A3A3D!important}",
    "html body .cmp .cmp-card .cmp-av{background:#3A3A3D!important}",
    "html body .cmp .cmp-card .cmp-sum,html body .cmp .cmp-card .cmp-st3{background:#363942!important}",
    "html body .cmp .cmp-card .cmp-ring::before,html body .cmp .cmp-ring::before{background:#2a2d34!important}",
    "html body .cmp .cmp-card .cmp-lbl.have{background:rgba(48,209,88,.18)!important}",
    "html body .cmp .cmp-card .cmp-lbl.want{background:rgba(255,159,10,.18)!important}",
    "html body .cmp .cmp-card .cmp-meta{color:rgba(235,235,245,.62)!important}",
    "/*cmpfix2-end*/",
    "/*cmpfix3-start*/",
    "html body .cmp .cmp-card,html body .cmp .cmp-card.tap{background:#3d414b!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 12px 28px rgba(0,0,0,.65)!important}",
    "html body .cmp .cmp-card.tap:active{background:#464a55!important}",
    "html body .cmp .cmp-card.urgent{box-shadow:inset 0 0 0 1.5px rgba(255,90,80,.75),0 12px 28px rgba(0,0,0,.65)!important}",
    "html body .cmp .cmp-card.need{box-shadow:inset 0 0 0 1.5px rgba(198,244,50,.65),0 12px 28px rgba(0,0,0,.65)!important}",
    "html body .cmp .cmp-card .cmp-sr{border-top:1px solid rgba(255,255,255,.2)!important}",
    "html body .cmp .cmp-card>.cmp-row:first-child[style*=\"border-bottom\"]{border-bottom:1px solid rgba(255,255,255,.2)!important}",
    "html body .cmp .cmp-card .cmp-tag,html body .cmp .cmp-card .cmp-acts .cmp-btn.sub,html body .cmp .cmp-card .cmp-av{background:#51566a!important;color:#fff!important}",
    "html body .cmp .cmp-card .cmp-av{color:#c6f432!important}",
    "html body .cmp .cmp-card .cmp-sum,html body .cmp .cmp-card .cmp-st3{background:#4a4f5c!important}",
    "html body .cmp .cmp-card .cmp-ring::before,html body .cmp .cmp-ring::before{background:#3d414b!important}",
    "html body .cmp .cmp-card .cmp-lbl.have{background:rgba(48,209,88,.24)!important;color:#6ee79a!important}",
    "html body .cmp .cmp-card .cmp-lbl.want{background:rgba(255,159,10,.24)!important;color:#ffc25c!important}",
    "html body .cmp .cmp-card .cmp-meta,html body .cmp .cmp-card .cmp-save{color:rgba(240,240,250,.75)!important}",
    "html body .cmp .cmp-card .cmp-note,html body .cmp .cmp-card .cmp-tag{color:rgba(250,250,255,.92)!important}",
    "html body .cmp .cmp-card .cmp-save.on{color:#c6f432!important}",
    "/*cmpfix3-end*/",
  ].join('');

  var DEF_FILTERS = { kind: '', make: '', city: '', yearFrom: '', yearTo: '', priceMin: '', priceMax: '', deal: '', sort: 'new', q: '', trusted: false, saved: false, urgent: false };
  var S = { tab: 'market', root: null, body: null, nav: null, filters: Object.assign({}, DEF_FILTERS), items: [], hasMore: false, offset: 0, facets: null, dash: null, offerBox: 'all', oppTab: 'matches', meTab: 'mine', seq: 0, layers: [], mk: null };

  function toast(msg) {
    var t = h('div', { class: 'cmp-toast', role: 'status', text: msg });
    document.body.append(t); setTimeout(function () { t.remove(); }, 2800);
  }
  function errText(e) { return (e && e.message) || 'خطا در ارتباط با سرور'; }
  function fail(e) { toast(errText(e)); }

  // ── اجزای مشترک ────────────────────────────────────────────────────────────────
  function avatar(sr, lg) {
    return h('span', { class: 'cmp-av' + (lg ? ' lg' : '') }, sr.logoUrl ? h('img', { src: sr.logoUrl, alt: '', loading: 'lazy' }) : (sr.name || '؟').trim().charAt(0));
  }
  function tierBadge(rep) { return h('span', { class: 'cmp-badge cmp-t' + rep.tier.level }, ic('shield', 12), rep.tier.label); }
  function ratingLine(rep) {
    if (!rep.ratingCount) return h('span', { class: 'cmp-meta', text: rep.deals ? fa(rep.deals) + ' معامله' : 'بدون امتیاز' });
    return h('span', { class: 'cmp-meta' }, h('span', { class: 'cmp-star', text: '★ ' }), fd(rep.ratingAvg.toFixed(1)) + ' (' + fa(rep.ratingCount) + ')' + (rep.deals ? ' · ' + fa(rep.deals) + ' معامله' : ''));
  }
  function statCell(n, l) { return h('div', { class: 'cmp-st3' }, h('b', { text: fa(n || 0) }), h('span', { text: l })); }
  function empty(title, text, cta) { return h('div', { class: 'cmp-empty' }, h('b', { text: title }), text, cta || null); }
  function skeleton() { return [h('div', { class: 'cmp-sk' }), h('div', { class: 'cmp-sk' }), h('div', { class: 'cmp-sk' })]; }
  function setBody(nodes) { S.body.replaceChildren(h('div', { class: 'cmp-wrap' }, [].concat(nodes).flat(Infinity).filter(Boolean))); S.mk = S.mk && S.mk.wrap.isConnected ? S.mk : null; }
  function field(label, input, hint) { return h('label', { class: 'cmp-f' }, h('span', { text: label }), input, hint || null); }
  function toggle(text, on, fn) {
    var b = h('button', { class: 'cmp-opt' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', text: text });
    b.addEventListener('click', function () { var v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); fn(v); });
    return b;
  }
  function liveMoney(input) { // مبلغ زندهٔ زیر فیلد «میلیون تومان»
    var hint = h('div', { class: 'cmp-hint live' });
    var upd = function () { hint.textContent = moneyExact(num(input.value)); };
    input.addEventListener('input', upd); upd();
    return hint;
  }

  // شیت پایین‌صفحه: سربرگ ثابت، بدنهٔ اسکرول‌شونده، پاورقی ثابت برای دکمهٔ اصلی. کشیدن سربرگ به پایین = بستن.
  function openSheet(title, build) {
    var sheet = h('div', { class: 'cmp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'پنجره' });
    var titleEl = h('b', { text: title || '' });
    var head = h('div', { class: 'cmp-sh-h' }, h('div', { class: 'cmp-grab' }), h('div', { class: 'cmp-sh-t' }, titleEl, h('button', { class: 'cmp-ib sm', type: 'button', 'aria-label': 'بستن', onclick: function () { api2.close(); } }, ic('x', 17))));
    var body = h('div', { class: 'cmp-sh-b' }), foot = h('div', { class: 'cmp-sh-f' });
    var form = h('div', { class: 'cmp-form' }, head, body, foot);
    sheet.append(form);
    var api2 = { el: body, foot: foot, setTitle: function (t) { titleEl.textContent = t; }, close: function () { sheet.remove(); S.layers = S.layers.filter(function (l) { return l !== api2; }); } };
    sheet.addEventListener('click', function (e) { if (e.target === sheet) api2.close(); });
    var y0 = null, dy = 0;
    head.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; dy = 0; form.style.transition = 'none'; }, { passive: true });
    head.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); form.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    head.addEventListener('touchend', function () { if (y0 == null) return; y0 = null; form.style.transition = 'transform .18s'; if (dy > 90) api2.close(); else form.style.transform = ''; });
    build(body, api2);
    document.body.append(sheet); S.layers.push(api2);
    return api2;
  }
  function confirmSheet(title, text, label, danger, onOk) {
    openSheet(title, function (b, sh) {
      b.append(h('div', { class: 'cmp-meta', style: 'line-height:2;margin-top:12px', text: text }));
      sh.foot.append(h('div', { class: 'cmp-acts' }, h('button', { class: 'cmp-btn ' + (danger ? 'red' : ''), type: 'button', text: label, onclick: function () { sh.close(); onOk(); } }), h('button', { class: 'cmp-btn sub', type: 'button', text: 'انصراف', onclick: sh.close })));
    });
  }

  // ── کارت آگهی ───────────────────────────────────────────────────────────────────
  function metaParts(p) {
    var out = [];
    var yt = yearsText(p.yearFrom, p.yearTo); if (yt) out.push(yt);
    if (p.mileageKm != null) out.push(fa(p.mileageKm) + (p.kind === 'want' ? ' کیلومتر (حداکثر)' : ' کیلومتر'));
    if (p.color) out.push(p.color);
    if (p.city) out.push(p.city);
    return out;
  }
  function kindBadge(p) {
    var have = p.kind === 'have';
    var t = p.mine ? (have ? 'ماشین دارم' : 'مشتری دارم') : (have ? 'ماشین موجود' : 'مشتری آماده');
    return h('span', { class: 'cmp-lbl ' + (have ? 'have' : 'want') }, h('i'), t);
  }
  function postCard(p, opts) {
    opts = opts || {};
    var left = daysLeft(p.expiresAt);
    var head = h('div', { class: 'cmp-row', style: 'gap:6px' }, kindBadge(p),
      p.urgent && h('span', { class: 'cmp-badge cmp-hot' }, ic('zap', 11), 'فوری'),
      p.hidden && h('span', { class: 'cmp-badge cmp-mute', text: 'مخفی‌شده' }),
      h('span', { class: 'cmp-meta cmp-grow', style: 'text-align:left', text: ago(p.createdAt) }),
      !p.mine && h('button', { class: 'cmp-save' + (p.saved ? ' on' : ''), type: 'button', 'aria-label': p.saved ? 'حذف از ذخیره‌ها' : 'ذخیره', onclick: function (e) { e.stopPropagation(); toggleSave(p, e.currentTarget); } }, ic('bookmark', 21)));
    var priceTxt = p.priceToman > 0 ? (p.kind === 'want' ? 'بودجه تا ' : '') + money(p.priceToman) : (p.kind === 'want' ? 'بودجه نامشخص' : 'قیمت توافقی');
    var main = h('div', { class: 'cmp-row', style: 'align-items:flex-start;flex-wrap:nowrap;margin-top:14px;gap:14px' },
      p.listing && p.listing.thumb && h('img', { class: 'cmp-thumb', src: p.listing.thumb, alt: '', loading: 'lazy' }),
      h('div', { class: 'cmp-grow' },
        h('div', { class: 'cmp-title', text: p.make + (p.model ? ' ' + p.model : '') }),
        h('div', { class: 'cmp-meta', text: metaParts(p).join(' · ') }),
        h('div', { class: 'cmp-price' }, priceTxt, !!p.priceNegotiable && h('small', { text: 'قابل مذاکره' }))));
    var tags = [];
    if (p.commissionPercent != null) tags.push('کمیسیون همکاری ' + fd(p.commissionPercent) + '٪');
    (p.dealTypes || []).forEach(function (d) { tags.push(DEALS[d]); });
    if (p.listing) tags.push('متصل به موجودی');
    var card = h('div', { class: 'cmp-card' + (opts.detail ? '' : ' tap') + (p.urgent ? ' urgent' : '') }, head, main,
      tags.length > 0 && h('div', { class: 'cmp-tags' }, tags.map(function (t) { return h('span', { class: 'cmp-tag', text: t }); })),
      p.note && h('div', { class: 'cmp-note' + (opts.detail ? '' : ' clamp'), text: p.note }));
    if (!opts.detail) card.addEventListener('click', function () { openDetail(p.id); });
    if (!opts.hideShowroom) {
      var sr = p.showroom;
      card.append(h('button', { class: 'cmp-sr', type: 'button', onclick: function (e) { e.stopPropagation(); openProfile(sr.id); } },
        avatar(sr), h('div', { class: 'cmp-grow' },
          h('div', { class: 'cmp-sn' }, sr.name, p.trusted && h('span', { style: 'color:var(--cmp-ac);display:inline-flex', title: 'همکار مورد اعتماد' }, ic('check', 14))),
          h('div', { class: 'cmp-row', style: 'gap:6px' }, tierBadge(sr.reputation), ratingLine(sr.reputation), (opts.detail && sr.reputation.responsive) && h('span', { class: 'cmp-badge cmp-blue', text: 'پاسخگو' }))),
        h('span', { class: 'cmp-meta', text: sr.city })));
    }
    if (p.mine) {
      card.append(h('div', { class: 'cmp-row cmp-meta', style: 'margin-top:10px;gap:14px' },
        h('span', null, ic('eye', 13), ' ' + fa(p.viewCount || 0) + ' بازدید'), h('span', null, ic('swap', 13), ' ' + fa(p.offerCount || 0) + ' پیشنهاد'),
        p.status === 'active' ? h('span', { text: fa(left) + ' روز تا انقضا' }) : h('span', { text: 'بسته‌شده' + (p.closedReason === 'deal' ? ' (معامله)' : '') })));
      if (!opts.detail) {
        var acts = h('div', { class: 'cmp-acts', onclick: function (e) { e.stopPropagation(); } });
        if (p.status === 'active') {
          acts.append(h('button', { class: 'cmp-btn sub sm', type: 'button', text: 'ویرایش', onclick: function () { openForm({ edit: p }); } }),
            h('button', { class: 'cmp-btn sub sm', type: 'button', text: 'تمدید', onclick: function () { act('/' + p.id + '/renew', 'تمدید شد'); } }),
            h('button', { class: 'cmp-btn red sm', type: 'button', text: 'بستن', onclick: function () { closeSheet(p); } }));
        } else acts.append(h('button', { class: 'cmp-btn red sm', type: 'button', text: 'حذف', onclick: function () { confirmSheet('حذف آگهی', 'این آگهی برای همیشه حذف می‌شود.', 'حذف', true, function () { act('/' + p.id, 'حذف شد', 'DELETE'); }); } }));
        card.append(acts);
      }
    } else if (!opts.detail) {
      card.append(h('div', { class: 'cmp-acts', onclick: function (e) { e.stopPropagation(); } }, offerButton(p, true), chatBtn(p.ownerId)));
    }
    return card;
  }
  function chatBtn(userId, withLabel) {
    return h('button', { class: 'cmp-btn sub' + (withLabel ? '' : ' ico'), type: 'button', 'aria-label': 'گفت‌وگو', onclick: function () { chat(userId); } }, ic('chat', 18), withLabel ? 'گفت‌وگو' : null);
  }
  function offerButton(p, short) {
    if (p.myOffer && (p.myOffer.status === 'pending' || p.myOffer.status === 'accepted')) return h('button', { class: 'cmp-btn sub', type: 'button', onclick: function () { setTab('offers'); } }, ic('check', 15), p.myOffer.status === 'accepted' ? 'پذیرفته شد' : 'پیشنهاد ارسال شد');
    return h('button', { class: 'cmp-btn', type: 'button', onclick: function () { openOffer(p); } }, ic('swap', 15), p.kind === 'have' ? (short ? 'پیشنهاد بده' : 'پیشنهاد خرید / همکاری') : (short ? 'ماشین دارم برایش' : 'معرفی ماشین به مشتری'));
  }

  // ── عملیات ────────────────────────────────────────────────────────────────────────
  function refreshCurrent() { if (!S.root) return; if (S.tab === 'market') loadMarket(false, true); else load(); }
  function act(path, okMsg, method) {
    api(path, { method: method || 'POST', body: (method || 'POST') === 'POST' ? '{}' : undefined }).then(function () { toast(okMsg); refreshCurrent(); refreshDash(); }).catch(fail);
  }
  function closeSheet(p) {
    openSheet('چرا آگهی را می‌بندید؟', function (b, sh) {
      [['sold_elsewhere', 'جای دیگر فروخته شد'], ['found', 'مشتری/ماشین پیدا شد'], ['cancelled', 'انصراف دادم']].forEach(function (r) {
        b.append(h('button', { class: 'cmp-btn sub full', style: 'margin-top:10px', type: 'button', text: r[1], onclick: function () { sh.close(); post('/' + p.id + '/close', { reason: r[0] }).then(function () { toast('آگهی بسته شد'); refreshCurrent(); refreshDash(); }).catch(fail); } }));
      });
      b.append(h('div', { class: 'cmp-hint', style: 'margin-top:14px', text: 'اگر معامله با یک همکار در همین بازار انجام شده، از بخش «پیشنهادها» آن را تأیید کنید تا اعتبارتان ثبت شود.' }));
    });
  }
  function toggleSave(p, btn) {
    var want = !p.saved; btn.classList.toggle('on', want);
    api('/' + p.id + '/save', { method: want ? 'POST' : 'DELETE', body: want ? '{}' : undefined }).then(function () { p.saved = want; toast(want ? 'ذخیره شد' : 'از ذخیره‌ها حذف شد'); if (!want && S.filters.saved) loadMarket(false, true); })
      .catch(function (e) { btn.classList.toggle('on', !want); fail(e); });
  }
  function chat(userId) {
    if (!userId) return;
    window.CARMA_API.request('/messages/conversations/direct', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
      .then(function (r) {
        var id = r && r.conversation && r.conversation.id;
        close();
        var M = window.MARQUE_CHAT;
        if (!M) return;
        return Promise.resolve(M.refresh && M.refresh()).then(function () { if (id && M.openChat) M.openChat(id); else if (M.openInbox) M.openInbox(); });
      }).catch(fail);
  }

  // ── جزئیات آگهی ───────────────────────────────────────────────────────────────────
  function openDetail(id) {
    openSheet('جزئیات آگهی', function (b, sh) {
      b.append(h('div', { class: 'cmp-empty', text: 'در حال بارگذاری…' }));
      api('/' + id).then(function (d) {
        var p = d.post; b.replaceChildren();
        sh.setTitle(p.make + (p.model ? ' ' + p.model : ''));
        b.append(h('div', { style: 'margin-top:12px' }, postCard(p, { detail: true })));
        if (p.mine) {
          b.append(h('div', { class: 'cmp-h', text: 'پیشنهادهای دریافتی' }));
          if (!(d.offers || []).length) b.append(h('div', { class: 'cmp-meta', text: 'هنوز پیشنهادی نرسیده است.' }));
          (d.offers || []).forEach(function (o) { b.append(offerCard(o, function () { sh.close(); })); });
        } else {
          if (p.listing) b.append(h('div', { class: 'cmp-hint', text: 'این آگهی به یک موجودی ثبت‌شدهٔ نمایشگاه متصل است: ' + p.listing.title }));
          b.append(h('button', { class: 'cmp-btn sub sm', style: 'margin-top:10px', type: 'button', onclick: function () { openReport(p); } }, ic('flag', 14), 'گزارش آگهی'));
          sh.foot.append(h('div', { class: 'cmp-acts' }, offerButton(p), chatBtn(p.ownerId, true)));
        }
      }).catch(function (e) { b.replaceChildren(h('div', { class: 'cmp-empty', text: errText(e) })); });
    });
  }
  function openReport(p) {
    openSheet('گزارش آگهی', function (b, sh) {
      b.append(h('div', { class: 'cmp-meta', style: 'margin:12px 0 2px', text: 'با گزارش چند همکار، آگهی خودکار مخفی می‌شود.' }));
      Object.keys(REASONS).forEach(function (k) {
        b.append(h('button', { class: 'cmp-btn sub full', style: 'margin-top:8px', type: 'button', text: REASONS[k], onclick: function () { post('/' + p.id + '/report', { reason: k }).then(function () { sh.close(); toast('گزارش ثبت شد. ممنون'); }).catch(fail); } }));
      });
    });
  }

  // ── پروفایل همکار ─────────────────────────────────────────────────────────────────
  function kpi(v, l) { return h('div', { class: 'cmp-kpi' }, h('b', { text: v }), h('span', { text: l })); }
  function openProfile(sid) {
    openSheet('پروفایل همکار', function (b, sh) {
      b.append(h('div', { class: 'cmp-empty', text: 'در حال بارگذاری…' }));
      api('/showroom/' + sid).then(function (d) {
        var s = d.showroom, rep = s.reputation;
        b.replaceChildren(); sh.setTitle(s.name);
        var trustBtn = h('button', { class: 'cmp-btn sub', type: 'button' });
        var setTrust = function () { trustBtn.replaceChildren(ic('check', 15), s.trusted ? 'در همکاران مورد اعتماد' : 'افزودن به مورد اعتماد'); };
        setTrust();
        trustBtn.onclick = function () { api('/trusted/' + s.id, { method: s.trusted ? 'DELETE' : 'POST', body: s.trusted ? undefined : '{}' }).then(function () { s.trusted = !s.trusted; setTrust(); toast(s.trusted ? 'اضافه شد' : 'حذف شد'); }).catch(fail); };
        b.append(h('div', { class: 'cmp-row', style: 'flex-wrap:nowrap;margin-top:12px' }, avatar(s, true), h('div', { class: 'cmp-grow' }, h('div', { class: 'cmp-title', text: s.name }), h('div', { class: 'cmp-meta', text: s.city + (s.since ? ' · عضو از ' + fd(new Date(s.since).getFullYear()) : '') }), h('div', { class: 'cmp-row', style: 'margin-top:5px' }, tierBadge(rep), s.verified && h('span', { class: 'cmp-badge cmp-have', text: 'تأییدشده' })))));
        if (s.description) b.append(h('div', { class: 'cmp-note', text: s.description }));
        b.append(h('div', { class: 'cmp-kpis' },
          kpi(fa(rep.deals), 'معامله موفق'), kpi(fa(rep.partners), 'همکار متفاوت'),
          kpi(rep.ratingCount ? fd(rep.ratingAvg.toFixed(1)) + ' ★' : '—', rep.ratingCount ? fa(rep.ratingCount) + ' امتیاز' : 'امتیاز'),
          kpi(rep.responseRate != null ? fa(rep.responseRate) + '٪' : '—', 'نرخ پاسخ' + (rep.avgResponseHours != null ? ' (میانگین ' + fa(rep.avgResponseHours) + ' ساعت)' : ''))));
        if (!s.mine) sh.foot.append(h('div', { class: 'cmp-acts' }, h('button', { class: 'cmp-btn', type: 'button', onclick: function () { sh.close(); chat(s.ownerId); } }, ic('chat', 15), 'گفت‌وگو'), trustBtn));
        b.append(h('div', { class: 'cmp-h' }, 'آگهی‌های فعال', h('span', { text: fa(d.posts.length) })));
        if (!d.posts.length) b.append(h('div', { class: 'cmp-meta', text: 'آگهی فعالی ندارد.' }));
        d.posts.forEach(function (p) { var c = postCard(p, { hideShowroom: true }); c.addEventListener('click', function () { sh.close(); openDetail(p.id); }); b.append(c); });
        b.append(h('div', { class: 'cmp-h' }, 'نظر همکاران', h('span', { text: fa(d.reviews.length) })));
        if (!d.reviews.length) b.append(h('div', { class: 'cmp-meta', text: 'هنوز نظری ثبت نشده است.' }));
        d.reviews.forEach(function (r) {
          b.append(h('div', { class: 'cmp-review' }, h('div', { class: 'cmp-row' }, h('span', { class: 'cmp-star', text: '★'.repeat(r.rating) }), h('b', { text: r.reviewer }), h('span', { class: 'cmp-meta', text: ago(r.createdAt) })),
            r.tags.length > 0 && h('div', { class: 'cmp-tags' }, r.tags.map(function (t) { return h('span', { class: 'cmp-tag', text: TAGS[t] || t }); })), r.comment && h('div', { class: 'cmp-note', text: r.comment })));
        });
      }).catch(function (e) { b.replaceChildren(h('div', { class: 'cmp-empty', text: errText(e) })); });
    });
  }

  // ── پیشنهاد همکاری، امتیاز ─────────────────────────────────────────────────────────
  function openOffer(p) {
    openSheet('پیشنهاد به «' + p.showroom.name + '»', function (b, sh) {
      var amount = h('input', { inputmode: 'decimal', placeholder: p.priceToman != null ? 'مثلاً ' + fd(Math.round(p.priceToman / 1e6)) : 'اختیاری' });
      var comm = h('input', { inputmode: 'decimal', placeholder: 'اختیاری، مثلاً ۲' });
      var msg = h('textarea', { rows: '2', maxlength: '500', placeholder: p.kind === 'have' ? 'مثلاً: برای مشتری آماده دارم؛ نقد، فردا قابل بازدید' : 'مثلاً: ماشین مشابه با سند آماده دارم' });
      var mySel = h('select', null, h('option', { value: '', text: 'بدون اتصال' }));
      var err = h('div', { class: 'cmp-err' });
      var send = h('button', { class: 'cmp-btn full', type: 'button', text: 'ارسال پیشنهاد' });
      api('/mine').then(function (d) { (d.items || []).filter(function (x) { return x.status === 'active' && x.kind !== p.kind; }).forEach(function (x) { mySel.append(h('option', { value: x.id, text: (x.kind === 'have' ? 'دارم: ' : 'مشتری: ') + x.make + ' ' + x.model })); }); }).catch(function () {});
      b.append(h('div', { class: 'cmp-meta', style: 'margin-top:10px', text: p.make + (p.model ? ' ' + p.model : '') + (p.priceToman != null ? ' · ' + money(p.priceToman) : '') }),
        field(p.kind === 'have' ? 'مبلغ پیشنهادی شما (میلیون تومان)' : 'قیمت ماشین شما (میلیون تومان)', amount, liveMoney(amount)),
        field('پیام به همکار', msg),
        h('details', { class: 'cmp-more' }, h('summary', null, 'جزئیات بیشتر ', h('small', { text: '(کمیسیون، اتصال به آگهی من)' })),
          h('div', { class: 'cmp-more-b' }, field('سهم همکاری / کمیسیون (٪)', comm), field(p.kind === 'have' ? 'مشتری یا ماشین من (برای هم‌خوانی بهتر)' : 'ماشین من برای این مشتری', mySel))));
      sh.foot.append(err, send);
      send.onclick = function () {
        var a = num(amount.value), c = num(comm.value);
        if (c != null && c > 50) { err.textContent = 'سهم همکاری حداکثر ۵۰٪ است.'; return; }
        send.disabled = true; err.textContent = '';
        post('/' + p.id + '/offers', { amountToman: a == null ? null : Math.round(a * 1e6), commissionPercent: c, message: msg.value.trim(), myPostId: mySel.value || null })
          .then(function () { sh.close(); toast('پیشنهاد ارسال شد'); refreshCurrent(); refreshDash(); }).catch(function (e) { err.textContent = errText(e); send.disabled = false; });
      };
    });
  }
  function openReview(o) {
    openSheet('امتیاز به «' + o.other.name + '»', function (b, sh) {
      var rating = 0, tags = {}, err = h('div', { class: 'cmp-err' });
      var stars = h('div', { class: 'cmp-stars' });
      var paint = function () { stars.querySelectorAll('button').forEach(function (x, i) { x.classList.toggle('on', i < rating); }); };
      for (var i = 1; i <= 5; i++) (function (n) { stars.append(h('button', { type: 'button', 'aria-label': fd(n) + ' ستاره', onclick: function () { rating = n; paint(); } }, ic('star', 36))); })(i);
      var tagBox = h('div', { class: 'cmp-opts' }, Object.keys(TAGS).map(function (k) { return h('button', { class: 'cmp-opt', type: 'button', text: TAGS[k], onclick: function (e) { var on = !tags[k]; if (on && Object.keys(tags).filter(function (x) { return tags[x]; }).length >= 4) return; tags[k] = on; e.currentTarget.classList.toggle('on', on); } }); }));
      var cm = h('textarea', { rows: '3', maxlength: '300', placeholder: 'تجربهٔ همکاری (اختیاری)' });
      var send = h('button', { class: 'cmp-btn full', type: 'button', text: 'ثبت امتیاز' });
      b.append(stars, h('div', { class: 'cmp-f' }, h('span', { text: 'ویژگی‌ها (حداکثر ۴)' }), tagBox), field('نظر', cm));
      sh.foot.append(err, send);
      send.onclick = function () {
        if (!rating) { err.textContent = 'تعداد ستاره را انتخاب کنید.'; return; }
        send.disabled = true;
        post('/offers/' + o.id + '/review', { rating: rating, tags: Object.keys(tags).filter(function (k) { return tags[k]; }), comment: cm.value.trim() }).then(function () { sh.close(); toast('امتیاز ثبت شد'); refreshCurrent(); refreshDash(); }).catch(function (e) { err.textContent = errText(e); send.disabled = false; });
      };
    });
  }
  function offerNeedsMe(o) { return (o.status === 'pending' && !o.outgoing) || (o.status === 'accepted' && !o.myConfirmed) || (o.status === 'completed' && !o.reviewed); }
  function offerWaiting(o) { return (o.status === 'pending' && o.outgoing) || (o.status === 'accepted' && o.myConfirmed); }
  function offerCard(o, afterAct) {
    var done = function (msg) { return function () { toast(msg); if (afterAct) afterAct(); refreshCurrent(); refreshDash(); }; };
    var p = o.post, ot = o.other, need = offerNeedsMe(o);
    var sum = [p.make + (p.model ? ' ' + p.model : ''), yearsText(p.yearFrom, p.yearTo)].filter(Boolean).join(' · ');
    var extra = [yearsText(p.yearFrom, p.yearTo), o.commissionPercent != null ? 'کمیسیون ' + fd(o.commissionPercent) + '٪' : '', ago(o.createdAt)].filter(Boolean).join(' · ');
    var card = h('div', { class: 'cmp-card' + (need ? ' need' : '') },
      h('div', { class: 'cmp-row', style: 'flex-wrap:nowrap' }, avatar(ot), h('div', { class: 'cmp-grow' }, h('div', { class: 'cmp-sn', text: ot.name }), h('div', { class: 'cmp-row', style: 'gap:6px' }, tierBadge(ot.reputation), ratingLine(ot.reputation))),
        h('span', { class: 'cmp-badge ' + (o.status === 'accepted' || o.status === 'completed' ? 'cmp-have' : o.status === 'pending' ? 'cmp-want' : 'cmp-mute'), text: OFFER_ST[o.status] })),
      h('div', { class: 'cmp-sum' },
        h('div', { class: 'cmp-sum-k', text: o.outgoing ? 'پیشنهاد شما برای' : 'پیشنهاد دریافتی برای' }),
        h('div', { class: 'cmp-sum-t', text: p.make + (p.model ? ' ' + p.model : '') }),
        h('div', { class: 'cmp-sum-v' }, o.amountToman != null ? h('b', { text: money(o.amountToman) }) : null, h('span', { text: extra }))),
      o.message && h('div', { class: 'cmp-quote', text: o.message }));
    var acts = h('div', { class: 'cmp-acts wrap' });
    var cb = chatBtn(ot.ownerId, true);
    if (o.status === 'pending' && !o.outgoing) acts.append(h('button', { class: 'cmp-btn', type: 'button', text: 'پذیرش', onclick: function () { post('/offers/' + o.id + '/accept').then(done('پذیرفته شد؛ گفت‌وگو را شروع کنید')).catch(fail); } }),
      h('button', { class: 'cmp-btn red', type: 'button', text: 'رد', onclick: function () { post('/offers/' + o.id + '/decline').then(done('رد شد')).catch(fail); } }), cb);
    else if (o.status === 'pending') acts.append(h('button', { class: 'cmp-btn red', type: 'button', text: 'پس‌گرفتن پیشنهاد', onclick: function () { post('/offers/' + o.id + '/withdraw').then(done('پس گرفته شد')).catch(fail); } }), cb);
    else if (o.status === 'accepted') {
      acts.append(h('button', { class: 'cmp-btn', type: 'button', disabled: o.myConfirmed, text: o.myConfirmed ? 'منتظر تأیید همکار' : (o.otherConfirmed ? 'همکار تأیید کرد؛ تأیید معامله' : 'معامله انجام شد'), onclick: function () { confirmSheet('تأیید انجام معامله', 'فقط اگر معامله واقعاً انجام شده تأیید کنید. بعد از تأیید هر دو طرف، معامله در اعتبار شما ثبت و آگهی بسته می‌شود.', 'تأیید می‌کنم', false, function () { post('/offers/' + o.id + '/complete').then(function (r) { done(r.completed ? 'معامله ثبت شد. به همکار امتیاز بدهید' : 'تأیید شما ثبت شد')(); }).catch(fail); }); } }), cb);
    } else if (o.status === 'completed') acts.append(o.reviewed ? h('span', { class: 'cmp-meta', text: 'امتیاز شما ثبت شده است ✓' }) : h('button', { class: 'cmp-btn', type: 'button', onclick: function () { openReview(o); } }, ic('star', 15), 'امتیاز به همکار'), cb);
    if (acts.childNodes.length) card.append(acts);
    return card;
  }

  // ── فرم آگهی ──────────────────────────────────────────────────────────────────────
  function openForm(o) {
    o = o || {};
    var e = o.edit, pre = o.prefill || {};
    openSheet(e ? 'ویرایش آگهی' : 'ثبت آگهی جدید', function (body, sh) {
      var kind = e ? e.kind : (pre.kind || 'have'), listingId = null, f = {}, deals = {};
      (e ? e.dealTypes : []).forEach(function (d) { deals[d] = true; });
      var flags = { neg: e ? e.priceNegotiable : false, urgent: e ? e.urgent : false };
      var err = h('div', { class: 'cmp-err' });
      var inp = function (id, attrs, val) { f[id] = h('input', attrs || {}); if (val != null && val !== '') f[id].value = val; return f[id]; };
      var facets = S.facets || {};
      var dlM = h('datalist', { id: 'cmp-dl-make' }, (facets.makes || []).map(function (m) { return h('option', { value: m.name }); }));
      var dlC = h('datalist', { id: 'cmp-dl-city' }, (facets.cities || []).map(function (m) { return h('option', { value: m.name }); }));

      var kHave = h('button', { class: 'cmp-kind', type: 'button' }, h('b', { text: 'ماشین دارم' }), h('span', { text: 'می‌خواهم به همکاران عرضه کنم' }));
      var kWant = h('button', { class: 'cmp-kind', type: 'button' }, h('b', { text: 'مشتری دارم' }), h('span', { text: 'دنبال ماشین مشخص برای مشتری‌ام هستم' }));
      var kinds = h('div', { class: 'cmp-kinds' }, kHave, kWant);
      var priceLbl = h('span'), priceBox = h('label', { class: 'cmp-f' }, priceLbl);
      var commWrap = h('div'), railWrap = h('div');
      var rail = h('div', { class: 'cmp-rail' });
      var negBtn = toggle('قیمت قابل مذاکره', flags.neg, function (v) { flags.neg = v; });
      var urgBtn = toggle('⚡ فوری (۱۴ روز در صدر)', flags.urgent, function (v) { flags.urgent = v; });
      var setKind = function (k) {
        kind = k; kHave.classList.toggle('on', k === 'have'); kWant.classList.toggle('on', k === 'want');
        priceLbl.textContent = k === 'have' ? 'قیمت (میلیون تومان)' : 'سقف بودجهٔ مشتری (میلیون تومان)';
        commWrap.style.display = k === 'have' ? '' : 'none'; railWrap.style.display = k === 'have' && !e && rail.childNodes.length ? '' : 'none';
      };
      kHave.onclick = function () { if (!e) setKind('have'); }; kWant.onclick = function () { if (!e) setKind('want'); };
      if (e) kinds.style.display = 'none';
      var lockFields = function (on) { ['make', 'model', 'yf', 'yt'].forEach(function (k) { f[k].disabled = on; }); };
      var pick = function (l) {
        listingId = listingId === l.id ? null : l.id;
        rail.querySelectorAll('.cmp-lst').forEach(function (x) { x.classList.toggle('on', x.dataset.id === listingId); });
        lockFields(!!listingId);
        if (listingId) {
          f.make.value = l.make; f.model.value = l.model; f.yf.value = fd(l.year); f.yt.value = fd(l.year); if (l.city) f.city.value = l.city;
          if (l.priceToman != null) { f.price.value = fd(Math.round(l.priceToman / 1e6)); f.price.dispatchEvent(new Event('input')); }
          if (l.mileageKm != null) f.km.value = fd(l.mileageKm); if (l.color) f.color.value = l.color;
          if (l.priceNegotiable) { flags.neg = true; negBtn.classList.add('on'); negBtn.setAttribute('aria-pressed', 'true'); }
        }
      };
      inp('make', { placeholder: 'مثلاً پژو', maxlength: '80', list: 'cmp-dl-make', autocomplete: 'off' }, e ? e.make : pre.make);
      inp('model', { placeholder: 'مثلاً ۲۰۶ تیپ ۲ (اختیاری)', maxlength: '100', autocomplete: 'off' }, e ? e.model : pre.model);
      inp('yf', { inputmode: 'numeric', placeholder: '۱۳۹۹ یا ۲۰۲۰' }, e && e.yearFrom ? fd(e.yearFrom) : '');
      inp('yt', { inputmode: 'numeric', placeholder: '۱۴۰۲ یا ۲۰۲۳' }, e && e.yearTo ? fd(e.yearTo) : '');
      inp('price', { inputmode: 'decimal', placeholder: 'اختیاری، مثلاً ۱۲۵۰' }, e && e.priceToman != null ? fd(Math.round(e.priceToman / 1e6)) : '');
      inp('city', { maxlength: '80', list: 'cmp-dl-city', autocomplete: 'off' }, e ? e.city : (pre.city || ''));
      inp('color', { maxlength: '50' }, e ? e.color : '');
      inp('km', { inputmode: 'numeric', placeholder: 'اختیاری' }, e && e.mileageKm != null ? fd(e.mileageKm) : '');
      inp('comm', { inputmode: 'decimal', placeholder: 'اختیاری، مثلاً ۲' }, e && e.commissionPercent != null ? fd(e.commissionPercent) : '');
      priceBox.append(f.price, liveMoney(f.price));
      var dealBox = h('div', { class: 'cmp-opts' }, Object.keys(DEALS).map(function (k) { return toggle(DEALS[k], !!deals[k], function (v) { deals[k] = v; }); }));
      var note = h('textarea', { rows: '3', maxlength: '300', placeholder: 'توضیح کوتاه (مثلاً: بدون رنگ، سند آماده، نقد یا معاوضه)' }); if (e) note.value = e.note || '';
      var send = h('button', { class: 'cmp-btn full', type: 'button', text: e ? 'ذخیره تغییرات' : 'ثبت آگهی' });
      commWrap.append(field('سهم همکاری برای همکار فروشنده (٪)', f.comm));
      railWrap.append(h('div', { class: 'cmp-f' }, h('span', { text: 'انتخاب سریع از موجودی من (اختیاری)' }), rail, h('div', { class: 'cmp-hint', text: 'مشخصات خودکار پر می‌شود و عکس آگهی در بازار نمایش داده می‌شود.' })));
      var hasMore = !!(e && (e.city || e.color || e.mileageKm != null || (e.dealTypes || []).length || e.commissionPercent != null || e.note)) || !!pre.city;
      var more = h('details', { class: 'cmp-more' }, h('summary', null, 'جزئیات بیشتر ', h('small', { text: '(شهر، رنگ، کارکرد، نوع معامله، کمیسیون، توضیح)' })),
        h('div', { class: 'cmp-more-b' }, h('div', { class: 'cmp-two' }, field('شهر', f.city), field('رنگ', f.color)), field('کارکرد (کیلومتر)', f.km), commWrap,
          h('div', { class: 'cmp-f' }, h('span', { text: 'نوع معامله' }), dealBox), field('توضیح', note)));
      if (hasMore) more.open = true;
      body.append(dlM, dlC, kinds, railWrap,
        field('برند', f.make), field('مدل', f.model),
        h('div', { class: 'cmp-two' }, field('از سال', f.yf), field('تا سال', f.yt)),
        h('div', { class: 'cmp-hint', text: 'سال شمسی یا میلادی هر دو پذیرفته می‌شود.' }),
        priceBox, h('div', { class: 'cmp-opts', style: 'margin-top:10px' }, negBtn, urgBtn), more);
      sh.foot.append(err, send);
      if (e && e.listing) lockFields(true);
      setKind(kind);
      if (!e) api('/my-listings').then(function (d) {
        var list = (d.items || []).filter(function (l) { return !l.inMarket; });
        list.forEach(function (l) { rail.append(h('button', { class: 'cmp-lst', type: 'button', 'data-id': l.id, onclick: function () { pick(l); } }, l.thumb ? h('img', { src: l.thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'ph' }), h('b', { text: l.title }), h('span', { text: fd(l.year) + (l.priceToman != null ? ' · ' + money(l.priceToman) : '') }))); });
        setKind(kind);
      }).catch(function () {});
      send.onclick = function () {
        var make = f.make.value.trim();
        if (make.length < 2) { err.textContent = 'برند را وارد کنید.'; f.make.focus(); return; }
        var yf = num(f.yf.value), yt = num(f.yt.value), pr = num(f.price.value), km = num(f.km.value), cm = num(f.comm.value);
        if (cm != null && cm > 50) { more.open = true; err.textContent = 'سهم همکاری حداکثر ۵۰٪ است.'; return; }
        var payload = { make: make, model: f.model.value.trim(), yearFrom: yf, yearTo: yt, city: f.city.value.trim(), color: f.color.value.trim(), priceToman: pr == null ? null : Math.round(pr * 1e6), mileageKm: km == null ? null : Math.round(km),
          dealTypes: Object.keys(deals).filter(function (k) { return deals[k]; }), commissionPercent: kind === 'have' ? cm : null, priceNegotiable: flags.neg, urgent: flags.urgent, note: note.value.trim() };
        if (!e) { payload.kind = kind; if (listingId) payload.listingId = listingId; }
        send.disabled = true; err.textContent = '';
        api(e ? '/' + e.id : '', { method: e ? 'PUT' : 'POST', body: JSON.stringify(payload) }).then(function (r) {
          sh.close(); var n = r && r.post && r.post.notified;
          toast(e ? 'تغییرات ذخیره شد' : (n ? 'آگهی ثبت شد · ' + fa(n) + ' همکار هم‌خوان مطلع شدند' : 'آگهی ثبت شد'));
          if (!e) { S.tab = 'me'; S.meTab = 'mine'; } S.facets = null; load(true); refreshDash();
        }).catch(function (x) { err.textContent = errText(x); send.disabled = false; });
      };
    });
  }
  function openAlertForm(pre) {
    pre = pre || {};
    openSheet('هشدار جستجو', function (b, sh) {
      var kind = '', f = {}, err = h('div', { class: 'cmp-err' });
      var inp = function (id, attrs, val) { f[id] = h('input', attrs || {}); if (val) f[id].value = val; return f[id]; };
      var btns = [['', 'هر دو'], ['have', 'ماشین موجود'], ['want', 'مشتری آماده']].map(function (k) { return h('button', { type: 'button', text: k[1], class: k[0] === '' ? 'on' : '', onclick: function (ev) { kind = k[0]; btns.forEach(function (x) { x.classList.remove('on'); }); ev.currentTarget.classList.add('on'); } }); });
      var send = h('button', { class: 'cmp-btn full', type: 'button', text: 'ساخت هشدار' });
      b.append(h('div', { class: 'cmp-meta', style: 'margin-top:12px', text: 'وقتی آگهی هم‌خوان ثبت شود، اعلان می‌گیرید.' }), h('div', { class: 'cmp-f' }, h('span', { text: 'نوع آگهی' }), h('div', { class: 'cmp-seg', style: 'margin-bottom:0' }, btns)),
        field('برند', inp('make', { maxlength: '80', autocomplete: 'off' }, pre.make)), field('مدل (اختیاری)', inp('model', { maxlength: '100', autocomplete: 'off' }, pre.model)),
        h('div', { class: 'cmp-two' }, field('از سال', inp('yf', { inputmode: 'numeric' })), field('تا سال', inp('yt', { inputmode: 'numeric' }))),
        h('div', { class: 'cmp-two' }, field('شهر (اختیاری)', inp('city', { maxlength: '80' })), field('سقف قیمت (میلیون)', inp('pm', { inputmode: 'decimal' }))));
      sh.foot.append(err, send);
      send.onclick = function () {
        if (f.make.value.trim().length < 2) { err.textContent = 'برند را وارد کنید.'; return; }
        var pm = num(f.pm.value); send.disabled = true;
        post('/alerts', { kind: kind || null, make: f.make.value.trim(), model: f.model.value.trim(), yearFrom: num(f.yf.value), yearTo: num(f.yt.value), city: f.city.value.trim(), priceMax: pm == null ? null : Math.round(pm * 1e6) })
          .then(function () { sh.close(); toast('هشدار ساخته شد'); if (S.tab === 'me') { S.meTab = 'alerts'; load(); } refreshDash(); }).catch(function (x) { err.textContent = errText(x); send.disabled = false; });
      };
    });
  }
  function openFilters() {
    openSheet('فیلتر و مرتب‌سازی', function (b, sh) {
      var F = S.filters, f = {}, sort = F.sort, deal = F.deal;
      var sel = function (id, opts, val) { f[id] = h('select', null, opts.map(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (o[0] === val) op.selected = true; return op; })); return f[id]; };
      var inp = function (id, val, ph) { f[id] = h('input', { inputmode: 'numeric', placeholder: ph || '' }); if (val) f[id].value = fd(val); return f[id]; };
      var makes = [['', 'همهٔ برندها']].concat(((S.facets && S.facets.makes) || []).map(function (m) { return [m.name, m.name + ' (' + fa(m.n) + ')']; }));
      var cities = [['', 'همهٔ شهرها']].concat(((S.facets && S.facets.cities) || []).map(function (m) { return [m.name, m.name + ' (' + fa(m.n) + ')']; }));
      var group = function (opts, cur, set) {
        var box = h('div', { class: 'cmp-opts' });
        opts.forEach(function (k) { box.append(h('button', { class: 'cmp-opt' + (cur === k[0] ? ' on' : ''), type: 'button', text: k[1], onclick: function (ev) { set(k[0]); box.querySelectorAll('.cmp-opt').forEach(function (x) { x.classList.remove('on'); }); ev.currentTarget.classList.add('on'); } })); });
        return box;
      };
      b.append(h('div', { class: 'cmp-f' }, h('span', { text: 'مرتب‌سازی' }), group(SORTS, sort, function (v) { sort = v; })),
        h('div', { class: 'cmp-two' }, field('برند', sel('make', makes, F.make)), field('شهر', sel('city', cities, F.city))),
        h('div', { class: 'cmp-two' }, field('از سال', inp('yf', F.yearFrom, '۱۳۹۹ یا ۲۰۲۰')), field('تا سال', inp('yt', F.yearTo, '۱۴۰۲ یا ۲۰۲۳'))),
        h('div', { class: 'cmp-two' }, field('قیمت از (میلیون)', inp('pmin', F.priceMin ? F.priceMin / 1e6 : '')), field('قیمت تا (میلیون)', inp('pmax', F.priceMax ? F.priceMax / 1e6 : ''))),
        h('div', { class: 'cmp-f' }, h('span', { text: 'نوع معامله' }), group([['', 'همه']].concat(Object.keys(DEALS).map(function (k) { return [k, DEALS[k]]; })), deal, function (v) { deal = v; })));
      sh.foot.append(h('div', { class: 'cmp-acts' }, h('button', { class: 'cmp-btn', type: 'button', text: 'نمایش نتایج', onclick: function () {
        var n = function (x) { return num(f[x].value); };
        Object.assign(S.filters, { sort: sort, make: f.make.value, city: f.city.value, yearFrom: n('yf') || '', yearTo: n('yt') || '', priceMin: n('pmin') ? Math.round(n('pmin') * 1e6) : '', priceMax: n('pmax') ? Math.round(n('pmax') * 1e6) : '', deal: deal });
        sh.close(); loadMarket();
      } }), h('button', { class: 'cmp-btn sub', type: 'button', text: 'پاک‌کردن همه', onclick: function () { var k = S.filters.kind, q = S.filters.q; S.filters = Object.assign({}, DEF_FILTERS, { kind: k, q: q }); sh.close(); loadMarket(); } })));
    });
  }

  // ── بخش «بازار» ───────────────────────────────────────────────────────────────────
  function filterCount() { var F = S.filters; return ['make', 'city', 'yearFrom', 'yearTo', 'priceMin', 'priceMax', 'deal'].filter(function (k) { return F[k]; }).length + (F.sort !== 'new' ? 1 : 0); }
  function feedQuery(offset) {
    var F = S.filters, q = [];
    var add = function (k, v) { if (v !== '' && v != null && v !== false) q.push(k + '=' + encodeURIComponent(v === true ? '1' : v)); };
    add('kind', F.kind); add('make', F.make); add('city', F.city); add('yearFrom', F.yearFrom); add('yearTo', F.yearTo); add('priceMin', F.priceMin); add('priceMax', F.priceMax);
    add('deal', F.deal); add('sort', F.sort === 'new' ? '' : F.sort); add('q', F.q); add('trusted', F.trusted); add('saved', F.saved); add('urgent', F.urgent); add('offset', offset || '');
    return q.length ? '?' + q.join('&') : '';
  }
  var searchTimer;
  function buildMarket() {
    var input = h('input', { type: 'search', placeholder: 'جستجو: برند، مدل، شهر، رنگ…', value: S.filters.q, 'aria-label': 'جستجو' });
    input.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(function () { S.filters.q = input.value.trim(); loadMarket(); }, 380); });
    var fbtn = h('button', { class: 'cmp-ib', type: 'button', 'aria-label': 'فیلتر و مرتب‌سازی', onclick: openFilters }, ic('tune', 19));
    var stick = h('div', { class: 'cmp-stick' }, h('div', { class: 'cmp-search' }, ic('search', 18), input), fbtn);
    var ctl = h('div'), list = h('div');
    S.mk = { wrap: h('div', null, stick, ctl, list), ctl: ctl, list: list, fbtn: fbtn };
  }
  function paintCtl() {
    var F = S.filters, st = S.facets && S.facets.stats, mk = S.mk, fc = filterCount();
    mk.fbtn.classList.toggle('on', !!fc); mk.fbtn.querySelector('i') && mk.fbtn.querySelector('i').remove(); if (fc) mk.fbtn.append(h('i', { text: fd(fc) }));
    var seg = h('div', { class: 'cmp-seg', role: 'tablist' }, [['', 'همه'], ['have', 'ماشین‌ها'], ['want', 'مشتری‌ها']].map(function (k) {
      return h('button', { class: F.kind === k[0] ? 'on' : '', type: 'button', role: 'tab', 'aria-selected': F.kind === k[0] ? 'true' : 'false', text: k[1] + (st && k[0] ? ' (' + fa(st[k[0]]) + ')' : ''), onclick: function () { S.filters.kind = k[0]; loadMarket(); } });
    }));
    var C = function (label, on, fn, icon) { return h('button', { class: 'cmp-chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: fn }, icon && ic(icon, 14), label); };
    var rmChips = [], chips = [C('فوری', F.urgent, function () { S.filters.urgent = !F.urgent; loadMarket(); }, 'zap'), C('ذخیره‌شده‌ها', F.saved, function () { S.filters.saved = !F.saved; loadMarket(); }, 'bookmark'), C('همکاران من', F.trusted, function () { S.filters.trusted = !F.trusted; loadMarket(); }, 'shield')];
    var rm = function (label, keys) { return h('button', { class: 'cmp-chip rm', type: 'button', 'aria-label': 'حذف فیلتر ' + label, onclick: function () { keys.forEach(function (k) { S.filters[k] = k === 'sort' ? 'new' : ''; }); loadMarket(); } }, label, ic('x', 13)); };
    if (F.make) rmChips.push(rm(F.make, ['make']));
    if (F.city) rmChips.push(rm(F.city, ['city']));
    if (F.yearFrom || F.yearTo) rmChips.push(rm('سال ' + yearsText(F.yearFrom, F.yearTo), ['yearFrom', 'yearTo']));
    if (F.priceMin || F.priceMax) rmChips.push(rm('قیمت ' + (F.priceMin ? 'از ' + money(F.priceMin) + ' ' : '') + (F.priceMax ? 'تا ' + money(F.priceMax) : ''), ['priceMin', 'priceMax']));
    if (F.deal) rmChips.push(rm(DEALS[F.deal], ['deal']));
    if (F.sort !== 'new') rmChips.push(rm((SORTS.filter(function (s) { return s[0] === F.sort; })[0] || [])[1] || '', ['sort']));
    var out = [seg, h('div', { class: 'cmp-chips' }, rmChips.concat(chips))];
    if (st) out.push(h('div', { class: 'cmp-stat', text: fa(st.showrooms) + ' نمایشگاه فعال · ' + fa(st.deals30) + ' معامله در ۳۰ روز اخیر' + (st.urgent ? ' · ' + fa(st.urgent) + ' آگهی فوری' : '') }));
    mk.ctl.replaceChildren.apply(mk.ctl, out);
  }
  function marketList() {
    var tail = [];
    var list = S.items.map(function (p) { return postCard(p); });
    if (!S.items.length) {
      var filtered = filterCount() || S.filters.q || S.filters.kind || S.filters.urgent || S.filters.trusted;
      var cta = null;
      if (S.filters.saved) cta = null;
      else if (S.filters.make || S.filters.q) cta = h('button', { class: 'cmp-btn sub', type: 'button', onclick: function () { openAlertForm({ make: S.filters.make || S.filters.q }); } }, ic('bell', 15), 'وقتی ثبت شد خبرم کن');
      else if (!filtered) cta = h('button', { class: 'cmp-btn', type: 'button', onclick: function () { openForm(); } }, ic('plus', 15), 'ثبت اولین آگهی');
      tail.push(empty('آگهی‌ای پیدا نشد', S.filters.saved ? 'هنوز آگهی‌ای ذخیره نکرده‌اید.' : (filtered ? 'فیلترها را کم کنید یا برای این جستجو هشدار بسازید.' : 'اولین نفر باشید و آگهی بگذارید!'), cta));
    }
    if (S.hasMore) tail.push(h('button', { class: 'cmp-btn sub full', type: 'button', text: 'نمایش بیشتر', onclick: function (ev) { ev.currentTarget.disabled = true; loadMore(); } }));
    return list.concat(tail);
  }
  function paintList() { if (S.mk && S.mk.list.isConnected) S.mk.list.replaceChildren.apply(S.mk.list, marketList()); }
  function loadMore() {
    api('/feed' + feedQuery(S.offset)).then(function (d) { S.items = S.items.concat(d.items || []); S.hasMore = d.hasMore; S.offset = d.nextOffset; if (S.tab === 'market') paintList(); }).catch(function (e) { fail(e); paintList(); });
  }
  function loadMarket(force, quiet) {
    if (!S.root) return;
    S.tab = 'market'; markNav();
    var seq = ++S.seq;
    if (!S.mk || !S.mk.wrap.isConnected) { buildMarket(); S.body.replaceChildren(h('div', { class: 'cmp-wrap' }, S.mk.wrap)); }
    var mk = S.mk;
    paintCtl();
    if (!quiet) mk.list.replaceChildren.apply(mk.list, skeleton());
    Promise.all([api('/feed' + feedQuery()), S.facets && !force ? null : api('/facets').catch(function () { return null; })]).then(function (r) {
      if (seq !== S.seq || S.tab !== 'market' || S.mk !== mk) return;
      S.items = r[0].items || []; S.hasMore = r[0].hasMore; S.offset = r[0].nextOffset; if (r[1]) S.facets = r[1];
      paintCtl(); paintList();
    }).catch(function (e) { if (seq === S.seq && S.tab === 'market' && S.mk === mk) mk.list.replaceChildren(empty('خطا', errText(e), h('button', { class: 'cmp-btn sub', type: 'button', text: 'تلاش دوباره', onclick: function () { loadMarket(); } }))); });
  }

  // ── سایر بخش‌ها ──────────────────────────────────────────────────────────────────
  function markNav() { if (S.nav) S.nav.querySelectorAll('.cmp-nb').forEach(function (x) { var on = x.dataset.t === S.tab; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); }
  function segTabs(items, cur, set) {
    return h('div', { class: 'cmp-seg', role: 'tablist' }, items.map(function (k) { return h('button', { class: cur === k[0] ? 'on' : '', type: 'button', role: 'tab', 'aria-selected': cur === k[0] ? 'true' : 'false', text: k[1], onclick: function () { set(k[0]); } }); }));
  }
  function load(force) {
    if (!S.root) return;
    if (S.tab === 'market') return loadMarket(force);
    markNav();
    var seq = ++S.seq, tab = S.tab;
    var guard = function (fn) { return function (d) { if (seq === S.seq && S.tab === tab) fn(d); }; };
    var onFail = function (e) { if (seq === S.seq && S.tab === tab) setBody(empty('خطا', errText(e), h('button', { class: 'cmp-btn sub', type: 'button', text: 'تلاش دوباره', onclick: function () { load(); } }))); };
    setBody(h('div', { style: 'padding-top:12px' }, skeleton()));
    if (tab === 'opps') renderOpps(guard, onFail);
    else if (tab === 'offers') renderOffers(guard, onFail);
    else renderMe(guard, onFail);
  }

  function renderOffers(guard, onFail) {
    api('/offers').then(guard(function (d) {
      var items = d.items || [], box = S.offerBox;
      var inc = items.filter(function (o) { return !o.outgoing; }), out = items.filter(function (o) { return o.outgoing; });
      var cur = box === 'in' ? inc : box === 'out' ? out : items;
      var need = cur.filter(offerNeedsMe), wait = cur.filter(function (o) { return !offerNeedsMe(o) && offerWaiting(o); }), arch = cur.filter(function (o) { return !offerNeedsMe(o) && !offerWaiting(o); });
      var nodes = [h('div', { style: 'padding-top:12px' }, segTabs([['all', 'همه (' + fa(items.length) + ')'], ['in', 'دریافتی (' + fa(inc.length) + ')'], ['out', 'ارسالی (' + fa(out.length) + ')']], box, function (v) { S.offerBox = v; load(); }))];
      if (!cur.length) nodes.push(empty(box === 'out' ? 'پیشنهادی نفرستاده‌اید' : 'هنوز پیشنهادی ندارید', box === 'out' ? 'از بخش «بازار» روی آگهی همکاران پیشنهاد بدهید.' : 'با ثبت آگهی‌های جذاب و «فوری» پیشنهاد بیشتری می‌گیرید.', h('button', { class: 'cmp-btn', type: 'button', onclick: function () { setTab('market'); } }, 'رفتن به بازار')));
      if (need.length) { nodes.push(h('div', { class: 'cmp-h need' }, 'نیاز به اقدام شما', h('span', { text: fa(need.length) }))); need.forEach(function (o) { nodes.push(offerCard(o)); }); }
      if (wait.length) { nodes.push(h('div', { class: 'cmp-h' }, 'منتظر پاسخ همکار', h('span', { text: fa(wait.length) }))); wait.forEach(function (o) { nodes.push(offerCard(o)); }); }
      if (arch.length) { nodes.push(h('div', { class: 'cmp-h' }, 'پایان‌یافته', h('span', { text: fa(arch.length) }))); arch.forEach(function (o) { nodes.push(offerCard(o)); }); }
      setBody(nodes);
    })).catch(onFail);
  }

  function renderOpps(guard, onFail) {
    var t = S.oppTab;
    var seg = h('div', { style: 'padding-top:12px' }, segTabs([['matches', 'هم‌خوانی با آگهی‌های من'], ['demand', 'تقاضای بازار']], t, function (v) { S.oppTab = v; load(); }));
    if (t === 'matches') {
      api('/matches').then(guard(function (d) {
        var items = (d.items || []).map(function (m) {
          var c = postCard(m.post);
          c.prepend(h('div', { class: 'cmp-row', style: 'margin-bottom:10px;padding-bottom:10px;border-bottom:.5px solid var(--cmp-line);flex-wrap:nowrap' }, h('div', { class: 'cmp-ring', style: '--p:' + m.score }, h('span', { text: fd(m.score) })), h('div', { class: 'cmp-grow' }, h('div', { class: 'cmp-sn', text: 'درصد هم‌خوانی ' + fd(m.score) + '٪' }), h('div', { class: 'cmp-meta', text: 'با آگهی شما: ' + (m.myPost.kind === 'have' ? 'دارم ' : 'مشتری ') + m.myPost.make + ' ' + m.myPost.model }))));
          return c;
        });
        setBody([seg, items.length ? items : empty('هم‌خوانی‌ای پیدا نشد', 'وقتی همکاری آگهی مقابل شما را ثبت کند، همین‌جا و با اعلان خبر می‌گیرید. برای دریافت زودتر، هشدار جستجو بسازید.', h('button', { class: 'cmp-btn sub', type: 'button', onclick: function () { openAlertForm(); } }, ic('bell', 15), 'ساخت هشدار'))]);
      })).catch(onFail);
    } else {
      api('/demand').then(guard(function (d) {
        var items = (d.items || []).map(function (r) {
          var opp = !r.iHave && (r.supply <= 2 || r.gap >= 6);
          var trend = r.trend == null ? null : h('span', { class: 'cmp-badge ' + (r.trend >= 0 ? 'cmp-have' : 'cmp-hot') }, ic('trend', 11), (r.trend >= 0 ? '+' : '') + fd(r.trend) + '٪');
          return h('div', { class: 'cmp-card' },
            h('div', { class: 'cmp-row' }, h('div', { class: 'cmp-title cmp-grow', text: r.make + ' ' + r.model }), trend, r.iHave ? h('span', { class: 'cmp-badge cmp-have', text: 'شما دارید' }) : (opp ? h('span', { class: 'cmp-badge cmp-want', text: '🔥 فرصت' }) : null)),
            h('div', { class: 'cmp-stats3' }, statCell(r.views, 'بازدید'), statCell(r.contacts, 'تماس'), statCell(r.favorites, 'نشان‌شده')),
            h('div', { class: 'cmp-meta', style: 'margin-top:8px;font-size:12px', text: '۱۴ روز اخیر' }),
            h('div', { class: 'cmp-tags' }, h('span', { class: 'cmp-tag', text: 'آگهی موجود در سایت: ' + fa(r.supply) }), r.medianPrice ? h('span', { class: 'cmp-tag', text: 'قیمت میانه: ' + money(r.medianPrice) }) : null, h('span', { class: 'cmp-tag', text: fa(r.partnerWant) + ' مشتری · ' + fa(r.partnerHave) + ' موجودی در بازار همکاران' })),
            h('div', { class: 'cmp-acts wrap' }, h('button', { class: 'cmp-btn sm', type: 'button', text: r.iHave ? 'ثبت موجودی' : 'دارم این ماشین', onclick: function () { openForm({ prefill: { kind: 'have', make: r.make, model: r.model } }); } }),
              h('button', { class: 'cmp-btn sub sm', type: 'button', text: 'مشتری دارم', onclick: function () { openForm({ prefill: { kind: 'want', make: r.make, model: r.model } }); } }),
              h('button', { class: 'cmp-btn sub sm', type: 'button', onclick: function () { openAlertForm({ make: r.make, model: r.model }); } }, ic('bell', 14), 'هشدار')));
        });
        setBody([seg, h('div', { class: 'cmp-meta', style: 'margin:0 0 10px', text: 'بر پایهٔ رفتار واقعی بازدیدکنندگان سایت، تجمیعی و بدون هیچ هویتی. «فرصت» یعنی تقاضا بالا و عرضه کم است.' }), items.length ? items : empty('داده کافی نیست', 'با افزایش بازدیدها، روند تقاضا اینجا نمایش داده می‌شود.')]);
      })).catch(onFail);
    }
  }

  function renderMe(guard, onFail) {
    Promise.all([api('/dashboard'), api('/mine'), api('/alerts'), api('/trusted')]).then(guard(function (r) {
      var d = r[0], mine = r[1].items || [], alerts = r[2].items || [], trusted = r[3].items || [];
      S.dash = d; updateBadge();
      var rep = d.reputation, nxt = TIER_NEXT[rep.tier.level], out = [];
      var prog = nxt ? Math.min(100, Math.round((rep.partners / nxt[1]) * 100)) : 100;
      var todos = [];
      if (d.offersIn) todos.push([fa(d.offersIn) + ' پیشنهاد منتظر پاسخ شماست', 'offers', 'in']);
      if (d.toConfirm) todos.push([fa(d.toConfirm) + ' معامله منتظر تأیید شماست', 'offers', 'all']);
      if (d.toReview) todos.push([fa(d.toReview) + ' همکار منتظر امتیاز شماست', 'offers', 'all']);
      if (d.expiring) todos.push([fa(d.expiring) + ' آگهی تا ۲ روز دیگر منقضی می‌شود', null]);
      if (d.offersOut) todos.push([fa(d.offersOut) + ' پیشنهاد ارسالی در انتظار پاسخ', 'offers', 'out']);
      if (todos.length) { out.push(h('div', { class: 'cmp-h', text: 'کارهای امروز' })); out.push(h('div', { class: 'cmp-grp' }, todos.map(function (t) { return h('button', { class: 'cmp-todo', type: 'button', onclick: function () { if (t[1]) { S.offerBox = t[2]; setTab(t[1]); } else { S.meTab = 'mine'; load(); } } }, ic('bell', 17), t[0], ic('back', 16)); }))); }
      out.push(h('div', { class: 'cmp-rep' }, h('div', { class: 'cmp-row', style: 'flex-wrap:nowrap' }, h('span', { class: 'cmp-av lg', text: d.showroom.name.trim().charAt(0) }), h('div', { class: 'cmp-grow' }, h('div', { class: 'cmp-title', text: d.showroom.name }), h('div', { class: 'cmp-row', style: 'margin-top:5px' }, tierBadge(rep), ratingLine(rep)))),
        h('div', { class: 'cmp-bar' }, h('i', { style: 'width:' + prog + '%' })),
        h('div', { class: 'cmp-meta', text: nxt ? fa(Math.max(0, nxt[1] - rep.partners)) + ' همکار متفاوت دیگر تا «' + nxt[0] + '» (فقط معاملهٔ تأییدشدهٔ دو طرف حساب می‌شود)' : 'بالاترین سطح اعتبار 🎉' })));
      out.push(h('div', { class: 'cmp-kpis' }, kpi(fa(d.activePosts) + ' / ' + fa(d.maxActive), 'آگهی فعال'), kpi(fa(d.views14), 'بازدید همکاران (۱۴ روز)'), kpi(fa(rep.deals), 'معامله موفق'), kpi(rep.responseRate != null ? fa(rep.responseRate) + '٪' : '—', 'نرخ پاسخ به پیشنهادها')));
      var activeN = mine.filter(function (p) { return p.status === 'active'; }).length;
      out.push(segTabs([['mine', 'آگهی‌های من (' + fa(activeN) + ')'], ['alerts', 'هشدارها (' + fa(alerts.length) + ')'], ['trusted', 'مورد اعتماد (' + fa(trusted.length) + ')']], S.meTab, function (v) { S.meTab = v; load(); }));
      if (S.meTab === 'mine') {
        if (mine.length) mine.forEach(function (p) { out.push(postCard(p, { hideShowroom: true })); });
        else out.push(empty('آگهی‌ای ثبت نکرده‌اید', 'آگهی بگذارید؛ همکاران هم‌خوان همان لحظه مطلع می‌شوند.', h('button', { class: 'cmp-btn', type: 'button', onclick: function () { openForm(); } }, ic('plus', 15), 'ثبت آگهی')));
      } else if (S.meTab === 'alerts') {
        out.push(h('button', { class: 'cmp-btn sub full', style: 'margin-bottom:10px', type: 'button', onclick: function () { openAlertForm(); } }, ic('plus', 15), 'هشدار جدید'));
        if (!alerts.length) out.push(empty('هشداری ندارید', 'هشدار بسازید تا به‌محض ثبت آگهی هم‌خوان خبردار شوید.'));
        alerts.forEach(function (a) {
          var txt = (a.kind ? (a.kind === 'have' ? 'موجودی ' : 'مشتری ') : '') + a.make + (a.model ? ' ' + a.model : '') + [a.yearFrom || a.yearTo ? yearsText(a.yearFrom, a.yearTo) : '', a.city, a.priceMax ? 'تا ' + money(a.priceMax) : ''].filter(Boolean).map(function (x) { return ' · ' + x; }).join('');
          out.push(h('div', { class: 'cmp-card', style: 'padding:11px' }, h('div', { class: 'cmp-row', style: 'flex-wrap:nowrap' }, ic('bell', 17), h('div', { class: 'cmp-grow cmp-sn', text: txt }), h('button', { class: 'cmp-btn red sm', type: 'button', text: 'حذف', onclick: function () { api('/alerts/' + a.id, { method: 'DELETE' }).then(function () { toast('حذف شد'); load(); refreshDash(); }).catch(fail); } }))));
        });
      } else {
        if (!trusted.length) out.push(empty('هنوز کسی را اضافه نکرده‌اید', 'از پروفایل هر همکار می‌توانید او را به لیست مورد اعتماد اضافه کنید؛ بعد با فیلتر «همکاران من» فقط آگهی‌های آن‌ها را ببینید.'));
        trusted.forEach(function (t) { out.push(h('button', { class: 'cmp-sr box', type: 'button', onclick: function () { openProfile(t.id); } }, avatar(t), h('div', { class: 'cmp-grow' }, h('div', { class: 'cmp-sn', text: t.name }), h('div', { class: 'cmp-row', style: 'gap:6px' }, tierBadge(t.reputation), ratingLine(t.reputation))), h('span', { class: 'cmp-meta', text: fa(t.activePosts) + ' آگهی' }))); });
      }
      setBody(out);
    })).catch(onFail);
  }

  // ── پوسته ─────────────────────────────────────────────────────────────────────────
  function updateBadge() {
    var d = S.dash; if (!S.nav) return;
    var n = d ? d.offersIn + d.toConfirm + d.toReview : 0;
    var b = S.nav.querySelector('[data-t="offers"] i'); if (b) { b.textContent = fd(n); b.style.display = n ? '' : 'none'; }
  }
  function refreshDash() { if (!S.root) return; api('/dashboard').then(function (d) { S.dash = d; updateBadge(); }).catch(function () {}); }
  function setTab(t) { S.tab = t; S.body.scrollTop = 0; load(); }

  function close() {
    if (!S.root) return;
    S.layers.slice().forEach(function (l) { l.close(); });
    S.root.remove(); document.querySelectorAll('.cmp-sheet,.cmp-nav,.cmp-toast').forEach(function (n) { n.remove(); });
    S.root = null; S.layers = []; S.mk = null; S.nav = null; document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key !== 'Escape') return; var top = S.layers[S.layers.length - 1]; if (top) top.close(); else close(); }

  function open(tab) {
    if (S.root) { if (tab) setTab(tab); return; }
    if (!document.getElementById('cmp-style')) document.head.append(h('style', { id: 'cmp-style', text: CSS }));
    S.tab = ['market', 'opps', 'offers', 'me'].indexOf(tab) >= 0 ? tab : 'market'; S.filters = Object.assign({}, DEF_FILTERS); S.facets = null; S.dash = null; S.items = []; S.mk = null; S.offerBox = 'all';
    var navBtn = function (t) {
      return h('button', { class: 'cmp-nb', 'data-t': t[0], type: 'button', onclick: function () { if (S.tab === t[0]) { S.body.scrollTop = 0; load(true); } else setTab(t[0]); } }, ic(t[2], 22), t[1], t[0] === 'offers' ? h('i', { style: 'display:none' }) : null);
    };
    S.nav = h('nav', { class: 'cmp-nav', 'aria-label': 'بخش‌های بازار همکاران' }, h('div', { class: 'cmp-nav-in' },
      navBtn(['market', 'بازار', 'grid']), navBtn(['opps', 'فرصت‌ها', 'trend']),
      h('button', { class: 'cmp-add', type: 'button', 'aria-label': 'ثبت آگهی جدید', onclick: function () { openForm(); } }, h('b', null, ic('plus', 26)), 'ثبت آگهی'),
      navBtn(['offers', 'پیشنهادها', 'swap']), navBtn(['me', 'من', 'user'])));
    S.body = h('div', { class: 'cmp-body' });
    S.root = h('div', { class: 'cmp', role: 'dialog', 'aria-label': 'بازار همکاران' },
      h('div', { class: 'cmp-top' }, h('button', { class: 'cmp-ib', type: 'button', 'aria-label': 'بستن', onclick: close }, ic('x', 20)), h('div', { class: 'cmp-ttl' }, h('h2', { text: 'بازار همکاران' }), h('p', { text: 'شبکهٔ حرفه‌ای نمایشگاه‌داران تأییدشده' }))),
      S.body);
    document.body.append(S.root, S.nav);
    document.addEventListener('keydown', onKey);
    load(true); refreshDash();
  }

  // دکمهٔ ورود: کنار «صفحه نمایشگاه» در کارت نمایشگاه (فقط وقتی نمایشگاه تأیید شده)
  function mount() {
    document.querySelectorAll('.dealership-card-actions').forEach(function (box) {
      if (box.querySelector('[data-cm-partners]') || !box.querySelector('[data-action="goSeller"]')) return;
      box.append(h('button', { type: 'button', class: 'dealership-btn-sub', 'data-cm-partners': '1', text: 'بازار همکاران', onclick: function () { open(); } }));
    });
  }
  var timer;
  new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(mount, 150); }).observe(document.body, { childList: true, subtree: true });
  mount();
  window.CARMA_PARTNERS = { open: open, close: close };
})();
/*cmp-color-editor-start*/
(function () {
  'use strict';
  if (window.__CMP_COLORS__) return; window.__CMP_COLORS__ = true;
  var KEY = 'cmp_user_colors_v1', P = 'html body .cmp ';
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  var F = [
    { k: 'pageBg', t: 'پس‌زمینهٔ صفحه', d: '#08090b', css: function (v) { return 'html body .cmp,' + P + '.cmp-stick{background:' + v + '!important}' + P + '.cmp-top{background:' + rgba(v, .92) + '!important}'; } },
    { k: 'cardBg', t: 'پس‌زمینهٔ کارت', d: '#3d414b', css: function (v) { return P + '.cmp-card,' + P + '.cmp-card.tap,' + P + '.cmp-ring::before{background:' + v + '!important}'; } },
    { k: 'cardBorder', t: 'حاشیهٔ کارت', d: '#64676f', css: function (v) { return P + '.cmp-card:not(.urgent):not(.need){box-shadow:inset 0 0 0 1px ' + v + ',0 12px 28px rgba(0,0,0,.65)!important}'; } },
    { k: 'divider', t: 'خط‌های جداکننده داخل کارت', d: '#64676f', css: function (v) { return P + '.cmp-card .cmp-sr{border-top-color:' + v + '!important}' + P + '.cmp-card>.cmp-row:first-child{border-bottom-color:' + v + '!important}'; } },
    { k: 'title', t: 'عنوان (نام خودرو)', d: '#ffffff', css: function (v) { return P + '.cmp-card .cmp-title{color:' + v + '!important}'; } },
    { k: 'price', t: 'قیمت', d: '#ffffff', css: function (v) { return P + '.cmp-card .cmp-price{color:' + v + '!important}'; } },
    { k: 'meta', t: 'مشخصات و زمان', d: '#c3c4cc', css: function (v) { return P + '.cmp-card .cmp-meta,' + P + '.cmp-card .cmp-save{color:' + v + '!important}'; } },
    { k: 'note', t: 'متن توضیحات', d: '#f4f4f8', css: function (v) { return P + '.cmp-card .cmp-note{color:' + v + '!important}'; } },
    { k: 'tagBg', t: 'پس‌زمینهٔ تگ‌ها', d: '#51566a', css: function (v) { return P + '.cmp-card .cmp-tag{background:' + v + '!important}'; } },
    { k: 'tagText', t: 'متن تگ‌ها', d: '#ffffff', css: function (v) { return P + '.cmp-card .cmp-tag{color:' + v + '!important}'; } },
    { k: 'have', t: 'برچسب «ماشین موجود»', d: '#6ee79a', css: function (v) { return P + '.cmp-card .cmp-lbl.have{color:' + v + '!important;background:' + rgba(v, .22) + '!important}'; } },
    { k: 'want', t: 'برچسب «مشتری آماده»', d: '#ffc25c', css: function (v) { return P + '.cmp-card .cmp-lbl.want{color:' + v + '!important;background:' + rgba(v, .22) + '!important}'; } },
    { k: 'avBg', t: 'پس‌زمینهٔ آواتار همکار', d: '#51566a', css: function (v) { return P + '.cmp-card .cmp-av{background:' + v + '!important}'; } },
    { k: 'avTx', t: 'حرف داخل آواتار', d: '#c6f432', css: function (v) { return P + '.cmp-card .cmp-av{color:' + v + '!important}'; } },
    { k: 'sn', t: 'نام همکار', d: '#ffffff', css: function (v) { return P + '.cmp-card .cmp-sn{color:' + v + '!important}'; } },
    { k: 'btnBg', t: 'دکمهٔ اصلی', d: '#c6f432', css: function (v) { return P + '.cmp-card .cmp-btn:not(.sub):not(.red){background:' + v + '!important}'; } },
    { k: 'btnTx', t: 'متن دکمهٔ اصلی', d: '#0b0f02', css: function (v) { return P + '.cmp-card .cmp-btn:not(.sub):not(.red){color:' + v + '!important}'; } },
    { k: 'btn2Bg', t: 'دکمهٔ دوم (گفت‌وگو / ارسال شد)', d: '#51566a', css: function (v) { return P + '.cmp-card .cmp-btn.sub{background:' + v + '!important}'; } },
    { k: 'btn2Tx', t: 'متن و آیکن دکمهٔ دوم', d: '#ffffff', css: function (v) { return P + '.cmp-card .cmp-btn.sub{color:' + v + '!important}'; } },
    { k: 'accent', t: 'رنگ تأکید (حلقه، منو، فعال)', d: '#c6f432', css: function (v) { return '.cmp,.cmp-sheet,.cmp-nav{--cmp-ac:' + v + '!important}'; } },
    { k: 'inputBg', t: 'جستجو، تب‌ها و چیپ‌ها', d: '#1b1c21', css: function (v) { return P + '.cmp-seg,' + P + '.cmp-chip:not(.on),' + P + '.cmp-search{background:' + v + '!important}'; } },
    { k: 'navBg', t: 'نوار پایین', d: '#1e1e23', css: function (v) { return 'html body .cmp-nav{background:' + rgba(v, .94) + '!important}'; } }
  ];
  var BYK = {}; F.forEach(function (f) { BYK[f.k] = f; });
  // با ضربه روی هر المنت، این رنگ‌ها باز می‌شوند (ترتیب مهم است: اول مشخص‌ترها)
  var MAP = [
    ['.cmp-save', ['meta']], ['.cmp-lbl.have', ['have']], ['.cmp-lbl.want', ['want']],
    ['.cmp-title', ['title']], ['.cmp-price', ['price']], ['.cmp-note', ['note']],
    ['.cmp-tag', ['tagBg', 'tagText']], ['.cmp-av', ['avBg', 'avTx']], ['.cmp-sn', ['sn']],
    ['.cmp-btn.sub', ['btn2Bg', 'btn2Tx']], ['.cmp-card .cmp-btn', ['btnBg', 'btnTx']],
    ['.cmp-ring', ['accent', 'cardBg']], ['.cmp-meta', ['meta']], ['.cmp-sr', ['divider', 'cardBg']],
    ['.cmp-card', ['cardBg', 'cardBorder', 'divider']], ['.cmp-nav', ['navBg', 'accent']],
    ['.cmp-search,.cmp-seg,.cmp-chip', ['inputBg']], ['.cmp-top,.cmp-stick,.cmp-body,.cmp', ['pageBg']]
  ];
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { saved = {}; }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) {} }
  function build() { return F.filter(function (f) { return /^#[0-9a-f]{6}$/i.test(saved[f.k] || ''); }).map(function (f) { return f.css(saved[f.k]); }).join('\n'); }
  var st = null;
  function keepLast() { if (st && document.head.lastElementChild !== st) document.head.append(st); }
  function apply() {
    if (!st) { st = document.createElement('style'); st.id = 'cmp-user-colors'; }
    st.textContent = build(); keepLast();
  }
  apply();
  new MutationObserver(keepLast).observe(document.head, { childList: true });

  function mk(tag, css, txt) { var e = document.createElement(tag); e.setAttribute('data-cmp-ed', '1'); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function toast(m) {
    var t = mk('div', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);background:#262628;color:#fff;padding:10px 18px;border-radius:99px;font-size:14px;font-family:inherit;z-index:100070;direction:rtl', m);
    t.setAttribute('role', 'status'); document.body.append(t); setTimeout(function () { t.remove(); }, 2200);
  }
  function copy(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { toast('CSS کپی شد'); }, fb);
    fb();
    function fb() { var a = document.createElement('textarea'); a.value = txt; document.body.append(a); a.select(); try { document.execCommand('copy'); toast('CSS کپی شد'); } catch (_) { toast('کپی نشد'); } a.remove(); }
  }
  function btn(txt, bg, fg, fn) { var b = mk('button', 'border:0;border-radius:11px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer;background:' + bg + ';color:' + fg, txt); b.type = 'button'; b.onclick = fn; return b; }
  function colorRow(f, onchange) {
    var r = mk('label', 'display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07)');
    var n = mk('span', 'flex:1', f.t);
    var hx = mk('code', 'font:12px monospace;direction:ltr;opacity:.7;min-width:62px');
    var i = mk('input', 'width:46px;height:34px;border:0;background:none;padding:0;cursor:pointer'); i.type = 'color'; i.value = saved[f.k] || f.d;
    hx.textContent = i.value;
    i.oninput = function () { saved[f.k] = i.value; hx.textContent = i.value; apply(); store(); if (onchange) onchange(); };
    r.append(n, hx, i); r._set = function (v) { i.value = v; hx.textContent = v; };
    return r;
  }
  var BOX = 'position:fixed;inset-inline:0;bottom:0;z-index:100050;background:#15161a;color:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.7);display:flex;flex-direction:column;font-size:14px;line-height:1.6;font-family:inherit;direction:rtl';

  // ── پنل کامل (فهرست همهٔ رنگ‌ها)
  var panel = null;
  function closePanel() { if (panel) { panel.remove(); panel = null; } }
  function openPanel() {
    closePop(); if (panel) return closePanel();
    panel = mk('div', BOX + ';height:52vh');
    var hd = mk('div', 'display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)');
    hd.append(mk('b', 'flex:1;font-size:16px', 'همهٔ رنگ‌ها'), btn('ذخیره', '#c6f432', '#0b0f02', function () { store(); toast('ذخیره شد'); closePanel(); }));
    var list = mk('div', 'flex:1;overflow:auto;padding:6px 16px;-webkit-overflow-scrolling:touch'), rows = [];
    F.forEach(function (f) { var r = colorRow(f); r._k = f.k; rows.push(r); list.append(r); });
    var ft = mk('div', 'display:flex;gap:8px;padding:10px 16px calc(env(safe-area-inset-bottom,0px) + 10px);border-top:1px solid rgba(255,255,255,.1)');
    ft.append(
      btn('بازنشانی همه', '#3A3A3D', '#fff', function () { saved = {}; store(); apply(); rows.forEach(function (r) { r._set(BYK[r._k].d); }); toast('به رنگ‌های پیش‌فرض برگشت'); }),
      btn('کپی CSS', '#3A3A3D', '#fff', function () { copy(build() || '/* بدون تغییر */'); }),
      btn('بستن', '#3A3A3D', '#fff', closePanel));
    panel.append(hd, list, ft); document.body.append(panel);
  }

  // ── حالت «ضربه روی المنت»
  var picking = false, pop = null, hi = null, hiOld = null, bar = null;
  function unhi() { if (hi) { hi.style.outline = hiOld[0]; hi.style.outlineOffset = hiOld[1]; hi = null; } }
  function closePop() { if (pop) { pop.remove(); pop = null; } unhi(); if (bar) bar.style.display = picking ? 'flex' : 'none'; }
  function resolve(t) {
    for (var i = 0; i < MAP.length; i++) { var el = t.closest(MAP[i][0]); if (el) return { el: el, keys: MAP[i][1] }; }
    return null;
  }
  function openPop(res) {
    closePop(); closePanel();
    hi = res.el; hiOld = [hi.style.outline, hi.style.outlineOffset];
    hi.style.outline = '2px dashed #c6f432'; hi.style.outlineOffset = '2px';
    pop = mk('div', BOX + ';padding:6px 16px calc(env(safe-area-inset-bottom,0px) + 12px)');
    var rows = [];
    pop.append(mk('div', 'font-weight:800;font-size:15px;padding:8px 0 2px', 'رنگ این المنت'));
    res.keys.forEach(function (k) { var r = colorRow(BYK[k]); r._k = k; rows.push(r); pop.append(r); });
    var ft = mk('div', 'display:flex;gap:8px;padding-top:10px');
    ft.append(
      btn('تمام', '#c6f432', '#0b0f02', closePop),
      btn('بازنشانی این', '#3A3A3D', '#fff', function () { res.keys.forEach(function (k) { delete saved[k]; }); store(); apply(); rows.forEach(function (r) { r._set(BYK[r._k].d); }); }),
      btn('همهٔ رنگ‌ها', '#3A3A3D', '#fff', openPanel));
    pop.append(ft); document.body.append(pop);
    if (bar) bar.style.display = 'none';
  }
  function onTap(e) {
    if (!picking) return;
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('[data-cmp-ed]')) return;
    if (!t.closest('.cmp,.cmp-nav')) return;
    var res = resolve(t); if (!res) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openPop(res);
  }
  document.addEventListener('click', onTap, true);

  function setPicking(on) {
    picking = on; closePop(); closePanel();
    fab.style.display = (!on && document.querySelector('.cmp')) ? 'block' : 'none';
    bar.style.display = on ? 'flex' : 'none';
  }
  var fab = mk('button', 'position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 104px);width:46px;height:46px;border-radius:50%;border:0;background:#c6f432;color:#0b0f02;font-size:21px;z-index:100030;box-shadow:0 6px 18px rgba(0,0,0,.5);display:none;cursor:pointer', '🎨');
  fab.type = 'button'; fab.setAttribute('aria-label', 'ویرایش رنگ‌ها'); fab.onclick = function () { setPicking(true); };
  bar = mk('div', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 100px);max-width:94vw;z-index:100050;background:#15161a;color:#fff;border-radius:99px;box-shadow:0 8px 28px rgba(0,0,0,.7);padding:6px 8px 6px 14px;display:none;align-items:center;gap:8px;font-size:13px;font-family:inherit;direction:rtl;white-space:nowrap');
  bar.append(mk('span', 'flex:1;overflow:hidden;text-overflow:ellipsis', 'روی هر المنت بزنید'), btn('همهٔ رنگ‌ها', '#3A3A3D', '#fff', openPanel), btn('پایان', '#c6f432', '#0b0f02', function () { setPicking(false); }));
  document.body.append(fab, bar);
  function sync() { var on = !!document.querySelector('.cmp'); if (!on) { if (picking) setPicking(false); fab.style.display = 'none'; closePanel(); } else if (!picking) fab.style.display = 'block'; }
  new MutationObserver(sync).observe(document.body, { childList: true }); sync(); setInterval(sync, 1000);
})();
/*cmp-color-editor-end*/
