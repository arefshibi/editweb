"use strict";

/* ---------------------------------------------------------------
   CARMA NEWS — "اخبار روز خودرو"
   Home box + the news list page (#/news).
   NEWS_ITEMS is a static snapshot of real car news (Oct 2026) with source links.
   Replace it with data from the API/admin when available:
   { id, category, date:"YYYY-MM-DD", title, summary, source, url [, body:[paragraph,…]] }
   Only the REAL cover photo of the source article (og:image, fetched through /news/preview) is used; news without it is not shown.
--------------------------------------------------------------- */
(function () {
  const NEWS_CATEGORIES = ["همه", "خودروهای جدید", "برقی", "بازار", "فراخوان"];
  const K = { name: "KBB", base: "https://www.kbb.com/car-news/" };
  const E = { name: "Elektroquatsch", base: "https://www.elektroquatsch.de/artikel/" };
  const NEWS_ITEMS = [
    { id: "n1", category: "فراخوان", date: "2026-10-21", title: "فورد بیش از ۱۰۲ هزار کامیونت F-Series را فراخوان کرد", summary: "ایراد در صفحه‌ی نمایش‌گر باعث می‌شود سرعت و دور موتور نادرست نشان داده شود.", source: K.name, url: K.base + "ford-recalls-102000-f-series-trucks-due-to-faulty-speedometer/" },
    { id: "n2", category: "خودروهای جدید", date: "2026-10-20", title: "لکسوس NX مدل ۲۰۲۷ فقط به‌صورت هیبریدی عرضه می‌شود", summary: "نسخه‌ی به‌روزشده‌ی NX با بهبود مصرف سوخت و فناوری‌های ایمنی جدید می‌آید و نسخه‌ی بنزینی کنار گذاشته شده است.", source: K.name, url: K.base + "the-updated-2027-lexus-nx-goes-hybrid-only/" },
    { id: "n3", category: "بازار", date: "2026-10-20", title: "میانگین قیمت خودروی دست‌دوم در آمریکا به بالاترین سطح از سال ۲۰۲۲ رسید", summary: "در ماه سپتامبر هر خودروی دست‌دوم به‌طور میانگین حدود ۲۷ هزار و ۲۳۵ دلار فروخته شد.", source: K.name, url: K.base + "average-used-car-price-hits-post-2022-high/" },
    { id: "n4", category: "خودروهای جدید", date: "2026-10-20", title: "نسخه‌ی ویژه‌ی نیسان پاثفایندر ۲۰۲۷ برای ۴۰ سالگی این مدل", summary: "نیسان به‌مناسبت چهل‌سالگی پاثفایندر، نسخه‌ای با رویه‌ی صندلی دورنگ و امکانات ویژه عرضه می‌کند.", source: K.name, url: K.base + "2027-nissan-pathfinder-special-edition-celebrates-40-year-history/" },
    { id: "n5", category: "فراخوان", date: "2026-10-20", title: "فولکس‌واگن ممکن است شارژ ID.4 را به‌صورت موقت از راه دور محدود کند", summary: "این محدودیت به‌عنوان راه‌حل موقت فراخوان و برای کاهش خطر آتش‌سوزی باتری بررسی می‌شود.", source: K.name, url: K.base + "vw-may-remotely-limit-id-4-charging-as-temporary-recall-fix/" },
    { id: "n6", category: "خودروهای جدید", date: "2026-10-19", title: "رونمایی از مرسدس AMG GT SUV برقی با بیش از ۱۱۰۰ اسب بخار", summary: "این SUV برقی تا ۸۶۰ کیلووات قدرت و شارژ سریع تا ۷۱۰ کیلووات دارد و برد آن حدود ۷۰۰ کیلومتر (WLTP) اعلام شده است.", source: K.name, url: K.base + "mercedes-debuts-1153-hp-amg-gt-suv/" },
    { id: "n7", category: "برقی", date: "2026-10-18", title: "ایکس‌پنگ برای فروش نیمی از ماشین‌هایش در اروپا برنامه‌ریزی کرد", summary: "این برند چینی هدف فروش یک میلیون خودرو در سال تا ۲۰۳۰ را دارد و تولید محلی در اتریش را در دستور کار گذاشته است.", source: E.name, url: E.base + "xpeng-europa-plan-500000-autos-lokale-produktion" },
    { id: "n8", category: "برقی", date: "2026-10-18", title: "BYD تانگ برقی با ۵۱۵ کیلووات قدرت و پنج صندلی ثبت شد", summary: "در فهرست مقدماتی مقررات چین، این SUV دو موتوره با سرعت حداکثر ۲۵۰ کیلومتر در ساعت دیده می‌شود.", source: E.name, url: E.base + "byd-tang-ev-515-kw-allrad-fuenf-sitze" },
    { id: "n9", category: "برقی", date: "2026-10-17", title: "اسمارت #2 برقی از ۱۹٬۹۹۰ یورو در آلمان پیش‌فروش شد", summary: "این دو‌سرنشینه تا ۲۹۰ کیلومتر برد WLTP دارد و تحویل آن برای میانه‌ی ۲۰۲۷ پیش‌بینی شده است.", source: E.name, url: E.base + "smart-2-preis-reichweite-ladezeit-ausstattung" },
    { id: "n10", category: "خودروهای جدید", date: "2026-10-17", title: "تسلا رودستر جدید با قدرت یک مگاوات و شارژ حدود ده‌دقیقه‌ای", summary: "گزارش‌ها از چهار نسخه برای رودستر خبر می‌دهند؛ بسیاری از ارقام تا ۲۰۲۸ تأیید نشده‌اند.", source: E.name, url: E.base + "tesla-roadster-1-mw-megawatt-laden-raketen" },
  ];

  const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const esc = (v) => (typeof escHtml === "function" ? escHtml(v) : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const whenFull = (iso) => { try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(iso + "T12:00:00")); } catch (_) { return iso; } };
  const ago = (iso) => { const d = Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86400000); return d <= 0 ? "امروز" : d === 1 ? "دیروز" : d < 8 ? fa(d) + " روز پیش" : when(iso); };
  const when = (iso) => { try { return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00")); } catch (_) { return iso; } };
  const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.2 10.9 7.1-3.8M8.2 13.1l7.1 3.8"/></svg>';
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';

  const ICON_CAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16.500V12l1.800-4.600A1.500 1.500 0 0 1 8.200 6.500h7.600a1.500 1.500 0 0 1 1.400.900L19 12v4.500M5 12h14M7 16.500v1.800M17 16.500v1.800"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/></svg>';
  const ICON_NEWS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h11.5a1.5 1.5 0 0 1 1.500 1.500v11a1.500 1.500 0 0 0 1.500 1.500H7A2 2 0 0 1 5 17.500z"/><path d="M8.500 9h6M8.500 12.500h6M8.500 16h3.500"/></svg>';
  const ICON_OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9.500 8H16v6.500"/></svg>';

  const ICON_CHEV = '<svg class="sr-chev" viewBox="0 0 9 15" aria-hidden="true"><path d="M7.5 1.5 1.8 7.5l5.7 6"/></svg>';
  const SAFE_IMG = /^(data:image\/|https?:\/\/|blob:|assets\/)/i;
  /* Cover: real image when given, otherwise the same empty-state box the showroom card uses. */
  function coverHTML(n, cls) {
    const src = n.remote;
    if (src && SAFE_IMG.test(src)) return `<img class="${cls}" data-news-id="${esc(n.id)}" src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__cmNewsImgErr(this)" data-ph="${esc(ICON_CAR)}" />`;
    return "";
  }
  /* If the source photo fails to load, that news is simply not shown (no illustrations / placeholders). */
  window.__cmNewsImgErr = function (img) {
    const n = NEWS_ITEMS.find((x) => x.id === img.dataset.newsId);
    if (n) { n.remote = ""; n.broken = true; delete covers[n.id]; saveCovers(); }
    repaintAll();
  };

  /* Ask the API for each article's own cover photo (og:image of the source page); a news item appears only once it arrives. */
  const apiBase = String(window.CARMA_API_BASE || "/api/v1").replace(/\/$/, "");
  const CACHE_KEY = "carma_news_covers_v2";
  let covers = {};
  try { covers = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch (_) { covers = {}; }
  const saveCovers = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(covers)); } catch (_) {} };
  NEWS_ITEMS.forEach((n) => { if (covers[n.id] && /^https:\/\//i.test(covers[n.id])) n.remote = covers[n.id]; });
  const repaints = new Set();
  let settled = false;
  let coversRequested = false;
  function repaintAll() { repaints.forEach((fn) => { try { fn(); } catch (_) {} }); syncHome(); }
  function loadCovers() {
    if (coversRequested) return;
    coversRequested = true;
    const todo = NEWS_ITEMS.filter((n) => !n.remote && n.url);
    let pending = todo.length;
    if (!pending) { settled = true; return; }
    const done = () => { pending -= 1; if (pending <= 0) settled = true; repaintAll(); };
    todo.forEach((n) => {
      fetch(apiBase + "/news/preview?url=" + encodeURIComponent(n.url), { headers: { Accept: "application/json" }, credentials: "omit" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.image && /^https:\/\//i.test(d.image)) { n.remote = d.image; covers[n.id] = d.image; saveCovers(); }
        })
        .catch(() => {})
        .then(done);
    });
  }

  /* ---- live news from the server (auto-ingested RSS, translated to Persian; see backend/src/services/news-ingest.js) ----
     They are merged into NEWS_ITEMS (newest first); the static list above stays as the fallback/offline snapshot. */
  let liveAt = 0, liveBusy = false, liveReady = false;
  function loadLive(force) {
    if (liveBusy || (!force && Date.now() - liveAt < 5 * 60 * 1000)) return;
    liveBusy = true;
    fetch(apiBase + "/news/items?limit=40", { headers: { Accept: "application/json" }, credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        liveAt = Date.now();
        const list = d && Array.isArray(d.items) ? d.items : [];
        let changed = false;
        list.forEach((x) => {
          if (!x || !x.id || !x.title || !/^https:\/\//i.test(String(x.image || ""))) return;
          if (NEWS_ITEMS.some((n) => n.id === x.id || (x.url && n.url === x.url))) return;
          NEWS_ITEMS.push({ id: String(x.id), category: x.category || "خودروهای جدید", date: String(x.date || "").slice(0, 10), title: String(x.title), summary: String(x.summary || ""), source: x.source || "", url: x.url || "", remote: x.image });
          changed = true;
        });
        if (changed) { NEWS_ITEMS.sort((a, b) => String(b.date).localeCompare(String(a.date))); repaintAll(); }
      })
      .catch(() => {})
      .then(() => { liveBusy = false; if (!liveReady) { liveReady = true; repaintAll(); } });
  }
  setTimeout(() => loadLive(true), 0);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadLive(false); });
  setInterval(() => { if (!document.hidden) loadLive(false); }, 5 * 60 * 1000);

  /* ---- only news that really has a photo is shown ---- */
  const hasImg = (n) => !!(n.remote && SAFE_IMG.test(n.remote));
  const visibleNews = () => NEWS_ITEMS.filter(hasImg);

  /* ---- like / comment (stored on the server; the browser only keeps an in-memory copy) ---- */
  const SOC_KEY = "carma_news_social_v1"; // legacy per-browser copy: read only by the offline demo and the one-time migration
  const API = () => (window.CARMA_API && window.CARMA_API.enabled && window.CARMA_API.news) ? window.CARMA_API : null;
  const meUid = () => { try { return String((window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.id) || ""); } catch (_) { return ""; } };
  let socMem = { likes: {}, counts: {}, comments: {} };
  const readSoc = () => {
    if (API()) return socMem;
    try { const o = JSON.parse(localStorage.getItem(SOC_KEY) || "{}"); return { likes: o.likes || {}, counts: {}, comments: o.comments || {} }; } catch (_) { return { likes: {}, counts: {}, comments: {} }; }
  };
  const writeSoc = (o) => {
    if (API()) { socMem = o; return; }
    try { localStorage.setItem(SOC_KEY, JSON.stringify({ likes: o.likes, comments: o.comments })); } catch (_) {}
  };
  const likeCount = (id, soc) => (soc.counts && soc.counts[id] != null) ? Number(soc.counts[id]) : (soc.likes[id] ? 1 : 0);
  const errMsg = (e) => (e && e.message) ? e.message : "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
  const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.6 2.4c0 5.600-7.600 10.200-7.600 10.200z"/></svg>';
  const ICON_COMMENT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.500a7.500 7.500 0 0 1-10.900 6.700L4.500 19.500l1.300-4.200A7.500 7.500 0 1 1 20 11.500z"/></svg>';
  const toastMsg = (m) => { if (typeof showToast === "function") showToast(m); };
  function loggedIn() { try { return !!(typeof state !== "undefined" && state && state.account); } catch (_) { return false; } }
  function askLogin(reason) {
    try {
      if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
      state = { ...state, modal: { type: "login", reason }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
      if (typeof updateOverlays === "function") updateOverlays();
    } catch (_) { toastMsg(reason); }
  }
  /* ---- commenter avatars + looping comment ticker ---- */
  const myId = () => { try { return state && state.account && typeof sellerIdForPhone === "function" ? sellerIdForPhone(state.account) : ""; } catch (_) { return ""; } };
  const myName = () => { try { const pf = state.accountProfile || {}; return [pf.firstName, pf.lastName].filter(Boolean).join(" ").trim() || "کاربر"; } catch (_) { return "کاربر"; } };
  const hue = (str) => { let h = 7; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0; return (h >>> 8) % 360; };
  function avHTML(c, small) {
    const name = c.n || "کاربر";
    let src = "";
    try {
      if (c.id && typeof mrGetAvatar === "function") src = mrGetAvatar("p", c.id) || "";
      if (!src && c.id && (c.id === myId() || (meUid() && c.id === meUid()))) src = (state.accountProfile || {}).avatar || "";
      if (!src && c.av) src = c.av;
    } catch (_) {}
    const cls = "nw-av" + (small ? " nw-av--" + (small === true ? "s" : small) : "");
    if (src && /^(data:image\/|https?:\/\/|blob:|\/(?!\/))/i.test(src)) return `<span class="${cls}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" /></span>`;
    return `<span class="${cls}" style="background:hsl(${hue(c.id || name)} 32% 36%)">${esc(Array.from(name)[0] || "؟")}</span>`;
  }
  const txtInner = (c) => `<b>${esc(c.n || "کاربر")}</b><span>${esc(c.t)}</span>`;
  /* items: newest first. Up to 3 distinct commenters, slightly overlapping. */
  function tickInner(list, i) {
    const seen = new Set(), who = [];
    for (const c of list) { const k = c.id || c.n || "anon"; if (!seen.has(k)) { seen.add(k); who.push(c); if (who.length === 3) break; } }
    return `<span class="nw-avs">${who.map((c) => avHTML(c)).join("")}</span><span class="nw-tick-txt">${list.length ? txtInner(list[i] || list[0]) : ""}</span>`;
  }
  const newestFirst = (id) => (readSoc().comments[id] || []).slice().reverse();
  function tickHTML(id) {
    const list = newestFirst(id);
    return `<div class="nw-tick" role="button" tabindex="0" aria-label="مشاهده‌ی نظرات" data-i="0"${list.length ? "" : " hidden"}>${tickInner(list, 0)}</div>`;
  }
  function paintTicker(box) {
    const el = box.querySelector(".nw-tick");
    if (!el) return;
    const list = newestFirst(box.dataset.newsId);
    el.hidden = !list.length;
    el.dataset.i = "0";
    el.innerHTML = tickInner(list, 0);
  }
  function advanceTick(el) {
    const box = el.closest(".cm-news-social");
    if (!box || (sheetEl && !sheetEl.hidden)) return;
    const list = newestFirst(box.dataset.newsId);
    if (list.length < 2) return;
    const i = ((parseInt(el.dataset.i, 10) || 0) + 1) % list.length;
    el.dataset.i = String(i);
    const t = el.querySelector(".nw-tick-txt");
    el.classList.add("is-out");
    setTimeout(() => {
      if (!el.isConnected || !t) return;
      t.innerHTML = txtInner(list[i]);
      el.classList.remove("is-out");
      el.classList.add("is-pre");
      void el.offsetWidth;
      el.classList.remove("is-pre");
    }, 280);
  }
  setInterval(() => { if (!document.hidden) document.querySelectorAll(".nw-tick:not([hidden])").forEach(advanceTick); }, 3800);

  function actsHTML(n, lead) {
    const soc = readSoc();
    const liked = !!soc.likes[n.id];
    const cc = (soc.comments[n.id] || []).length;
    return `<div class="cm-news-social" data-news-id="${esc(n.id)}">
      <div class="cm-news-acts" role="group" aria-label="تعامل با خبر">${lead || ""}
        <button type="button" class="cm-news-act${liked ? " is-on" : ""}" data-act="like" aria-pressed="${liked}" aria-label="پسندیدن"><span class="cm-news-ic">${ICON_HEART}</span><span class="cm-news-n" data-n="like">${likeCount(n.id, soc) ? fa(likeCount(n.id, soc)) : ""}</span></button>
        <button type="button" class="cm-news-act" data-act="comment" aria-haspopup="dialog" aria-label="نظرات"><span class="cm-news-ic">${ICON_COMMENT}</span><span class="cm-news-n" data-n="comment">${cc ? fa(cc) : ""}</span></button>
        <button type="button" class="cm-news-act cm-news-act--share" data-act="share" aria-label="اشتراک‌گذاری"><span class="cm-news-ic">${ICON_SHARE}</span></button>
      </div>
      ${tickHTML(n.id)}
    </div>`;
  }
  function paintBox(box) {
    const id = box.dataset.newsId, soc = readSoc(), on = !!soc.likes[id];
    const lb = box.querySelector('[data-act="like"]');
    if (lb) {
      lb.classList.toggle("is-on", on); lb.setAttribute("aria-pressed", String(on));
      const ln = lb.querySelector('[data-n="like"]'); if (ln) { const c = likeCount(id, soc); ln.textContent = c ? fa(c) : ""; }
    }
    const n = (soc.comments[id] || []).length;
    const nEl = box.querySelector('[data-n="comment"]'); if (nEl) nEl.textContent = n ? fa(n) : "";
    paintTicker(box);
  }
  function refreshSocial(id) {
    document.querySelectorAll(".cm-news-social").forEach((box) => { if (box.dataset.newsId === id) paintBox(box); });
  }


  /* ---- comments sheet (opens from the comment button / the ticker) ---- */
  const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (!(ts > 1e12) || m < 0) return "";
    if (m < 1) return "هم‌اکنون";
    if (m < 60) return fa(m) + " دقیقه پیش";
    if (m < 1440) return fa(Math.floor(m / 60)) + " ساعت پیش";
    if (m < 10080) return fa(Math.floor(m / 1440)) + " روز پیش";
    try { return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" }).format(new Date(ts)); } catch (_) { return ""; }
  };
  let sheetEl = null, sheetNews = "", sheetPrevFocus = null;
  let sheetReply = null;
  const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /* Older saved comments get a stable key so they can be replied to / liked. */
  function ensureKeys(id) {
    if (API()) return; // server ids are already stable keys
    const soc = readSoc(); const list = soc.comments[id] || []; let changed = false;
    list.forEach((c, i) => { if (!c.k) { c.k = "o" + i + "_" + (c.d || 0); changed = true; } });
    if (changed) writeSoc(soc);
  }
  function itemHTML(c, isReply) {
    const lc = c.lc != null ? Number(c.lc) : (Array.isArray(c.l) ? c.l.length : 0);
    const mine = (c.lm != null ? !!c.lm : (Array.isArray(c.l) ? c.l : []).includes(myId() || "me")) && loggedIn();
    const canDel = !!(API() && meUid() && c.id === meUid());
    const at = c.rt ? `<span class="nw-at">@${esc(c.rt)}</span> ` : "";
    return `<div class="nw-c${isReply ? " nw-r" : ""}" data-k="${esc(c.k)}"><div class="nw-c-h">${avHTML(c, isReply ? "r" : "m")}<b>${esc(c.n || "کاربر")}</b><small>${timeAgo(c.d)}</small></div><p class="nw-c-t">${at}${esc(c.t)}</p><div class="nw-c-a"><button type="button" class="nw-c-btn" data-nw-reply="${esc(c.k)}">پاسخ</button>${canDel ? `<button type="button" class="nw-c-btn" data-nw-del="${esc(c.k)}">حذف</button>` : ""}<button type="button" class="nw-c-btn nw-c-like${mine ? " is-on" : ""}" data-nw-like="${esc(c.k)}" aria-pressed="${mine}" aria-label="پسندیدن نظر">${ICON_HEART}<span>${lc ? fa(lc) : ""}</span></button></div>`;
  }
  function sheetItemsHTML(id) {
    const items = readSoc().comments[id] || [];
    if (!items.length) return '<p class="nw-sheet-empty">هنوز نظری ثبت نشده. اولین نفر باشید.</p>';
    const keys = new Set(items.map((c) => c.k));
    const tops = items.filter((c) => !c.p || !keys.has(c.p));
    return tops.map((c) => {
      const reps = items.filter((r) => r.p === c.k);
      return itemHTML(c, false) + (reps.length ? `<div class="nw-reps">${reps.map((r) => itemHTML(r, true) + "</div>").join("")}</div>` : "") + "</div>";
    }).join("");
  }
  function paintSheet(keepScroll) {
    if (!sheetEl) return;
    const list = sheetEl.querySelector(".nw-sheet-list"); const y = list.scrollTop;
    list.innerHTML = sheetItemsHTML(sheetNews);
    list.scrollTop = keepScroll ? y : list.scrollHeight;
  }
  function setReply(k) {
    const c = (readSoc().comments[sheetNews] || []).find((x) => x.k === k);
    if (!c) return;
    sheetReply = { k: c.p || c.k, name: c.n || "کاربر" };
    const bar = sheetEl.querySelector(".nw-replying");
    bar.querySelector("b").textContent = sheetReply.name; bar.hidden = false;
    const input = sheetEl.querySelector("input"); input.placeholder = "پاسخ خود را بنویسید…"; input.focus({ preventScroll: true });
  }
  function clearReply() {
    sheetReply = null;
    if (!sheetEl) return;
    sheetEl.querySelector(".nw-replying").hidden = true;
    sheetEl.querySelector("input").placeholder = "نظر خود را بنویسید…";
  }
  function toggleCommentLike(k) {
    if (!loggedIn()) { closeSheet(); askLogin("برای پسندیدن نظر ابتدا وارد حساب خود شوید."); return; }
    const id = sheetNews, api = API();
    const find = () => (readSoc().comments[id] || []).find((x) => x.k === k);
    const c = find();
    if (!c) return;
    if (api) {
      if (c.busy) return; c.busy = true;
      const was = !!c.lm, base = Number(c.lc) || 0;
      c.lm = !was; c.lc = Math.max(0, base + (was ? -1 : 1)); paintSheet(true);
      api.news.toggleCommentLike(k).then((r) => { const x = find(); if (x) { x.lm = !!r.liked; x.lc = Number(r.count) || 0; } })
        .catch((e) => { const x = find(); if (x) { x.lm = was; x.lc = base; } if (e && e.status === 401) { closeSheet(); askLogin("برای پسندیدن نظر ابتدا وارد حساب خود شوید."); } else toastMsg(errMsg(e)); })
        .finally(() => { const x = find(); if (x) delete x.busy; paintSheet(true); });
      return;
    }
    const soc = readSoc();
    const uid = myId() || "me"; c.l = Array.isArray(c.l) ? c.l : [];
    const i = c.l.indexOf(uid); if (i >= 0) c.l.splice(i, 1); else c.l.push(uid);
    writeSoc(soc); paintSheet(true);
  }
  function deleteComment(k) {
    const api = API(); if (!api) return;
    const id = sheetNews;
    api.news.deleteComment(k).then(() => {
      const soc = readSoc(); soc.comments[id] = (soc.comments[id] || []).filter((x) => x.k !== k);
      paintSheet(true); refreshSocial(id);
    }).catch((e) => toastMsg(errMsg(e)));
  }

  function ensureSheet() {
    if (sheetEl) return sheetEl;
    sheetEl = document.createElement("div");
    sheetEl.className = "nw-sheet";
    sheetEl.hidden = true;
    sheetEl.innerHTML = `<div class="nw-sheet-bd" data-nw-close></div>
      <div class="nw-sheet-card" role="dialog" aria-modal="true" aria-labelledby="nwSheetT">
        <header class="nw-sheet-h"><h2 id="nwSheetT">نظرات</h2><button type="button" class="nw-x" data-nw-close aria-label="بستن">${ICON_X}</button></header>
        <div class="nw-sheet-ctx"></div>
        <div class="nw-sheet-list" aria-live="polite"></div>
        <div class="nw-replying" hidden><span>در پاسخ به <b></b></span><button type="button" class="nw-x" data-nw-unreply aria-label="لغو پاسخ">${ICON_X}</button></div>
        <form class="nw-sheet-form" autocomplete="off"><span class="nw-me"></span><input type="text" name="c" maxlength="300" placeholder="نظر خود را بنویسید…" aria-label="نظر شما" enterkeyhint="send" /><button type="submit" class="nw-send" aria-label="ارسال" disabled>${ICON_UP}</button></form>
      </div>`;
    document.body.appendChild(sheetEl);
    const input = sheetEl.querySelector("input"), send = sheetEl.querySelector(".nw-send");
    input.addEventListener("input", () => { send.disabled = !input.value.trim(); });
    sheetEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.closest("[data-nw-close]")) { closeSheet(); return; }
      const rb = e.target.closest("[data-nw-reply]"); if (rb) { setReply(rb.dataset.nwReply); return; }
      const lb = e.target.closest("[data-nw-like]"); if (lb) { toggleCommentLike(lb.dataset.nwLike); return; }
      const db = e.target.closest("[data-nw-del]"); if (db) { deleteComment(db.dataset.nwDel); return; }
      if (e.target.closest("[data-nw-unreply]")) clearReply();
    });
    sheetEl.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") closeSheet(); });
    let sending = false;
    sheetEl.addEventListener("submit", (e) => {
      e.preventDefault(); e.stopPropagation();
      const text = (input.value || "").trim();
      if (!text) return;
      if (!loggedIn()) { closeSheet(); askLogin("برای ثبت نظر ابتدا وارد حساب خود شوید."); return; }
      const id = sheetNews, api = API();
      if (api) {
        if (sending) return; sending = true; send.disabled = true;
        const rep = sheetReply;
        api.news.comment(id, text, rep ? rep.k : null).then((r) => {
          const c = mapComment(r.comment); if (rep) { c.p = rep.k; c.rt = rep.name; }
          const soc = readSoc(); (soc.comments[id] = soc.comments[id] || []).push(c);
          input.value = ""; clearReply(); paintSheet(false);
          if (rep) { const el = sheetEl.querySelector('[data-k="' + c.k + '"]'); if (el) el.scrollIntoView({ block: "nearest" }); }
          refreshSocial(id);
        }).catch((err) => {
          if (err && err.status === 401) { closeSheet(); askLogin("برای ثبت نظر ابتدا وارد حساب خود شوید."); } else toastMsg(errMsg(err));
        }).finally(() => { sending = false; send.disabled = !input.value.trim(); });
        return;
      }
      const soc = readSoc();
      const nc = { k: newKey(), t: text, d: Date.now(), id: myId(), n: myName() };
      if (sheetReply) { nc.p = sheetReply.k; nc.rt = sheetReply.name; }
      (soc.comments[id] = soc.comments[id] || []).push(nc);
      writeSoc(soc); input.value = ""; send.disabled = true;
      const wasReply = !!sheetReply; clearReply();
      paintSheet(false);
      if (wasReply) { const el = sheetEl.querySelector('[data-k="' + nc.k + '"]'); if (el) el.scrollIntoView({ block: "nearest" }); }
      refreshSocial(id);
    });
    return sheetEl;
  }
  function openSheet(id) {
    const el = ensureSheet();
    sheetNews = id; sheetPrevFocus = document.activeElement;
    ensureKeys(id); clearReply(); syncSocial();
    const list = el.querySelector(".nw-sheet-list");
    const post = NEWS_ITEMS.find((x) => x.id === id);
    el.querySelector(".nw-sheet-ctx").innerHTML = post ? `<div class="nw-ctx-ph">${coverHTML(post, "nw-img")}</div><div class="nw-ctx-tx"><span class="nw-ctx-lb">نظر شما برای این خبر</span><b>${esc(post.title)}</b><span class="nw-meta">${esc(post.category)}<i></i>${esc(post.source)}</span></div>` : "";
    list.innerHTML = sheetItemsHTML(id);
    el.querySelector(".nw-me").innerHTML = avHTML({ id: myId(), n: myName() }, "m");
    el.hidden = false;
    document.documentElement.classList.add("nw-sheet-open");
    list.scrollTop = list.scrollHeight;
    requestAnimationFrame(() => { el.classList.add("is-open"); });
    setTimeout(() => { const i = el.querySelector("input"); if (i) i.focus({ preventScroll: true }); }, 60);
  }
  function closeSheet() {
    if (!sheetEl || sheetEl.hidden) return;
    sheetEl.classList.remove("is-open");
    document.documentElement.classList.remove("nw-sheet-open");
    const el = sheetEl;
    setTimeout(() => { if (!el.classList.contains("is-open")) el.hidden = true; }, 240);
    try { if (sheetPrevFocus && sheetPrevFocus.focus) sheetPrevFocus.focus({ preventScroll: true }); } catch (_) {}
  }
  window.addEventListener("hashchange", closeSheet);
  window.addEventListener("popstate", closeSheet);

  /* ---- server sync ---- */
  function mapComment(c) {
    return { k: String(c.id), t: String(c.text || ""), d: Number(c.createdAt) || 0, id: String(c.userId || ""), n: String(c.name || "کاربر"), av: String(c.avatarUrl || ""), p: c.parentId ? String(c.parentId) : undefined, lc: Number(c.likes) || 0, lm: !!c.liked };
  }
  let socAt = 0, socBusy = null;
  function syncSocial(force) {
    const api = API();
    if (!api) return Promise.resolve();
    if (socBusy) return socBusy;
    if (!force && Date.now() - socAt < 30000) return Promise.resolve();
    const ids = NEWS_ITEMS.map((n) => n.id);
    socBusy = api.news.social(ids).then((r) => {
      const items = (r && r.items) || {}, soc = { likes: {}, counts: {}, comments: {} };
      ids.forEach((id) => {
        const it = items[id]; if (!it) return;
        if (it.liked) soc.likes[id] = 1;
        soc.counts[id] = Number(it.likes) || 0;
        const list = (it.comments || []).map(mapComment), names = new Map(list.map((c) => [c.k, c.n]));
        list.forEach((c) => { if (c.p && names.has(c.p)) c.rt = names.get(c.p); });
        soc.comments[id] = list;
      });
      writeSoc(soc); socAt = Date.now();
      document.querySelectorAll(".cm-news-social").forEach(paintBox);
      if (sheetEl && !sheetEl.hidden) paintSheet(true);
    }).catch(() => { /* keep the last copy; the next trigger retries */ }).finally(() => { socBusy = null; });
    return socBusy;
  }
  window.addEventListener("carma:live", (e) => { if (e.detail && e.detail.t === "news") syncSocial(true); });
  /* One-time move of this browser's old likes/comments (the signed-in user's own) to the server. */
  const MIG_PREFIX = "mr_social_migrated_v1:";
  let migrating = false;
  async function migrateLegacy() {
    const api = API(), uid = meUid();
    if (!api || !uid || migrating) return;
    const flagKey = MIG_PREFIX + uid, doneKey = flagKey + ":done";
    try { if (localStorage.getItem(flagKey) === "1") return; } catch (_) { return; }
    let raw = null; try { raw = JSON.parse(localStorage.getItem(SOC_KEY) || "null"); } catch (_) {}
    if (!raw || typeof raw !== "object") { try { localStorage.setItem(flagKey, "1"); } catch (_) {} return; }
    migrating = true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let done = new Set(); try { done = new Set(JSON.parse(localStorage.getItem(doneKey) || "[]")); } catch (_) {}
    const saveDone = () => { try { localStorage.setItem(doneKey, JSON.stringify([...done])); } catch (_) {} };
    try {
      await syncSocial(true);
      const mine = myId(), serverLiked = readSoc().likes, idOk = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
      const ops = [];
      Object.keys(raw.likes || {}).forEach((nid) => { if (idOk.test(nid) && !serverLiked[nid]) ops.push({ tok: "l:" + nid, kind: "like", nid }); });
      Object.keys(raw.comments || {}).forEach((nid) => {
        if (!idOk.test(nid) || !Array.isArray(raw.comments[nid])) return;
        raw.comments[nid].forEach((c) => { if (mine && c && c.id === mine && typeof c.t === "string" && c.t.trim() && c.k) ops.push({ tok: "c:" + nid + ":" + c.k, kind: "comment", nid, c }); });
      });
      ops.sort((a, b) => (a.c && a.c.p ? 1 : 0) - (b.c && b.c.p ? 1 : 0));
      const pending = ops.filter((o) => !done.has(o.tok)).slice(0, 60), pmap = {};
      let stopped = false;
      for (const op of pending) {
        try {
          if (op.kind === "like") await api.news.toggleLike(op.nid);
          else { const r = await api.news.comment(op.nid, op.c.t.trim().slice(0, 500), (op.c.p && pmap[op.c.p]) || null); pmap[op.c.k] = r.comment.id; }
          done.add(op.tok); saveDone();
        } catch (e) {
          const st = e && e.status;
          if (st === 400 || st === 404 || st === 409 || (e && e.code === "DUPLICATE_COMMENT")) { done.add(op.tok); saveDone(); }
          else { stopped = true; break; }
        }
        await sleep(3200); // the server allows 20 writes/minute
      }
      if (!stopped && ops.every((o) => done.has(o.tok))) {
        try {
          if (raw.likes) ops.filter((o) => o.kind === "like").forEach((o) => { delete raw.likes[o.nid]; });
          if (raw.comments) Object.keys(raw.comments).forEach((nid) => { raw.comments[nid] = (raw.comments[nid] || []).filter((c) => !(mine && c && c.id === mine)); if (!raw.comments[nid].length) delete raw.comments[nid]; });
          if (!Object.keys(raw.likes || {}).length && !Object.keys(raw.comments || {}).length) localStorage.removeItem(SOC_KEY); else localStorage.setItem(SOC_KEY, JSON.stringify(raw));
          localStorage.setItem(flagKey, "1"); localStorage.removeItem(doneKey);
        } catch (_) {}
        await syncSocial(true);
      }
    } finally { migrating = false; }
  }
  let lastUid = "";
  setInterval(() => {
    const u = meUid();
    if (u === lastUid) return;
    lastUid = u; socAt = 0;
    syncSocial(true).then(() => { if (u) migrateLegacy(); });
  }, 4000);
  setTimeout(() => { syncSocial(true); }, 1500);

  async function shareNews(id) {
    const n = NEWS_ITEMS.find((x) => x.id === id);
    if (!n) return;
    const data = { title: n.title, text: n.summary, url: n.url };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(n.url); toastMsg("لینک خبر کپی شد"); }
    catch (_) { toastMsg("اشتراک‌گذاری در این مرورگر پشتیبانی نمی‌شود"); }
  }
  /* Capture phase: the home card is itself a link, so buttons inside must not trigger it. */
  document.addEventListener("click", (e) => {
    const box = e.target.closest && e.target.closest(".cm-news-social");
    if (!box) return;
    e.stopPropagation();
    if (e.target.closest(".nw-tick")) { const cb = box.querySelector('[data-act="comment"]'); if (cb) cb.click(); return; }
    const btn = e.target.closest(".cm-news-act");
    if (!btn) return;
    e.preventDefault();
    const id = box.dataset.newsId, act = btn.dataset.act;
    if (act === "like") {
      if (!loggedIn()) { askLogin("برای پسندیدن خبر ابتدا وارد حساب خود شوید."); return; }
      const api = API();
      if (api) {
        if (btn.dataset.busy) return; btn.dataset.busy = "1";
        const soc = readSoc(), was = !!soc.likes[id], base = likeCount(id, soc);
        const set = (on, n) => { const m = readSoc(); if (on) m.likes[id] = 1; else delete m.likes[id]; m.counts[id] = Math.max(0, n); refreshSocial(id); };
        set(!was, base + (was ? -1 : 1));
        api.news.toggleLike(id).then((r) => set(!!r.liked, Number(r.count) || 0))
          .catch((e) => { set(was, base); if (e && e.status === 401) askLogin("برای پسندیدن خبر ابتدا وارد حساب خود شوید."); else toastMsg(errMsg(e)); })
          .finally(() => { delete btn.dataset.busy; });
        return;
      }
      const soc = readSoc(); const on = !soc.likes[id];
      if (on) soc.likes[id] = 1; else delete soc.likes[id];
      writeSoc(soc);
      btn.classList.toggle("is-on", on); btn.setAttribute("aria-pressed", String(on));
      btn.querySelector('[data-n="like"]').textContent = on ? fa(1) : "";
    } else if (act === "comment") {
      openSheet(id);
    } else if (act === "share") {
      shareNews(id);
    }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (!(e.target && e.target.closest && e.target.closest(".cm-news-social"))) return;
    e.stopPropagation();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".nw-tick")) { e.preventDefault(); e.target.click(); }
  }, true);

  /* List card: cover, category, title, two-line summary, one quiet info/actions row. Tap opens the detail page. */
  function metaHTML(n) { return `<span class="nw-meta">${esc(n.source)}<i></i>${ago(n.date)}</span>`; }
  function cardHTML(n) {
    return `<article class="nw-card cm-news-card" data-news-id="${esc(n.id)}">
      <div class="nw-open" data-action="openNews" data-id="${esc(n.id)}" role="link" tabindex="0" aria-label="${esc(n.title)}">
        <div class="nw-ph">${coverHTML(n, "nw-img")}</div>
        <div class="nw-bd"><span class="nw-cat">${esc(n.category)}</span><h3>${esc(n.title)}</h3><p class="nw-sm">${esc(n.summary)}</p></div>
      </div>
      ${actsHTML(n, metaHTML(n))}
    </article>`;
  }

  /* Detail page (#/news/<id>): full cover, title, info, summary (+ optional n.body paragraphs), link to the source, more news. */
  function rowHTML(n) {
    return `<div class="nw-row" data-action="openNews" data-id="${esc(n.id)}" role="link" tabindex="0" aria-label="${esc(n.title)}"><div class="nw-row-tx"><span class="nw-cat">${esc(n.category)}</span><h4>${esc(n.title)}</h4><span class="nw-meta">${esc(n.source)}<i></i>${ago(n.date)}</span></div><div class="nw-row-ph">${coverHTML(n, "nw-img")}</div></div>`;
  }
  window.renderNewsItemScreen = function (id) {
    loadCovers(); syncSocial();
    const known = NEWS_ITEMS.find((x) => x.id === id);
    const root = document.createElement("section");
    root.dataset.page = "newsItem";
    root.className = "sr-page cm-news-page cm-news-detail";
    root.innerHTML = `<div class="page-header-sticky bg-neutral-950 cm-lh"><div class="cm-lh-text"><h1>جزئیات خبر</h1><p>${esc(known ? known.source : "اخبار روز خودرو")}</p></div><div class="cm-lh-btns"><button type="button" class="cm-lh-btn" data-action="vehicleBack" aria-label="بازگشت"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></div><div data-slot="news-body"></div>`;
    const slot = root.querySelector('[data-slot="news-body"]');
    const build = () => {
      const k = NEWS_ITEMS.find((x) => x.id === id); /* looked up lazily: live items may arrive after a deep link opens */
      const n = k && hasImg(k) ? k : null;
      if (!n) {
        slot.innerHTML = settled && liveReady
          ? '<div class="sr-empty"><strong>این خبر پیدا نشد.</strong></div><div class="nw-more" style="text-align:center"><button type="button" class="nw-src" data-action="goNews">همه‌ی خبرها</button></div>'
          : '<div class="sr-empty"><strong>در حال دریافت خبر…</strong></div>';
        return;
      }
      const body = Array.isArray(n.body) ? n.body.map((t) => `<p class="nw-lead">${esc(t)}</p>`).join("") : "";
      const others = visibleNews().filter((x) => x.id !== n.id).sort((x, y) => (x.category === n.category ? -1 : 0) - (y.category === n.category ? -1 : 0) || y.date.localeCompare(x.date)).slice(0, 3);
      slot.innerHTML = `
      <article class="nw-detail" data-news-id="${esc(n.id)}">
        <div class="nw-hero">${coverHTML(n, "nw-img")}</div>
        <div class="nw-dbd">
          <span class="nw-cat">${esc(n.category)}</span>
          <h2 class="nw-title">${esc(n.title)}</h2>
          ${metaHTML(n)}
          <p class="nw-lead">${esc(n.summary)}</p>
          ${body}
          <dl class="nw-info"><div><dt>منبع خبر</dt><dd>${esc(n.source)}</dd></div><div><dt>تاریخ انتشار</dt><dd>${whenFull(n.date)}</dd></div><div><dt>دسته‌بندی</dt><dd>${esc(n.category)}</dd></div></dl>
          <a class="nw-src" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><span>مشاهده‌ی متن کامل در ${esc(n.source)}</span>${ICON_OUT}</a>
        </div>
        ${actsHTML(n)}
      </article>
      ${others.length ? `<section class="nw-more"><h3>خبرهای بیشتر</h3><div class="nw-rows">${others.map(rowHTML).join("")}</div></section>` : ""}
      <p class="sr-footnote">خلاصه‌ی خبر توسط کارما نوشته شده؛ متن کامل در منبع آن در دسترس است.</p>`;
    };
    build();
    const rp = () => {
      if (!root.isConnected) { try { if (state.route.page !== "newsItem") repaints.delete(rp); } catch (_) {} return; }
      build();
    };
    repaints.add(rp);
    return root;
  };

  /* Home news card. Only the active story is in the DOM, so every slide does not download its image at once. */
  function homeCardHTML(n) {
    return `<article class="cm-post cm-news-home" data-news-id="${esc(n.id)}" data-id="${esc(n.id)}" data-action="openNews" role="link" tabindex="0" aria-label="${esc(n.title)}">
      <header class="cm-post-head">
        <span class="cm-post-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h11.5a1.5 1.5 0 0 1 1.500 1.500v11a1.500 1.500 0 0 0 1.500 1.500H7A2 2 0 0 1 5 17.500z"/><path d="M8.500 9h6M8.500 12.500h6M8.500 16h3.500"/></svg></span>
        <span class="cm-post-who"><b>${esc(n.category)}</b><small>${esc(n.source)} · ${when(n.date)}</small></span>
      </header>
      <div class="cm-post-media cm-news-cover">${coverHTML(n, "cm-news-home-img")}</div>
      <div class="cm-news-home-body"><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p></div>
      ${actsHTML(n)}
    </article>`;
  }
  const HOME_NEWS_MAX = 8;      /* the home box shows only the newest few, never the whole archive */
  const HOME_DOTS_MAX = 5;      /* ...and never more than this many dots, however many news there are */
  const homeNewsItems = () => visibleNews().slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, HOME_NEWS_MAX);
  const homeSig = (items) => items.map((n) => n.id).join("|");
  /* Dots: a sliding window of at most HOME_DOTS_MAX; the active one is a long pill, the window's outer dots shrink when more news exist beyond them. */
  function homeDotsHTML(total, active) {
    if (total < 2) return "";
    const size = Math.min(total, HOME_DOTS_MAX);
    const start = Math.max(0, Math.min(active - Math.floor(size / 2), total - size));
    let out = "";
    for (let i = start; i < start + size; i++) {
      const edge = (i === start && start > 0) || (i === start + size - 1 && start + size < total);
      out += `<button type="button" class="cm-news-carousel-dot${i === active ? " is-active" : ""}${edge && i !== active ? " is-edge" : ""}" data-news-slide-to="${i}" aria-label="خبر ${fa(i + 1)} از ${fa(total)}" aria-current="${i === active ? "true" : "false"}"></button>`;
    }
    return out;
  }
  function homeHTML() {
    const items = homeNewsItems();
    if (!items.length) return "";
    const slides = items.map((n, i) => `<div class="cm-news-slide" data-news-slide="${i}" role="group" aria-roledescription="slide" aria-label="${fa(i + 1)} از ${fa(items.length)}">${homeCardHTML(n)}</div>`).join("");
    const dots = items.length > 1 ? `<div class="cm-news-carousel-dots" role="group" aria-label="انتخاب خبر" data-news-dots>${homeDotsHTML(items.length, 0)}</div>` : "";
    return `<div class="cm-news-carousel" data-news-index="0" data-news-sig="${esc(homeSig(items))}" data-news-count="${items.length}" aria-roledescription="carousel" aria-label="اخبار اسلایدی خودرو"><div class="cm-news-carousel-track" data-home-news-track>${slides}</div>${dots}</div>`;
  }
  /* Signed distance between two neighbouring slides (negative in RTL), so the same maths works in any direction. */
  function newsStep(track) {
    const s = track.querySelectorAll(".cm-news-slide");
    return s.length > 1 ? (s[1].offsetLeft - s[0].offsetLeft) : 0;
  }
  function newsIndexOf(track, count) {
    const step = newsStep(track);
    if (!step) return 0;
    return Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / step)));
  }
  function setHomeNewsIndex(feed, idx) {
    const count = Number(feed.dataset.newsCount) || 0;
    if (String(idx) === feed.dataset.newsIndex) return;
    feed.dataset.newsIndex = String(idx);
    const dots = feed.querySelector("[data-news-dots]");
    if (dots) dots.innerHTML = homeDotsHTML(count, idx);
  }
  function goHomeNews(feed, idx, smooth) {
    const track = feed && feed.querySelector("[data-home-news-track]");
    if (!track) return;
    const count = Number(feed.dataset.newsCount) || 0;
    idx = ((idx % count) + count) % count;
    const step = newsStep(track);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: idx * step, behavior: smooth && !reduce ? "smooth" : "auto" });
    setHomeNewsIndex(feed, idx);
  }
  function restartHomeNewsTimer(feed) {
    if (feed._cmNewsTimer) clearInterval(feed._cmNewsTimer);
    feed._cmNewsTimer = null;
    if ((Number(feed.dataset.newsCount) || 0) < 2) return;
    feed._cmNewsTimer = setInterval(() => {
      if (!feed.isConnected) { clearInterval(feed._cmNewsTimer); feed._cmNewsTimer = null; return; }
      if (document.hidden || feed._cmNewsHold || Date.now() - (feed._cmNewsTouched || 0) < 6000) return;
      const r = feed.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;   /* off screen: do not animate */
      goHomeNews(feed, (Number(feed.dataset.newsIndex) || 0) + 1, true);
    }, 5000);
  }
  function bindHomeNews(feed) {
    const track = feed.querySelector("[data-home-news-track]");
    if (!track || feed._cmNewsBound) return;
    feed._cmNewsBound = true;
    const count = Number(feed.dataset.newsCount) || 0;
    let raf = 0;
    track.addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setHomeNewsIndex(feed, newsIndexOf(track, count)); });
    }, { passive: true });
    const touch = () => { feed._cmNewsTouched = Date.now(); };
    track.addEventListener("touchstart", touch, { passive: true });
    track.addEventListener("pointerdown", touch, { passive: true });
    track.addEventListener("wheel", touch, { passive: true });
    feed.addEventListener("mouseenter", () => { feed._cmNewsHold = true; });
    feed.addEventListener("mouseleave", () => { feed._cmNewsHold = false; });
    feed.addEventListener("focusin", () => { feed._cmNewsHold = true; });
    feed.addEventListener("focusout", () => { feed._cmNewsHold = false; });
    feed.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const rtl = getComputedStyle(track).direction === "rtl";
      const next = (e.key === "ArrowLeft") === rtl;
      touch(); goHomeNews(feed, (Number(feed.dataset.newsIndex) || 0) + (next ? 1 : -1), true);
    });
    /* rotating the phone / resizing changes the slide width: re-align to the current news */
    if (window.ResizeObserver) { let first = true; new ResizeObserver(() => { if (first) { first = false; return; } goHomeNews(feed, Number(feed.dataset.newsIndex) || 0, false); }).observe(track); }
  }
  function initHomeNewsCarousels() {
    document.querySelectorAll('[data-slot="home-news"] .cm-news-carousel').forEach((carousel) => { bindHomeNews(carousel); restartHomeNewsTimer(carousel); });
  }
  document.addEventListener("click", (event) => {
    const dot = event.target && event.target.closest && event.target.closest("[data-news-slide-to]");
    if (!dot) return;
    const feed = dot.closest(".cm-news-carousel");
    if (!feed) return;
    event.preventDefault(); event.stopPropagation();
    feed._cmNewsTouched = Date.now();
    goHomeNews(feed, Number(dot.dataset.newsSlideTo), true);
  });
  /* The home box is filled (and its whole section shown/hidden) as soon as a real cover is available. */
  function syncHome() {
    document.querySelectorAll('[data-slot="home-news"]').forEach((feed) => {
      const items = homeNewsItems();
      const cur = feed.querySelector(".cm-news-carousel");
      if (cur && items.length && cur.dataset.newsSig === homeSig(items)) return;   /* nothing changed: keep position */
      if (feed._cmNewsTimer) clearInterval(feed._cmNewsTimer);
      const html = homeHTML();
      feed.innerHTML = html;
      const sec = feed.closest("section");
      if (sec) sec.hidden = !html;
      initHomeNewsCarousels();
    });
  }
  window.CARMA_NEWS_HOME_HTML = function () {
    loadCovers(); syncSocial();
    const html = homeHTML();
    setTimeout(() => {
      if (html) initHomeNewsCarousels();
      else syncHome();
    }, 0);
    return html;
  };

  /* News list page — same layout as the showroom directory (header + chips in the sticky slot, grid of cards). */
  window.renderNewsScreen = function () {
    loadCovers(); syncSocial();
    const root = document.createElement("section");
    root.dataset.page = "news";
    root.className = "sr-page cm-news-page";
    root.innerHTML = `
      <div class="page-header-sticky bg-neutral-950 cm-lh"><div class="cm-lh-text"><h1>اخبار روز خودرو</h1><p>تازه‌ترین خبرهای خودروهای جدید و دنیای خودرو</p></div><div class="cm-lh-btns"><button type="button" class="cm-lh-btn" data-action="vehicleBack" aria-label="بازگشت"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div><div class="sr-chips" role="group" aria-label="دسته‌بندی اخبار">${NEWS_CATEGORIES.map((c, i) => `<button type="button" class="sr-chip${i === 0 ? " is-active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
      <div class="sr-count" data-slot="news-count"></div>
      <div class="sr-grid" data-slot="news-list" aria-live="polite"></div>
      <p class="sr-footnote">خلاصه‌ها توسط کارما نوشته شده‌اند؛ متن کامل هر خبر در منبع آن در دسترس است.</p>`;
    const list = root.querySelector('[data-slot="news-list"]');
    const count = root.querySelector('[data-slot="news-count"]');
    const chips = root.querySelector(".sr-chips");
    let cat = "همه";
    const paint = () => {
      const items = visibleNews().sort((x, y) => y.date.localeCompare(x.date)).filter((n) => cat === "همه" || n.category === cat);
      count.textContent = items.length ? fa(items.length) + " خبر" : "";
      list.innerHTML = items.length ? items.map(cardHTML).join("")
        : '<div class="sr-empty"><strong>' + (settled ? "خبری در این دسته‌بندی نیست." : "در حال دریافت خبرها…") + "</strong></div>";
    };
    paint();
    const rp = () => {
      if (!root.isConnected) { try { if (state.route.page !== "news") repaints.delete(rp); } catch (_) {} return; }
      paint();
    };
    repaints.add(rp);
    /* The chips are moved into the sticky header, outside the page node, so listen on the bar itself. */
    chips.addEventListener("click", (e) => {
      const btn = e.target.closest(".sr-chip");
      if (!btn) return;
      chips.querySelectorAll(".sr-chip").forEach((b) => b.classList.toggle("is-active", b === btn));
      cat = btn.dataset.cat; paint();
    });
    return root;
  };

  /* Keyboard access for the home news card (role="link"). */
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.matches && e.target.matches('[data-action="goNews"][role="link"], [data-action="openNews"][role="link"]')) {
      e.preventDefault();
      e.target.click();
    }
  });
})();
