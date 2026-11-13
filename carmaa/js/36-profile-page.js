"use strict";

/* ---------------------------------------------------------------
   PUBLIC PROFILE helpers — unique usernames + follow system.
   Everything is browser-local (like the rest of this front-end build):
     mr_usernames_v1 : { <sellerId>: "username" }      (unique, user-chosen)
     mr_follows_v1   : { <followerId>: [<targetId>] }
   Until a user picks a username, their sellerId is shown as the handle
   (it is already unique), so every profile always has a unique @handle.
--------------------------------------------------------------- */
(function () {
  const KEY_NAMES = "mr_usernames_v1";
  const KEY_FOLLOWS = "mr_follows_v1";
  const RE_USERNAME = /^[a-z][a-z0-9_.]{2,19}$/;

  function read(key) { try { const o = JSON.parse(window.localStorage.getItem(key) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; } }
  function write(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (_) { return false; } }
  const myId = () => {
    if (window.CARMA_API?.enabled) return window.CARMA_AUTH_USER?.id ? String(window.CARMA_AUTH_USER.id) : null;
    return (typeof state !== "undefined" && state.account && typeof sellerIdForPhone === "function") ? sellerIdForPhone(state.account) : null;
  };

  // kind "dealer" keeps the showroom's @handle separate from the owner's personal one
  // (stored under "d:<sellerId>"); every handle is unique across both kinds.
  const keyOf = (id, kind) => (kind === "dealer" ? "d:" + id : id);
  function serverHandle(id) {
    const u = window.CARMA_AUTH_USER;
    const pretty = (h) => (typeof window.prettyHandle === "function" ? window.prettyHandle(h) : h);
    if (u && u.username && String(u.id) === String(id)) return pretty(String(u.username));
    const c = window.CARMA_USER_HANDLES;
    return c && c[String(id)] ? pretty(c[String(id)]) : "";
  }
  function setServerHandle(id, name) { window.CARMA_USER_HANDLES = window.CARMA_USER_HANDLES || {}; window.CARMA_USER_HANDLES[String(id)] = String(name); try { if (typeof window.syncCanonicalUrl === "function") window.syncCanonicalUrl(); } catch (_) {} }
  function getUsername(id, kind) { if (!id) return ""; if (kind !== "dealer") { const sh = serverHandle(id); if (sh) return sh; } const m = read(KEY_NAMES); return m[keyOf(id, kind)] || (kind === "dealer" && demoShowroomById(id) ? demoShowroomById(id).username : "") || ((kind === "dealer" ? "dealer_" : "user_") + String(id).replace(/[^a-z0-9_.]/gi, "").toLowerCase()); }
  function customUsername(id, kind) { return id ? (read(KEY_NAMES)[keyOf(id, kind)] || "") : ""; }
  // ---- username change policy ------------------------------------------------
  // First assignment is free; after that a handle may be changed at most MAX_CHANGES times.
  const MAX_CHANGES = 2;
  const KEY_COUNTS = "mr_username_changes_v1";
  const LIMIT_MSG = "شما حداکثر ۲ بار می‌توانید نام کاربری را تغییر دهید و این سهمیه تمام شده است.";
  const TAKEN_MSG = "این نام کاربری قبلاً گرفته شده است؛ نام دیگری انتخاب کنید.";
  const slugOf = (raw) => String(raw || "").trim().toLowerCase().replace(/^@/, "").replace(/[._]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const cleanName = (raw) => String(raw || "").trim().toLowerCase().replace(/^@/, "");
  const apiMode = () => !!(window.CARMA_API && window.CARMA_API.enabled && window.CARMA_AUTH_USER);

  // { current: "<saved handle or ''>", left: <number | null> }  (left === null → never set yet, first set is free)
  function handleInfo(kind) {
    if (apiMode()) {
      if (kind === "dealer") {
        const d = typeof state !== "undefined" ? state.dealership : null;
        return d && d.slug ? { current: String(d.slug), left: typeof d.slugChangesLeft === "number" ? d.slugChangesLeft : MAX_CHANGES } : { current: "", left: null };
      }
      const u = window.CARMA_AUTH_USER;
      return u.username ? { current: String(u.username), left: typeof u.usernameChangesLeft === "number" ? u.usernameChangesLeft : MAX_CHANGES } : { current: "", left: null };
    }
    const id = kind === "dealer" ? (typeof sellerIdForPhone === "function" && typeof state !== "undefined" ? sellerIdForPhone(state.account) : null) : myId();
    const cur = id ? (read(KEY_NAMES)[keyOf(id, kind)] || "") : "";
    const used = id ? Number(read(KEY_COUNTS)[keyOf(id, kind)] || 0) : 0;
    return cur ? { current: cur, left: Math.max(0, MAX_CHANGES - used) } : { current: "", left: null };
  }

  // returns "" when ok, otherwise a Persian error message  (local / demo mode)
  function setUsername(id, raw, kind) {
    const key = keyOf(id, kind);
    const name = cleanName(raw);
    const m = read(KEY_NAMES);
    const cur = m[key] || "";
    if (!name || name === cur) return ""; // nothing to change (a saved handle can't be cleared)
    if (!RE_USERNAME.test(name)) return "نام کاربری باید ۳ تا ۲۰ حرف انگلیسی کوچک، عدد، _ یا . باشد و با حرف شروع شود.";
    const taken = Object.keys(m).some((k) => k !== key && m[k] === name) || (typeof DEMO_SHOWROOMS !== "undefined" && DEMO_SHOWROOMS.some((x) => x.username === name));
    if (taken || /^(user|dealer)_u/.test(name)) return TAKEN_MSG;
    const counts = read(KEY_COUNTS);
    if (cur) {
      if (Number(counts[key] || 0) >= MAX_CHANGES) return LIMIT_MSG;
      counts[key] = Number(counts[key] || 0) + 1; write(KEY_COUNTS, counts);
    }
    m[key] = name;
    return write(KEY_NAMES, m) ? "" : "ذخیره نام کاربری ممکن نشد.";
  }

  // Live availability check. Resolves { status: "empty"|"invalid"|"own"|"free"|"taken"|"error", message }.
  async function checkAvailability(raw, kind) {
    const dealer = kind === "dealer";
    const name = dealer ? slugOf(raw) : cleanName(raw);
    if (!name) return { status: "empty", message: "" };
    const info = handleInfo(kind);
    if (info.current && (dealer ? slugOf(info.current) : info.current) === name) return { status: "own", message: "این نام کاربری فعلی شماست." };
    if (dealer ? !/^[a-z0-9][a-z0-9-]{2,79}$/.test(name) : !RE_USERNAME.test(name)) return { status: "invalid", message: dealer ? "نام کاربری نمایشگاه باید حداقل ۳ حرف انگلیسی، عدد یا . _ - باشد." : "۳ تا ۲۰ حرف انگلیسی کوچک، عدد، _ یا . و شروع با حرف." };
    if (apiMode()) {
      try {
        const data = await window.CARMA_API.request(dealer ? "/showrooms/slug-available?slug=" + encodeURIComponent(name) : "/auth/username-available?username=" + encodeURIComponent(name));
        if (data && data.available) return { status: "free", message: "این نام کاربری آزاد است ✓" };
        return { status: data && data.reason === "INVALID" ? "invalid" : "taken", message: data && data.reason === "INVALID" ? "نام کاربری معتبر نیست." : "این نام کاربری قبلاً توسط شخص دیگری گرفته شده است." };
      } catch (e) { return { status: "error", message: "بررسی نام کاربری انجام نشد؛ اتصال را بررسی کنید." }; }
    }
    const id = dealer ? (typeof sellerIdForPhone === "function" ? sellerIdForPhone(state.account) : null) : myId();
    const key = keyOf(id, kind), m = read(KEY_NAMES);
    const taken = Object.keys(m).some((k) => k !== key && m[k] === name) || (typeof DEMO_SHOWROOMS !== "undefined" && DEMO_SHOWROOMS.some((x) => x.username === name)) || /^(user|dealer)_u/.test(name);
    return taken ? { status: "taken", message: "این نام کاربری قبلاً توسط شخص دیگری گرفته شده است." } : { status: "free", message: "این نام کاربری آزاد است ✓" };
  }

  // Prefills the saved handle, shows the remaining-changes note, locks the field when the quota is used up
  // and wires the live check. `input` is the <input> element; kind is "dealer" for the showroom field.
  function decorateField(input, kind) {
    if (!input) return;
    const info = handleInfo(kind);
    input.value = info.current || "";
    input.dataset.unameOrig = info.current || "";
    input.dataset.unameKind = kind === "dealer" ? "dealer" : "user";
    input.dataset.unameState = "";
    let note = input.parentElement && input.parentElement.querySelector('[data-slot="uname-note"]');
    if (!note) {
      note = document.createElement("div"); note.setAttribute("data-slot", "uname-note"); note.setAttribute("aria-live", "polite");
      note.style.cssText = "font-size:11.5px;line-height:1.7;margin-top:2px;";
      if (input.parentElement) input.parentElement.appendChild(note);
    }
    const locked = info.left === 0;
    input.readOnly = locked; if (locked) { input.setAttribute("aria-readonly", "true"); input.style.opacity = ".6"; input.style.cursor = "not-allowed"; }
    if (locked) { note.style.color = "#f59e0b"; note.textContent = "سهمیهٔ تغییر نام کاربری شما (۲ بار) تمام شده است و دیگر قابل تغییر نیست."; }
    else if (info.left === null) { note.style.color = "#9ca3af"; note.textContent = "اولین انتخاب نام کاربری رایگان است؛ بعد از آن فقط ۲ بار می‌توانید آن را تغییر دهید."; }
    else { note.style.color = "#9ca3af"; note.textContent = "تا " + (typeof faNum === "function" ? faNum(info.left) : info.left) + " بار دیگر می‌توانید نام کاربری را تغییر دهید."; }
    note.dataset.base = note.textContent; note.dataset.baseColor = note.style.color;
  }

  let liveSeq = 0; const liveTimers = new WeakMap();
  document.addEventListener("input", function (e) {
    const input = e.target;
    if (!input || input.tagName !== "INPUT" || (input.name !== "username" && input.name !== "dealerUsername") || !input.dataset.unameKind) return;
    const note = input.parentElement && input.parentElement.querySelector('[data-slot="uname-note"]'); if (!note) return;
    const kind = input.dataset.unameKind, seq = ++liveSeq;
    clearTimeout(liveTimers.get(input));
    const unchanged = (kind === "dealer" ? slugOf(input.value) : cleanName(input.value)) === (kind === "dealer" ? slugOf(input.dataset.unameOrig) : input.dataset.unameOrig);
    if (!String(input.value).trim() || unchanged) { input.dataset.unameState = ""; note.textContent = note.dataset.base || ""; note.style.color = note.dataset.baseColor || ""; return; }
    input.dataset.unameState = "checking"; note.style.color = "#9ca3af"; note.textContent = "در حال بررسی…";
    liveTimers.set(input, setTimeout(async () => {
      const r = await checkAvailability(input.value, kind);
      if (seq !== liveSeq || !input.isConnected) return; // a newer keystroke superseded this check
      input.dataset.unameState = r.status;
      note.style.color = r.status === "free" || r.status === "own" ? "#22c55e" : (r.status === "error" ? "#f59e0b" : "#ffffff");
      note.textContent = r.message;
    }, 400));
  });

  function followingOf(id) {
    if (window.CARMA_API?.enabled) return [];
    const f = read(KEY_FOLLOWS); return Array.isArray(f[id]) ? f[id] : [];
  }
  function followersCount(id) {
    if (window.CARMA_API?.enabled) return 0;
    const f = read(KEY_FOLLOWS); return demoFollowersBase(id) + Object.keys(f).filter((k) => Array.isArray(f[k]) && f[k].includes(id)).length;
  }
  function isFollowing(me, target) {
    if (window.CARMA_API?.enabled) return false;
    return !!me && followingOf(me).includes(target);
  }
  function toggleFollow(me, target) {
    const f = read(KEY_FOLLOWS); const list = Array.isArray(f[me]) ? f[me] : [];
    const i = list.indexOf(target);
    if (i >= 0) list.splice(i, 1); else list.push(target);
    f[me] = list; write(KEY_FOLLOWS, f);
    return i < 0;
  }

  // Showroom hashtags (browser-local like the rest): { <sellerId>: ["تگ", ...] }
  const KEY_TAGS = "mr_dealer_tags_v1";
  const MAX_TAGS = 10;
  function parseTags(raw) {
    const out = [];
    String(raw || "").split(/[\s,،;؛#]+/).forEach((t) => {
      t = t.replace(/^_+|_+$/g, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 24);
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out.slice(0, MAX_TAGS);
  }
  function serverTags(id) { const list = Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : []; const s = list.find((x) => String(x.id) === String(id)); return s && Array.isArray(s.tags) ? s.tags : null; }
  function dealerTags(id) { const st = serverTags(id); if (st) return st.slice(); const a = read(KEY_TAGS)[id]; if (Array.isArray(a)) return a; const d = demoShowroomById(id); return d ? d.tags.slice() : []; }
  // Tags that only exist in this browser (pre-server data); used once to move them to the server.
  function localDealerTags(id) { const a = read(KEY_TAGS)[id]; return Array.isArray(a) ? a.slice(0, MAX_TAGS) : []; }
  function clearLocalDealerTags(id) { const m = read(KEY_TAGS); if (m[id] !== undefined) { delete m[id]; write(KEY_TAGS, m); } }
  function setDealerTags(id, raw) { if (!id) return; const m = read(KEY_TAGS); const t = parseTags(raw); if (t.length) m[id] = t; else delete m[id]; write(KEY_TAGS, m); }
  window.MR_PROFILE = { localDealerTags, clearLocalDealerTags, handleInfo, checkAvailability, decorateField, slugOf, setServerHandle, dealerTags, setDealerTags, parseTags, getUsername, customUsername, setUsername, followingOf, followersCount, isFollowing, toggleFollow, myId };

  const fa = (n) => (typeof faNum === "function" ? faNum(n) : String(n));
  function toast(msg) { if (typeof showToast === "function") showToast(msg); }
  function askLogin(msg) {
    if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
    state = { ...state, modal: { type: "login", reason: msg }, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
    if (typeof render === "function") render(); else if (typeof updateOverlays === "function") updateOverlays();
  }

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    const action = el.getAttribute("data-action");
    if (action === "pfToggleFollow") {
      e.preventDefault();
      const target = el.dataset.sellerId; const me = myId();
      if (!me || (window.CARMA_API?.enabled && !window.CARMA_AUTH_USER)) { askLogin("برای دنبال‌کردن کاربران باید وارد حساب کاربری شوید."); return; }
      if (me === target) return;
      // (the old pattern was missing a group, so it rejected every real server id and the
      // follow button always answered "not connected to the server")
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(target || ""));
      if (window.CARMA_API?.enabled && el.dataset.kind === "dealer" && state.dealership && String(state.dealership.id || "") === String(target)) { toast("نمی‌توانید نمایشگاه خودتان را دنبال کنید."); return; }
      const isServerShowroom = window.CARMA_API?.enabled && el.dataset.kind === "dealer" && isUuid;
      const isServerUser = window.CARMA_API?.enabled && el.dataset.kind !== "dealer" && isUuid;
      if (window.CARMA_API?.enabled && !isServerShowroom && !isServerUser) {
        toast("این حساب هنوز به سرور متصل نیست؛ دنبال‌کردن محلی در حالت آنلاین غیرفعال است.");
        return;
      }
      if (isServerShowroom || isServerUser) {
        if (isServerUser && String(window.CARMA_AUTH_USER?.id || "") === String(target)) return;
        if (el.disabled) return;
        el.disabled = true;
        const operation = isServerShowroom ? window.CARMA_API.showrooms.toggleFollow(target) : window.CARMA_API.social.toggleUserFollow(target);
        operation.then((result) => {
          const now = result?.following === true;
          el.classList.toggle("is-following", now); el.textContent = now ? "دنبال می‌شود" : "دنبال کردن"; el.setAttribute("aria-pressed", String(now));
          const page = el.closest('[data-page="seller"]');
          const out = page && page.querySelector("[data-pf-followers]");
          if (out && Number.isFinite(Number(result?.followerCount))) out.textContent = fa(Number(result.followerCount));
        }).catch((err) => toast(err.message || "ثبت دنبال‌کردن انجام نشد.")).finally(() => { if (el.isConnected) el.disabled = false; });
        return;
      }
      const now = toggleFollow(me, target);
      if (now && window.MR_NOTIFS && window.MR_NOTIF_UI) window.MR_NOTIF_UI.followed(target, el.dataset.kind === "dealer");
      el.classList.toggle("is-following", now);
      el.textContent = now ? "دنبال می‌شود" : "دنبال کردن";
      el.setAttribute("aria-pressed", String(now));
      const page = el.closest('[data-page="seller"]');
      const out = page && page.querySelector("[data-pf-followers]");
      if (out) out.textContent = fa(followersCount(target));
    } else if (action === "pfNoChat") {
      e.preventDefault(); toast("برای پیام‌دادن، این کاربر باید حداقل یک آگهی منتشرشده داشته باشد.");
    } else if (action === "shareShowroomPage") {
      e.preventDefault();
      const sid = el.getAttribute("data-seller-id"); if (sid && typeof window.openShowroomPoster === "function") window.openShowroomPoster(sid);
    } else if (action === "pfEditDealership") {
      e.preventDefault();
      if (typeof navigateTo === "function") navigateTo({ page: "dealershipEdit" }, { menuOpen: false, dealershipError: null, dealershipDraft: null, dealershipLogoDraft: null, dealershipBannerDraft: null });
    } else if (action === "pfEditProfile") {
      e.preventDefault();
      if (typeof navigateTo === "function") navigateTo({ page: "accountEdit" }, { menuOpen: false, accountEditError: null });
    }
  });
})();
