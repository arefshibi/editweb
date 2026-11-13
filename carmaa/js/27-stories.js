"use strict";

/*
 * CarMaa STORIES — 24-hour stories (Instagram style)
 * The rail at the top of the messages page is made of stories. In API mode,
 * stories, publication, deletion and view counts are server-authoritative;
 * localStorage keeps only seen-state and a small offline-preview store. Seed
 * stories from demo dealerships are shown only when the API is disabled.
 */
(function () {
  const STORE_KEY = "marque_stories_v1";
  const SEEN_KEY = "marque_stories_seen_v1";
  const TTL = 24 * 60 * 60 * 1000;
  const SLIDE_MS = 5000;
  const MAX_PER_USER = 10;
  const FA = (n) => new Intl.NumberFormat("fa-IR").format(n);
  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const PLUS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>`;

  /* ---------------- storage ---------------- */
  function readStories() {
    let list = [];
    try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); if (Array.isArray(d)) list = d; } catch (_) {}
    const now = Date.now();
    const alive = list.filter((s) => s && s.media && Number(s.expiresAt) > now);
    if (alive.length !== list.length && !window.CARMA_API?.enabled) writeStories(alive);
    return alive;
  }
  function writeStories(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; }
    catch (_) { toast("فضای ذخیره‌سازی مرورگر پر است؛ استوری قدیمی‌تر را حذف کنید."); return false; }
  }
  // Server mode + signed in: "seen" is stored on the server (story_seen), so it follows the user across devices.
  // `serverSeen` is filled from GET /social/stories; the local map is only used for signed-out viewers / offline preview.
  const serverSeen = {};
  const seenOnServer = () => !!(window.CARMA_API?.enabled && window.CARMA_AUTH_USER);
  function readSeen() {
    if (seenOnServer()) return serverSeen;
    try { const o = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; }
  }
  function markSeen(id) {
    if (seenOnServer()) {
      if (serverSeen[id]) return;
      serverSeen[id] = Date.now();
      if (/^[0-9a-f-]{36}$/i.test(String(id))) { try { window.CARMA_API.social.markStorySeen(id).catch(() => { delete serverSeen[id]; }); } catch (_) {} }
      return;
    }
    const o = readSeen(); if (o[id]) return; o[id] = Date.now();
    // forget entries older than 2 days so the map never grows forever
    const cut = Date.now() - 2 * TTL; Object.keys(o).forEach((k) => { if (o[k] < cut) delete o[k]; });
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (_) {}
  }
  function toast(m) { if (typeof showToast === "function") showToast(m); }

  /* ---------------- views (private: only the story's owner sees the numbers) ----------------
     In API mode, distinct views are stored by the server. Local view storage is
     used only for offline preview stories; owners never count their own views. */
  const VIEWS_KEY = "marque_story_views_v1", DEVICE_KEY = "marque_story_device_v1";
  function readViews() { try { const o = JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; } }
  function deviceId() {
    try { let d = localStorage.getItem(DEVICE_KEY); if (!d) { d = "d" + Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVICE_KEY, d); } return d; } catch (_) { return "d0"; }
  }
  function viewerKey() { return account() ? "a:" + myId() : "d:" + deviceId(); }
  function recordView(story, group) {
    if (!story || story.seed || !group) return;
    if (group.mine || (group.phone && group.phone === account())) return; // owner's own views don't count
    if (story.serverBacked && window.CARMA_API?.enabled) {
      if (!story._viewSent) { story._viewSent = true; window.CARMA_API.social.viewStory(story.id, deviceId()).then((r)=>{ if(r?.viewCount!=null) story.serverViewCount=Number(r.viewCount); }).catch(()=>{ story._viewSent = false; }); }
      return;
    }
    const all = readViews(), k = viewerKey();
    const r = all[story.id] || (all[story.id] = { n: 0, v: {} });
    if (r.v[k]) return;
    r.v[k] = Date.now(); r.n = Object.keys(r.v).length;
    // forget views of stories that no longer exist
    const alive = {}; readStories().forEach((x) => { alive[x.id] = 1; });
    Object.keys(all).forEach((id) => { if (!alive[id]) delete all[id]; });
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(all)); } catch (_) {}
  }
  function seedViews(id) { let h = 7; const t = String(id); for (let i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) % 100003; return 140 + (h % 860); }
  function viewsOf(story, views) {
    if (story && story.serverBacked) return Number(story.serverViewCount || 0);
    const r = (views || readViews())[story.id];
    return (story.seed ? seedViews(story.id) : 0) + (r ? Number(r.n) || 0 : 0);
  }
  /* Skeleton rail: shown until the first server sync settles, so the row never pops in late or flashes stale local data. */
  let storiesReady = !window.CARMA_API?.enabled;
  function markStoriesReady() { if (storiesReady) return; storiesReady = true; try { autoSync(true); } catch (_) {} }
  function skeletonTop() {
    const item = `<div class="cm-ts-item cm-ts-sk" aria-hidden="true"><span class="cm-ts-ring" style="background:none;box-shadow:none;padding:0"><span class="skeleton-block" style="display:block;width:72px;height:72px;border-radius:999px"></span></span><span style="margin-top:10px"><span class="skeleton-block" style="display:block;width:52px;height:10px;border-radius:999px"></span></span><span style="margin-top:5px"><span class="skeleton-block" style="display:block;width:40px;height:8px;border-radius:999px"></span></span></div>`;
    return `<section class="cm-ts cm-ts-skeleton" aria-busy="true" aria-label="در حال بارگذاری استوری‌ها"><div class="cm-ts-rail" style="overflow:hidden">${[0,1,2,3,4].map(() => item).join("")}</div></section>`;
  }
  function syncServerStories() {
    if (!window.CARMA_API?.enabled) return;
    Promise.all([window.CARMA_API.social.stories(), window.CARMA_AUTH_USER ? window.CARMA_API.social.myStories().catch(()=>({items:[]})) : Promise.resolve({items:[]}), (window.CARMA_AUTH_USER && window.CARMA_API.social.suggestedStories) ? window.CARMA_API.social.suggestedStories().catch(()=>({items:[]})) : Promise.resolve({items:[]})]).then(([result, mineResult, sugResult]) => {
      const mineId = String(window.CARMA_AUTH_USER?.id || '');
      const privateViews = new Map((mineResult?.items || []).map((r)=>[String(r.id),Number(r.view_count||0)]));
      const sugById = new Map((sugResult?.items || []).map((x) => [String(x.id), x]));
      const baseRows = (result?.items || []).concat((sugResult?.items || []).filter((x) => !(result?.items || []).some((y) => String(y.id) === String(x.id))));
      const list = baseRows.map((r0) => {
        const sg = sugById.get(String(r0.id)); const r = sg ? { ...r0, ...sg } : r0;
        const mine = mineId && String(r.owner_id) === mineId;
        const ownerId = mine ? (myId() || 'user:' + String(r.owner_id)) : 'user:' + String(r.owner_id);
        return { id:String(r.id), serverBacked:true, serverViewCount:privateViews.get(String(r.id)) || 0, owner:{id:ownerId,kind:'personal',name:String(r.owner_name||'کاربر'),short:String(r.owner_name||r.username||'کاربر'),username:String(r.username||''),avatar:String(r.avatar_url||''),uid:String(r.owner_id||''),phone:mine?account():'',suggested:!!r.suggested&&!mine,score:Number(r.score||0),reason:String(r.reason||'')}, media:String(r.media_url||''), caption:String(r.caption||''), createdAt:Date.parse(r.created_at)||Date.now(), expiresAt:Date.parse(r.expires_at)||Date.now()+TTL, ...(r.listing_id?{listingId:String(r.listing_id)}:{}) };
      }).filter((x)=>x.media && x.expiresAt>Date.now());
      if (window.CARMA_AUTH_USER) baseRows.forEach((r) => { if (r.seen === true) serverSeen[String(r.id)] = serverSeen[String(r.id)] || Date.now(); });
      try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (_) {}
      storiesReady = true;
      autoSync(true);
    }).catch(()=>{ markStoriesReady(); });
  }
  function groupViews(g, views) { return g.stories.reduce((n, st) => n + viewsOf(st, views), 0); }
  const EYE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  /* ---- «آموزش سایت» bubble in the home rail: opens the first-visit tour (js/57-onboarding-tour.js) ---- */
  function tourSeen() { try { return !!JSON.parse(localStorage.getItem("carma_onboarding_v1") || "{}").done; } catch (_) { return false; } }
  function tourBubbleCss() {
    if (document.getElementById("cmTourBubbleCss")) return;
    const st = document.createElement("style"); st.id = "cmTourBubbleCss";
    st.textContent = ".cm-ts-tour .cm-ts-av{background:#1D1D1F;color:#ffffff}.cm-ts-tour .cm-ts-av svg{width:30px;height:30px}"
      + ".cm-ts-tour.is-unseen .cm-ts-ring{background:conic-gradient(from 200deg,#ffffff,#9a9aa1 30%,#ffffff 60%,#9a9aa1);animation:cmTourPulse 2.6s ease-out infinite;color:#1D1D1F}"
      + ".cm-ts .cm-ts-tour .cm-ts-handle{direction:rtl!important;unicode-bidi:normal!important;color:#ffffff!important}.cm-ts .cm-ts-tour.is-seen .cm-ts-handle{color:#ececee!important}"
      + "@keyframes cmTourPulse{0%{box-shadow:0 6px 16px rgba(0,0,0,.5),0 0 0 0 rgba(255,255,255,.27)}70%,100%{box-shadow:0 6px 16px rgba(0,0,0,.5),0 0 0 5px rgba(255,255,255,0)}}"
      + "@media (prefers-reduced-motion:reduce){.cm-ts-tour.is-unseen .cm-ts-ring{animation:none}}";
    document.head.appendChild(st);
  }
  function tourBubble() {
    tourBubbleCss();
    return `<button type="button" class="cm-ts-item cm-ts-tour ${tourSeen() ? "is-seen" : "is-unseen"}" data-action="openTour" data-owner="__tour" aria-label="آموزش سایت">
        <span class="cm-ts-ring"><span class="cm-ts-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg></span></span>
        <span class="cm-ts-name">آموزش سایت</span><span class="cm-ts-kind cm-ts-handle">آموزش سایت</span></button>`;
  }
  // after the user's own story; first when they have none
  function tourInsert(parts, list) {
    const i = list.findIndex((g) => g.mine && !g.dealer);
    parts.push(tourBubble()); /* CM-TOUR-LAST: آموزش سایت همیشه آخرین دایره (در RTL = انتهای سمت چپ) */
    return parts.join("");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest('[data-action="openTour"]'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    b.classList.remove("is-unseen"); b.classList.add("is-seen");
    if (window.CARMA_TOUR) window.CARMA_TOUR.open();
  }, true);

  /* ---------------- home: top stories ---------------- */
  function topGroups() {
    const { others } = buildGroups(), views = readViews();
    // Keep seen stories in the rail; unseen groups stay on the right and fully
    // watched groups move to the far left (RTL) instead of disappearing.
    return others // استوری خود کاربر دیگر اینجا نیست؛ همیشه اول ریل با renderMeItem نمایش داده می‌شود
      .map((g) => ({ g, v: groupViews(g, views) }))
      .sort((a, b) => sugCmp(a.g, b.g) || (b.g.latest - a.g.latest) || (b.v - a.v))
      .map((x) => x.g);
  }
  // The @handle under a story is the owner's real username. Never derive it from an internal id
  // (that produced throw-away "user_u…" handles that looked like the id kept changing).
  function storyHandle(g) {
    let handle = "";
    const dealerStory = g?.dealer || String(g?.id || "").startsWith("brand:");
    const raw = String(g?.id || "").replace(/^(dealer:|user:|personal:|brand:)/, "");
    if (!dealerStory) {
      const au = window.CARMA_AUTH_USER;
      if (g?.mine && au?.username) handle = String(au.username);
      else if (g?.username) handle = String(g.username);
    }
    if (!handle) {
      try { if (window.MR_PROFILE?.getUsername && raw) handle = window.MR_PROFILE.getUsername(raw, dealerStory ? "dealer" : ""); } catch (_) {}
      // getUsername() returns a generated "user_<id>"/"dealer_<id>" placeholder when nothing is set: hide it.
      const placeholder = (dealerStory ? "dealer_" : "user_") + raw.replace(/[^a-z0-9_.]/gi, "").toLowerCase();
      if (handle === placeholder) handle = "";
    }
    if (!handle && dealerStory && typeof demoShowroomById === "function") { try { const d = demoShowroomById(g.id); if (d && d.username) handle = d.username; } catch (_) {} }
    return handle ? "@" + handle : "";
  }
  // اولین حباب ریل صفحه اصلی = پروفایل خود کاربر لاگین‌شده (چه استوری داشته باشد چه نه) + دکمه + برای گذاشتن استوری
  function renderMeItem() {
    if (!account()) return "";
    const { mine } = buildGroups();
    const prof = (typeof state !== "undefined" && state.accountProfile) || {};
    const me = { id: myId(), mine: true, name: myName(), avatar: prof.avatar || (mine && mine.avatar) || "" };
    const has = !!mine;
    return `<button type="button" class="cm-ts-item cm-ts-me${has ? " has-story" : ""}${has && mine.unseen ? " is-unseen" : ""}" data-action="${has ? "storyOpen" : "storyAdd"}" data-owner="${esc(has ? mine.id : (me.id || "me"))}" aria-label="${has ? "استوری شما" : "افزودن استوری"}">
        <span class="cm-ts-ring"><span class="cm-ts-av" style="--h:${hueOf(me.name)}">${avatarHTML(me)}</span><span class="cm-ts-plus" role="button" tabindex="0" data-action="storyAdd" aria-label="افزودن استوری">${PLUS}</span></span>
        <span class="cm-ts-name">استوری شما</span><span class="cm-ts-kind cm-ts-handle" dir="ltr">${esc(storyHandle(me))}</span></button>`;
  }
  function renderTop() {
    if (!storiesReady) return skeletonTop();
    const list = topGroups();
    const meItem = renderMeItem();
    const items = tourInsert(list.map((g, i) => {
      const who = (g.mine && !g.dealer) ? { ...g, name: myName(), avatar: (typeof state !== "undefined" && state.accountProfile && state.accountProfile.avatar) || g.avatar } : g;
      return `<button type="button" class="cm-ts-item${g.unseen ? " is-unseen" : ""}${g.suggested ? " is-suggested" : ""}" data-action="storyOpen" data-owner="${esc(g.id)}" aria-label="${esc("استوری " + g.name)}">
        <span class="cm-ts-ring"><span class="cm-ts-av" style="--h:${hueOf(g.name)}">${avatarHTML(who)}</span>${g.suggested ? '<span class="cm-ts-sug">پیشنهادی</span>' : ''}</span>
        <span class="cm-ts-name">${esc(g.short)}</span><span class="cm-ts-kind cm-ts-handle" dir="ltr">${esc(storyHandle(g))}</span></button>`;
    }), list);
    lastSig = railSignature();
    return `<section class="cm-ts" aria-label="استوری‌های برتر"><div class="cm-ts-rail" role="list">${meItem}${items}</div></section>`;
  }
  function refreshTop() {
    const el = document.querySelector(".cm-ts"); if (!el) return;
    // Cancel a pending section fade if new stories arrive before it finishes.
    if (typeof el.getAnimations === "function") el.getAnimations().forEach((a) => { try { a.cancel(); } catch (_) {} });
    const tmp = document.createElement("div"); tmp.innerHTML = renderTop();
    const fresh = tmp.firstElementChild;
    if (fresh && el.classList.contains("cm-ts-skeleton") && !fresh.classList.contains("cm-ts-skeleton")) { el.replaceWith(fresh); lastSig = railSignature(); return; }
    if (!fresh) {
      // Nothing is left to show. Fade the section itself rather than removing it mid-frame.
      const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" });
      fade.onfinish = () => { if (el.isConnected) el.remove(); };
      return;
    }
    const currentHeading = el.querySelector(".cm-home-section-heading");
    const nextHeading = fresh.querySelector(".cm-home-section-heading");
    if (currentHeading && nextHeading) currentHeading.replaceWith(nextHeading);
    const currentRail = el.querySelector(".cm-ts-rail");
    const desiredRail = fresh.querySelector(".cm-ts-rail");
    if (currentRail && desiredRail) reconcileRail(currentRail, desiredRail, ".cm-ts-item");
    lastSig = railSignature();
  }

  /* ---------------- identity ---------------- */
  function account() { return String((typeof state !== "undefined" && state.account) || ""); }
  function myId() { return account() && typeof sellerIdForPhone === "function" ? sellerIdForPhone(account()) : ""; }
  function myName() {
    const p = (typeof state !== "undefined" && state.accountProfile) || {};
    const n = String(p.nickname || "").trim() || `${p.firstName || ""} ${p.lastName || ""}`.trim();
    return n || "من";
  }
  function avatarOf(group) {
    if (group.avatar) return { url: group.avatar, logo: false };
    if (typeof sellerAvatarFor === "function" && group.id && !String(group.id).startsWith("brand:")) {
      const bare = String(group.id).replace(/^dealer:/, "");
      const u = group.dealer ? (sellerAvatarFor("dealer", bare) || "") : (sellerAvatarFor("personal", bare) || sellerAvatarFor("dealer", bare));
      if (u) return { url: u, logo: false };
    }
    if (String(group.id).startsWith("brand:") && typeof demoAvatarForId === "function") {
      const u = demoAvatarForId(group.id); if (u) return { url: u, logo: false };
    }
    return { url: "", logo: false };
  }
  function hueOf(name) { let h = 0; const t = String(name || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return h; }
  function avatarHTML(group) {
    const a = avatarOf(group);
    return a.url ? `<img src="${esc(a.url)}" alt=""${a.logo ? ' class="is-logo"' : ""} />` : esc(String(group.name || "م").trim().slice(0, 1) || "م");
  }

  // tile cover = the user's profile photo (not the story image)
  function coverHTML(group) {
    const a = avatarOf(group);
    if (a.url) return `<img class="mr-story-cover${a.logo ? " is-logo" : ""}" src="${esc(a.url)}" alt="" loading="lazy" />`;
    return `<span class="mr-story-cover mr-story-cover-ph" style="--h:${hueOf(group.name)}">${esc(String(group.name || "م").trim().slice(0, 1) || "م")}</span>`;
  }

  /* ---------------- data: groups ---------------- */
  /* استوری‌های نمایشی: از همان نمایشگاه‌های فرضی لیست نمایشگاه‌ها (js/00-demo-showrooms.js) */
  /* CM-FAKE-STORIES: برای خاموش‌کردن استوری‌های نمایشی این را false کن */
  const CM_FAKE_STORIES = true;
  function seedStories() {
    const out = [];
    if (!CM_FAKE_STORIES || typeof DEMO_BRAND_ORDER === "undefined" || typeof demoShowroomForBrand !== "function") return out;
    const fallback = []; for (let n = 1; n <= 20; n++) fallback.push("images/listings/car-" + (n < 10 ? "0" : "") + n + ".webp");
    const pool = (typeof LISTINGS !== "undefined" ? LISTINGS : []).filter((x) => Array.isArray(x.photos) && x.photos[0]).map((x) => x.photos[0]);
    const photos = pool.length >= 10 ? pool : fallback;
    const offsets = [0.4, 1.2, 2.5, 3.6, 5, 7, 9, 12, 16, 20];
    DEMO_BRAND_ORDER.slice(0, 10).forEach((brand, bi) => {
      const d = demoShowroomForBrand(brand);
      const base = Date.now() - (offsets[bi % offsets.length] * 3600 * 1000);
      [0, 1].forEach((i) => {
        out.push({
          id: `seed:${d.username}:${bi}:${i}`, seed: true,
          owner: { id: "brand:" + brand, kind: "dealer", name: d.name, short: d.short, avatar: demoAvatarFor(d) },
          media: photos[(bi * 2 + i) % photos.length], caption: i === 0 ? d.caption : "",
          createdAt: base + i * 60000, expiresAt: base + TTL
        });
      });
    });
    return out;
  }
  /* suggested users: unseen normal stories first, then unseen suggested (highest activity score first), then everything already seen */
  function sugTier(g) { return g.unseen ? (g.suggested ? 1 : 0) : 2; }
  function sugCmp(a, b) { return (sugTier(a) - sugTier(b)) || ((a.suggested && b.suggested) ? (Number(b.score || 0) - Number(a.score || 0)) : 0); }
  function buildGroups() {
    const me = myId();
    const all = readStories().concat(seedStories());
    const map = new Map();
    const authId = String((window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.id) || "");
    const myPhone = account();
    // A story is "mine" if ANY signal says so (stored id, server owner id, phone) — not just the
    // id computed at sync time, which can differ and made my own story show up as a second card.
    const ownedByMe = (o) => o.kind !== "dealer" && (
      (!!me && o.id === me) ||
      (!!authId && (String(o.uid || "") === authId || o.id === "user:" + authId)) ||
      (!!myPhone && !!o.phone && String(o.phone) === myPhone)
    );
    all.forEach((s) => {
      const o0 = s.owner || {};
      const o = ownedByMe(o0) ? { ...o0, id: me || o0.id } : o0;
      if (!map.has(o.id)) map.set(o.id, { suggested: !!o.suggested, score: Number(o.score || 0), reason: o.reason || "", dealer: o.kind === "dealer", id: o.id, username: o.username || "", uid: o.uid || "", phone: o.phone || "", name: o.name || "کاربر", short: o.short || o.name || "کاربر", avatar: o.avatar || "", stories: [], mine: ownedByMe(o0) || (!!me && o.id === "dealer:" + me) });
      map.get(o.id).stories.push(s);
    });
    const seen = readSeen();
    const groups = Array.from(map.values());
    groups.forEach((g) => {
      g.stories.sort((a, b) => a.createdAt - b.createdAt);
      g.unseen = g.stories.some((s) => !seen[s.id]);
      g.latest = g.stories[g.stories.length - 1].createdAt;
    });
    let mine = groups.find((g) => g.mine && !g.dealer) || null;
    const others = groups.filter((g) => !(g.mine && !g.dealer)).sort((a, b) => sugCmp(a, b) || (b.latest - a.latest));
    return { mine, others };
  }

  /* ---------------- rail ---------------- */
  function renderRail() {
    const { mine, others } = buildGroups();
    const me = { id: myId(), mine: true, name: myName(), avatar: (typeof state !== "undefined" && state.accountProfile && state.accountProfile.avatar) || "" };
    let first;
    if (mine) {
      first = `<button type="button" class="mr-msg-story mr-story-tile${mine.unseen ? " is-unseen" : ""}" data-action="storyOpen" data-owner="${esc(mine.id)}" aria-label="استوری من">
        <span class="mr-story-in">${coverHTML(me)}<span class="mr-story-shade"></span>
        <span class="mr-story-add" role="button" tabindex="0" data-action="storyAdd" aria-label="افزودن استوری">${PLUS}</span>
        <span class="mr-story-name">استوری شما</span><span class="mr-story-handle" dir="ltr">${esc(storyHandle(me))}</span></span></button>`;
    } else {
      first = `<button type="button" class="mr-msg-story is-new mr-story-mine-empty" data-action="storyAdd" aria-label="افزودن استوری">
        <span class="mr-msg-new-avatar mr-story-me-avatar" style="--h:${hueOf(me.name)}">${account() ? avatarHTML(me) : esc("م")}<i>${PLUS}</i></span><small>استوری شما</small></button>`;
    }
    const cards = others.map((g) => {
      return `<button type="button" class="mr-msg-story mr-story-tile${g.unseen ? " is-unseen" : ""}${g.suggested ? " is-suggested" : ""}" data-action="storyOpen" data-owner="${esc(g.id)}" aria-label="${esc("استوری " + g.name)}">
        <span class="mr-story-in">${coverHTML(g)}${g.suggested ? '<span class="mr-story-sug">پیشنهادی</span>' : ''}<span class="mr-story-shade"></span>
        <span class="mr-story-name">${esc(g.short)}</span><span class="mr-story-handle" dir="ltr">${esc(storyHandle(g))}</span></span></button>`;
    }).join("");
    lastSig = railSignature();
    return `<h2 class="mr-stories-title">استوری‌ها</h2><div class="mr-msg-stories" role="list">${first}${cards}</div>`;
  }
  function refreshRail() {
    const el = document.querySelector('[data-page="messages"] .mr-msg-stories:not(.mr-sk-stories)');
    if (!el) return;
    const tmp = document.createElement("div"); tmp.innerHTML = renderRail();
    const heading = tmp.querySelector(".mr-stories-title");
    const currentHeading = el.previousElementSibling;
    if (heading && currentHeading && currentHeading.matches(".mr-stories-title")) currentHeading.replaceWith(heading);
    const desiredRail = tmp.querySelector(".mr-msg-stories");
    if (desiredRail) reconcileRail(el, desiredRail, ".mr-msg-story");
    lastSig = railSignature();
  }


  /* ---------------- live rail updates ----------------
     Keep the scroll rail and surviving tile nodes mounted. Seen stories are reordered to the far left
     instead of removed, while the existing nodes are retained for smooth FLIP movement. */
  function railKey(el) { return el.dataset.owner || "_add"; }
  const railSnapRestoreTimers = new WeakMap();
  function reconcileRail(rail, desiredRail, sel) {
    if (!rail || !desiredRail) return;
    const before = snapshotRail(rail, sel);
    const current = [...rail.querySelectorAll(sel)];
    const desired = [...desiredRail.querySelectorAll(sel)];
    const currentByKey = new Map(current.map((el) => [railKey(el), el]));
    const desiredKeys = new Set(desired.map(railKey));

    // Reordering in an RTL, scroll-snapping rail can make the browser scroll to the
    // focused story after it moves to the far left. Preserve the user's viewport and
    // restore focus without scrolling so marking a story as seen never jumps the rail.
    const savedScrollLeft = rail.scrollLeft;
    const active = document.activeElement;
    const restoreActive = !!(active && active !== document.body && rail.contains(active) && typeof active.focus === "function");
    const pendingSnapState = railSnapRestoreTimers.get(rail);
    const savedSnapType = pendingSnapState ? pendingSnapState.savedSnapType : rail.style.scrollSnapType;
    if (restoreActive && typeof active.blur === "function") active.blur();
    rail.style.scrollSnapType = "none";
    if (pendingSnapState) clearTimeout(pendingSnapState.timer);

    // If a previous layout animation is still in flight, restart it from its current
    // visual position. This avoids stacked transforms when a refresh lands mid-motion.
    current.forEach((el) => { if (typeof el.getAnimations === "function") el.getAnimations().forEach((a) => { try { a.cancel(); } catch (_) {} }); });

    // Remove only nodes that are no longer wanted. animateRail paints a non-interactive
    // fixed-position ghost over the old slot, then fades it out while neighbours FLIP.
    current.forEach((el) => { if (!desiredKeys.has(railKey(el))) el.remove(); });

    desired.forEach((wanted) => {
      const key = railKey(wanted);
      let node = currentByKey.get(key);
      if (node && desiredKeys.has(key)) {
        // Refresh the button contents/attributes without replacing the button itself.
        const wantedAttrs = new Map([...wanted.attributes].map((a) => [a.name, a.value]));
        [...node.attributes].forEach((a) => { if (!wantedAttrs.has(a.name)) node.removeAttribute(a.name); });
        wantedAttrs.forEach((value, name) => node.setAttribute(name, value));
        if (node.innerHTML !== wanted.innerHTML) node.innerHTML = wanted.innerHTML;
      } else {
        node = wanted.cloneNode(true);
      }
      rail.appendChild(node); // synchronous reorder; the browser paints only after FLIP is set up
    });

    // Restore the exact horizontal scroll offset before measuring FLIP destinations.
    rail.scrollLeft = savedScrollLeft;
    if (restoreActive && active.isConnected) {
      try { active.focus({ preventScroll: true }); } catch (_) { try { active.focus(); } catch (_) {} }
      rail.scrollLeft = savedScrollLeft;
    }
    requestAnimationFrame(() => {
      if (!rail.isConnected) return;
      rail.scrollLeft = savedScrollLeft;
      requestAnimationFrame(() => { if (rail.isConnected) rail.scrollLeft = savedScrollLeft; });
    });

    animateRail(rail, sel, before);
    // Keep snap disabled only for the short FLIP transition; then restore the site's CSS.
    const timer = setTimeout(() => {
      if (!rail.isConnected) { railSnapRestoreTimers.delete(rail); return; }
      const scrollAtRestore = rail.scrollLeft; // respect any swipe the user made during the transition
      rail.style.scrollSnapType = savedSnapType;
      railSnapRestoreTimers.delete(rail);
      rail.scrollLeft = scrollAtRestore;
    }, 700);
    railSnapRestoreTimers.set(rail, { timer, savedSnapType });
  }
  function snapshotRail(rail, sel) {
    const m = new Map(); if (!rail) return m;
    rail.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      // keep a copy of the old tile so it can fade out in place as a "ghost"
      m.set(railKey(el), { left: r.left, top: r.top, width: r.width, height: r.height, node: el.cloneNode(true) });
    });
    return m;
  }
  /* Smooth FLIP for story rails.
     Removed/fully-watched stories fade in place; surviving neighbours glide into
     the newly freed slot. No delayed re-bloom at the far end, which caused jumps. */
  function animateRail(rail, sel, before) {
    if (!before || !before.size || !rail) return;
    const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = [...rail.querySelectorAll(sel)];
    const after = new Map(items.map((el) => [railKey(el), el]));
    if (calm) {
      before.forEach((old, key) => { if (!after.has(key)) old.node.remove(); });
      return;
    }
    const MOVE_MS = 620;
    const SOFT = "cubic-bezier(.2,.72,.22,1)";

    // Removed tile: it stays visually anchored in its former slot and fades away;
    // it never participates in layout, so it cannot push neighbouring tiles around.
    before.forEach((old, key) => {
      if (after.has(key)) return;
      const ghost = old.node;
      ghost.setAttribute("aria-hidden", "true");
      ghost.removeAttribute("data-action");
      ghost.removeAttribute("data-owner");
      ghost.classList.remove("cm-st-new");
      ghost.style.cssText += `;position:fixed;left:${old.left}px;top:${old.top}px;width:${old.width}px;height:${old.height}px;margin:0;z-index:999;pointer-events:none;transform:none;transform-origin:50% 50%;will-change:opacity,filter;animation:none;`;
      document.body.appendChild(ghost);
      const fade = ghost.animate(
        [
          { opacity: 1, filter: "blur(0px)" },
          { opacity: 0, filter: "blur(.6px)" }
        ],
        { duration: 420, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
      );
      fade.onfinish = fade.oncancel = () => ghost.remove();
    });

    // FLIP each surviving tile from its exact pre-update screen position to its new slot.
    // Use the node's visual rect (not scrollLeft) so RTL scroll containers remain stable.
    items.forEach((el) => {
      const old = before.get(railKey(el));
      if (!old || !el.animate) {
        // Only genuinely new/unseen stories get the pop-in effect. A seen story
        // reintroduced at the far left should arrive quietly, never look new.
        if (!old && (el.classList.contains("is-unseen") || el.classList.contains("is-new"))) {
          el.classList.add("cm-st-new");
          el.addEventListener("animationend", () => el.classList.remove("cm-st-new"), { once: true });
        }
        return;
      }
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (Math.abs(dx) < 0.75 && Math.abs(dy) < 0.75) return;
      el.animate(
        [
          { transform: `translate3d(${dx}px,${dy}px,0)` },
          { transform: "translate3d(0,0,0)" }
        ],
        { duration: MOVE_MS, easing: SOFT, fill: "none" }
      );
    });
  }
  function railSignature() {
    const { mine, others } = buildGroups();
    return "me:" + account() + ":" + String((typeof state !== "undefined" && state.accountProfile && state.accountProfile.avatar) || "").length + "|" + (mine ? [mine] : []).concat(others).map((g) => g.id + ":" + Number(g.unseen) + ":" + g.stories.length + ":" + Number(!!g.suggested)).join("|") + "#" + topGroups().map((g) => g.id).join(",");
  }
  let lastSig = "";
  function autoSync(force) {
    if (overlay) return; // the viewer is open: closeOverlay() refreshes afterwards
    if (!document.querySelector('.cm-ts, [data-page="messages"] .mr-msg-stories')) return;
    const sig = railSignature();
    if (!force && sig === lastSig) return;
    lastSig = sig; refreshRail(); refreshTop();
  }
  window.addEventListener("storage", (e) => { if (!e.key || e.key === STORE_KEY || e.key === SEEN_KEY) autoSync(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { autoSync(); syncServerStories(); } });
  setInterval(() => { if (!document.hidden) { autoSync(); if (window.CARMA_API?.enabled) syncServerStories(); } }, 30000);
  setTimeout(markStoriesReady, 6000);
  window.addEventListener('carma:live', (e) => { if (e.detail && e.detail.t === 'stories' && window.CARMA_API?.enabled) { try { syncServerStories(); } catch (_) {} } });
  if (window.CARMA_API?.enabled) { window.addEventListener('carma:boot-done', () => { try { syncServerStories(); } catch (_) {} }, { once: true }); }
  if (window.CARMA_API?.enabled) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncServerStories, {once:true}); else syncServerStories(); }

  /* ---------------- linking a listing ---------------- */
  function myPublishedListings() {
    return ((typeof state !== "undefined" && state.myListings) || [])
      .filter((m) => m && m.status === "listed" && m.listing)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .map((m) => m.listing);
  }
  function listingThumb(l) { return (Array.isArray(l.photos) && l.photos[0]) || l.photo || ""; }
  function listingPriceText(l) {
    const p = l.price != null && l.price !== "" ? l.price : l.priceAmount;
    if (p == null || p === "") return "قیمت توافقی";
    if (typeof p === "number") return FA(p) + " تومان";
    return String(p);
  }
  function findListing(id) {
    const key = String(id);
    const live = typeof LISTINGS !== "undefined" && LISTINGS.find((x) => String(x.id) === key);
    if (live) return live;
    const mine = ((typeof state !== "undefined" && state.myListings) || []).find((m) => m.listing && String(m.listing.id) === key);
    return mine ? mine.listing : null;
  }

  /* ---------------- posting ---------------- */
  function requireLogin() {
    if (account()) return true;
    if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
    state = { ...state, modal: { type: "login", reason: "برای گذاشتن استوری ابتدا وارد حساب خود شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
    if (typeof updateOverlays === "function") updateOverlays();
    return false;
  }
  let postAs = "";
  function pickPhoto(as, camera) {
    if (!requireLogin()) return;
    postAs = as === "dealer" && typeof state !== "undefined" && state.dealership ? "dealer" : "";
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.hidden = true;
    if (camera) input.setAttribute("capture", "environment");
    input.addEventListener("change", () => {
      const file = input.files && input.files[0]; input.remove();
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("فقط عکس را می‌توانید به‌عنوان استوری بگذارید."); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const done = (url) => openComposer(url);
        if (typeof mrRecompressPhoto === "function") mrRecompressPhoto(reader.result, 900, 0.78).then(done); else done(reader.result);
      };
      reader.readAsDataURL(file);
    });
    document.body.appendChild(input);
    input.click();
  }
  async function publish(media, caption, linked) {
    if (window.CARMA_API?.enabled) {
      if (!window.CARMA_AUTH_USER) { toast('برای انتشار استوری وارد حساب کاربری شوید.'); return false; }
      try {
        const blob = await (await fetch(media)).blob();
        const file = new File([blob], 'story-image', {type:blob.type || 'image/jpeg'});
        const uploaded = await window.CARMA_API.uploads.image(file);
        const imageId = uploaded?.image?.id;
        if (!imageId) throw new Error('آپلود تصویر استوری تأیید نشد.');
        const listingId = linked && /^[0-9a-f-]{36}$/i.test(String(linked.id)) ? String(linked.id) : null;
        const created = await window.CARMA_API.social.createStory({imageId, caption:String(caption||'').slice(0,200), listingId});
        if (!created?.story?.id) throw new Error('سرور استوری را تأیید نکرد.');
        await syncServerStories(); toast('استوری شما منتشر شد و ۲۴ ساعت می‌ماند.'); syncDealerRing(); return true;
      } catch (error) { toast(error?.message || 'انتشار استوری انجام نشد.'); return false; }
    }
    const list = readStories();
    const asDealer = postAs === "dealer" && state.dealership;
    const id = asDealer ? "dealer:" + myId() : myId();
    const mineCount = list.filter((s) => s.owner && s.owner.id === id).length;
    if (mineCount >= MAX_PER_USER) { toast(`حداکثر ${FA(MAX_PER_USER)} استوری فعال می‌توانید داشته باشید.`); return false; }
    const now = Date.now();
    const avatar = (state.accountProfile && state.accountProfile.avatar) || "";
    list.push({ id: "s" + now.toString(36) + Math.random().toString(36).slice(2, 6), owner: asDealer ? { id, kind: "dealer", name: state.dealership.name, short: state.dealership.name, phone: account(), avatar: state.dealership.logo && state.dealership.logo.length < 60000 ? state.dealership.logo : "" } : { id, name: myName(), phone: account(), avatar: avatar && avatar.length < 60000 ? avatar : "" }, media, caption: String(caption || "").slice(0, 200), createdAt: now,
      ...(linked ? { listingId: String(linked.id), listingSnap: { title: String(linked.title || ""), price: listingPriceText(linked) } } : {}), expiresAt: now + TTL });
    if (!writeStories(list)) return false;
    toast("استوری شما منتشر شد و ۲۴ ساعت می‌ماند.");
    syncDealerRing();
    return true;
  }
  async function removeStory(id) {
    if (window.CARMA_API?.enabled && /^[0-9a-f-]{36}$/i.test(String(id))) {
      try { await window.CARMA_API.social.deleteStory(id); } catch (error) { toast(error?.message || 'حذف استوری انجام نشد.'); return false; }
      await syncServerStories(); syncDealerRing(); return true;
    }
    writeStories(readStories().filter((s) => s.id !== id));
    syncDealerRing(); return true;
  }
  /* Showroom avatars (account card + public page) get a ring while the showroom has a live story.
     Elements opt in with data-dealer-ring="<sellerId>"; called after every publish/delete/view. */
  function syncDealerRing() {
    document.querySelectorAll("[data-dealer-ring]").forEach((el) => {
      const sid = el.getAttribute("data-dealer-ring");
      const k = "dealer:" + sid;
      const mine = readStories().filter((s) => s.owner && s.owner.id === k);
      const on = mine.length > 0;
      el.classList.toggle("sp-avatar-story", on);
      if (on) {
        const seen = readSeen();
        el.classList.toggle("is-seen", mine.every((s) => seen[s.id]));
        el.setAttribute("data-action", "storyOpen"); el.setAttribute("data-owner", k);
        el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.setAttribute("aria-label", "مشاهده استوری نمایشگاه");
      } else {
        ["data-action", "data-owner", "role", "tabindex", "aria-label"].forEach((a) => el.removeAttribute(a));
        el.classList.remove("is-seen");
      }
    });
  }

  /* ---------------- overlay (composer + viewer) ---------------- */
  let overlay = null, V = null, repliedFlag = false;
  function closeOverlay(fromPop) {
    setTimeout(syncDealerRing, 0);
    // Drop the history entry the viewer added so "back" goes where the user was before it.
    if (window.__mrStoryHist) {
      window.__mrStoryHist = false;
      if (fromPop !== true) { window.__mrSkipPop = true; try { history.back(); } catch (_) { window.__mrSkipPop = false; } }
    }
    if (V) { cancelAnimationFrame(V.raf); V = null; }
    if (overlay) { overlay.remove(); overlay = null; }
    document.documentElement.classList.remove("mr-sv-lock");
    if (repliedFlag) { repliedFlag = false; if (window.MARQUE_CHAT && typeof render === "function" && state.route && state.route.page === "messages") { render(); return; } }
    refreshRail(); refreshTop(); lastSig = railSignature();
  }
  function mountOverlay(cls, html) {
    if (overlay) { if (V) cancelAnimationFrame(V.raf); V = null; overlay.remove(); }
    overlay = document.createElement("div");
    overlay.className = "mr-sv " + cls; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    if (!window.__mrStoryHist) {
      try { history.pushState(Object.assign({}, history.state || {}, { mrStory: 1 }), "", location.href); window.__mrStoryHist = true; } catch (_) {}
    }
    document.documentElement.classList.add("mr-sv-lock");
    return overlay;
  }

  function openComposer(media, draftCaption, draftLinked) {
    const o = mountOverlay("is-composer", `
      <div class="mr-sv-stage">
        <img class="mr-sv-bg" src="${esc(media)}" alt="" /><img class="mr-sv-img" src="${esc(media)}" alt="" />
        <div class="mr-sv-scrim-top"></div><div class="mr-sv-scrim-bot"></div>
        <button type="button" class="mr-sv-btn mr-sv-close" data-sv="cancel" aria-label="انصراف">×</button>
        <div class="mr-sv-compose">
          <button type="button" class="mr-sv-link" data-sv="pick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><span data-slot="linkLabel">لینک کردن آگهی</span><i data-sv="unlink" hidden aria-label="حذف لینک">×</i></button>
          <textarea maxlength="200" rows="2" placeholder="یک متن کوتاه بنویسید… (اختیاری)" aria-label="متن استوری"></textarea>
          <div class="mr-sv-compose-row"><button type="button" class="mr-sv-pill is-ghost" data-sv="cancel">انصراف</button><span>۲۴ ساعت می‌ماند</span><button type="button" class="mr-sv-pill" data-sv="publish">انتشار</button></div>
        </div>
      </div>`);
    let linked = null;
    const linkBtn = o.querySelector(".mr-sv-link");
    function setLinked(l) {
      linked = l;
      linkBtn.classList.toggle("is-set", !!l);
      linkBtn.querySelector("[data-slot=linkLabel]").textContent = l ? (l.title || "آگهی انتخاب‌شده") : "لینک کردن آگهی";
      linkBtn.querySelector("i").hidden = !l;
    }
    if (draftCaption) o.querySelector("textarea").value = draftCaption; // BG-UPLOAD: restore the draft after a failed upload
    if (draftLinked) setLinked(draftLinked);
    function openPicker() {
      const list = myPublishedListings();
      if (!list.length) { toast("هنوز آگهی منتشرشده‌ای ندارید."); return; }
      const sheet = document.createElement("div");
      sheet.className = "mr-sv-sheet";
      sheet.innerHTML = `<div class="mr-sv-sheet-card"><div class="mr-sv-sheet-head"><b>یکی از آگهی‌هایتان را انتخاب کنید</b><button type="button" class="mr-sv-btn" data-pick="close" aria-label="بستن">×</button></div><div class="mr-sv-sheet-list">${list.map((l) => `<button type="button" class="mr-sv-ad${linked && String(linked.id) === String(l.id) ? " is-on" : ""}" data-pick="${esc(l.id)}"><span class="mr-sv-ad-img">${listingThumb(l) ? `<img src="${esc(listingThumb(l))}" alt="" />` : ""}</span><span class="mr-sv-ad-copy"><b>${esc(l.title || "آگهی خودرو")}</b><small>${esc(listingPriceText(l))}</small></span><span class="mr-sv-ad-check" aria-hidden="true"></span></button>`).join("")}</div></div>`;
      sheet.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pick]");
        if (!b && e.target !== sheet) return;
        if (b && b.dataset.pick !== "close") { const l = list.find((x) => String(x.id) === b.dataset.pick); if (l) setLinked(l); }
        sheet.remove();
      });
      o.querySelector(".mr-sv-stage").appendChild(sheet);
    }
    o.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sv]"); if (!b) return;
      if (b.dataset.sv === "unlink") { e.stopPropagation(); setLinked(null); }
      else if (b.dataset.sv === "pick") openPicker();
      else if (b.dataset.sv === "cancel") closeOverlay();
      else if (b.dataset.sv === "publish") {
        const caption = o.querySelector("textarea").value.trim();
        if (window.CARMA_API && window.CARMA_API.enabled) {
          // BG-UPLOAD: leave the composer right away and upload in the background.
          if (!window.CARMA_AUTH_USER) { toast("برای انتشار استوری وارد حساب کاربری شوید."); return; }
          const keepLinked = linked;
          closeOverlay();
          toast("در حال آپلود استوری… می‌توانید در سایت بگردید.");
          publish(media, caption, keepLinked).then((ok) => { if (!ok && !overlay) openComposer(media, caption, keepLinked); });
          return;
        }
        b.disabled = true;
        publish(media, caption, linked).then((ok) => { if (ok) closeOverlay(); else if (b.isConnected) b.disabled = false; });
      }
    });
  }

  function ago(ts) {
    const d = Math.max(0, Date.now() - ts);
    if (d < 60000) return "اکنون";
    if (d < 3600000) return `${FA(Math.floor(d / 60000))} دقیقه پیش`;
    return `${FA(Math.floor(d / 3600000))} ساعت پیش`;
  }

  function openViewer(ownerId) {
    const { mine, others } = buildGroups();
    const queue = (mine ? [mine] : []).concat(others);
    let gi = queue.findIndex((g) => g.id === ownerId);
    if (gi < 0) return;
    // start at the first story not yet seen (like Instagram), else the first one
    const seen = readSeen();
    let si = queue[gi].stories.findIndex((s) => !seen[s.id]); if (si < 0) si = 0;

    const o = mountOverlay("is-viewer", `
      <div class="mr-sv-stage">
        <img class="mr-sv-bg" alt="" /><img class="mr-sv-img" alt="" />
        <div class="mr-sv-scrim-top"></div><div class="mr-sv-scrim-bot"></div>
        <div class="mr-sv-zones"><span data-zone="next"></span><span data-zone="mid"></span><span data-zone="prev"></span></div>
        <div class="mr-sv-bars"></div>
        <div class="mr-sv-head">
          <span class="mr-sv-avatar" data-sv="profile" role="link" tabindex="0" aria-label="\u0645\u0634\u0627\u0647\u062f\u0647 \u0635\u0641\u062d\u0647 \u06a9\u0627\u0631\u0628\u0631"></span><span class="mr-sv-who" data-sv="profile" role="link" tabindex="0" aria-label="\u0645\u0634\u0627\u0647\u062f\u0647 \u0635\u0641\u062d\u0647 \u06a9\u0627\u0631\u0628\u0631"><b></b><time></time></span>
          <button type="button" class="mr-sv-views" data-sv="viewers" hidden aria-label="مشاهده فهرست بازدیدکنندگان؛ با کشیدن به بالا هم باز می‌شود"></button>
          <button type="button" class="mr-sv-btn mr-sv-del" data-sv="delete" aria-label="حذف استوری" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button>
          <button type="button" class="mr-sv-btn mr-sv-close" data-sv="close" aria-label="بستن">×</button>
        </div>
        <div class="mr-sv-foot"><p class="mr-sv-caption"></p><button type="button" class="mr-sv-pill mr-sv-listing" data-sv="listing" hidden>مشاهده آگهی</button>
          <div class="mr-sv-reply" hidden>
            <div class="mr-sv-emojis">${["❤️","🔥","😍","👏","😮","👌"].map((e) => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join("")}</div>
            <form class="mr-sv-replyform" autocomplete="off"><input type="text" maxlength="500" placeholder="ارسال پیام…" aria-label="پاسخ به استوری" enterkeyhint="send" /><button type="submit" class="mr-sv-send" aria-label="ارسال"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 2.5 10.6 13.4"/><path d="M21.5 2.5 14.7 21.5l-4.1-8.1-8.1-4.1Z"/></svg></button></form>
          </div>
        </div>
      </div>`);
    V = { elapsed: 0, last: 0, paused: false, raf: 0, held: false };
    const $ = (s) => o.querySelector(s);
    const imgs = o.querySelectorAll(".mr-sv-bg,.mr-sv-img");

    function cur() { return queue[gi].stories[si]; }
    let viewersSheet = null;
    let viewersRequestToken = 0;
    function closeViewersSheet() {
      viewersRequestToken++;
      const sh = viewersSheet; viewersSheet = null;
      if (sh) { sh.classList.remove('is-open'); setTimeout(() => sh.remove(), 260); }
      if (V) { V.paused = false; V.last = performance.now(); }
    }
    function openViewersSheet() {
      const g = queue[gi], story = cur();
      if (!g?.mine) return;
      if (viewersSheet) return;
      V.paused = true;
      V.last = performance.now();
      const sh = document.createElement('section');
      viewersSheet = sh;
      sh.className = 'mr-sv-sheet mr-sv-viewers-sheet';
      sh.setAttribute('dir', 'rtl');
      sh.setAttribute('role', 'dialog');
      sh.setAttribute('aria-modal', 'true');
      sh.setAttribute('aria-label', 'افرادی که استوری را دیده‌اند');
      sh.innerHTML = `<div class="mr-sv-sheet-card"><div class="mr-sv-vdrag"><div class="mr-sv-sheet-grab"></div><div class="mr-sv-vhead"><span class="mr-sv-vcount">${EYE}<b class="mr-sv-viewers-summary">…</b></span><h3 class="mr-sv-vtitle">بینندگان استوری</h3><button type="button" class="mr-sv-vtrash" data-viewers-delete aria-label="حذف استوری"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button></div></div><div class="mr-sv-sheet-list mr-sv-viewers-list" aria-live="polite"><p class="mr-sv-viewers-state">در حال بارگذاری…</p></div></div>`;
      stage.appendChild(sh);
      requestAnimationFrame(() => requestAnimationFrame(() => sh.classList.add('is-open')));
      const token = ++viewersRequestToken;
      const card = sh.querySelector('.mr-sv-sheet-card');
      const list = sh.querySelector('.mr-sv-viewers-list');
      const summary = sh.querySelector('.mr-sv-viewers-summary');
      sh.querySelector('[data-viewers-delete]').addEventListener('click', () => { closeViewersSheet(); const d = o.querySelector('.mr-sv-del'); if (d) d.click(); });
      sh.addEventListener('click', (event) => { if (event.target === sh) closeViewersSheet(); });
      // drag the handle/header down to close
      const drag = sh.querySelector('.mr-sv-vdrag');
      let dy0 = null, dy = 0;
      drag.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dy0 = e.clientY; dy = 0; card.style.transition = 'none'; try { drag.setPointerCapture(e.pointerId); } catch (_) {} });
      drag.addEventListener('pointermove', (e) => { if (dy0 == null) return; dy = Math.max(0, e.clientY - dy0); card.style.transform = `translateY(${dy}px)`; });
      const endDrag = () => { if (dy0 == null) return; dy0 = null; card.style.transition = ''; if (dy > 90) { closeViewersSheet(); } else { card.style.transform = ''; } };
      drag.addEventListener('pointerup', endDrag);
      drag.addEventListener('pointercancel', endDrag);

      function closeMenu() { sh.querySelector('.mr-sv-vmenu')?.remove(); }
      function openMenu(row) {
        closeMenu();
        const uid = row.getAttribute('data-uid'), name = row.getAttribute('data-name') || 'کاربر';
        const hidden = row.classList.contains('is-hidden');
        const m = document.createElement('div');
        m.className = 'mr-sv-vmenu';
        m.innerHTML = `<div class="mr-sv-vmenu-card"><p>${esc(name)}</p><button type="button" data-vm="toggle" class="${hidden ? '' : 'is-danger'}">${hidden ? 'نمایش دوباره استوری‌ها به این کاربر' : 'پنهان کردن استوری از این کاربر'}</button><button type="button" data-vm="cancel">انصراف</button></div>`;
        sh.appendChild(m);
        m.addEventListener('click', async (e) => {
          if (e.target === m) { closeMenu(); return; }
          const b = e.target.closest('[data-vm]'); if (!b) return;
          if (b.getAttribute('data-vm') === 'cancel') { closeMenu(); return; }
          if (!uid) { toast('شناسه این کاربر در دسترس نیست.'); closeMenu(); return; }
          b.disabled = true;
          try {
            const api = window.CARMA_API.social;
            if (hidden) await api.unhideStoryFrom(uid); else await api.hideStoryFrom(uid);
            row.classList.toggle('is-hidden', !hidden);
            const tag = row.querySelector('.mr-sv-viewer-hidetag'); if (tag) tag.hidden = hidden;
            toast(hidden ? 'استوری دوباره برای این کاربر قابل نمایش شد.' : 'استوری‌های شما از این کاربر پنهان شد.');
          } catch (err) { toast(err?.message || 'انجام نشد؛ دوباره تلاش کن.'); }
          closeMenu();
        });
      }
      list.addEventListener('click', async (e) => {
        const row = e.target.closest('.mr-sv-viewer-row'); if (!row) return;
        if (e.target.closest('[data-vmore]')) { openMenu(row); return; }
        if (e.target.closest('.mr-sv-viewer-avatar, .mr-sv-viewer-copy')) {
          const vid = row.getAttribute('data-uid');
          if (vid) openProfile({ uid: vid, id: 'user:' + vid }); else toast('\u0635\u0641\u062d\u0647 \u0627\u06cc\u0646 \u06a9\u0627\u0631\u0628\u0631 \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a.');
          return;
        }
        if (e.target.closest('[data-vreply]')) {
          const uid = row.getAttribute('data-uid');
          if (!uid) { toast('شناسه این کاربر در دسترس نیست.'); return; }
          if (!window.MARQUE_CHAT || !window.MARQUE_CHAT.connectWithBuyer) return;
          const ok = await window.MARQUE_CHAT.connectWithBuyer({ buyerId: uid });
          if (ok) closeOverlay();
        }
      });

      if (!window.CARMA_API?.enabled || !story.serverBacked || !/^[0-9a-f-]{36}$/i.test(String(story.id))) {
        summary.textContent = FA(viewsOf(story));
        list.innerHTML = '<p class="mr-sv-viewers-state">فهرست اسامی برای این استوری محلی در دسترس نیست؛ فقط آمار بازدید ثبت شده است.</p>';
        return;
      }
      window.CARMA_API.social.storyViewers(story.id).then((result) => {
        if (token !== viewersRequestToken || !viewersSheet) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        summary.textContent = FA(result?.total || 0);
        const guest = Number(result?.guestCount || 0);
        const guestRow = guest ? `<div class="mr-sv-viewer-guest"><span class="mr-sv-viewer-avatar is-guest"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.600"/><path d="M5 20c0-3.800 3.100-6 7-6s7 2.200 7 6"/></svg></span><span class="mr-sv-viewer-copy"><b>بازدیدکنندگان مهمان</b><small>بدون ورود به حساب</small></span><span class="mr-sv-viewer-count">${FA(guest)}</span></div>` : '';
        const rows = items.map((viewer) => {
          const name = viewer.displayName || viewer.username || 'کاربر';
          const avatar = viewer.avatarUrl ? `<img src="${esc(viewer.avatarUrl)}" alt="" loading="lazy" decoding="async">` : `<span>${esc(name.trim().slice(0, 1) || 'ک')}</span>`;
          const handle = viewer.username ? `<small dir="ltr">@${esc(viewer.username)}</small>` : '';
          const time = viewer.viewedAt ? ago(Date.parse(viewer.viewedAt) || Date.now()) : '';
          const hid = !!viewer.hidden;
          return `<div class="mr-sv-viewer-row${hid ? ' is-hidden' : ''}" data-uid="${esc(viewer.id || '')}" data-name="${esc(name)}"><span class="mr-sv-viewer-avatar" style="--h:${hueOf(name)}">${avatar}</span><span class="mr-sv-viewer-copy"><b>${esc(name)}</b>${handle}<small class="mr-sv-viewer-hidetag"${hid ? '' : ' hidden'}>استوری از این کاربر پنهان است</small>${time ? `<small class="mr-sv-viewer-time">${esc(time)}</small>` : ''}</span><span class="mr-sv-viewer-acts"><button type="button" class="mr-sv-vact" data-vreply aria-label="ریپلای"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.500 2.500 10.600 13.400"/><path d="M21.500 2.500 14.700 21.500l-4.100-8.100-8.100-4.100Z"/></svg></button><button type="button" class="mr-sv-vact" data-vmore aria-label="گزینه‌ها"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.800"/><circle cx="12" cy="12" r="1.800"/><circle cx="19" cy="12" r="1.800"/></svg></button></span></div>`;
        }).join('');
        list.innerHTML = (rows ? '<div class="mr-sv-viewer-group">' + rows + '</div>' : '') + guestRow + (!rows && !guestRow ? '<p class="mr-sv-viewers-state">هنوز کسی این استوری را ندیده است.</p>' : '');
      }).catch((error) => {
        if (token !== viewersRequestToken || !viewersSheet) return;
        summary.textContent = '!';
        list.innerHTML = `<div class="mr-sv-viewers-state"><p>${esc(error?.message || 'اتصال به سرور برقرار نشد.')}</p><button type="button" class="mr-sv-viewers-retry">تلاش دوباره</button></div>`;
        list.querySelector('.mr-sv-viewers-retry')?.addEventListener('click', () => { closeViewersSheet(); setTimeout(openViewersSheet, 300); });
      });
    }
    function show() {
      if (viewersSheet) closeViewersSheet();
      const g = queue[gi], s = cur();
      imgs.forEach((i) => { i.src = s.media; });
      $(".mr-sv-bars").innerHTML = g.stories.map((_, i) => `<i><b style="width:${i < si ? 100 : 0}%"></b></i>`).join("");
      $(".mr-sv-avatar").style.setProperty("--h", hueOf(g.name));
      $(".mr-sv-avatar").innerHTML = avatarHTML((g.mine && !g.dealer) ? { ...g, name: myName(), avatar: (state.accountProfile && state.accountProfile.avatar) || g.avatar } : g);
      { const wb = $(".mr-sv-who b"), hd = (g.mine && !g.dealer) ? "" : storyHandle(g); /* CM-STORY-PROFILE */
        if (g.mine && !g.dealer) wb.textContent = "استوری شما";
        else if (hd) wb.innerHTML = '<bdi dir="ltr">' + esc(hd) + '</bdi>';
        else wb.textContent = g.name; }
      $(".mr-sv-who time").textContent = ago(s.createdAt) + (g.suggested ? " · پیشنهادی" + (g.reason ? " (" + g.reason + ")" : "") : "");
      $(".mr-sv-del").hidden = !g.mine;
      const vp = $(".mr-sv-views"); // تعداد بازدید فقط برای صاحب استوری نمایش داده می‌شود
      if (g.mine) { vp.hidden = false; vp.innerHTML = EYE + "<b>" + FA(viewsOf(s)) + "</b>"; vp.setAttribute("aria-label", FA(viewsOf(s)) + " بازدید"); } else { vp.hidden = true; vp.innerHTML = ""; }
      recordView(s, g);
      const rep = $(".mr-sv-reply"); rep.hidden = !!g.mine || (g.phone && g.phone === account()); rep.querySelector("input").value = "";
      const cap = $(".mr-sv-caption"); cap.textContent = s.caption || ""; cap.hidden = !s.caption;
      $(".mr-sv-listing").hidden = !s.listingId;
      markSeen(s.id);
      V.elapsed = 0; V.last = performance.now();
    }
    function next() {
      if (si < queue[gi].stories.length - 1) { si++; show(); return; }
      if (gi < queue.length - 1) { gi++; si = 0; show(); return; }
      closeOverlay();
    }
    function prev() {
      if (V.elapsed > 800 || (si === 0 && gi === 0)) { V.elapsed = 0; V.last = performance.now(); setBar(0); return; }
      if (si > 0) si--; else { gi--; si = queue[gi].stories.length - 1; }
      show();
    }
    function setBar(p) {
      const b = o.querySelectorAll(".mr-sv-bars b")[si]; if (b) b.style.width = Math.min(100, p * 100) + "%";
    }
    function tick(t) {
      if (!V) return;
      if (!V.paused) { V.elapsed += t - V.last; setBar(V.elapsed / SLIDE_MS); if (V.elapsed >= SLIDE_MS) { next(); if (!V) return; } }
      V.last = t; V.raf = requestAnimationFrame(tick);
    }

    // hold = pause, quick tap = navigate (RTL: left side goes forward, right side goes back)
    let downAt = 0, downX = 0, downY = 0;
    const stage = $(".mr-sv-stage");
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, input, form, .mr-sv-sheet, [data-sv='profile']")) return;
      downAt = Date.now(); downX = e.clientX; downY = e.clientY; V.paused = true; stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
    });
    const release = (e, cancelled) => {
      if (!downAt) return; const dt = Date.now() - downAt; downAt = 0; V.paused = false; V.last = performance.now();
      if (cancelled) return;
      const dy = e.clientY - downY, dx = e.clientX - downX;
      if (dy < -70 && Math.abs(dy) > Math.abs(dx) && queue[gi]?.mine) { openViewersSheet(); return; }
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { closeOverlay(); return; }
      if (dt < 260 && Math.abs(dx) < 14 && Math.abs(dy) < 14) {
        const r = stage.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width;
        if (x < 0.34) next(); else if (x > 0.66) prev();
      }
    };
    stage.addEventListener("pointerup", (e) => release(e, false));
    stage.addEventListener("pointercancel", (e) => release(e, true));
    stage.addEventListener("lostpointercapture", (e) => { if (downAt) release(e, true); });

    o.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sv]"); if (!b) return;
      if (b.dataset.sv === "close") closeOverlay();
      else if (b.dataset.sv === "viewers") { e.stopPropagation(); openViewersSheet(); }
      else if (b.dataset.sv === "profile") { e.stopPropagation(); openProfile(queue[gi]); }
      else if (b.dataset.sv === "delete") {
        V.paused = true;
        if (!confirm("این استوری حذف شود؟")) { V.paused = false; V.last = performance.now(); return; }
        removeStory(cur().id).then((ok) => { if (!ok) { V && (V.paused = false); return; } });
        toast("استوری حذف شد.");
        const g = queue[gi]; g.stories.splice(si, 1);
        if (!g.stories.length) { closeOverlay(); return; }
        if (si >= g.stories.length) si = g.stories.length - 1;
        V.paused = false; show();
      } else if (b.dataset.sv === "listing") {
        const l = findListing(cur().listingId);
        const hadEntry = !!window.__mrStoryHist;
        closeOverlay(true);
        const go = () => { if (l && typeof navigateTo === "function") navigateTo({ page: "vehicle", listing: l }); else toast("این آگهی دیگر در دسترس نیست."); };
        if (hadEntry) {
          // step back off the viewer's history entry first, then open the listing on top of the original page
          window.__mrSkipPop = true;
          window.addEventListener("popstate", go, { once: true });
          try { history.back(); } catch (_) { window.__mrSkipPop = false; window.removeEventListener("popstate", go); go(); }
        } else go();
      }
    });
    // ---- CM-STORY-PROFILE: open the story owner's page ----
    function profileRoute(g) {
      if (!g) return null;
      if (g.mine && !g.dealer) return { page: "account" };
      if (String(g.id || "").startsWith("brand:")) return null;
      const sid = String(g.uid || g.id || "").replace(/^(dealer:|user:|personal:)/, "");
      if (!sid) return null;
      return g.dealer ? { page: "seller", sellerId: sid, kind: "dealer" } : { page: "seller", sellerId: sid };
    }
    function openProfile(g) {
      const r = profileRoute(g);
      if (!r || typeof navigateTo !== "function") { toast("\u0635\u0641\u062d\u0647 \u0627\u06cc\u0646 \u06a9\u0627\u0631\u0628\u0631 \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a."); return; }
      const hadEntry = !!window.__mrStoryHist;
      closeOverlay(true);
      const go = () => navigateTo(r, { menuOpen: false });
      if (hadEntry) {
        window.__mrSkipPop = true;
        window.addEventListener("popstate", go, { once: true });
        try { history.back(); } catch (_) { window.__mrSkipPop = false; window.removeEventListener("popstate", go); go(); }
      } else go();
    }
    o.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-sv='profile']")) { e.preventDefault(); e.stopPropagation(); openProfile(queue[gi]); }
    });
    // ---- reply (direct message to the story owner) ----
    const rInput = $(".mr-sv-reply input");
    function thumbOf(media) {
      return new Promise((res) => {
        if (typeof media !== "string" || media.indexOf("data:image") !== 0) return res(media);
        const im = new Image();
        im.onload = () => { try { const c = document.createElement("canvas"); const k = Math.min(1, 360 / Math.max(im.naturalWidth, im.naturalHeight)); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(mrCanvasToDataURL(c, 0.78)); } catch (_) { res(""); } };
        im.onerror = () => res(""); im.src = media;
      });
    }
    async function sendReply(text) {
      text = String(text || "").trim(); if (!text) return;
      if (!account()) { closeOverlay(); requireLogin(); return; }
      if (!window.MARQUE_CHAT || !window.MARQUE_CHAT.replyToStory) return;
      const g = queue[gi], s = cur();
      const ok = await window.MARQUE_CHAT.replyToStory({ ownerId: String(g.id).replace(/^(dealer:|user:)/, ""), ownerName: g.name, ownerPhone: g.phone, ownerType: (String(g.id).startsWith("brand:") || g.dealer) ? "dealer" : "personal", text, story: { id: s.id, thumb: await thumbOf(s.media), caption: s.caption ? String(s.caption).slice(0, 40) : "" } });
      if (ok) { repliedFlag = true; rInput.value = ""; rInput.blur(); toast("پیام شما ارسال شد."); closeOverlay(); }
    }
    o.querySelector(".mr-sv-replyform").addEventListener("submit", (e) => { e.preventDefault(); sendReply(rInput.value); });
    o.querySelector(".mr-sv-emojis").addEventListener("click", (e) => { const b = e.target.closest("[data-emoji]"); if (b) sendReply(b.dataset.emoji); });
    rInput.addEventListener("focus", () => { V.paused = true; });
    rInput.addEventListener("blur", () => { if (V) { V.paused = false; V.last = performance.now(); } });
    show();
    V.last = performance.now(); V.raf = requestAnimationFrame(tick);
    V.api = { next, prev };
  }

  /* ---------------- wiring ---------------- */
  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-action='storyOpen'],[data-action='storyAdd']");
    if (!el) return;
    event.preventDefault(); event.stopPropagation();
    if (el.dataset.action === "storyAdd") pickPhoto(el.dataset.as);
    else openViewer(el.dataset.owner);
  }, true);
  document.addEventListener("keydown", function (event) {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches && event.target.matches(".mr-story-add,.cm-ts-plus")) { event.preventDefault(); pickPhoto(); return; }
    if ((event.key === "Enter" || event.key === " ") && event.target.matches && event.target.matches(".sp-avatar-story")) { event.preventDefault(); openViewer(event.target.dataset.owner); return; }
    if (!overlay) return;
    if (event.key === "Escape") closeOverlay();
    else if (event.target.matches && event.target.matches("input,textarea")) return;
    else if (V && V.api && event.key === "ArrowLeft") V.api.next();
    else if (V && V.api && event.key === "ArrowRight") V.api.prev();
  });
  window.addEventListener("popstate", () => { if (overlay) closeOverlay(true); });

  function hasDealer(sellerId) { const k = "dealer:" + sellerId; return readStories().some((s) => s.owner && s.owner.id === k); }
  /* CM-STORY-PROFILE css */
  (function () {
    if (document.getElementById("mr-sv-pl-css")) return;
    const st = document.createElement("style"); st.id = "mr-sv-pl-css";
    st.textContent = ".mr-sv-avatar[data-sv=profile],.mr-sv-who[data-sv=profile],.mr-sv-viewer-avatar,.mr-sv-viewer-copy{cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      ".mr-sv-who[data-sv=profile] b{direction:rtl;text-align:start}.mr-sv-who b bdi{unicode-bidi:isolate}" +
      ".mr-sv-avatar[data-sv=profile]:focus-visible,.mr-sv-who[data-sv=profile]:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:10px}";
    (document.head || document.documentElement).appendChild(st);
  })();
  window.MARQUE_STORIES = { renderTop, refreshTop, renderRail, refreshRail, open: openViewer, add: pickPhoto, hasDealer, syncDealerRing, publish: function (media, caption, linked, as) { postAs = as === "dealer" && typeof state !== "undefined" && state.dealership ? "dealer" : ""; return publish(media, caption, linked); } };
})();
