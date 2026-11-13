"use strict";

/* ------------------------------------------------------------------
   CarMaa Social Feed — iOS / Liquid Glass surface.
   Posts are server-backed. Images use the existing authenticated image
   upload pipeline; story markup is reused from MARQUE_STORIES unchanged.
------------------------------------------------------------------- */
(function () {
  const FEED = { scope: "all", items: [], loading: false, composerOpen: false, publishing: false, file: null, previewUrl: null, vvCleanup: null };
  const $ = (root, selector) => root ? root.querySelector(selector) : null;
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, extra = "") => {
    const paths = {
      search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10 21h4"/>',
      chevron: '<path d="m7 10 5 5 5-5"/>',
      heart: '<path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.8 2.4Z"/>',
      comment: '<path d="M20.5 11.5a8.3 8.3 0 0 1-8.5 7.8 9.5 9.5 0 0 1-4-.8L3 20l1.4-4.1A7.7 7.7 0 0 1 3.5 12 8.3 8.3 0 0 1 12 4a8.3 8.3 0 0 1 8.5 7.5Z"/>',
      share: '<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      photo: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      close: '<path d="m18 6-12 12M6 6l12 12"/>',
      car: '<path d="m5 11 2-4h10l2 4"/><path d="M3 12h18v6H3z"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
      refresh: '<path d="M20 7v5h-5"/><path d="M4.5 10a7.5 7.5 0 0 1 13-2.8L20 12M4 17v-5h5"/><path d="M19.5 14a7.5 7.5 0 0 1-13 2.8L4 12"/>',
      trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
      camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18"/>'
    };
    return `<svg viewBox="0 0 24 24" class="cm-feed-icon ${extra}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.car}</svg>`;
  };
  function faNum(value) { return Number(value || 0).toLocaleString("fa-IR"); }
  function userAccount() { return !!(typeof state !== "undefined" && state.account); }
  function myName() {
    const p = (typeof state !== "undefined" && state.accountProfile) || {};
    return String(p.nickname || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "شما").trim();
  }
  function myAvatar() { const p = (typeof state !== "undefined" && state.accountProfile) || {}; return p.avatar || ""; }
  function initials(name) { return String(name || "ک").trim().slice(0, 1) || "ک"; }
  function avatar(name, src, size = "") {
    return `<span class="cm-feed-avatar ${size}" aria-hidden="true">${src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${esc(initials(name))}</span>`}</span>`;
  }
  function formatDate(iso) {
    if (!iso) return "همین حالا";
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (sec < 45) return "همین حالا";
    if (sec < 3600) return `${faNum(Math.floor(sec / 60))} دقیقه پیش`;
    if (sec < 86400) return `${faNum(Math.floor(sec / 3600))} ساعت پیش`;
    if (sec < 604800) return `${faNum(Math.floor(sec / 86400))} روز پیش`;
    try { return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(then)); } catch (_) { return ""; }
  }
  function postCard(post) {
    const name = post.owner_name || "کاربر CarMaa";
    const handle = post.username ? `@${post.username}` : "عضو CarMaa";
    const body = String(post.body || "").trim();
    const hasMedia = !!post.image_url;
    const likes = Number(post.like_count || 0);
    const comments = Number(post.comment_count || 0);
    const author = (cls) => `<button type="button" class="cm-feed-author ${cls}" data-action="feedOpenAuthor" data-owner-id="${esc(post.owner_id)}" aria-label="مشاهده پروفایل ${esc(name)}">${avatar(name, post.avatar_url)}<span class="cm-feed-author-copy"><strong>${esc(name)}</strong>${cls === "is-below" ? `<span dir="ltr">${esc(handle)}</span>` : ""}</span></button>`;
    const tools = `<div class="cm-feed-head-tools"><button type="button" class="cm-feed-glass" data-action="feedSharePost" data-id="${esc(post.id)}" aria-label="اشتراک‌گذاری">${icon("share")}</button>${post.is_owner ? `<button type="button" class="cm-feed-glass" data-action="feedDeletePost" data-id="${esc(post.id)}" aria-label="حذف پست">${icon("more")}</button>` : ""}</div>`;
    const pill = `<div class="cm-feed-pill" dir="ltr">
        <button type="button" class="cm-feed-pill-btn cm-feed-like${post.is_liked ? " is-liked" : ""}" data-action="feedLike" data-id="${esc(post.id)}" aria-label="پسندیدن" aria-pressed="${!!post.is_liked}">${icon("heart")}<span data-like-count>${faNum(likes)}</span></button>
        <button type="button" class="cm-feed-pill-btn" data-action="feedComments" data-id="${esc(post.id)}" aria-label="دیدگاه‌ها">${icon("comment")}<span data-comment-count>${faNum(comments)}</span></button>
      </div>`;
    return `<article class="cm-feed-post${hasMedia ? "" : " is-text"}" data-post-card="${esc(post.id)}" id="feed-post-${esc(post.id)}">
      ${hasMedia ? `<div class="cm-feed-stage">
        <img class="cm-feed-media" src="${esc(post.image_url)}" alt="تصویر پست ${esc(name)}" loading="lazy" decoding="async" />
        <div class="cm-feed-stage-top">${author("is-chip")}${tools}</div>
        <div class="cm-feed-stage-bottom">${pill}</div>
      </div>` : ""}
      <div class="cm-feed-body">
        <div class="cm-feed-body-head">${author("is-below")}<time>${esc(formatDate(post.created_at))}</time>${hasMedia ? "" : tools}</div>
        ${body ? `<p class="cm-feed-caption">${esc(body).replace(/\n/g, "<br>")}</p>` : ""}
        ${hasMedia ? "" : `<div class="cm-feed-flat-actions">${pill}</div>`}
      </div>
    </article>`;
  }
  function skeletons() {
    return [0, 1].map(() => `<article class="cm-feed-skeleton"><div class="cm-feed-skel-head"><i></i><span></span></div><i class="cm-feed-skel-line"></i><i class="cm-feed-skel-photo"></i></article>`).join("");
  }
  function emptyState() {
    return `<div class="cm-feed-empty">
      <span class="cm-feed-empty-icon">${icon("car")}</span>
      <h2>اینجا جای تجربه‌های خودروییه</h2>
      <p>اولین پست CarMaa رو منتشر کن؛ عکس خودرو، تجربهٔ رانندگی یا نکته‌ای که به درد بقیه می‌خوره.</p>
      <button type="button" data-action="feedOpenComposer" class="cm-feed-primary">${icon("plus")}<span>انتشار اولین پست</span></button>
    </div>`;
  }
  function errorState() {
    return `<div class="cm-feed-state"><span class="cm-feed-state-icon">${icon("refresh")}</span><strong>اتصال به فید برقرار نشد</strong><p>اتصال اینترنت را بررسی کن و دوباره تلاش کن.</p><button type="button" data-action="feedRetry">تلاش دوباره</button></div>`;
  }
  function renderSocialFeedScreen() {
    const page = document.createElement("section");
    page.dataset.page = "feed";
    page.className = "cm-social-feed-page";
    const storyMarkup = window.MARQUE_STORIES && typeof window.MARQUE_STORIES.renderTop === "function" ? window.MARQUE_STORIES.renderTop() : "";
    page.innerHTML = `
      <div class="cm-feed-shell">
        <header class="cm-feed-header" dir="ltr">
          <button type="button" class="cm-feed-top-icon" data-action="feedToggleSearch" aria-label="جستجو در پست‌ها">${icon("search")}</button>
          <div class="cm-feed-heading"><button type="button" data-action="feedTopMenu" aria-label="انتخاب فید"><span>Feed</span>${icon("chevron")}</button></div>
          <button type="button" class="cm-feed-top-icon cm-feed-notify" data-action="openNotifications" aria-label="اعلان‌ها">${icon("bell")}<i hidden data-feed-unread-dot></i></button>
        </header>
        <div class="cm-feed-search-panel" data-feed-search hidden><input type="search" data-feed-search-input maxlength="100" placeholder="جستجو در متن و نام کاربران…" aria-label="جستجو در پست‌ها"><button type="button" data-action="feedClearSearch" aria-label="پاک کردن جستجو">${icon("close")}</button></div>
        <div class="cm-feed-filter-tabs" role="tablist" aria-label="نوع فید" dir="rtl">
          <button type="button" role="tab" class="${FEED.scope === "all" ? "is-active" : ""}" aria-selected="${FEED.scope === "all"}" data-action="feedScope" data-scope="all">برای تو</button>
          <button type="button" role="tab" class="${FEED.scope === "following" ? "is-active" : ""}" aria-selected="${FEED.scope === "following"}" data-action="feedScope" data-scope="following">دنبال‌شده‌ها</button>
        </div>
        <div class="cm-feed-stories">${storyMarkup}</div>
        <div class="cm-feed-post-list" data-slot="feed-posts" aria-live="polite">${skeletons()}</div>
        <div class="cm-feed-footer-note">CarMaa <span>·</span> جامعهٔ عاشقان خودرو</div>
      </div>`;
    loadPosts(page, FEED.scope);
    return page;
  }
  function applyLocalSearch(root, query) {
    if (!root) return;
    const q = String(query || "").trim().toLocaleLowerCase();
    const slot = $(root, '[data-slot="feed-posts"]'); if (!slot) return;
    const filtered = !q ? FEED.items : FEED.items.filter((p) => `${p.body || ""} ${p.owner_name || ""} ${p.username || ""}`.toLocaleLowerCase().includes(q));
    slot.innerHTML = filtered.length ? filtered.map(postCard).join("") : `<div class="cm-feed-search-empty"><strong>نتیجه‌ای پیدا نشد</strong><span>کلمهٔ دیگری جستجو کن.</span></div>`;
  }
  async function loadPosts(root, scope) {
    const slot = $(root, '[data-slot="feed-posts"]');
    if (!slot) return;
    FEED.loading = true;
    try {
      const result = await window.CARMA_API.social.posts({ scope: scope || "all", limit: 30 });
      if (!root.isConnected || scope !== FEED.scope) return;
      FEED.items = Array.isArray(result && result.items) ? result.items : [];
      slot.innerHTML = FEED.items.length ? FEED.items.map(postCard).join("") : emptyState();
      const targetPost = new URLSearchParams(window.location.search).get("post");
      if (targetPost) requestAnimationFrame(() => document.getElementById(`feed-post-${CSS.escape(targetPost)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (_) {
      if (root.isConnected) slot.innerHTML = errorState();
    } finally { FEED.loading = false; }
  }
  function requireFeedLogin() {
    if (userAccount()) return true;
    if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
    state = { ...state, modal: { type: "login", reason: "برای انتشار پست و تعامل با دیگران، ابتدا وارد حساب کاربری شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: { page: "feed" } };
    if (typeof updateOverlays === "function") updateOverlays();
    return false;
  }
  /* ---------------- Composer (iOS large-detent sheet) ---------------- */
  const COMPOSER_MAX = 2200;
  const toast = (message) => { if (typeof showToast === "function") showToast(message); };
  function composerEl() { return document.getElementById("cmFeedComposer"); }
  function composerDirty() {
    const b = composerEl(); if (!b) return false;
    return !!(String(b.querySelector("#cmFeedPostBody")?.value || "").trim() || FEED.file);
  }
  function composerSync() {
    const b = composerEl(); if (!b) return;
    const ta = b.querySelector("#cmFeedPostBody"); if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(132, ta.scrollHeight) + "px";
    const len = ta.value.length, remain = COMPOSER_MAX - len;
    const ring = b.querySelector('[data-slot="ring"]');
    if (ring) {
      const fg = ring.querySelector(".fg");
      if (fg) fg.style.strokeDashoffset = String(69.115 * (1 - Math.min(1, len / COMPOSER_MAX)));
      ring.classList.toggle("is-warn", remain <= 300 && remain > 50);
      ring.classList.toggle("is-danger", remain <= 50);
      const num = ring.querySelector("b");
      if (num) num.textContent = remain <= 300 ? faNum(remain) : "";
    }
    const post = b.querySelector('[data-slot="post"]');
    if (post && !FEED.publishing) post.disabled = !(ta.value.trim() || FEED.file);
  }
  function composerViewport(backdrop, sheet) {
    const vv = window.visualViewport; if (!vv) return null;
    const apply = () => {
      backdrop.style.top = Math.round(vv.offsetTop) + "px";
      backdrop.style.height = Math.round(vv.height) + "px";
      sheet.classList.toggle("is-kb", window.innerHeight - vv.height > 120);
    };
    vv.addEventListener("resize", apply); vv.addEventListener("scroll", apply); apply();
    return () => { vv.removeEventListener("resize", apply); vv.removeEventListener("scroll", apply); };
  }
  function openComposer() {
    if (!requireFeedLogin()) return;
    if (FEED.composerOpen) return;
    const stale = composerEl(); if (stale) stale.remove();
    FEED.composerOpen = true; FEED.file = null; FEED.previewUrl = null;
    const touch = !!(window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
    const backdrop = document.createElement("div");
    backdrop.className = "cm-feed-composer-backdrop";
    backdrop.id = "cmFeedComposer";
    backdrop.innerHTML = `<section class="cm-fc-sheet" role="dialog" aria-modal="true" aria-labelledby="cmFeedComposerTitle" dir="rtl">
      <div class="cm-fc-drag"><i></i></div>
      <header class="cm-fc-nav">
        <button type="button" class="cm-fc-cancel" data-action="feedCloseComposer">لغو</button>
        <h2 id="cmFeedComposerTitle">پست جدید</h2>
        <button type="submit" form="cmFcForm" class="cm-fc-post" data-slot="post" disabled><span>انتشار</span></button>
      </header>
      <form class="cm-feed-composer-form cm-fc-form" id="cmFcForm" novalidate>
        <div class="cm-fc-scroll">
          <div class="cm-fc-author">${avatar(myName(), myAvatar())}<div><strong>${esc(myName())}</strong><span class="cm-fc-aud">${icon("globe")}<span>نمایش برای همه</span></span></div></div>
          <textarea id="cmFeedPostBody" class="cm-fc-text" dir="auto" maxlength="${COMPOSER_MAX}" rows="3" placeholder="چی تو ذهنته؟ از ماشینت، سفرت یا یه تجربه بنویس…" aria-label="متن پست"></textarea>
          <div class="cm-fc-media" data-slot="preview" hidden></div>
        </div>
        <div class="cm-fc-bar">
          <label class="cm-fc-tool" data-slot="photo-tool" for="cmFeedPostImage" aria-label="افزودن عکس">${icon("photo")}</label>
          ${touch ? `<label class="cm-fc-tool" for="cmFeedPostCamera" aria-label="گرفتن عکس">${icon("camera")}</label>` : ""}
          <span class="cm-fc-ring" data-slot="ring" aria-hidden="true"><svg viewBox="0 0 28 28"><circle class="bg" cx="14" cy="14" r="11"/><circle class="fg" cx="14" cy="14" r="11" stroke-dasharray="69.115" stroke-dashoffset="69.115"/></svg><b></b></span>
          <input id="cmFeedPostImage" type="file" accept="image/jpeg,image/png,image/webp" hidden />
          <input id="cmFeedPostCamera" type="file" accept="image/*" capture="environment" hidden />
        </div>
      </form>
    </section>`;
    document.body.appendChild(backdrop);
    document.documentElement.classList.add("cm-feed-composer-open");
    const sheet = backdrop.querySelector(".cm-fc-sheet");
    const ta = backdrop.querySelector("textarea");
    ta.addEventListener("input", composerSync);
    ta.addEventListener("paste", (e) => {
      const f = e.clipboardData && Array.from(e.clipboardData.files || []).find((x) => /^image\//.test(x.type));
      if (f) { e.preventDefault(); setSelectedImage(f); }
    });
    ta.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); publishPost(); } });
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) requestCloseComposer(); });
    let startY = null, dy = 0;
    const down = (e) => { if (e.target.closest("button")) return; startY = e.clientY; dy = 0; sheet.style.transition = "none"; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
    const move = (e) => { if (startY == null) return; dy = Math.max(0, e.clientY - startY); sheet.style.transform = `translateY(${dy}px)`; backdrop.style.setProperty("--fc-fade", String(Math.max(0, 1 - dy / 420))); };
    const up = () => { if (startY == null) return; startY = null; sheet.style.transition = ""; sheet.style.transform = ""; backdrop.style.removeProperty("--fc-fade"); if (dy > 110) requestCloseComposer(); };
    ["cm-fc-drag", "cm-fc-nav"].forEach((cls) => { const el = backdrop.querySelector("." + cls); ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((n, i) => el.addEventListener(n, [down, move, up, up][i])); });
    FEED.vvCleanup = composerViewport(backdrop, sheet);
    composerSync();
    requestAnimationFrame(() => { backdrop.classList.add("is-open"); setTimeout(() => ta.focus({ preventScroll: true }), 120); });
  }
  function closeComposer() {
    const backdrop = composerEl();
    FEED.composerOpen = false; FEED.publishing = false;
    if (FEED.vvCleanup) { FEED.vvCleanup(); FEED.vvCleanup = null; }
    if (FEED.previewUrl) { URL.revokeObjectURL(FEED.previewUrl); FEED.previewUrl = null; }
    FEED.file = null;
    document.documentElement.classList.remove("cm-feed-composer-open");
    if (!backdrop) return;
    backdrop.removeAttribute("id");
    backdrop.classList.remove("is-open"); backdrop.classList.add("is-closing");
    setTimeout(() => backdrop.remove(), 340);
  }
  function requestCloseComposer() {
    const b = composerEl(); if (!b || FEED.publishing) return;
    if (b.querySelector(".cm-fc-confirm")) return;
    if (!composerDirty()) { closeComposer(); return; }
    const el = document.createElement("div");
    el.className = "cm-fc-confirm";
    el.innerHTML = `<div class="cm-fc-confirm-stack" role="alertdialog" aria-label="دور انداختن پست؟">
      <div class="cm-fc-confirm-card"><div class="cm-fc-confirm-text"><strong>پست دور انداخته شود؟</strong><span>متن و عکسی که انتخاب کردی ذخیره نمی‌شود.</span></div><button type="button" class="is-danger" data-action="feedDiscard">دور انداختن</button></div>
      <div class="cm-fc-confirm-card"><button type="button" class="is-primary" data-action="feedKeepEditing">ادامه نوشتن</button></div>
    </div>`;
    el.addEventListener("click", (e) => { if (e.target === el) el.remove(); });
    b.appendChild(el);
  }
  function setSelectedImage(file) {
    const b = composerEl(); if (!b) return;
    const preview = b.querySelector('[data-slot="preview"]'); if (!preview) return;
    const tool = b.querySelector('[data-slot="photo-tool"]');
    ["#cmFeedPostImage", "#cmFeedPostCamera"].forEach((s) => { const i = b.querySelector(s); if (i) i.value = ""; });
    if (!file) {
      if (FEED.previewUrl) { URL.revokeObjectURL(FEED.previewUrl); FEED.previewUrl = null; }
      FEED.file = null; preview.hidden = true; preview.innerHTML = ""; if (tool) tool.classList.remove("is-on");
      composerSync(); return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 6 * 1024 * 1024) {
      toast("عکس باید JPEG، PNG یا WebP و حداکثر ۶ مگابایت باشد.");
      return;
    }
    if (FEED.previewUrl) URL.revokeObjectURL(FEED.previewUrl);
    const url = URL.createObjectURL(file);
    FEED.file = file; FEED.previewUrl = url;
    const sizeLabel = file.size >= 1048576 ? `${Number((file.size / 1048576).toFixed(1)).toLocaleString("fa-IR")} مگابایت` : `${Math.max(1, Math.round(file.size / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
    preview.hidden = false;
    preview.innerHTML = `<img src="${url}" alt="پیش‌نمایش تصویر" /><button type="button" class="cm-fc-media-x" data-action="feedRemoveImage" aria-label="حذف تصویر">${icon("close")}</button><label class="cm-fc-media-change" for="cmFeedPostImage">${icon("photo")}<span>تغییر</span></label><span class="cm-fc-media-size">${sizeLabel}</span>`;
    if (tool) tool.classList.add("is-on");
    composerSync();
  }
  function setComposerBusy(b, busy) {
    const sheet = b.querySelector(".cm-fc-sheet"); if (sheet) sheet.classList.toggle("is-busy", busy);
    const ta = b.querySelector("#cmFeedPostBody"); if (ta) ta.readOnly = busy;
    const post = b.querySelector('[data-slot="post"]');
    if (post) {
      post.disabled = busy;
      post.innerHTML = busy ? '<span class="cm-feed-spinner"></span>' : "<span>انتشار</span>";
    }
  }
  async function publishPost() {
    const backdrop = composerEl();
    if (!backdrop || FEED.publishing) return;
    if (!requireFeedLogin()) { closeComposer(); return; }
    const body = String(backdrop.querySelector("#cmFeedPostBody")?.value || "").trim();
    const file = FEED.file;
    if (!body && !file) { toast("متن یا تصویر پست را وارد کن."); return; }
    if (!window.CARMA_API || !window.CARMA_API.social || !window.CARMA_API.uploads) { toast("سرویس انتشار پست در دسترس نیست."); return; }
    FEED.publishing = true;
    setComposerBusy(backdrop, true);
    try {
      let imageId = null;
      if (file) {
        const uploaded = await window.CARMA_API.uploads.image(file);
        imageId = uploaded && uploaded.image && uploaded.image.id;
        if (!imageId) throw new Error("آپلود تصویر کامل نشد.");
      }
      await window.CARMA_API.social.createPost({ body, imageId });
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
      closeComposer();
      FEED.scope = "all";
      const root = document.querySelector('[data-page="feed"]');
      if (root) {
        root.querySelectorAll('[data-action="feedScope"]').forEach((b) => {
          const active = b.dataset.scope === "all"; b.classList.toggle("is-active", active); b.setAttribute("aria-selected", String(active));
        });
        const slot = $(root, '[data-slot="feed-posts"]'); if (slot) slot.innerHTML = skeletons();
        await loadPosts(root, "all");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      toast("پستت با موفقیت منتشر شد.");
    } catch (error) {
      FEED.publishing = false;
      if (composerEl()) { setComposerBusy(composerEl(), false); composerSync(); }
      toast(error && error.message ? error.message : "انتشار پست انجام نشد. دوباره تلاش کن.");
    }
  }
  async function toggleLike(id) {
    const card = document.querySelector(`[data-post-card="${CSS.escape(String(id))}"]`);
    const post = FEED.items.find((item) => String(item.id) === String(id));
    if (!post || !card) return;
    if (!requireFeedLogin()) return;
    card.querySelectorAll('[data-action="feedLike"]').forEach((b) => { b.disabled = true; });
    try {
      const result = await window.CARMA_API.social.togglePostLike(id);
      post.is_liked = !!result.liked; post.like_count = Number(result.likeCount || 0);
      card.querySelectorAll('[data-action="feedLike"]').forEach((b) => {
        b.classList.toggle("is-liked", post.is_liked); b.setAttribute("aria-pressed", String(post.is_liked)); b.disabled = false;
        const count = b.querySelector("[data-like-count]"); if (count) count.textContent = faNum(post.like_count);
      });
          } catch (error) {
      card.querySelectorAll('[data-action="feedLike"]').forEach((b) => { b.disabled = false; });
      if (typeof showToast === "function") showToast(error?.message || "ثبت پسندیدن انجام نشد.");
    }
  }
  /* ===== Comments: 2027-style glass bottom sheet ===== */
  const CS = { postId: null, ownerId: null, root: null };
  const QUICK = ["🔥", "😍", "👏", "😂", "🙌", "💯"];
  function commentRow(c, isNew) {
    const name = c.owner_name || "کاربر";
    const isAuthor = CS.ownerId && c.owner_id && String(c.owner_id) === String(CS.ownerId);
    return `<article class="cm-cs-item${isNew ? " is-new" : ""}">${avatar(name, c.avatar_url, "is-cs")}<div class="cm-cs-main"><div class="cm-cs-meta"><strong>${esc(name)}</strong>${isAuthor ? '<em>نویسنده</em>' : ""}<time>${esc(formatDate(c.created_at))}</time></div><p>${esc(c.body || "").replace(/\n/g, "<br>")}</p><button type="button" class="cm-cs-reply" data-cs-reply="${esc(name)}">پاسخ</button></div></article>`;
  }
  function csSkeleton() { return [0, 1, 2].map(() => '<div class="cm-cs-skel"><i></i><span><b></b><b></b></span></div>').join(""); }
  function renderComments(list, items) {
    const safeItems = Array.isArray(items) ? items : [];
    if (!safeItems.length) { list.innerHTML = '<div class="cm-cs-empty"><div class="cm-cs-empty-orb">' + icon("comment") + '</div><strong>هنوز دیدگاهی نیست</strong><span>اولین نفری باش که نظرش رو می‌گه.</span></div>'; return; }
    list.innerHTML = safeItems.map((c) => commentRow(c, false)).join("");
  }
  function ensureSheet() {
    if (CS.root && CS.root.isConnected) return CS.root;
    const root = document.createElement("div");
    root.className = "cm-cs-backdrop"; root.hidden = true;
    root.innerHTML = `<section class="cm-cs-sheet" role="dialog" aria-modal="true" aria-label="دیدگاه‌ها" dir="rtl">
      <div class="cm-cs-drag"><i></i></div>
      <header class="cm-cs-head"><div><h3>دیدگاه‌ها</h3><span data-cs-count></span></div><button type="button" class="cm-cs-close" data-cs-close aria-label="بستن">${icon("close") || "✕"}</button></header>
      <div class="cm-cs-list" data-slot="feed-comments-list"></div>
      <form class="cm-feed-comment-form cm-cs-composer" data-post-id="">
        <div class="cm-cs-quick" role="group" aria-label="واکنش سریع">${QUICK.map((e) => `<button type="button" data-cs-emoji="${e}">${e}</button>`).join("")}</div>
        <div class="cm-cs-field">${avatar(myName(), myAvatar(), "is-cs")}
          <textarea name="comment" rows="1" maxlength="800" placeholder="نظرت رو بنویس…" aria-label="متن دیدگاه" enterkeyhint="send"></textarea>
          <button type="submit" class="cm-cs-send" aria-label="ارسال دیدگاه" disabled>${icon("share")}</button>
        </div>
      </form>
    </section>`;
    document.body.appendChild(root);
    CS.root = root;
    const sheet = root.querySelector(".cm-cs-sheet");
    const form = root.querySelector("form");
    const ta = form.querySelector("textarea");
    const send = form.querySelector(".cm-cs-send");
    const sync = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; send.disabled = !ta.value.trim(); };
    ta.addEventListener("input", sync);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (ta.value.trim()) form.requestSubmit(); } });
    form._sync = sync;
    root.addEventListener("click", (e) => {
      if (e.target === root || e.target.closest("[data-cs-close]")) { closeComments(); return; }
      const em = e.target.closest("[data-cs-emoji]");
      if (em) { ta.value += em.dataset.csEmoji; sync(); ta.focus(); return; }
      const rp = e.target.closest("[data-cs-reply]");
      if (rp) { ta.value = `@${rp.dataset.csReply} ` + ta.value.replace(/^@\S+\s/, ""); sync(); ta.focus(); }
    });
    // swipe down to dismiss (from the handle / header)
    let startY = null, dy = 0;
    const grab = root.querySelector(".cm-cs-drag"), head = root.querySelector(".cm-cs-head");
    const down = (e) => { if (e.target.closest("button")) return; startY = e.clientY; dy = 0; sheet.style.transition = "none"; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
    const move = (e) => { if (startY == null) return; dy = Math.max(0, e.clientY - startY); sheet.style.transform = `translateY(${dy}px)`; root.style.setProperty("--cs-fade", String(Math.max(0, 1 - dy / 420))); };
    const up = () => { if (startY == null) return; startY = null; sheet.style.transition = ""; sheet.style.transform = ""; root.style.removeProperty("--cs-fade"); if (dy > 110) closeComments(); };
    [grab, head].forEach((el) => { el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); });
    return root;
  }
  function closeComments() {
    const root = CS.root; if (!root || root.hidden) return;
    root.classList.remove("is-open");
    document.documentElement.classList.remove("cm-cs-lock");
    CS.postId = null;
    setTimeout(() => { if (!root.classList.contains("is-open")) root.hidden = true; }, 320);
  }
  async function toggleComments(id) {
    const post = FEED.items.find((x) => String(x.id) === String(id));
    const root = ensureSheet();
    const form = root.querySelector("form"), list = root.querySelector('[data-slot="feed-comments-list"]');
    CS.postId = String(id); CS.ownerId = post ? post.owner_id : null;
    form.dataset.postId = String(id);
    const ta = form.querySelector("textarea"); ta.value = ""; form._sync();
    const setCount = (n) => { const el = root.querySelector("[data-cs-count]"); if (el) el.textContent = n ? `${faNum(n)} نظر` : ""; };
    setCount(post ? Number(post.comment_count || 0) : 0);
    list.innerHTML = csSkeleton(); list.scrollTop = 0;
    root.hidden = false; void root.offsetWidth; root.classList.add("is-open");
    document.documentElement.classList.add("cm-cs-lock");
    try {
      const data = await window.CARMA_API.social.postComments(id);
      if (CS.postId !== String(id)) return;
      renderComments(list, data.items); setCount((data.items || []).length);
    } catch (error) {
      if (CS.postId === String(id)) list.innerHTML = `<div class="cm-cs-empty"><strong>دریافت نشد</strong><span>${esc(error?.message || "دیدگاه‌ها دریافت نشد.")}</span></div>`;
    }
  }
  async function sendComment(form) {
    const id = form.dataset.postId;
    const input = form.querySelector("[name=comment]");
    const body = String(input?.value || "").trim();
    if (!body || !id) return;
    if (!requireFeedLogin()) return;
    const button = form.querySelector("button[type=submit]"); if (button) button.disabled = true;
    try {
      const result = await window.CARMA_API.social.createPostComment(id, body);
      const comment = result.comment;
      const list = CS.root && CS.root.querySelector('[data-slot="feed-comments-list"]');
      const post = FEED.items.find((x) => String(x.id) === String(id));
      if (post) post.comment_count = Number(post.comment_count || 0) + 1;
      const card = document.querySelector(`[data-post-card="${CSS.escape(String(id))}"]`);
      const count = card && card.querySelector("[data-comment-count]"); if (count && post) count.textContent = faNum(post.comment_count);
      const head = CS.root && CS.root.querySelector("[data-cs-count]"); if (head && post) head.textContent = `${faNum(post.comment_count)} نظر`;
      if (list && comment) {
        if (list.querySelector(".cm-cs-empty, .cm-cs-skel")) list.innerHTML = "";
        list.insertAdjacentHTML("afterbegin", commentRow(comment, true));
        list.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (input) { input.value = ""; form._sync && form._sync(); }
    } catch (error) { if (typeof showToast === "function") showToast(error?.message || "دیدگاه ارسال نشد."); if (button) button.disabled = false; }
  }
  async function deletePost(id) {
    const post = FEED.items.find((x) => String(x.id) === String(id));
    if (!post || !post.is_owner) return;
    if (!window.confirm("این پست برای همیشه از فید حذف شود؟")) return;
    try {
      await window.CARMA_API.social.deletePost(id);
      FEED.items = FEED.items.filter((x) => String(x.id) !== String(id));
      document.querySelector(`[data-post-card="${CSS.escape(String(id))}"]`)?.remove();
      if (!FEED.items.length) { const slot = document.querySelector('[data-page="feed"] [data-slot="feed-posts"]'); if (slot) slot.innerHTML = emptyState(); }
      if (typeof showToast === "function") showToast("پست حذف شد.");
    } catch (error) { if (typeof showToast === "function") showToast(error?.message || "حذف پست انجام نشد."); }
  }

  document.addEventListener("click", (event) => {
    const el = event.target.closest && event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (action === "openSocialFeed") {
      event.preventDefault(); event.stopImmediatePropagation();
      if (typeof navigateTo === "function") navigateTo({ page: "feed" }, { menuOpen: false });
    } else if (action === "feedOpenComposer") {
      event.preventDefault(); event.stopImmediatePropagation(); openComposer();
    } else if (action === "feedCloseComposer") {
      event.preventDefault(); event.stopImmediatePropagation(); requestCloseComposer();
    } else if (action === "feedDiscard") {
      event.preventDefault(); event.stopImmediatePropagation(); closeComposer();
    } else if (action === "feedKeepEditing") {
      event.preventDefault(); event.stopImmediatePropagation();
      const c = el.closest(".cm-fc-confirm"); if (c) c.remove();
    } else if (action === "feedRemoveImage") {
      event.preventDefault(); event.stopImmediatePropagation(); setSelectedImage(null);
    } else if (action === "feedScope") {
      event.preventDefault(); event.stopImmediatePropagation();
      const requested = el.dataset.scope === "following" ? "following" : "all";
      if (requested === "following" && !userAccount()) { requireFeedLogin(); return; }
      FEED.scope = requested;
      const root = document.querySelector('[data-page="feed"]');
      if (!root) return;
      root.querySelectorAll('[data-action="feedScope"]').forEach((b) => { const active = b.dataset.scope === requested; b.classList.toggle("is-active", active); b.setAttribute("aria-selected", String(active)); });
      const slot = $(root, '[data-slot="feed-posts"]'); if (slot) slot.innerHTML = skeletons();
      loadPosts(root, requested);
    } else if (action === "feedRetry") {
      event.preventDefault(); event.stopImmediatePropagation();
      const root = document.querySelector('[data-page="feed"]'); if (root) { const slot = $(root, '[data-slot="feed-posts"]'); if (slot) slot.innerHTML = skeletons(); loadPosts(root, FEED.scope); }
    } else if (action === "feedLike") {
      event.preventDefault(); event.stopImmediatePropagation(); toggleLike(el.dataset.id);
    } else if (action === "feedComments") {
      event.preventDefault(); event.stopImmediatePropagation(); toggleComments(el.dataset.id);
    } else if (action === "feedSharePost") {
      event.preventDefault(); event.stopImmediatePropagation();
      const post = FEED.items.find((x) => String(x.id) === String(el.dataset.id));
      const url = `${window.location.origin}/feed?post=${encodeURIComponent(el.dataset.id)}`;
      if (navigator.share) navigator.share({ title: "پست در CarMaa", text: (post && post.body) || "این پست را در CarMaa ببین", url }).catch(() => {});
      else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => { if (typeof showToast === "function") showToast("لینک فید کپی شد."); }).catch(() => { if (typeof showToast === "function") showToast(url); });
      else if (typeof showToast === "function") showToast("لینک: " + url);
    } else if (action === "feedDeletePost") {
      event.preventDefault(); event.stopImmediatePropagation(); deletePost(el.dataset.id);
    } else if (action === "feedToggleSearch") {
      event.preventDefault(); event.stopImmediatePropagation();
      const root = document.querySelector('[data-page="feed"]'); if (!root) return;
      const panel = root.querySelector('[data-feed-search]'); if (!panel) return;
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.querySelector("input")?.focus({ preventScroll: true });
      else { const input = panel.querySelector("input"); if (input) input.value = ""; applyLocalSearch(root, ""); }
    } else if (action === "feedClearSearch") {
      event.preventDefault(); event.stopImmediatePropagation();
      const root = document.querySelector('[data-page="feed"]'); const input = root && root.querySelector('[data-feed-search-input]');
      if (input) { input.value = ""; applyLocalSearch(root, ""); input.focus({ preventScroll: true }); }
    } else if (action === "feedTopMenu") {
      event.preventDefault(); event.stopImmediatePropagation();
      const root = document.querySelector('[data-page="feed"]'); if (!root) return;
      const tabs = root.querySelector(".cm-feed-filter-tabs"); if (tabs) tabs.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (action === "feedOpenAuthor") {
      event.preventDefault(); event.stopImmediatePropagation();
      const id = el.dataset.ownerId;
      if (id && typeof navigateTo === "function") navigateTo({ page: "seller", sellerId: id }, { menuOpen: false });
    }
  }, true);

  document.addEventListener("input", (event) => {
    if (event.target && event.target.matches("[data-feed-search-input]")) {
      const root = event.target.closest('[data-page="feed"]'); applyLocalSearch(root, event.target.value);
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target && (event.target.id === "cmFeedPostImage" || event.target.id === "cmFeedPostCamera")) { const f = event.target.files && event.target.files[0]; if (f) setSelectedImage(f); }
  });
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form && form.matches(".cm-feed-composer-form")) {
      event.preventDefault(); event.stopImmediatePropagation(); publishPost();
    } else if (form && form.matches(".cm-feed-comment-form")) {
      event.preventDefault(); event.stopImmediatePropagation(); sendComment(form);
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { if (CS.root && !CS.root.hidden) closeComments(); else if (FEED.composerOpen) { const c = document.querySelector(".cm-fc-confirm"); if (c) c.remove(); else requestCloseComposer(); } }
  });

  window.renderSocialFeedScreen = renderSocialFeedScreen;
})();
