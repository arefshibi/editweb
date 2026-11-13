"use strict";

/*
 * CarMaa MESSAGING UI + TRANSPORT ADAPTER
 * Frontend-only by default. Conversations live in localStorage for preview.
 * To connect an API, set window.MARQUE_CHAT_CONFIG before this script loads:
 * { mode: "api", baseURL: "/api/v1", getAccessToken: async () => "..." }
 */
(function () {
  const STORE_KEY = "marque_messages_v1";
  const CFG = window.MARQUE_CHAT_CONFIG || {};
  const MODE = CFG.mode || (CFG.baseURL ? "api" : "local");
  const API_BASE = String(CFG.baseURL || "/api/v1").replace(/\/$/, "");
  const UI = { filter: "all", search: "", apiConversations: [], apiLoaded: false, apiLoading: false, activeMessages: {}, failedAt: {}, loadingIds: new Set(), openingIds: new Set(), canonicalizingIds: new Set(), error: "", reply: null, typing: {}, readAt: {}, edit: null };
  let pollTimer = null;
  let pollBusy = false;
  let pendingListingId = null;

  const escapeHTML = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function readStore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return data && Array.isArray(data.conversations) ? data : { conversations: [] };
    } catch (_) { return { conversations: [] }; }
  }
  function writeStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; }
    catch (_) { if (typeof showToast === "function") showToast("فضای ذخیره‌سازی مرورگر پر شده است."); return false; }
  }
  function accountPhone() { return String((typeof state !== "undefined" && state.account) || ""); }
  function activeRoute() { return typeof state !== "undefined" ? state.route : null; }
  function listingById(id) {
    const key = String(id || "");
    const live = (typeof LISTINGS !== "undefined" && LISTINGS || []).find((x) => String(x.id) === key);
    if (live) return live;
    const mine = (typeof state !== "undefined" && state.myListings || []).find((x) => String(x.id) === key || String(x.listing && x.listing.id) === key);
    if (mine) return mine.listing || mine;
    const routeListing = activeRoute() && activeRoute().listing;
    return routeListing && String(routeListing.id) === key ? routeListing : null;
  }
  function listingSnapshot(listing) {
    const safe = listing || {};
    let seller = { name: "فروشنده خودرو", type: "personal", id: null, city: safe.city || "" };
    try { if (typeof listingSeller === "function") seller = listingSeller(safe) || seller; } catch (_) {}
    const model = typeof vehicleModelName === "function" ? vehicleModelName(safe) : (safe.model || "خودرو");
    return {
      id: String(safe.id || ""), title: String(listingDisplayTitle(safe) || `${safe.brand || "خودرو"} ${model || ""}`.trim()),
      brand: String(safe.brand || ""), model: String(model || ""), year: String(safe.year || ""),
      price: String(safe.price || safe.priceAmount || "توافقی"), priceAmount: safe.priceAmount == null ? null : safe.priceAmount,
      city: String(safe.city || seller.city || ""), photo: Array.isArray(safe.photos) && safe.photos[0] ? String(safe.photos[0]) : "",
      photos: Array.isArray(safe.photos) ? safe.photos.filter(Boolean).slice(0, 4).map(String) : [],
      sellerName: String(safe.sellerName || seller.name || "فروشنده خودرو"), sellerType: seller.type || "personal",
      sellerId: seller.id == null ? "" : String(seller.id),
      sellerUserId: String(safe.sellerUserId || safe.ownerId || safe.owner_id || (safe.seller && safe.seller.userId) || ""),
      sellerPhone: String(safe.phone || safe.sellerPhone || "")
    };
  }
  function listingTitle(conversation) {
    const l = conversation && (conversation.listing || conversation.listing_snapshot) || {};
    return l.title || conversation.listing_title || "گفتگو درباره آگهی خودرو";
  }
  // Listing attachments in API mode: the backend stores only text, so the listing id rides
  // along as a hidden token on the last line and is turned back into a card on every load
  // (otherwise the card vanished on the next refresh and only plain text was left).
  const ATT_RE = /\n?\u27e6car:([^\u27e7\s]+)\u27e7\s*$/;
  const ATT_KEY = "carmaa_chat_att_v1";
  function attReg() { try { return JSON.parse(localStorage.getItem(ATT_KEY) || "{}") || {}; } catch (_) { return {}; } }
  function attRegSave(r) { try { const k = Object.keys(r); if (k.length > 300) k.slice(0, k.length - 300).forEach((x) => delete r[x]); localStorage.setItem(ATT_KEY, JSON.stringify(r)); } catch (_) {} }
  function attToken(l) { return l && l.id ? `\n\u27e6car:${l.id}\u27e7` : ""; }
  function stripAttText(t) { return String(t || "").replace(ATT_RE, ""); }
  function hydrateAtt(m) {
    const raw = String(m.text || "");
    const hit = ATT_RE.exec(raw);
    const reg = attReg();
    let listing = m.listing && m.listing.id ? m.listing : null;
    if (hit) {
      const id = hit[1];
      if (!listing) { try { const l = typeof listingById === "function" ? listingById(id) : null; if (l) listing = listingSnapshot(l); } catch (_) {} }
      if (!listing && reg[id]) listing = reg[id];
      if (!listing) listing = { id, title: stripAttText(raw).replace(/^آگهی:\s*/, "") || "آگهی خودرو" };
      return { ...m, text: stripAttText(raw), listing };
    }
    return listing ? { ...m, listing } : m;
  }
  function normalizeConversation(raw) {
    const item = raw || {};
    const listing = item.listing || item.listing_snapshot || {
      id: item.listing_id || "", title: item.listing_title || item.ad_title || "گفتگو درباره آگهی خودرو",
      photo: item.listing_photo || item.ad_photo || "", price: item.listing_price || ""
    };
    const messages = Array.isArray(item.messages) ? item.messages : (UI.activeMessages[String(item.id)] || []);
    return {
      ...item, id: String(item.id || item.conversation_id || ""), listing,
      messages, updatedAt: item.updatedAt || item.updated_at || item.last_message_at || item.created_at || Date.now(),
      unreadCount: Number(item.unreadCount ?? item.unread_count ?? 0),
      lastMessage: stripAttText(item.lastMessage || item.last_message || (messages.length ? messages[messages.length - 1].text : "")),
      otherUserId: String(item.otherUserId || item.other_user_id || ""),
      otherName: item.otherName || item.other_name || item.seller_name || item.participant_name || listing.sellerName || "فروشنده خودرو"
    };
  }
  function localConversationPersonKey(conv, phone) {
    const otherPhone = conv.buyerPhone === phone ? String(conv.sellerPhone || "") : String(conv.buyerPhone || "");
    // A real phone is the most stable local identity across listing and story replies.
    if (otherPhone && !otherPhone.startsWith("seller:")) return "phone:" + otherPhone;
    // Synthetic seller IDs are common in preview data; use the seller snapshot to
    // collapse separate listings from the same person into a single inbox thread.
    if (conv.buyerPhone === phone) {
      const key = localPersonKey(conv.listing || {});
      if (key && !key.startsWith("listing:")) return key;
    }
    return otherPhone ? "phone:" + otherPhone : localPersonKey(conv.listing || {});
  }
  function myLocalConversations() {
    const phone = accountPhone();
    if (!phone) return [];
    const store = readStore();
    const byPerson = new Map();
    store.conversations
      .filter((c) => c.buyerPhone === phone || c.sellerPhone === phone)
      .map((c) => {
        const isSeller = c.sellerPhone === phone;
        return { ...c, otherName: isSeller ? (c.buyerName || "خریدار") : (c.sellerName || "فروشنده خودرو"), unreadCount: Number((c.unreadBy || {})[phone] || 0), messages: Array.isArray(c.messages) ? c.messages.slice() : [] };
      })
      .forEach((conv) => {
        const key = localConversationPersonKey(conv, phone) || ("conversation:" + conv.id);
        const previous = byPerson.get(key);
        if (!previous) { byPerson.set(key, conv); return; }
        const newer = Number(conv.updatedAt || 0) > Number(previous.updatedAt || 0) ? conv : previous;
        const all = [...(previous.messages || []), ...(conv.messages || [])];
        const seen = new Set();
        newer.messages = all.sort((a, b) => Number(a.createdAt || a.created_at || 0) - Number(b.createdAt || b.created_at || 0)).filter((m) => {
          const mk = String(m.id || "") || `${m.createdAt || m.created_at || 0}|${m.senderPhone || m.sender_phone || ""}|${m.text || m.body || ""}`;
          if (seen.has(mk)) return false;
          seen.add(mk); return true;
        });
        newer.unreadCount = Number(previous.unreadCount || 0) + Number(conv.unreadCount || 0);
        newer.updatedAt = Math.max(Number(previous.updatedAt || 0), Number(conv.updatedAt || 0));
        const last = newer.messages[newer.messages.length - 1];
        if (last) newer.lastMessage = last.text || last.body || newer.lastMessage || "";
        byPerson.set(key, newer);
      });
    return [...byPerson.values()].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }
  function conversations() {
    if (MODE === "api") {
      const rows = (UI.apiConversations || []).map(normalizeConversation).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const me = String(window.CARMA_AUTH_USER?.id || "");
      if (!me) return rows;
      const unique = new Map();
      rows.forEach((c) => {
        const buyer = String(c.buyer_id || c.buyerId || "");
        const seller = String(c.seller_id || c.sellerId || "");
        const other = buyer === me ? seller : (seller === me ? buyer : "");
        if (!other) { unique.set("conversation:" + c.id, c); return; }
        const key = "person:" + other;
        const previous = unique.get(key);
        if (!previous) unique.set(key, c);
        else {
          const recent = new Date(c.updatedAt).getTime() > new Date(previous.updatedAt).getTime() ? c : previous;
          recent.unreadCount = Number(previous.unreadCount || 0) + Number(c.unreadCount || 0);
          unique.set(key, recent);
        }
      });
      return Array.from(unique.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return myLocalConversations();
  }
  function findConversation(id) {
    const key = String(id || "");
    if (MODE === "api") return conversations().find((c) => c.id === key) || null;
    const list = myLocalConversations();
    const exact = list.find((c) => c.id === key);
    if (exact) return exact;
    // Notifications or old bookmarks can still point at a pre-deduplication thread ID.
    // Resolve that old ID to the single current thread for the same person.
    const phone = accountPhone();
    const raw = readStore().conversations.find((c) => String(c.id) === key);
    if (!raw || !phone || (raw.buyerPhone !== phone && raw.sellerPhone !== phone)) return null;
    const personKey = localConversationPersonKey(raw, phone);
    return list.find((c) => localConversationPersonKey(c, phone) === personKey) || null;
  }
  function formatTime(ts) {
    if (!ts) return "";
    const date = typeof ts === "number" ? new Date(ts) : new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    const diff = Math.max(0, Date.now() - date.getTime());
    const fa = (n) => new Intl.NumberFormat("fa-IR").format(n);
    if (diff < 60 * 1000) return "اکنون";
    if (diff < 60 * 60 * 1000) return `${fa(Math.floor(diff / 60000))} دقیقه`;
    if (diff < 24 * 60 * 60 * 1000) return `${fa(Math.floor(diff / 3600000))} ساعت`;
    return date.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
  }
  function formatPrice(value) {
    if (value == null || value === "") return "قیمت توافقی";
    if (typeof value === "number") return new Intl.NumberFormat("fa-IR").format(value) + " تومان";
    const s = String(value);
    if (/توافقی|معاوضه|تماس|تومان|ریال|USD|EUR/i.test(s) || /[$€£]/.test(s)) return s;
    const digits = s.replace(/[^0-9۰-۹]/g, "");
    if (!digits) return s;
    return `${s} تومان`;
  }
  function initials(name) { return String(name || "ف").trim().slice(0, 1) || "ف"; }
  function avatarMarkup(name, small) {
    return `<span class="mr-chat-avatar${small ? " is-small" : ""}" aria-hidden="true">${escapeHTML(initials(name))}</span>`;
  }
  function carThumbMarkup(listing, extraClass) {
    const photo = listing && (listing.photo || (listing.photos && listing.photos[0]));
    return `<span class="mr-chat-car-thumb ${extraClass || ""}">${photo ? `<img src="${escapeHTML(photo)}" alt="" loading="lazy" />` : `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M7 20 11 12a4 4 0 0 1 3.5-2h18a4 4 0 0 1 3.5 2l4 8v5H7z" fill="currentColor" opacity=".22"/><path d="M10 19h28M14 10l-3 9m23-9 3 9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="14" cy="25" r="3" fill="currentColor"/><circle cx="34" cy="25" r="3" fill="currentColor"/></svg>`}</span>`;
  }
  function showToastSafe(message) { if (typeof showToast === "function") showToast(message); }
  function requireLogin(returnRoute) {
    if (accountPhone()) return true;
    if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
    state = { ...state, modal: { type: "login", reason: "برای ارسال و دریافت پیام، ابتدا وارد حساب خود شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: returnRoute || state.route };
    if (typeof updateOverlays === "function") updateOverlays();
    return false;
  }

  async function getToken() {
    if (typeof CFG.getAccessToken === "function") return await CFG.getAccessToken();
    try { return localStorage.getItem(CFG.tokenStorageKey || "marqueAccessToken") || localStorage.getItem("access_token") || ""; }
    catch (_) { return ""; }
  }
  async function apiRequest(path, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    headers.set("Accept", "application/json");
    if (opts.body && !(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include", cache: "no-store", redirect: "error" });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = { message: raw }; }
    if (!response.ok) {
      const err = new Error((data && (data.error && data.error.message || data.message || data.detail && data.detail.message || data.detail)) || `HTTP ${response.status}`);
      err.status = response.status; err.code = data && data.error && data.error.code || "REQUEST_FAILED";
      throw err;
    }
    return data;
  }
  const API = {
    async list() {
      const data = await apiRequest("/messages/conversations?page=1&page_size=50");
      const rows = Array.isArray(data) ? data : (data.results || data.items || data.conversations || []);
      return rows.map(normalizeConversation);
    },
    async conversation(id) {
      const data = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}`);
      return normalizeConversation(data.conversation || data);
    },
    async messages(id) {
      const data = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages?limit=50`);
      const rows = Array.isArray(data) ? data : (data.results || data.items || data.messages || []);
      if (data && !Array.isArray(data) && data.other_last_read_at) UI.readAt[String(id)] = data.other_last_read_at;
      return rows.map((m) => hydrateAtt({ ...m, id: String(m.id || m.message_id || ""), text: String(m.text || m.body || m.content || ""), createdAt: m.createdAt || m.created_at || Date.now(), is_mine: Boolean(m.is_mine), is_read: Boolean(m.is_read), reactions: Array.isArray(m.reactions) ? m.reactions : [], my_reaction: m.my_reaction || null, edited_at: m.edited_at || null, media: normMedia(m.media), story: normStory(m.story) }));
    },
    async start(listing) {
      const data = await apiRequest("/messages/conversations", { method: "POST", body: JSON.stringify({ listing_id: listing.id }) });
      return normalizeConversation(data.conversation || data);
    },
    async direct(userId) {
      const data = await apiRequest("/messages/conversations/direct", { method: "POST", body: JSON.stringify({ user_id: String(userId) }) });
      return normalizeConversation(data.conversation || data);
    },
    async send(id, text, storyId) {
      const payload = storyId ? { text, story_id: String(storyId) } : { text };
      const data = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages`, { method: "POST", body: JSON.stringify(payload) });
      const msg = data.message || data;
      return hydrateAtt({ ...msg, id: String(msg.id || msg.message_id || ""), text: String(msg.text || msg.body || text), createdAt: msg.createdAt || msg.created_at || Date.now(), is_mine: true, media: normMedia(msg.media), story: normStory(msg.story) });
    },
    // Photo / voice message: multipart upload; the server re-encodes images and validates audio by magic bytes.
    async sendMedia(id, media) {
      const fd = new FormData();
      fd.append("kind", media.type);
      if (media.caption) fd.append("caption", media.caption);
      if (media.type === "voice") {
        fd.append("duration", String(Math.round((media.dur || 0) * 10) / 10));
        if (media.wave && media.wave.length) fd.append("wave", media.wave.join(","));
      }
      fd.append("file", media.blob, media.type === "voice" ? `voice.${voiceExt(media.blob.type || media.mime)}` : "photo.jpg");
      const data = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/media`, { method: "POST", body: fd });
      const msg = data.message || data;
      return { ...msg, id: String(msg.id || msg.message_id || ""), text: String(msg.text || msg.body || ""), createdAt: msg.createdAt || msg.created_at || Date.now(), is_mine: true, media: normMedia(msg.media), story: null };
    },
    async typing(id, on) {
      return apiRequest(`/messages/conversations/${encodeURIComponent(id)}/typing`, { method: "POST", body: JSON.stringify({ typing: on !== false }) });
    },
    async isTyping(id) {
      const d = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/typing`);
      return { typing: Boolean(d && d.typing), readAt: (d && d.other_read_at) || null };
    },
    async react(id, mid, emoji) {
      return apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(mid)}/react`, { method: "POST", body: JSON.stringify({ emoji: emoji || null }) });
    },
    async edit(id, mid, text) {
      const d = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(mid)}`, { method: "PATCH", body: JSON.stringify({ text }) });
      return (d && d.message) || d || {};
    },
    async removeConv(id) {
      return apiRequest(`/messages/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async remove(id, mid) {
      return apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(mid)}`, { method: "DELETE" });
    },
    async read(id) {
      return apiRequest(`/messages/conversations/${encodeURIComponent(id)}/read`, { method: "POST", body: JSON.stringify({}) });
    }
  };

  async function refreshApiInbox(force) {
    if (MODE !== "api" || UI.apiLoading || (!force && UI.apiLoaded)) return;
    UI.apiLoading = true;
    try {
      UI.apiConversations = await API.list();
      UI.apiLoaded = true; UI.error = "";
    } catch (err) {
      UI.error = err.status === 401 ? "برای نمایش گفتگوها، ورود متصل به بک‌اند لازم است." : "دریافت گفتگوها انجام نشد. اتصال API را بررسی کنید.";
    } finally {
      UI.apiLoading = false;
      if (!UI.apiLoaded) UI.apiLoaded = true;
      if (activeRoute() && activeRoute().page === "messages" && typeof render === "function") render();
    }
  }
  async function refreshApiConversation(id, force) {
    const key = String(id || "");
    if (MODE !== "api" || !key || UI.loadingIds.has(key) || (!force && UI.activeMessages[key])) return;
    UI.loadingIds.add(key);
    try {
      let conv = findConversation(key);
      const [c2, messages] = await Promise.all([conv ? Promise.resolve(conv) : API.conversation(key), API.messages(key)]);
      conv = c2;
      UI.activeMessages[key] = messages;
      conv.messages = messages;
      conv.unreadCount = 0;
      UI.apiConversations = [conv, ...UI.apiConversations.filter((c) => String(c.id) !== key)];
      API.read(key).catch(() => {});
      UI.error = "";
      delete UI.failedAt[key];
    } catch (err) {
      UI.error = err.status === 401 ? "نشست ورود به بک‌اند معتبر نیست." : "پیام‌ها بارگذاری نشدند. اتصال API را بررسی کنید.";
      UI.failedAt[key] = Date.now();
      delete UI.activeMessages[key];
    } finally {
      UI.loadingIds.delete(key);
      if (activeRoute() && activeRoute().page === "conversation" && String(activeRoute().conversationId) === key && typeof render === "function") render();
    }
  }

  function lastIsMine(c) {
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    const m = msgs[msgs.length - 1];
    if (!m) return false;
    if (m.is_mine != null) return !!m.is_mine;
    return String(m.senderPhone || m.sender_phone || "") === accountPhone();
  }
  function hueOf(name) { let h = 0; const t = String(name || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return h; }
  // Profile picture of the other side: backend field, else the seller's account
  // avatar / dealership logo saved on this device.
  // Dealership seller -> the dealership's profile picture (logo); personal seller
  // -> the seller's account picture; seeded brand dealerships -> the brand logo.
  function convAvatarInfo(c) {
    const l = (c && (c.listing || c.listing_snapshot)) || {};
    const direct = (c && (c.otherAvatar || c.other_avatar)) || l.sellerAvatar || l.seller_avatar || "";
    if (direct) return { url: String(direct), logo: false };
    let type = l.sellerType, id = l.sellerId;
    if (!id) {
      try {
        const live = listingById(l.id || (c && c.listing_id));
        const s = live && typeof listingSeller === "function" ? listingSeller(live) : null;
        if (s) { type = s.type; id = s.id; }
      } catch (_) {}
    }
    if (typeof sellerAvatarFor === "function" && id) {
      const url = sellerAvatarFor(type, id);
      if (url) return { url, logo: false };
    }
    if (type === "dealer" && String(id || "").startsWith("brand:") && typeof BRANDS !== "undefined") {
      const b = BRANDS.find((x) => x.name === String(id).slice(6));
      if (b && b.img) return { url: String(b.img), logo: true };
    }
    return { url: "", logo: false };
  }
  function convAvatar(c) { return convAvatarInfo(c).url; }
  function avatarImgMarkup(info) { return `<img src="${escapeHTML(info.url)}" alt=""${info.logo ? ' class="is-logo"' : ""} />`; }
  function ringAvatarMarkup(name, info) {
    return `<span class="mr-msg-avatar" style="--h:${hueOf(name)}" aria-hidden="true">${info && info.url ? avatarImgMarkup(info) : `<b>${escapeHTML(initials(name))}</b>`}</span>`;
  }
  const FA = (n) => new Intl.NumberFormat("fa-IR").format(n);
  const ICON_SEARCH = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7.5"></circle><path d="m20.5 20.5-4-4"></path></svg>`;
  const ICON_SLIDERS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4M8 14v7M16 3v8M16 18v3"></path><rect x="5.5" y="7" width="5" height="7" rx="2.5" class="k"></rect><rect x="13.5" y="11" width="5" height="7" rx="2.5" class="k"></rect></svg>`;
  const ICON_CHAT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2 1-4.2A7.4 7.4 0 0 1 4.5 5.3 7.5 7.5 0 0 1 20 11.5Z"></path><path d="M8.5 11h7M8.5 14h4"></path></svg>`;

  function renderStoryRail() {
    // Stories (js/27-stories.js): first tile from the right = my story.
    if (window.MARQUE_STORIES) return window.MARQUE_STORIES.renderRail();
    const rows = conversations().slice(0, 12);
    const cards = rows.map((c) => {
      const listing = c.listing || c.listing_snapshot || {};
      const other = c.otherName || c.sellerName || listing.sellerName || "فروشنده خودرو";
      const photo = listing.photo || (listing.photos && listing.photos[0]) || "";
      const unread = Number(c.unreadCount || 0) > 0;
      return `<button type="button" class="mr-msg-story${unread ? " has-unread" : ""}" data-action="openChat" data-id="${escapeHTML(c.id)}" aria-label="${escapeHTML(other + " - " + listingTitle(c))}">
        ${photo ? `<img src="${escapeHTML(photo)}" alt="" loading="lazy" />` : `<span class="mr-msg-story-fallback">${carThumbMarkup(listing, "")}</span>`}
        <span class="mr-msg-story-avatar" style="--h:${hueOf(other)}">${convAvatar(c) ? avatarImgMarkup(convAvatarInfo(c)) : escapeHTML(initials(other))}</span>
      </button>`;
    }).join("");
    return `<div class="mr-msg-stories" role="list"><button type="button" class="mr-msg-story is-new" data-action="goListings" data-brand="all"><span class="mr-msg-new-avatar">${ICON_CHAT}<i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></i></span><small>گفتگوی جدید</small></button>${cards}</div>`;
  }

  function renderInboxRows() {
    let rows = conversations();
    const query = UI.search.trim().toLocaleLowerCase("fa-IR");
    if (UI.filter === "unread") rows = rows.filter((c) => Number(c.unreadCount || 0) > 0);
    if (query) rows = rows.filter((c) => `${c.otherName || ""} ${listingTitle(c)} ${c.lastMessage || ""}`.toLocaleLowerCase("fa-IR").includes(query));
    if (!rows.length) {
      const hasAny = conversations().length > 0;
      return `<div class="mr-chat-empty"><div class="mr-chat-empty-title">${hasAny ? "گفتگویی پیدا نشد" : "هنوز گفتگویی ندارید"}</div><p>${hasAny ? "عبارت جستجو یا فیلتر را تغییر دهید." : "از صفحه هر آگهی، گزینه «گفتگو با فروشنده» را بزنید و درباره خودرو پیام بدهید."}</p>${hasAny ? `<button type="button" class="mr-chat-quiet-btn" data-action="chatResetFilters">پاک کردن فیلترها</button>` : `<button type="button" class="mr-chat-primary-btn" data-action="goListings" data-brand="all">دیدن آگهی خودروها<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg></button>`}</div>`;
    }
    return `<div class="mr-msg-list">${rows.map((c) => {
      const last = c.lastMessage || (c.messages && c.messages.length ? c.messages[c.messages.length - 1].text : "برای شروع گفتگو پیام بفرستید");
      const other = c.otherName || c.sellerName || (c.listing && c.listing.sellerName) || "فروشنده خودرو";
      const unread = Number(c.unreadCount || 0);
      const preview = (lastIsMine(c) ? "شما: " : "") + last;
      return `<button type="button" class="mr-msg-row${unread ? " has-unread" : ""}" data-action="openChat" data-id="${escapeHTML(c.id)}">
        ${ringAvatarMarkup(other, convAvatarInfo(c))}
        <span class="mr-msg-copy"><b>${escapeHTML(other)}</b><span class="mr-msg-preview">${escapeHTML(preview)}</span></span>
        <span class="mr-msg-meta"><time>${escapeHTML(formatTime(c.updatedAt || c.updated_at))}</time>${unread ? `<span class="mr-msg-badge">${FA(unread)}</span>` : ""}</span>
      </button>`;
    }).join("")}</div>`;
  }
  /* ---- Skeleton loaders (inbox, conversation, in-page loading) ---- */
  const sk = (style, cls) => `<span class="skeleton-block ${cls || ""}" style="display:block;${style}"></span>`;
  function skeletonInboxRows(n) {
    const w = [[96, 62], [72, 80], [110, 50], [84, 70], [100, 58], [68, 76], [90, 64]];
    return `<div class="mr-msg-list mr-sk-list" aria-hidden="true">${Array.from({ length: n || 7 }, (_, i) => `<div class="mr-msg-row mr-sk-row">${sk("width:68px;height:68px;border-radius:50%;flex:0 0 auto")}<span class="mr-msg-copy">${sk(`height:14px;width:${w[i % 7][0]}px;border-radius:999px`)}${sk(`height:11px;width:${w[i % 7][1]}%;max-width:230px;border-radius:999px`)}</span><span class="mr-msg-meta">${sk("height:10px;width:34px;border-radius:999px")}</span></div>`).join("")}</div>`;
  }
  function skeletonStories() {
    return `<h2 class="mr-stories-title" aria-hidden="true">استوری‌ها</h2><div class="mr-msg-stories mr-sk-stories" aria-hidden="true">${Array.from({ length: 5 }, () => sk("", "mr-sk-story")).join("")}</div>`;
  }
  function skeletonBubbles() {
    const spec = [["theirs", 58, 44], ["theirs", 40, 30], ["mine", 64, 44], ["theirs", 72, 62], ["mine", 36, 30], ["mine", 54, 44]];
    return spec.map(([side, w, h]) => `<div class="mr-cv-row is-${side}">${sk(`width:${w}%;height:${h}px;border-radius:22px`)}</div>`).join("");
  }
  function skeletonMessagesScreen() {
    const root = document.createElement("section");
    root.dataset.skeleton = "messages";
    root.className = "mr-chat-screen mr-msg-screen";
    root.setAttribute("aria-busy", "true");
    root.innerHTML = `<div class="mr-msg-hero"><div class="mr-msg-topbar"><button type="button" class="mr-msg-back" data-action="chatInboxBack" aria-label="برگشت"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg></button><div class="mr-msg-search">${ICON_SEARCH}${sk("height:14px;flex:1 1 auto;border-radius:999px")}</div></div>${skeletonStories()}</div><h1 class="mr-msg-title">پیام‌ها</h1>${skeletonInboxRows(7)}`;
    return root;
  }
  function skeletonConversationScreen() {
    const root = document.createElement("section");
    root.dataset.skeleton = "conversation";
    root.className = "mr-chat-conversation mr-cv";
    root.setAttribute("aria-busy", "true");
    root.innerHTML = `
      <div class="mr-cv-stage">
        <div class="mr-cv-history">${skeletonBubbles()}</div>
        <div class="mr-cv-top">
          <header class="mr-cv-head">
            ${sk("position:absolute;left:0;top:6px;width:42px;height:42px;border-radius:50%")}
            <div class="mr-cv-person">${sk("width:66px;height:66px;border-radius:50%")}${sk("margin-top:-12px;width:112px;height:30px;border-radius:999px;border:2px solid var(--cv-bg)")}</div>
          </header>
        </div>
      </div>
      <div class="mr-cv-composer"><div class="mr-cv-composer-row">${sk("flex:0 0 auto;width:44px;height:44px;border-radius:50%")}${sk("flex:1 1 auto;height:44px;border-radius:23px")}</div></div>`;
    return root;
  }

  function renderMessagesScreen() {
    if (MODE === "api" && !UI.apiLoaded && !UI.apiLoading) setTimeout(() => refreshApiInbox(false), 0);
    const root = document.createElement("section");
    root.dataset.page = "messages";
    root.className = "mr-chat-screen mr-msg-screen";
    root.innerHTML = `
      <div class="mr-msg-hero"><div class="mr-msg-topbar"><button type="button" class="mr-msg-back" data-action="chatInboxBack" aria-label="برگشت"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg></button><div class="mr-msg-search">${ICON_SEARCH}<input id="mrChatSearch" type="search" value="${escapeHTML(UI.search)}" placeholder="جستجوی افراد" autocomplete="off" aria-label="جستجوی گفتگوها"/><button type="button" class="mr-msg-clear" data-action="chatClearSearch" aria-label="پاک کردن جستجو" ${UI.search ? "" : "hidden"}>×</button></div></div>
      ${renderStoryRail()}</div>
      <h1 class="mr-msg-title">پیام‌ها</h1>
      ${UI.error ? `<div class="mr-chat-inline-error">${escapeHTML(UI.error)}</div>` : ""}
      <div data-slot="chat-list">${MODE === "api" && !UI.apiLoaded && UI.apiLoading ? `${skeletonInboxRows(6)}` : renderInboxRows()}</div>
      <p class="mr-chat-privacy-note">برای امنیت معامله، اطلاعات حساس یا کدهای تأیید را در گفتگو ارسال نکنید.</p>${MODE === "local" ? `<p class="mr-chat-preview-note">نسخه پیش‌نمایش: پیام‌ها فقط روی همین مرورگر ذخیره می‌شوند.</p>` : ""}`;
    return root;
  }

  function msgIsMine(message) {
    return message.is_mine != null ? !!message.is_mine : (String(message.senderPhone || message.sender_phone || "") === accountPhone());
  }
  function msgTime(message) {
    const d = new Date(message.createdAt || message.created_at || Date.now());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  function formatStamp(d) {
    const hm = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return `امروز ${hm}`;
    const y = new Date(now.getTime() - 864e5);
    if (d.toDateString() === y.toDateString()) return `دیروز ${hm}`;
    return `${d.toLocaleDateString("fa-IR", { month: "long", day: "numeric" })} ${hm}`;
  }
  function msgPreview(m) {
    if (m && m.listing && m.listing.id) return `آگهی: ${m.listing.title || "خودرو"}`;
    if (m && m.media) return `${mediaLabel(m.media)} ${m.text || ""}`.replace(/\s+/g, " ").trim().slice(0, 140);
    return String((m && (m.text || m.body || m.content)) || "").replace(/\s+/g, " ").trim().slice(0, 140);
  }
  function replyWho(m, conv) {
    if (msgIsMine(m)) return "شما";
    return (conv && (conv.otherName || conv.sellerName || (conv.listing && conv.listing.sellerName))) || "فروشنده خودرو";
  }
  function replyBarHTML() {
    const r = UI.reply;
    return `<div class="mr-cv-replybar"${r ? "" : " hidden"}><span class="mr-cv-replybar-line" aria-hidden="true"></span><span class="mr-cv-replybar-txt"><b>${r ? "پاسخ به " + escapeHTML(r.who) : ""}</b><small>${r ? escapeHTML(r.text) : ""}</small></span><button type="button" class="mr-cv-replybar-x" data-action="chatReplyCancel" aria-label="لغو پاسخ"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></div>`;
  }
  // iMessage-style "typing…" bubble: three grey dots that pulse in turn, with the little tail circles.
  function typingRowHTML() {
    return `<div class="mr-cv-row is-theirs mr-cv-typing" aria-label="در حال تایپ" role="status"><div class="mr-cv-bubble mr-cv-typing-bubble"><i></i><i></i><i></i><span class="mr-cv-typing-tail" aria-hidden="true"></span></div></div>`;
  }
  // ---- Read receipts ("ارسال شد" / "دیده شد") under my latest message, like iMessage ----
  function receiptState(conv, messages) {
    const last = messages && messages[messages.length - 1];
    if (!conv || !last || !msgIsMine(last)) return null;
    if (MODE === "api") {
      const at = UI.readAt[String(conv.id)];
      return last.is_read ? { read: true, at: at || null } : { read: false };
    }
    const me = accountPhone();
    const other = String(conv.buyerPhone === me ? conv.sellerPhone : conv.buyerPhone) || "";
    const real = other && !other.startsWith("seller:");
    const unread = Number(((conv.unreadBy || {})[other]) || 0);
    return real && unread === 0 ? { read: true, at: null } : { read: false };
  }
  function receiptHTML(st) {
    if (!st) return "";
    const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"></path></svg>';
    if (st.read) {
      let t = "";
      if (st.at) { const d = new Date(st.at); if (!Number.isNaN(d.getTime())) t = ` <time>${escapeHTML(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }))}</time>`; }
      return `<div class="mr-cv-status is-read" data-k="r${escapeHTML(String(st.at || ""))}" role="status">${tick}<span>دیده شد</span>${t}</div>`;
    }
    return `<div class="mr-cv-status" data-k="s" role="status"><span>ارسال شد</span></div>`;
  }
  // Refresh only the status line (no full re-render) when the other side reads my message.
  function updateReceipt(id) {
    id = String(id || "");
    if (!id || currentConvId() !== id) return;
    const box = document.querySelector('[data-page="conversation"] [data-slot="chat-messages"]');
    if (!box) return;
    const conv = findConversation(id);
    const html = receiptHTML(receiptState(conv, getConversationMessages(conv)));
    const old = box.querySelector(".mr-cv-status");
    const km = /data-k="([^"]*)"/.exec(html);
    if (old && km && old.getAttribute("data-k") === km[1]) return;
    if (old) old.remove();
    if (!html) return;
    const rows = box.querySelectorAll(".mr-cv-row:not(.mr-cv-typing)");
    const lastRow = rows[rows.length - 1];
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    if (lastRow) lastRow.insertAdjacentHTML("afterend", html);
    if (near) box.scrollTop = box.scrollHeight;
  }
  function currentConvId() { const r = activeRoute() || {}; return r.page === "conversation" ? String(r.conversationId || "") : ""; }
  let typingExpire = null;
  function setTyping(id, on) {
    id = String(id || ""); on = !!on;
    if (!!UI.typing[id] === on && !(on && typingExpire)) { if (on) armTypingExpire(id); return; }
    UI.typing[id] = on;
    if (on) armTypingExpire(id);
    if (currentConvId() !== id) return;
    const box = document.querySelector('[data-page="conversation"] [data-slot="chat-messages"]');
    if (!box) return;
    const had = box.querySelector(".mr-cv-typing");
    if (on && !had) {
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
      const note = box.querySelector(".mr-chat-start-note");
      box.insertAdjacentHTML("beforeend", typingRowHTML());
      if (near || note) box.scrollTop = box.scrollHeight;
    } else if (!on && had) had.remove();
  }
  function armTypingExpire(id) { clearTimeout(typingExpire); typingExpire = setTimeout(() => { typingExpire = null; if (UI.typing[id]) setTyping(id, false); }, 6000); }
  // ---- Reactions: double-tap = heart; long-press = menu (reactions, reply, copy, edit, delete) ----
  const REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢", "🔥"];
  function reactionInfo(m) {
    if (MODE === "api") {
      const list = (Array.isArray(m.reactions) ? m.reactions : []).map((r) => ({ e: String(r.emoji), n: Number(r.count || 0) })).filter((r) => r.n > 0);
      return { list, total: list.reduce((a, r) => a + r.n, 0), mine: m.my_reaction || "" };
    }
    const map = Object.assign({}, m.reactions && !Array.isArray(m.reactions) ? m.reactions : {});
    (Array.isArray(m.likedBy) ? m.likedBy : []).forEach((p) => { if (!map[p]) map[p] = "❤️"; });  // legacy hearts
    const counts = {}; Object.keys(map).forEach((p) => { counts[map[p]] = (counts[map[p]] || 0) + 1; });
    const list = Object.keys(counts).map((e) => ({ e, n: counts[e] })).sort((a, b) => b.n - a.n);
    return { list, total: Object.keys(map).length, mine: map[accountPhone()] || "" };
  }
  function reactionsHTML(r) {
    if (!r.total) return "";
    return `<span class="mr-cv-reacts${r.mine ? " is-mine" : ""}" aria-label="واکنش‌ها">${r.list.map((x) => `<b>${escapeHTML(x.e)}</b>`).join("")}${r.total > 1 ? `<i>${FA(r.total)}</i>` : ""}</span>`;
  }
  const msgSig = (messages) => messages.length + ":" + (messages.length ? messages[messages.length - 1].id : "") + ":" + messages.map((m) => { const r = reactionInfo(m); return (m.edited_at || m.editedAt ? "e" : "") + r.list.map((x) => x.e + x.n).join("") + (r.mine ? "m" : ""); }).join("|");
  function editedHTML(m) { return (m.edited_at || m.editedAt) ? `<small class="mr-cv-edited">ویرایش شده</small>` : ""; }
  function applyReactionToRow(row, m) {
    if (!row) return;
    const r = reactionInfo(m), bubble = row.querySelector(".mr-cv-bubble");
    row.classList.toggle("is-liked", r.total > 0);
    if (!bubble) return;
    const old = bubble.querySelector(".mr-cv-reacts"); if (old) old.remove();
    bubble.insertAdjacentHTML("beforeend", reactionsHTML(r));
    const h = bubble.querySelector(".mr-cv-reacts"); if (h) h.classList.add("pop");
  }
  function chatFormInfo() {
    const form = document.querySelector("form[data-chat-form]"); if (!form) return null;
    const id = String(form.dataset.conversationId || ""), conv = findConversation(id);
    return { form, id, conv, messages: getConversationMessages(conv) };
  }
  function findStoreMessage(store, mid) {
    let hit = null;
    store.conversations.forEach((c) => (c.messages || []).forEach((x) => { if (String(x.id) === String(mid)) hit = x; }));
    return hit;
  }
  async function setReaction(row, emoji) {
    const ctx = chatFormInfo(); const mid = row && row.dataset.mid; if (!ctx || !mid || !row.querySelector(".mr-cv-bubble")) return;
    if (!accountPhone()) { requireLogin(activeRoute()); return; }
    const m = ctx.messages.find((x) => String(x.id) === String(mid)); if (!m) return;
    try { window.getSelection && window.getSelection().removeAllRanges(); } catch (_) {}
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {}
    if (MODE === "api") {
      const prev = { r: m.reactions, me: m.my_reaction };
      const list = (Array.isArray(m.reactions) ? m.reactions : []).map((r) => ({ emoji: r.emoji, count: Number(r.count || 0) }));
      if (m.my_reaction) { const o = list.find((r) => r.emoji === m.my_reaction); if (o) o.count--; }
      if (emoji) { const n = list.find((r) => r.emoji === emoji); if (n) n.count++; else list.push({ emoji, count: 1 }); }
      m.reactions = list.filter((r) => r.count > 0); m.my_reaction = emoji || null;
      applyReactionToRow(row, m);
      try { const r = await API.react(ctx.id, mid, emoji || null); if (r && Array.isArray(r.reactions)) { m.reactions = r.reactions; m.my_reaction = r.my_reaction || null; applyReactionToRow(row, m); } }
      catch (err) { m.reactions = prev.r; m.my_reaction = prev.me; applyReactionToRow(row, m); showToastSafe(err.message || "واکنش ثبت نشد."); }
      return;
    }
    const store = readStore(), phone = accountPhone(), hit = findStoreMessage(store, mid); if (!hit) return;
    const map = Object.assign({}, hit.reactions && !Array.isArray(hit.reactions) ? hit.reactions : {});
    (Array.isArray(hit.likedBy) ? hit.likedBy : []).forEach((p) => { if (!map[p]) map[p] = "❤️"; }); delete hit.likedBy;
    if (emoji) map[phone] = emoji; else delete map[phone];
    hit.reactions = map;
    if (!writeStore(store)) return;
    m.reactions = map; delete m.likedBy;
    applyReactionToRow(row, m);
  }
  const toggleLike = (row) => {
    clearTimeout(window.__mrImgT);
    const ctx = chatFormInfo(); const m = ctx && ctx.messages.find((x) => String(x.id) === String(row.dataset.mid));
    if (m) setReaction(row, reactionInfo(m).mine ? "" : "❤️");
  };
  function rerenderMessages(ctx) {
    const box = document.querySelector('[data-page="conversation"] [data-slot="chat-messages"]'); if (!box || !ctx.conv) return;
    const messages = getConversationMessages(ctx.conv);
    box.innerHTML = messages.length ? renderBubbles(messages) : startNoteMarkup();
    box.dataset.sig = msgSig(messages);
  }
  function syncLastMessage(ctx, messages) {
    const last = messages[messages.length - 1], txt = last ? msgPreview(last) : "";
    if (MODE === "api") { const c = UI.apiConversations.find((x) => String(x.id) === ctx.id); if (c) { c.lastMessage = txt; c.last_message = txt; } return; }
    const store = readStore(), c = store.conversations.find((x) => x.id === ctx.id);
    if (c) { c.lastMessage = txt; writeStore(store); }
  }
  async function deleteMessage(mid) {
    const ctx = chatFormInfo(); if (!ctx) return;
    try {
      if (MODE === "api") {
        await API.remove(ctx.id, mid);
        UI.activeMessages[ctx.id] = (UI.activeMessages[ctx.id] || []).filter((x) => String(x.id) !== String(mid));
        if (ctx.conv) ctx.conv.messages = UI.activeMessages[ctx.id];
      } else {
        const store = readStore();
        store.conversations.forEach((c) => { if (Array.isArray(c.messages)) c.messages = c.messages.filter((x) => String(x.id) !== String(mid)); });
        if (!writeStore(store)) return;
      }
      const fresh = chatFormInfo(); rerenderMessages(fresh); syncLastMessage(fresh, fresh.messages);
      showToastSafe("پیام حذف شد");
    } catch (err) { showToastSafe(err.message || "حذف پیام انجام نشد."); }
  }
  async function submitEdit(form, textarea, text, id) {
    const ed = UI.edit;
    if (text === ed.text) { clearReply(form); return; }
    try {
      if (MODE === "api") {
        const msg = await API.edit(id, ed.id, text);
        const m = (UI.activeMessages[id] || []).find((x) => String(x.id) === String(ed.id));
        if (m) { m.text = text; m.edited_at = msg.edited_at || new Date().toISOString(); }
      } else {
        const store = readStore(), hit = findStoreMessage(store, ed.id); if (!hit) throw new Error("پیام پیدا نشد.");
        hit.text = text; hit.editedAt = Date.now();
        if (!writeStore(store)) return;
      }
      clearReply(form);
      const ctx = chatFormInfo(); rerenderMessages(ctx); syncLastMessage(ctx, ctx.messages);
    } catch (err) { showToastSafe(err.message || "ویرایش پیام انجام نشد."); }
  }
  function startEdit(row) {
    const ctx = chatFormInfo(); if (!ctx) return;
    const m = ctx.messages.find((x) => String(x.id) === String(row.dataset.mid)); if (!m || !msgIsMine(m) || m.listing) return;
    UI.reply = null; UI.edit = { conv: ctx.id, id: String(m.id), text: String(m.text || "") };
    const bar = ctx.form.querySelector(".mr-cv-replybar");
    if (bar) { bar.hidden = false; bar.querySelector("b").textContent = "ویرایش پیام"; bar.querySelector("small").textContent = msgPreview(m); }
    const ta = ctx.form.querySelector("textarea");
    if (ta) { ta.value = UI.edit.text; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; ctx.form.classList.add("has-text"); ta.focus({ preventScroll: true }); }
    syncChatPad(ctx.form);
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); }
    catch (_) { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (__) {} ta.remove(); }
    showToastSafe("متن کپی شد");
  }
  // ---- long-press menu ----
  let lastMenuAt = 0;
  function closeMsgMenu() {
    const b = document.querySelector(".mr-cv-menu-back"); if (b) b.remove();
    document.querySelectorAll(".mr-cv-row.is-picked").forEach((r) => r.classList.remove("is-picked"));
  }
  function openMsgMenu(row) {
    const ctx = chatFormInfo(); if (!ctx || !row || !row.dataset.mid) return;
    const m = ctx.messages.find((x) => String(x.id) === String(row.dataset.mid)); if (!m) return;
    closeMsgMenu(); lastMenuAt = Date.now();
    const mine = msgIsMine(m), isText = !(m.listing && m.listing.id) && !m.media, r = reactionInfo(m);
    const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"></path></svg>`;
    const acts = [["reply", "پاسخ", ic("M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v3")]];
    if (isText || (m.media && m.text)) acts.push(["copy", "کپی متن", ic("M9 9h10v11H9zM5 15V4h10")]);
    if (mine && isText) acts.push(["edit", "ویرایش", ic("M4 20h4L19 9l-4-4L4 16zM13 7l4 4")]);
    if (mine) acts.push(["del", "حذف", ic("M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3"), "is-danger"]);
    const back = document.createElement("div");
    back.className = "mr-cv-menu-back";
    back.innerHTML = `<div class="mr-cv-menu ${mine ? "is-mine" : "is-theirs"}" role="menu">
      <div class="mr-cv-rxbar">${REACTIONS.map((e) => `<button type="button" class="mr-cv-rx${r.mine === e ? " is-on" : ""}" data-rx="${e}" aria-label="${e}">${e}</button>`).join("")}</div>
      <div class="mr-cv-acts">${acts.map(([k, label, svg, cls]) => `<button type="button" class="mr-cv-act ${cls || ""}" data-act="${k}" role="menuitem">${svg}<span>${label}</span></button>`).join("")}</div></div>`;
    document.body.appendChild(back);
    row.classList.add("is-picked");
    const menu = back.querySelector(".mr-cv-menu"), rect = row.getBoundingClientRect(), h = menu.offsetHeight, vh = window.innerHeight;
    let top = rect.bottom + 8;
    if (top + h > vh - 12) top = Math.max(12, rect.top - h - 8);
    if (top + h > vh - 12) top = Math.max(12, vh - h - 12);
    menu.style.top = top + "px";
    const rowId = row.dataset.mid;
    back.addEventListener("click", (e) => {
      const rx = e.target.closest("[data-rx]"), act = e.target.closest("[data-act]");
      const target = document.querySelector(`.mr-cv-history .mr-cv-row[data-mid="${CSS.escape(rowId)}"]`);
      if (rx) { closeMsgMenu(); setReaction(target, r.mine === rx.dataset.rx ? "" : rx.dataset.rx); return; }
      if (!act) { if (e.target === back) closeMsgMenu(); return; }
      const k = act.dataset.act;
      if (k === "del" && !act.classList.contains("is-confirm")) { act.classList.add("is-confirm"); act.querySelector("span").textContent = "تأیید حذف برای همه"; return; }
      closeMsgMenu();
      if (k === "reply") startReply(target);
      else if (k === "copy") copyText(String(m.text || ""));
      else if (k === "edit") startEdit(target);
      else if (k === "del") deleteMessage(rowId);
    });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMsgMenu(); });
  window.addEventListener("popstate", closeMsgMenu);
  function renderBubbles(messages) {
    let prevTime = 0;
    const cid = currentConvId();
    const tail = (cid ? receiptHTML(receiptState(findConversation(cid), messages)) : "") + (cid && UI.typing[cid] ? typingRowHTML() : "");
    return messages.map((m, i) => {
      const mine = msgIsMine(m);
      const body = m.text || m.body || m.content || "";
      const t = msgTime(m).getTime();
      const next = messages[i + 1];
      const lastOfRun = !next || msgIsMine(next) !== mine || (msgTime(next).getTime() - t) > 3600e3;
      const stamp = (i === 0 || t - prevTime > 3600e3) ? `<div class="mr-cv-stamp">${escapeHTML(formatStamp(new Date(t)))}</div>` : "";
      prevTime = t;
      const storyCard = m.story ? storyCardHTML(m, mine) : "";
      const mediaInner = m.media ? (m.media.type === "voice" ? voiceHTML(m) : imageHTML(m)) : "";
      const bodyHTML = escapeHTML(body).replace(/\n/g, "<br>");
      const quote = m.replyTo ? `<span class="mr-cv-quote" data-action="chatJumpTo" data-mid="${escapeHTML(String(m.replyTo.id || ""))}"><b>${escapeHTML(m.replyTo.who || "")}</b><small>${escapeHTML(m.replyTo.text || "")}</small></span>` : "";
      if (m.listing && m.listing.id) {
        const L = m.listing, ph = L.photo || (L.photos && L.photos[0]) || "";
        return `${stamp}<div class="mr-cv-row ${mine ? "is-mine" : "is-theirs"}${lastOfRun ? " has-tail" : ""}" data-mid="${escapeHTML(String(m.id || ""))}"><button type="button" class="mr-cv-att" data-action="chatOpenListing" data-listing-id="${escapeHTML(L.id)}" aria-label="مشاهده آگهی ${escapeHTML(L.title || "")}">${ph ? `<img src="${escapeHTML(ph)}" alt="" decoding="async" />` : `<span class="mr-cv-att-ph">${carThumbMarkup(L, "")}</span>`}<span class="mr-cv-att-info"><b>${escapeHTML(L.title || "آگهی خودرو")}</b><small>${escapeHTML(formatPrice(L.price || L.priceAmount))}${L.city ? ` · ${escapeHTML(L.city)}` : ""}</small></span></button></div>`;
      }
      const rx = reactionInfo(m);
      return `${stamp}${storyCard}<div class="mr-cv-row ${mine ? "is-mine" : "is-theirs"}${lastOfRun ? " has-tail" : ""}${rx.total ? " is-liked" : ""}" data-mid="${escapeHTML(String(m.id || ""))}"><div class="mr-cv-bubble${m.media ? ` is-media is-${m.media.type}` : ""}">${quote}${mediaInner}${m.media && bodyHTML ? `<span class="mr-cv-cap">${bodyHTML}</span>` : bodyHTML}${editedHTML(m)}${reactionsHTML(rx)}</div></div>`;
    }).join("") + tail;
  }
  function startNoteMarkup() {
    return `<div class="mr-chat-start-note"><span>✦</span><b>گفتگو را شروع کنید</b><p>درباره وضعیت خودرو، قیمت یا زمان بازدید سؤال بپرسید.</p></div>`;
  }
  function getConversationMessages(conv) {
    if (!conv) return [];
    if (MODE === "api") return UI.activeMessages[String(conv.id)] || conv.messages || [];
    return Array.isArray(conv.messages) ? conv.messages : [];
  }
  function twoInitials(name) {
    const w = String(name || "ف").trim().split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0].slice(0, 1) + "\u200c" + w[1].slice(0, 1) : (w[0] || "ف").slice(0, 1));
  }
  const QUICK_REPLIES = ["سلام، آگهی هنوز موجود است؟", "قیمت نهایی چقدر است؟", "امکان بازدید حضوری هست؟", "خودرو رنگ‌شدگی یا تصادف دارد؟"];
  function renderConversationScreen() {
    const route = activeRoute() || {};
    const id = String(route.conversationId || "");
    let conv = findConversation(id);
    if (MODE !== "api" && conv && String(conv.id) !== id) {
      const guard = "route:" + id;
      if (!UI.canonicalizingIds.has(guard)) {
        UI.canonicalizingIds.add(guard);
        const canonicalId = String(conv.id);
        setTimeout(() => {
          UI.canonicalizingIds.delete(guard);
          const current = activeRoute() || {};
          if (current.page === "conversation" && String(current.conversationId || "") === id) openRoute({ ...current, conversationId: canonicalId });
        }, 0);
      }
      const placeholder = document.createElement("section");
      placeholder.dataset.page = "conversation";
      placeholder.className = "mr-chat-conversation mr-cv";
      placeholder.innerHTML = skeletonBubbles();
      return placeholder;
    }
    if (MODE === "api" && id && !UI.activeMessages[id] && !UI.loadingIds.has(id) && (!UI.failedAt[id] || Date.now() - UI.failedAt[id] > 5000)) setTimeout(() => refreshApiConversation(id, false), 0);
    const listing = conv && (conv.listing || conv.listing_snapshot) || {};
    const other = conv && (conv.otherName || conv.sellerName || listing.sellerName) || "فروشنده خودرو";
    const messages = getConversationMessages(conv);
    const otherUnread = conversations().filter((c) => c.id !== id).reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);
    const ctxTitle = conv && !listing.storyChat ? listingTitle(conv) : "";
    if (UI.reply && UI.reply.conv !== id) UI.reply = null;
    const root = document.createElement("section");
    root.dataset.page = "conversation";
    root.className = "mr-chat-conversation mr-cv";
    root.innerHTML = `
${UI.error ? `<div class="mr-chat-inline-error">${escapeHTML(UI.error)}</div>` : ""}
      <div class="mr-cv-stage">
      <div class="mr-cv-history" data-slot="chat-messages">${conv ? (messages.length ? renderBubbles(messages) : startNoteMarkup() + (UI.typing[id] ? typingRowHTML() : "")) : `${skeletonBubbles()}`}</div>
      <div class="mr-cv-top">
      <header class="mr-cv-head">
        <button type="button" class="mr-cv-back" data-action="chatBack" aria-label="بازگشت"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>${otherUnread ? `<i>${FA(otherUnread)}</i>` : ""}</button>
        <button type="button" class="mr-cv-person" data-action="chatOpenSeller" data-listing-id="${escapeHTML(listing.id || (conv && conv.listing_id) || "")}" data-seller-id="${escapeHTML((conv && conv.otherUserId) || listing.sellerId || "")}" aria-label="مشاهده صفحه ${escapeHTML(other)}">
          <span class="mr-cv-avatar" style="--h:${hueOf(other)}">${convAvatar(conv) ? avatarImgMarkup(convAvatarInfo(conv)) : `<b>${escapeHTML(twoInitials(other))}</b>`}</span>
          <span class="mr-cv-name">${escapeHTML(other)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg></span>
        </button>
      </header>
      ${ctxTitle ? `<button type="button" class="mr-cv-ctx" data-action="chatOpenListing" data-listing-id="${escapeHTML(listing.id || (conv && conv.listing_id) || "")}">${escapeHTML(ctxTitle)}${listing.price || listing.priceAmount ? ` · ${escapeHTML(formatPrice(listing.price || listing.priceAmount || listing.price_amount))}` : ""}</button>` : ""}
      </div></div>
      <form class="mr-cv-composer" data-chat-form data-conversation-id="${escapeHTML(id)}">
        ${replyBarHTML()}
        <div class="mr-cv-quick" hidden>${QUICK_REPLIES.map((q) => `<button type="button" data-action="chatQuick" data-text="${escapeHTML(q)}">${escapeHTML(q)}</button>`).join("")}</div>
        <div class="mr-cv-composer-row">
          <button type="button" class="mr-cv-plus" data-action="chatPlus" aria-label="پیام‌های آماده" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg></button>
          <button type="button" class="mr-cv-plus mr-cv-attach-btn" data-action="chatAttach" aria-label="ارسال آگهی" ${conv ? "" : "disabled"}><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2"></rect><rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2"></rect><rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2"></rect><rect x="13" y="13" width="7.5" height="7.5" rx="2.2"></rect></svg></button>
          <div class="mr-cv-pill"><textarea name="message" rows="1" maxlength="3000" placeholder="پیام" aria-label="متن پیام" ${conv ? "" : "disabled"}></textarea><button type="submit" class="mr-cv-send" aria-label="ارسال پیام" ${conv ? "" : "disabled"}><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button><button type="button" class="mr-cv-pillbtn mr-cv-mic" data-action="chatMic" aria-label="ضبط پیام صوتی" ${conv ? "" : "disabled"}><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"></path></svg></button><button type="button" class="mr-cv-pillbtn mr-cv-cam" data-action="chatPhoto" aria-label="ارسال عکس" ${conv ? "" : "disabled"}><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="3.5"></rect><circle cx="9" cy="10.5" r="1.6"></circle><path d="m5 17 4.6-4.4a1.5 1.5 0 0 1 2.1 0L15 16l1.6-1.5a1.5 1.5 0 0 1 2 0L20.5 16"></path></svg></button></div>
        </div>
        <div class="mr-cv-rec" aria-live="polite"><button type="button" class="mr-cv-rec-x" data-action="chatRecCancel" aria-label="لغو ضبط"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3"></path></svg></button><div class="mr-cv-rec-mid"><i class="mr-cv-rec-dot" aria-hidden="true"></i><span class="mr-cv-rec-time">۰:۰۰</span><span class="mr-cv-rec-bars" aria-hidden="true">${"<i></i>".repeat(28)}</span></div><button type="button" class="mr-cv-rec-send" data-action="chatRecSend" aria-label="ارسال پیام صوتی"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button></div>
      </form>`;
    return root;
  }

  // The composer is fixed and the quick-reply tray grows upward over the messages;
  // give the history matching bottom padding so the last messages stay visible above it.
  function syncChatPad(form) {
    const hist = document.querySelector(".mr-cv-history"); if (!hist || !form) return;
    const tray = form.querySelector(".mr-cv-quick");
    const near = hist.scrollHeight - hist.scrollTop - hist.clientHeight < 200;
    const rb = form.querySelector(".mr-cv-replybar");
    hist.style.paddingBottom = (tray && !tray.hidden) || (rb && !rb.hidden) ? (form.offsetHeight + 28) + "px" : "";
    if (near) hist.scrollTop = hist.scrollHeight;
  }

  function openRoute(route) {
    stopPolling();
    if (typeof navigateTo === "function") navigateTo(route, { menuOpen: false });
    else { state = { ...state, route }; render(); }
    startPolling();
  }
  function localPersonKey(snapshot) {
    const s = snapshot || {};
    if (s.sellerUserId) return "user:" + String(s.sellerUserId);
    if (s.sellerPhone && !String(s.sellerPhone).startsWith("seller:")) return "phone:" + String(s.sellerPhone);
    if (s.sellerId) return "seller:" + String(s.sellerId);
    return "listing:" + String(s.id || "");
  }
  function localConversationMatchesPerson(conv, phone, snapshot) {
    if (!conv || !phone) return false;
    const currentKey = localPersonKey(snapshot);
    if (!currentKey || currentKey.startsWith("listing:")) return false;
    const oldSnapshot = conv.listing || {};
    const oldKey = localPersonKey(oldSnapshot);
    // Existing conversation where this account started as the buyer.
    if (conv.buyerPhone === phone) {
      return currentKey === oldKey || (!!snapshot.sellerPhone && String(conv.sellerPhone || "") === String(snapshot.sellerPhone));
    }
    // Reuse the same thread when this account was originally the seller and now
    // opens a listing/story from the other participant's profile.
    if (conv.sellerPhone === phone) {
      return !!snapshot.sellerPhone && String(conv.buyerPhone || "") === String(snapshot.sellerPhone);
    }
    return false;
  }
  function createLocalConversation(listing) {
    const phone = accountPhone();
    const snapshot = listingSnapshot(listing);
    if (!phone) throw new Error("برای شروع گفتگو وارد حساب خود شوید.");
    if ((snapshot.sellerPhone && snapshot.sellerPhone === phone) || (snapshot.sellerUserId && String(snapshot.sellerUserId) === String(window.CARMA_AUTH_USER?.id || ""))) throw new Error("نمی‌توانید به آگهی خودتان پیام بدهید.");
    const store = readStore();
    let conv = store.conversations.find((c) => localConversationMatchesPerson(c, phone, snapshot)) || store.conversations.find((c) => c.listingId === String(listing.id) && c.buyerPhone === phone);
    if (conv) {
      conv.listing = snapshot;
      conv.listingId = String(listing.id);
    }
    if (!conv) {
      conv = {
        id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        listingId: String(listing.id), listing: snapshot, buyerPhone: phone,
        buyerName: ((state.accountProfile && [state.accountProfile.firstName, state.accountProfile.lastName].filter(Boolean).join(" ")) || "خریدار").trim(),
        sellerPhone: snapshot.sellerPhone || `seller:${snapshot.sellerId || listing.brand || "car"}`,
        sellerName: snapshot.sellerName || "فروشنده خودرو", otherName: snapshot.sellerName || "فروشنده خودرو",
        createdAt: Date.now(), updatedAt: Date.now(), messages: [], unreadBy: {}
      };
      store.conversations.unshift(conv);
      writeStore(store);
    }
    return conv;
  }
  // Seller side: after accepting a price offer, open (or create) the chat with that buyer.
  async function connectWithBuyer(o) {
    const phone = accountPhone();
    if (!phone) { requireLogin(activeRoute()); return false; }
    if (MODE === "api") {
      const buyerId = String(o?.buyerId || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(buyerId)) {
        showToastSafe("شناسهٔ سروری خریدار در اعلان موجود نیست؛ گفتگو ایجاد نشد."); return false;
      }
      try {
        const conv = await API.direct(buyerId);
        UI.apiConversations = [conv, ...UI.apiConversations.filter((c) => String(c.id) !== String(conv.id))];
        UI.apiLoaded = true;
        openRoute({ page: "conversation", conversationId: conv.id });
        return true;
      } catch (err) { showToastSafe(err.message || "اتصال به خریدار انجام نشد."); return false; }
    }
    const listing = listingById(o.listingId);
    let snapshot; try { snapshot = listingSnapshot(listing || { id: o.listingId, title: "آگهی خودرو" }); } catch (_) { snapshot = { id: String(o.listingId), title: "آگهی خودرو", sellerName: "فروشنده خودرو", sellerType: "personal", sellerId: "", photos: [] }; }
    const store = readStore();
    let conv = store.conversations.find((c) => (c.buyerPhone === o.buyerPhone && c.sellerPhone === phone) || (c.buyerPhone === phone && c.sellerPhone === o.buyerPhone));
    if (!conv) {
      conv = { id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, listingId: String(o.listingId), listing: snapshot, buyerPhone: o.buyerPhone, buyerName: o.buyerName || "خریدار", sellerPhone: phone, sellerName: snapshot.sellerName || "فروشنده خودرو", otherName: o.buyerName || "خریدار", createdAt: Date.now(), updatedAt: Date.now(), messages: [], unreadBy: {} };
      store.conversations.unshift(conv);
    } else {
      // Keep the original participant orientation: flipping sellerPhone here could
      // turn a reused thread into a self-chat when it was first created the other way.
      conv.listing = snapshot; conv.listingId = String(o.listingId);
    }
    writeStore(store);
    openRoute({ page: "conversation", conversationId: conv.id });
    return true;
  }
  async function startListingChat(listingId) {
    if (!requireLogin(activeRoute())) { pendingListingId = String(listingId || ""); return; }
    const listing = listingById(listingId);
    if (!listing) { showToastSafe("آگهی برای شروع گفتگو پیدا نشد."); return; }
    try {
      let conv;
      if (MODE === "api") {
        const snapshot = listingSnapshot(listing);
        const targetId = String(snapshot.sellerUserId || "");
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId);
        if (isUuid && String(window.CARMA_AUTH_USER?.id || "") === targetId) throw new Error("نمی‌توانید به آگهی خودتان پیام بدهید.");
        conv = isUuid ? await API.direct(targetId) : await API.start(listing);
        if (!conv.id) throw new Error("پاسخ ساخت گفتگو شناسه ندارد.");
        conv.listing = snapshot;
        UI.apiConversations = [conv, ...UI.apiConversations.filter((c) => String(c.id) !== String(conv.id))];
        // Direct/listing creation responses may contain only conversation metadata.
        // Leave messages uncached so the conversation screen always loads full history.
        delete UI.activeMessages[String(conv.id)];
        delete UI.failedAt[String(conv.id)];
        UI.apiLoaded = true;
      } else {
        conv = createLocalConversation(listing);
      }
      openRoute({ page: "conversation", conversationId: conv.id });
    } catch (err) {
      showToastSafe(err.message || "شروع گفتگو انجام نشد.");
    }
  }
  // Reply to a story (js/27-stories.js): a direct chat with the story's owner,
  // not tied to any listing. One conversation per (me, story owner).
  async function replyToStory(o) {
    const phone = accountPhone();
    if (!phone) { requireLogin(activeRoute()); return false; }
    const text = String(o.text || "").trim();
    if (!text) return false;
    if (o.ownerPhone && o.ownerPhone === phone) return false;
    if (MODE === "api") {
      const targetId = String(o.ownerId || '').replace(/^(user:|personal:)/, '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
        showToastSafe("حساب صاحب این استوری به سرور متصل نیست؛ امکان ارسال پاسخ وجود ندارد."); return false;
      }
      try {
        const conv = await API.direct(targetId);
        // The direct endpoint returns the canonical conversation for this person pair.
        // Load its prior messages before appending the story reply so history is never lost.
        const previousMessages = await API.messages(conv.id);
        // Real stories are attached by id: the server stores a snapshot, so the story card shows in the chat for both people.
        const storyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(o.story?.id || "")) ? String(o.story.id) : "";
        const storyCaption = String(o.story?.caption || '').trim();
        const messageText = storyId ? text : (storyCaption ? `پاسخ به استوری «${storyCaption.slice(0, 40)}»:\n${text}` : `پاسخ به استوری:\n${text}`);
        const message = await API.send(conv.id, messageText, storyId);
        UI.activeMessages[conv.id] = [...previousMessages, message];
        delete UI.failedAt[String(conv.id)];
        conv.lastMessage = messageText; conv.updatedAt = message.createdAt || Date.now(); conv.messages = UI.activeMessages[conv.id];
        UI.apiConversations = [conv, ...UI.apiConversations.filter((c) => String(c.id) !== String(conv.id))];
        UI.apiLoaded = true;
        openRoute({ page: "conversation", conversationId: conv.id });
        return true;
      } catch (err) { showToastSafe(err.message || "پاسخ به استوری ارسال نشد."); return false; }
    }
    const store = readStore();
    const targetId = String(o.ownerId || "").replace(/^(dealer:|user:|personal:|brand:)/, "");
    const targetSnapshot = { id: "", title: "", storyChat: true, sellerId: targetId, sellerUserId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId) ? targetId : "", sellerName: o.ownerName || "کاربر", sellerType: o.ownerType || "personal", sellerPhone: o.ownerPhone || "" };
    const key = "person:" + localPersonKey(targetSnapshot).replace(/^user:/, "");
    let conv = store.conversations.find((c) => localConversationMatchesPerson(c, phone, targetSnapshot));
    if (!conv && o.ownerPhone) conv = store.conversations.find((c) => c.buyerPhone === phone && c.sellerPhone === o.ownerPhone);
    if (!conv) conv = store.conversations.find((c) => c.listingId === "story:" + o.ownerId && c.buyerPhone === phone);
    if (!conv) {
      const name = o.ownerName || "کاربر";
      conv = {
        id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        listingId: key,
        listing: targetSnapshot,
        buyerPhone: phone,
        buyerName: ((state.accountProfile && [state.accountProfile.firstName, state.accountProfile.lastName].filter(Boolean).join(" ")) || "کاربر").trim(),
        sellerPhone: o.ownerPhone || `seller:${targetId}`, sellerName: name, otherName: name,
        createdAt: Date.now(), updatedAt: Date.now(), messages: [], unreadBy: {}
      };
      store.conversations.unshift(conv);
    }
    const now = Date.now();
    conv.messages.push({ id: `msg_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`, senderPhone: phone, text, createdAt: now, story: o.story || null });
    conv.lastMessage = text; conv.updatedAt = now; conv.unreadBy = conv.unreadBy || {};
    conv.unreadBy[conv.sellerPhone] = Number(conv.unreadBy[conv.sellerPhone] || 0) + 1;
    conv.unreadBy[phone] = 0;
    if (!writeStore(store)) return false;
    updateChatDockBadge();
    openRoute({ page: "conversation", conversationId: conv.id });
    return true;
  }
  async function openChat(id) {
    if (!requireLogin({ page: "messages" })) return;
    const key = String(id || "");
    if (!key) { showToastSafe("شناسهٔ گفتگو معتبر نیست."); return; }
    if (UI.openingIds.has(key)) return;
    UI.openingIds.add(key);
    let routeKey = key;
    if (MODE === "api") {
      // Open the screen immediately (skeleton / cached messages); the conversation and its
      // messages load in the background via refreshApiConversation() instead of blocking the tap.
      const cached = findConversation(key);
      if (cached) cached.unreadCount = 0;
      delete UI.failedAt[key];
    } else {
      const store = readStore();
      const phone = accountPhone();
      const conv = store.conversations.find((c) => c.id === key);
      if (!conv || (conv.buyerPhone !== phone && conv.sellerPhone !== phone)) { showToastSafe("این گفتگو در دسترس حساب شما نیست."); UI.openingIds.delete(key); return; }
      const personKey = localConversationPersonKey(conv, phone);
      // Opening the canonical thread marks every legacy duplicate for this person read.
      store.conversations.filter((c) => (c.buyerPhone === phone || c.sellerPhone === phone) && localConversationPersonKey(c, phone) === personKey).forEach((c) => {
        c.unreadBy = c.unreadBy || {};
        c.unreadBy[phone] = 0;
      });
      writeStore(store);
      const canonical = myLocalConversations().find((c) => localConversationPersonKey(c, phone) === personKey);
      if (canonical) routeKey = String(canonical.id);
    }
    UI.error = "";
    UI.openingIds.delete(key);
    openRoute({ page: "conversation", conversationId: routeKey });
  }
  async function sendMessage(form, attach, media) {
    const textarea = form.querySelector("textarea[name='message']");
    const text = attach ? `آگهی: ${attach.title || "خودرو"}` : media ? String(media.caption || "").trim() : (textarea && textarea.value || "").trim();
    const preview = text || mediaLabel(media);
    const id = String(form.dataset.conversationId || "");
    if ((!text && !media) || !id) return;
    if (!accountPhone()) { requireLogin(activeRoute()); return; }
    if (UI.edit && UI.edit.conv === id && !attach && !media) { if (form.dataset.sending === "1") return; form.dataset.sending = "1"; try { await submitEdit(form, textarea, text, id); } finally { delete form.dataset.sending; } return; }
    if (form.dataset.sending === "1") return;
    form.dataset.sending = "1";
    const hadFocus = document.activeElement === textarea;
    const replyTo = UI.reply && UI.reply.conv === id ? { id: UI.reply.id, who: UI.reply.who, text: UI.reply.text } : null;
    try {
      if (MODE === "api") {
        const message = media ? await API.sendMedia(id, media) : await API.send(id, attach ? text + attToken(attach) : text);
        if (attach) {
          message.text = text; message.listing = attach;
          if (message.id && attach.id) { const r = attReg(); r[attach.id] = attach; attRegSave(r); }
        }
        if (replyTo) message.replyTo = replyTo;
        UI.activeMessages[id] = [...(UI.activeMessages[id] || []), message];
        const cached = UI.apiConversations.find((c) => String(c.id) === id);
        if (cached) {
          cached.lastMessage = preview; cached.last_message = preview;
          cached.updatedAt = message.createdAt || Date.now(); cached.updated_at = cached.updatedAt;
          cached.unreadCount = 0; cached.unread_count = 0; cached.messages = UI.activeMessages[id];
        }
      } else {
        const store = readStore();
        const conv = store.conversations.find((c) => c.id === id);
        if (!conv || (conv.buyerPhone !== accountPhone() && conv.sellerPhone !== accountPhone())) throw new Error("این گفتگو در دسترس نیست.");
        conv.messages = Array.isArray(conv.messages) ? conv.messages : [];
        const localMedia = media ? await localMediaSave(media) : null;
        const message = { id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, senderPhone: accountPhone(), text, createdAt: Date.now(), ...(attach ? { listing: attach } : {}), ...(localMedia ? { media: localMedia } : {}), ...(replyTo ? { replyTo } : {}) };
        conv.messages.push(message);
        conv.lastMessage = preview;
        conv.updatedAt = Date.now();
        conv.unreadBy = conv.unreadBy || {};
        const otherPhone = conv.buyerPhone === accountPhone() ? conv.sellerPhone : conv.buyerPhone;
        conv.unreadBy[otherPhone] = Number(conv.unreadBy[otherPhone] || 0) + 1;
        conv.unreadBy[accountPhone()] = 0;
        writeStore(store);
        try { if (window.MR_NOTIFS && otherPhone && otherPhone !== accountPhone()) {
          const mine = [conv.buyerName, conv.sellerName].filter(Boolean);
          const fromName = conv.buyerPhone === accountPhone() ? (conv.buyerName || "خریدار") : (conv.sellerName || "فروشنده");
          const prev = window.MR_NOTIFS.list(otherPhone).find((n) => n.type === "message" && !n.read && n.data && n.data.conversationId === conv.id);
          const cnt = prev ? (prev.data.count || 1) + 1 : 1;
          const patch = { title: "پیام جدید از " + fromName, body: cnt > 1 ? cnt + " پیام جدید: " + preview.slice(0, 60) : preview.slice(0, 80), at: Date.now(), data: { conversationId: conv.id, count: cnt, listingId: conv.listingId, whoId: (typeof sellerIdForPhone === "function" ? sellerIdForPhone(accountPhone()) : ""), whoKind: (conv.sellerPhone === accountPhone() && conv.listing && conv.listing.sellerType === "dealer") ? "d" : "p", who: fromName } };
          if (prev) window.MR_NOTIFS.update(prev.id, patch); else window.MR_NOTIFS.push(otherPhone, Object.assign({ type: "message", icon: "msg", route: { page: "conversation", conversationId: conv.id } }, patch));
        } } catch (_) {}
      }
      UI.error = "";
      if (typingSentFor) { clearTimeout(typingStopTimer); sendTypingState(typingSentFor, false); typingSentFor = ""; lastTypingSent = 0; }
      if (replyTo) clearReply(form);
      // Update in place instead of re-rendering the whole page: the textarea stays
      // mounted and focused, so the on-screen keyboard does not close and reopen.
      const box = document.querySelector('[data-page="conversation"] [data-slot="chat-messages"]');
      const conv = findConversation(id);
      if (box && conv && form.isConnected) {
        const messages = getConversationMessages(conv);
        box.innerHTML = messages.length ? renderBubbles(messages) : startNoteMarkup();
        box.dataset.sig = msgSig(messages);
        if (textarea && !attach && !media) { textarea.value = ""; textarea.style.height = "auto"; form.classList.remove("has-text"); }
        box.scrollTop = box.scrollHeight;
        updateChatDockBadge();
        if (hadFocus && textarea) textarea.focus({ preventScroll: true });
      } else {
        render();
        requestAnimationFrame(() => {
          const b = document.querySelector('[data-slot="chat-messages"]');
          if (b) b.scrollTop = b.scrollHeight;
          const next = document.querySelector("[data-chat-form] textarea");
          if (next && hadFocus) next.focus({ preventScroll: true });
        });
      }
    } catch (err) { showToastSafe(err.message || "ارسال پیام انجام نشد."); }
    finally { delete form.dataset.sending; }
  }
  const DEMO_DOCK_UNREAD = 0; // demo badge removed: the dock badge now shows the real, live unread count
  function chatUnreadCount() {
    return conversations().reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);
  }
  function updateChatDockBadge() {
    const dockBtn = document.querySelector('#bottomDock [data-dock="messages"]');
    if (!dockBtn) return;
    const count = chatUnreadCount() || DEMO_DOCK_UNREAD; // demo: show a fake unread count when there are no real unread chats
    const badge = dockBtn.querySelector(".mr-chat-dock-badge");
    if (badge) {
      const txt = count > 9 ? "۹+" : new Intl.NumberFormat("fa-IR").format(count);
      const changed = badge.textContent !== txt || badge.hidden !== (count < 1);
      badge.hidden = count < 1; badge.textContent = txt;
      if (changed && count > 0) { badge.classList.remove("is-pop"); void badge.offsetWidth; badge.classList.add("is-pop"); }
    }
  }
  function afterMarqueRender() {
    updateChatDockBadge();
    const route = activeRoute();
    if (pendingListingId && accountPhone() && route && route.page === "vehicle") {
      const id = pendingListingId; pendingListingId = null;
      setTimeout(() => startListingChat(id), 80);
    }
    if (route && route.page === "messages") {
      const input = document.getElementById("mrChatSearch");
      if (input && !input.dataset.bound) {
        input.dataset.bound = "1";
        input.addEventListener("input", () => {
          UI.search = input.value;
          const clear = document.querySelector(".mr-msg-search [data-action='chatClearSearch']");
          if (clear) clear.hidden = !UI.search;
          const slot = document.querySelector('[data-page="messages"] [data-slot="chat-list"]');
          if (slot) slot.innerHTML = renderInboxRows();
        });
      }
    }
    if (route && route.page === "conversation") requestAnimationFrame(() => {
      const box = document.querySelector('[data-slot="chat-messages"]');
      if (box && !box.dataset.initialized) { box.dataset.initialized = "1"; box.scrollTop = box.scrollHeight; }
    });
    startPolling();
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function startPolling() {
    if (MODE !== "api" || pollTimer) return;
    const tick = async () => {
      const route = activeRoute();
      if (pollBusy && route && ["messages", "conversation"].includes(route.page)) { pollRerun = true; return; }
      if (document.hidden || !accountPhone() || pollBusy || !route || !["messages", "conversation"].includes(route.page)) return;
      pollBusy = true;
      try {
        if (route.page === "messages") {
          UI.apiConversations = await API.list(); UI.apiLoaded = true;
          const slot = document.querySelector('[data-page="messages"] [data-slot="chat-list"]');
          if (slot) slot.innerHTML = renderInboxRows();
          updateChatDockBadge();
        } else {
          const id = String(route.conversationId || "");
          if (!id) return;
          UI.activeMessages[id] = await API.messages(id);
          const latest = UI.activeMessages[id][UI.activeMessages[id].length - 1];
          const cached = UI.apiConversations.find((c) => String(c.id) === id);
          if (cached && latest) { cached.lastMessage = latest.text; cached.last_message = latest.text; cached.updatedAt = latest.createdAt || cached.updatedAt; cached.updated_at = cached.updatedAt; }
          const box = document.querySelector('[data-page="conversation"] [data-slot="chat-messages"]');
          const conv = findConversation(id);
          if (box && conv) {
            const messages = getConversationMessages(conv);
            const sig = msgSig(messages);
            if (box.dataset.sig !== sig) {
              const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
              const lastMsg = messages[messages.length - 1];
              if (lastMsg && !msgIsMine(lastMsg) && UI.typing[id]) { UI.typing[id] = false; }  // their message arrived
              if (lastMsg && !msgIsMine(lastMsg) && !document.hidden) API.read(id).catch(() => {});  // I'm looking at it -> they see "seen"
              box.innerHTML = messages.length ? renderBubbles(messages) : startNoteMarkup();
              box.dataset.sig = sig;
              if (wasNearBottom) box.scrollTop = box.scrollHeight;
            } else updateReceipt(id);
          }
        }
      } catch (_) {} finally { pollBusy = false; if (pollRerun) { pollRerun = false; setTimeout(tick, 0); } }
    };
    pollNow = tick;
    pollTimer = setInterval(tick, 10000);
  }
  // Live updates (server push, js/47-live.js): refresh immediately instead of waiting for the next poll.
  let pollNow = null, pollRerun = false;
  window.addEventListener("carma:live", (e) => {
    if (!e.detail || e.detail.t !== "messages") return;
    if (pollNow) pollNow();
    if (typeof pollMessageAlerts === "function") pollMessageAlerts();
  });

  // ---- Reply to a message: swipe a bubble sideways. Double-tap a bubble to like it. ----
  function clearReply(form) {
    UI.reply = null;
    if (UI.edit) {
      UI.edit = null;
      const f = form || document.querySelector("form[data-chat-form]"), ta = f && f.querySelector("textarea");
      if (ta) { ta.value = ""; ta.style.height = "auto"; f.classList.remove("has-text"); }
    }
    const bar = (form || document).querySelector(".mr-cv-replybar"); if (bar) bar.hidden = true;
    syncChatPad(form || document.querySelector("form[data-chat-form]"));
  }
  function startReply(row) {
    const form = document.querySelector("form[data-chat-form]"); if (!form || !row) return;
    if (UI.edit) clearReply(form);
    const id = String(form.dataset.conversationId || "");
    const mid = row.dataset.mid; if (!mid) return;
    const conv = findConversation(id);
    const m = getConversationMessages(conv).find((x) => String(x.id) === String(mid)); if (!m) return;
    UI.reply = { conv: id, id: mid, who: replyWho(m, conv), text: msgPreview(m) };
    const bar = form.querySelector(".mr-cv-replybar");
    if (bar) { bar.hidden = false; bar.querySelector("b").textContent = "پاسخ به " + UI.reply.who; bar.querySelector("small").textContent = UI.reply.text; }
    const ta = form.querySelector("textarea"); if (ta) ta.focus({ preventScroll: true });
    syncChatPad(form);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {}
  }
  (function bindReplyGestures() {
    let row = null, x0 = 0, y0 = 0, dx = 0, active = false, fired = false, x1 = 0, y1 = 0, lastTap = null, lastLikeAt = 0, lpTimer = null;
    const cancelLP = () => { clearTimeout(lpTimer); lpTimer = null; };
    const TH = 58;
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const r = e.target.closest && e.target.closest(".mr-cv-history .mr-cv-row[data-mid]");
      if (!r || e.target.closest(".mr-cv-quote, .mr-cv-vplay")) return;
      row = r; x0 = x1 = e.clientX; y0 = y1 = e.clientY; dx = 0; active = false; fired = false;
      cancelLP();
      lpTimer = setTimeout(() => { lpTimer = null; if (row === r && !active) { row = null; lastTap = null; try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {} openMsgMenu(r); } }, 480);
    });
    document.addEventListener("pointermove", (e) => {
      if (!row) return;
      x1 = e.clientX; y1 = e.clientY;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (Math.hypot(mx, my) > 10) cancelLP();
      if (!active) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.6) { active = true; row.classList.add("is-swiping"); } else if (Math.abs(my) > 12) { row = null; return; } else return; }
      dx = Math.max(-80, Math.min(80, mx));
      row.style.setProperty("--sw", dx + "px");
      row.classList.toggle("is-armed", Math.abs(dx) >= TH);
      if (Math.abs(dx) >= TH && !fired) { fired = true; try { if (navigator.vibrate) navigator.vibrate(6); } catch (_) {} }
    });
    const end = () => {
      cancelLP();
      if (!row) return;
      const r = row; row = null;
      const go = active && Math.abs(dx) >= TH;
      r.classList.remove("is-swiping", "is-armed"); r.style.removeProperty("--sw");
      if (go) { startReply(r); lastTap = null; return; }
      if (active || !r.querySelector(".mr-cv-bubble")) return;
      const t = Date.now();
      if (lastTap && lastTap.row === r && t - lastTap.t < 340 && Math.hypot(x1 - lastTap.x, y1 - lastTap.y) < 28) { lastTap = null; lastLikeAt = t; toggleLike(r); }
      else lastTap = { row: r, t, x: x1, y: y1 };
    };
    document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
    document.addEventListener("contextmenu", (e) => {
      const r = e.target.closest && e.target.closest(".mr-cv-history .mr-cv-row[data-mid]");
      if (!r || !r.querySelector(".mr-cv-bubble")) return;
      e.preventDefault();
      if (Date.now() - lastMenuAt > 800) openMsgMenu(r);
    });
    document.addEventListener("dblclick", (e) => {
      const r = e.target.closest && e.target.closest(".mr-cv-history .mr-cv-row[data-mid]");
      if (!r || e.target.closest(".mr-cv-quote")) return;
      try { window.getSelection && window.getSelection().removeAllRanges(); } catch (_) {}
      // touch double-taps are already handled on pointerup; this covers desktop mice
      if (Date.now() - lastLikeAt > 600) { lastLikeAt = Date.now(); toggleLike(r); }
    });
  })();
  document.addEventListener("click", function (event) {
    const a = event.target.closest("[data-action]"); if (!a) return;
    if (a.dataset.action === "chatReplyCancel") { event.preventDefault(); clearReply(a.closest("form")); }
    else if (a.dataset.action === "chatJumpTo") {
      event.preventDefault();
      const t = Array.from(document.querySelectorAll(".mr-cv-history .mr-cv-row[data-mid]")).find((r) => r.dataset.mid === a.dataset.mid);
      if (t) { t.scrollIntoView({ block: "center", behavior: "smooth" }); t.classList.add("is-flash"); setTimeout(() => t.classList.remove("is-flash"), 1300); }
    }
  });

  // ---- long-press an inbox chat -> "حذف گفتگو" (deleted for me only) ----
  (function bindInboxDelete() {
    let timer = null, startX = 0, startY = 0, lastOpen = 0, target = null;
    const SEL = '.mr-msg-row[data-action="openChat"], .mr-msg-story[data-action="openChat"]';
    function nameOf(el) {
      const b = el.querySelector(".mr-msg-copy b"); if (b && b.textContent.trim()) return b.textContent.trim();
      const a = (el.getAttribute("aria-label") || "").split(" - ")[0].trim(); if (a) return a;
      const s = el.querySelector("small"); return (s && s.textContent.trim()) || "این گفتگو";
    }
    function closeSheet() { const b = document.querySelector(".mr-cd-back"); if (b) { b.classList.remove("is-open"); setTimeout(() => b.remove(), 220); } }
    async function removeConversation(id) {
      try {
        if (MODE === "api") { await API.removeConv(id); UI.apiConversations = (UI.apiConversations || []).filter((c) => String(c.id) !== String(id)); }
        else { const st = readStore(); st.conversations = st.conversations.filter((c) => String(c.id) !== String(id)); writeStore(st); }
        delete UI.activeMessages[String(id)]; delete UI.failedAt[String(id)];
        showToastSafe("گفتگو حذف شد.");
        if (typeof render === "function") render();
      } catch (err) { showToastSafe((err && err.message) || "حذف گفتگو انجام نشد."); }
    }
    function openSheet(el) {
      const id = String(el.dataset.id || ""); if (!id) return;
      closeSheet(); lastOpen = Date.now();
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
      const back = document.createElement("div");
      back.className = "mr-cd-back"; back.setAttribute("dir", "rtl");
      back.innerHTML = `<div class="mr-cd-card" role="dialog" aria-modal="true"><div class="mr-cd-grab"></div><p class="mr-cd-name">${escapeHTML(nameOf(el))}</p><button type="button" class="mr-cd-btn is-danger" data-cd="del"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3"></path></svg><span>حذف گفتگو</span></button><small class="mr-cd-note" hidden>این گفتگو فقط از فهرست تو پاک می‌شود و برای طرف مقابل باقی می‌ماند. اگر پیام تازه‌ای بفرستد دوباره ظاهر می‌شود.</small><button type="button" class="mr-cd-btn" data-cd="cancel">انصراف</button></div>`;
      document.body.appendChild(back);
      requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add("is-open")));
      back.addEventListener("click", (e) => {
        if (Date.now() - lastOpen < 700) return;
        if (e.target === back) { closeSheet(); return; }
        const b = e.target.closest("[data-cd]"); if (!b) return;
        if (b.dataset.cd === "cancel") { closeSheet(); return; }
        if (!b.classList.contains("is-confirm")) { b.classList.add("is-confirm"); b.querySelector("span").textContent = "تأیید حذف گفتگو"; back.querySelector(".mr-cd-note").hidden = false; return; }
        closeSheet(); removeConversation(id);
      });
    }
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = e.target.closest && e.target.closest(SEL); if (!el) return;
      target = el; startX = e.clientX; startY = e.clientY; clearTimeout(timer);
      timer = setTimeout(() => { timer = null; if (target === el) openSheet(el); }, 520);
    });
    document.addEventListener("pointermove", (e) => { if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) { clearTimeout(timer); timer = null; } });
    ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, () => { clearTimeout(timer); timer = null; }));
    document.addEventListener("contextmenu", (e) => {
      const el = e.target.closest && e.target.closest(SEL); if (!el) return;
      e.preventDefault(); if (Date.now() - lastOpen > 800) openSheet(el);
    });
    // the click that follows a long-press must not open the chat
    document.addEventListener("click", (e) => {
      if (Date.now() - lastOpen < 700 && !(e.target.closest && e.target.closest(".mr-cd-back"))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
    window.addEventListener("popstate", closeSheet);
  })();

  // ---- Photos, voice messages and story cards ----
  // Local preview keeps the files in IndexedDB (localStorage would fill up after a few photos);
  // API mode uploads them to POST /messages/conversations/:id/media and renders the URLs the server returns.
  const MEDIA_LABEL = { image: "📷 عکس", voice: "🎤 پیام صوتی" };
  function mediaLabel(media) { return (media && MEDIA_LABEL[media.type]) || ""; }
  function safeMediaURL(u) {
    const s = String(u || "").trim();
    if (!s || s.startsWith("//")) return "";
    if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return /^(https?:|blob:|data:image\/(png|jpe?g|webp|gif);)/i.test(s) ? s : "";
    return s;
  }
  function normMedia(x) {
    if (!x || typeof x !== "object") return null;
    const url = safeMediaURL(x.url);
    if (!url || (x.type !== "image" && x.type !== "voice")) return null;
    return { type: x.type, url, w: Number(x.w) || 0, h: Number(x.h) || 0, dur: Number(x.dur) || 0, wave: Array.isArray(x.wave) ? x.wave : null, mime: String(x.mime || "") };
  }
  function normStory(x) {
    if (!x || typeof x !== "object") return null;
    return { id: String(x.id || ""), thumb: safeMediaURL(x.thumb), caption: String(x.caption || "").slice(0, 80) };
  }
  const fmtDur = (sec) => { const t = Math.max(0, Math.round(Number(sec) || 0)), s = t % 60; return `${FA(Math.floor(t / 60))}:${s < 10 ? "۰" : ""}${FA(s)}`; };
  function voiceExt(mime) { return /mp4|m4a|aac/i.test(mime || "") ? "m4a" : /ogg/i.test(mime || "") ? "ogg" : "webm"; }

  // IndexedDB blob store for local-preview media.
  const LM = { db: null, urls: new Map(), pending: new Map() };
  function lmOpen() {
    if (LM.db) return Promise.resolve(LM.db);
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("no-idb"));
      const rq = indexedDB.open("carmaa_chat_media", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("blobs");
      rq.onsuccess = () => { LM.db = rq.result; resolve(LM.db); };
      rq.onerror = () => reject(rq.error);
    });
  }
  async function lmPut(id, blob) {
    const db = await lmOpen();
    await new Promise((resolve, reject) => { const tx = db.transaction("blobs", "readwrite"); tx.objectStore("blobs").put(blob, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    LM.urls.set(id, URL.createObjectURL(blob));
  }
  function lmLoad(id) {
    if (LM.urls.has(id)) return Promise.resolve(LM.urls.get(id));
    if (LM.pending.has(id)) return LM.pending.get(id);
    const job = lmOpen().then((db) => new Promise((resolve) => {
      const rq = db.transaction("blobs").objectStore("blobs").get(id);
      rq.onsuccess = () => { const b = rq.result; if (!b) return resolve(""); const u = URL.createObjectURL(b); LM.urls.set(id, u); resolve(u); };
      rq.onerror = () => resolve("");
    })).catch(() => "").then((u) => { LM.pending.delete(id); if (u) document.querySelectorAll(`img[data-lmedia="${CSS.escape(id)}"]`).forEach((el) => { el.src = u; }); return u; });
    LM.pending.set(id, job);
    return job;
  }
  // Synchronous URL for rendering: the real URL, a cached local blob URL, or "" while a local blob is still loading.
  function mediaURL(media) {
    if (!media) return "";
    if (media.url) return safeMediaURL(media.url);
    if (!media.lid) return "";
    if (LM.urls.has(media.lid)) return LM.urls.get(media.lid);
    lmLoad(media.lid);
    return "";
  }
  async function localMediaSave(media) {
    const lid = `lm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try { await lmPut(lid, media.blob); } catch (_) { throw new Error("ذخیرهٔ فایل در مرورگر ممکن نشد."); }
    return { type: media.type, lid, w: media.w || 0, h: media.h || 0, dur: media.dur || 0, wave: media.wave || null, mime: media.blob.type || media.mime || "" };
  }
  function currentMessages() { const c = chatFormInfo(); return c && c.messages ? c.messages : []; }

  // ---- rendering ----
  function pseudoWave(seed) {
    let h = 2166136261; const s = String(seed || "x");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Array.from({ length: 32 }, () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return 2 + (h % 8); });
  }
  const ICON_PLAY = `<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"></path></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"></path></svg>`;
  function voiceHTML(m) {
    const md = m.media, id = String(m.id || md.lid || "");
    const wave = (md.wave && md.wave.length ? md.wave : pseudoWave(id)).slice(0, 40);
    const bars = wave.map((v) => `<i style="--v:${Math.max(1, Math.min(9, Number(v) || 1))}"></i>`).join("");
    return `<div class="mr-cv-voice" data-vid="${escapeHTML(id)}" data-dur="${Number(md.dur) || 0}"><button type="button" class="mr-cv-vplay" data-action="chatVoicePlay" data-mid="${escapeHTML(id)}" aria-label="پخش پیام صوتی">${ICON_PLAY}</button><span class="mr-cv-vwave" aria-hidden="true">${bars}</span><small class="mr-cv-vtime">${fmtDur(md.dur)}</small></div>`;
  }
  function imageHTML(m) {
    const md = m.media, w = Number(md.w) || 4, h = Number(md.h) || 3, url = mediaURL(md);
    return `<button type="button" class="mr-cv-img" data-action="chatViewImage" data-mid="${escapeHTML(String(m.id || ""))}" style="aspect-ratio:${w} / ${h}" aria-label="مشاهدهٔ عکس"><img ${url ? `src="${escapeHTML(url)}"` : `data-lmedia="${escapeHTML(md.lid || "")}"`} alt="" decoding="async" /></button>`;
  }
  // The story a reply refers to is shown as its own card right above the reply (like Instagram DMs).
  function storyCardHTML(m, mine) {
    const s = m.story, thumb = safeMediaURL(s.thumb);
    return `<div class="mr-cv-row mr-cv-storyrow ${mine ? "is-mine" : "is-theirs"}"><div class="mr-cv-storybox"><span class="mr-cv-storybox-label">${mine ? "پاسخ شما به استوری" : "پاسخ به استوری شما"}</span><span class="mr-cv-storybox-frame">${thumb ? `<img src="${escapeHTML(thumb)}" alt="" decoding="async" />` : ""}${s.caption ? `<em>${escapeHTML(s.caption)}</em>` : ""}</span></div></div>`;
  }

  // ---- voice playback (one player for the whole chat; the UI re-syncs from it on every timeupdate) ----
  const VP = { audio: null, mid: "" };
  function voiceStop() {
    if (VP.audio) { try { VP.audio.pause(); } catch (_) {} VP.audio = null; VP.mid = ""; }
    voiceSync();
  }
  function voiceSync() {
    if (VP.audio && !document.querySelector(`.mr-cv-voice[data-vid="${CSS.escape(VP.mid)}"]`)) { try { VP.audio.pause(); } catch (_) {} VP.audio = null; VP.mid = ""; }
    document.querySelectorAll(".mr-cv-voice").forEach((el) => {
      const on = !!(VP.audio && el.dataset.vid === VP.mid);
      const bars = el.querySelectorAll(".mr-cv-vwave i"), stored = Number(el.dataset.dur) || 0;
      const dur = stored || (on && isFinite(VP.audio.duration) ? VP.audio.duration : 0);
      const n = on && dur ? Math.min(bars.length, Math.round((VP.audio.currentTime / dur) * bars.length)) : 0;
      el.classList.toggle("is-playing", on && !VP.audio.paused);
      bars.forEach((b, i) => b.classList.toggle("is-on", i < n));
      const t = el.querySelector(".mr-cv-vtime"); if (t) t.textContent = fmtDur(on && VP.audio.currentTime ? VP.audio.currentTime : stored);
    });
  }
  async function voicePlay(mid) {
    if (!mid) return;
    if (VP.audio && VP.mid === mid) { if (VP.audio.paused) VP.audio.play().catch(() => {}); else VP.audio.pause(); voiceSync(); return; }
    const m = currentMessages().find((x) => String(x.id) === String(mid));
    if (!m || !m.media) return;
    voiceStop();
    let url = mediaURL(m.media);
    if (!url && m.media.lid) url = await lmLoad(m.media.lid);
    if (!url) { showToastSafe("فایل صوتی پیدا نشد."); return; }
    const a = new Audio(url); a.preload = "auto";
    VP.audio = a; VP.mid = String(mid);
    a.addEventListener("timeupdate", voiceSync); a.addEventListener("play", voiceSync); a.addEventListener("pause", voiceSync);
    a.addEventListener("ended", () => { if (VP.audio === a) { VP.audio = null; VP.mid = ""; } voiceSync(); });
    a.addEventListener("error", () => { if (VP.audio === a) { VP.audio = null; VP.mid = ""; } voiceSync(); showToastSafe("پخش پیام صوتی انجام نشد."); });
    a.play().catch(() => { if (VP.audio === a) { VP.audio = null; VP.mid = ""; } voiceSync(); showToastSafe("پخش پیام صوتی انجام نشد."); });
    voiceSync();
  }

  // ---- full-screen photo viewer ----
  function closeImageViewer() { const el = document.getElementById("mrImgViewer"); if (el) el.remove(); }
  async function openImageViewerFor(mid) {
    const m = currentMessages().find((x) => String(x.id) === String(mid));
    if (!m || !m.media) return;
    const url = mediaURL(m.media) || (m.media.lid ? await lmLoad(m.media.lid) : "");
    if (!url) return;
    closeImageViewer();
    const el = document.createElement("div"); el.id = "mrImgViewer"; el.className = "mr-iv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "عکس");
    el.innerHTML = `<button type="button" class="mr-iv-x" aria-label="بستن"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"></path></svg></button><img alt="" />`;
    el.querySelector("img").src = url;
    el.addEventListener("click", closeImageViewer);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-open"));
  }

  // ---- picking a photo: resize in the browser, preview with an optional caption, then send ----
  async function prepImage(file) {
    if (!/^image\//i.test(file.type || "")) throw new Error("فقط فایل تصویر قابل ارسال است.");
    if (file.size > 30 * 1024 * 1024) throw new Error("حجم این عکس بیش از حد مجاز است.");
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (_) {
      src = await new Promise((resolve, reject) => {
        const u = URL.createObjectURL(file), im = new Image();
        im.onload = () => { URL.revokeObjectURL(u); resolve(im); };
        im.onerror = () => { URL.revokeObjectURL(u); reject(new Error("این عکس خوانده نشد.")); };
        im.src = u;
      });
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    if (!w0 || !h0) throw new Error("این عکس خوانده نشد.");
    const k = Math.min(1, 1600 / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("آماده‌سازی عکس انجام نشد.");
    return { blob, w, h };
  }
  function pickPhoto(form) {
    if (!form) return;
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.hidden = true;
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0]; inp.remove();
      if (!f) return;
      try { openPhotoPreview(form, await prepImage(f)); } catch (err) { showToastSafe(err.message || "این عکس قابل ارسال نیست."); }
    });
    inp.addEventListener("cancel", () => inp.remove());
    document.body.appendChild(inp); inp.click();
  }
  function closePhotoPreview() {
    const el = document.getElementById("mrPhotoPreview"); if (!el) return;
    try { URL.revokeObjectURL(el._url); } catch (_) {}
    el.remove();
  }
  function openPhotoPreview(form, prepared) {
    closePhotoPreview();
    const url = URL.createObjectURL(prepared.blob);
    const el = document.createElement("div"); el.id = "mrPhotoPreview"; el.className = "mr-pv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "ارسال عکس");
    el.innerHTML = `<div class="mr-pv-stage"><img src="${url}" alt="پیش‌نمایش عکس" /></div><div class="mr-pv-bar"><button type="button" class="mr-pv-x" data-pv="close" aria-label="انصراف"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"></path></svg></button><input type="text" class="mr-pv-cap" maxlength="1000" placeholder="توضیح (اختیاری)" aria-label="توضیح عکس" /><button type="button" class="mr-pv-send" data-pv="send" aria-label="ارسال عکس"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button></div>`;
    el._url = url; el._form = form; el._prepared = prepared;
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-pv]"); if (!b) return; if (b.dataset.pv === "close") closePhotoPreview(); else sendPhotoPreview(); });
    el.querySelector(".mr-pv-cap").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendPhotoPreview(); } });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-open"));
  }
  async function sendPhotoPreview() {
    const el = document.getElementById("mrPhotoPreview"); if (!el || el.dataset.busy) return;
    el.dataset.busy = "1";
    const form = el._form && el._form.isConnected ? el._form : document.querySelector("form[data-chat-form]");
    const p = el._prepared, caption = (el.querySelector(".mr-pv-cap").value || "").trim();
    closePhotoPreview();
    if (form) await sendMessage(form, null, { type: "image", blob: p.blob, w: p.w, h: p.h, caption, mime: "image/jpeg" });
  }

  // ---- recording a voice message (tap the mic, then send or cancel) ----
  const REC_MAX = 180;
  const REC = { active: false, rec: null, stream: null, chunks: [], t0: 0, timer: null, peaks: [], levels: [], ctx: null, analyser: null, buf: null, form: null, mime: "", sendOnStop: false };
  function recMime() {
    for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {}
    }
    return "";
  }
  function recCleanup() {
    clearInterval(REC.timer);
    try { REC.stream && REC.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { REC.ctx && REC.ctx.close(); } catch (_) {}
    if (REC.form) REC.form.classList.remove("is-recording");
    Object.assign(REC, { active: false, rec: null, stream: null, chunks: [], timer: null, peaks: [], levels: [], ctx: null, analyser: null, buf: null, form: null, mime: "", sendOnStop: false });
  }
  function recTick() {
    if (!REC.active) return;
    if (!REC.form || !REC.form.isConnected) { recStop(false); return; }
    const sec = (Date.now() - REC.t0) / 1000;
    const timeEl = REC.form.querySelector(".mr-cv-rec-time"); if (timeEl) timeEl.textContent = fmtDur(sec);
    let level = 0.15;
    if (REC.analyser) {
      try { REC.analyser.getByteTimeDomainData(REC.buf); let p = 0; for (let i = 0; i < REC.buf.length; i++) p = Math.max(p, Math.abs(REC.buf[i] - 128)); level = Math.min(1, p / 90); } catch (_) {}
    }
    REC.peaks.push(level); REC.levels.push(level); if (REC.levels.length > 28) REC.levels.shift();
    REC.form.querySelectorAll(".mr-cv-rec-bars i").forEach((b, i) => { const v = REC.levels[REC.levels.length - 28 + i]; b.style.height = (4 + (v == null ? 0 : v) * 20) + "px"; });
    if (sec >= REC_MAX) recStop(true);
  }
  async function recStart(form) {
    if (REC.active || !form) return;
    if (!accountPhone()) { requireLogin(activeRoute()); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { showToastSafe("مرورگر شما ضبط صدا را پشتیبانی نمی‌کند."); return; }
    if (window.isSecureContext === false) { showToastSafe("ضبط صدا فقط روی اتصال امن (HTTPS) کار می‌کند."); return; }
    REC.active = true; // block double taps while the permission prompt is open
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (_) { REC.active = false; showToastSafe("دسترسی به میکروفون داده نشد. آن را در تنظیمات مرورگر فعال کنید."); return; }
    if (!form.isConnected) { stream.getTracks().forEach((t) => t.stop()); REC.active = false; return; }
    const mime = recMime();
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); }
    catch (_) { stream.getTracks().forEach((t) => t.stop()); REC.active = false; showToastSafe("ضبط صدا در این مرورگر شروع نشد."); return; }
    voiceStop();
    Object.assign(REC, { rec, stream, chunks: [], t0: Date.now(), peaks: [], levels: [], form, mime: rec.mimeType || mime || "audio/webm", sendOnStop: false });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    rec.onstop = recFinish;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      REC.ctx = new AC(); if (REC.ctx.resume) REC.ctx.resume();
      const src = REC.ctx.createMediaStreamSource(stream); REC.analyser = REC.ctx.createAnalyser(); REC.analyser.fftSize = 256;
      REC.buf = new Uint8Array(REC.analyser.fftSize); src.connect(REC.analyser);
    } catch (_) { REC.analyser = null; }
    const ta = form.querySelector("textarea"); if (ta) ta.blur();
    rec.start(250);
    form.classList.add("is-recording");
    REC.timer = setInterval(recTick, 100);
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {}
  }
  function recStop(send) {
    if (!REC.active || !REC.rec) { if (REC.active && !REC.rec) REC.active = false; return; }
    REC.sendOnStop = !!send;
    clearInterval(REC.timer);
    try { if (REC.rec.state !== "inactive") REC.rec.stop(); else recFinish(); } catch (_) { recFinish(); }
  }
  function buildWave(peaks, n) {
    if (!peaks.length) return null;
    let max = 0.05; for (const p of peaks) if (p > max) max = p;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * peaks.length / n), b = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n));
      let s = 0; for (let j = a; j < b && j < peaks.length; j++) s = Math.max(s, peaks[j]);
      out.push(Math.max(1, Math.min(9, Math.round((s / max) * 9))));
    }
    return out;
  }
  function recFinish() {
    const { chunks, form, mime, t0, peaks, sendOnStop } = REC;
    const dur = (Date.now() - t0) / 1000;
    recCleanup();
    if (!sendOnStop) return;
    if (dur < 1) { showToastSafe("پیام صوتی خیلی کوتاه است."); return; }
    const blob = new Blob(chunks, { type: String(mime || "audio/webm").split(";")[0] });
    if (!blob.size) { showToastSafe("صدایی ضبط نشد."); return; }
    const f = form && form.isConnected ? form : document.querySelector("form[data-chat-form]");
    if (f) sendMessage(f, null, { type: "voice", blob, dur: Math.min(REC_MAX, dur), wave: buildWave(peaks, 40), mime: blob.type });
  }

  document.addEventListener("click", function (event) {
    const a = event.target.closest && event.target.closest("[data-action]"); if (!a) return;
    const act = a.dataset.action;
    if (act === "chatPhoto") { event.preventDefault(); pickPhoto(a.closest("form")); }
    else if (act === "chatMic") { event.preventDefault(); recStart(a.closest("form")); }
    else if (act === "chatRecCancel") { event.preventDefault(); recStop(false); }
    else if (act === "chatRecSend") { event.preventDefault(); recStop(true); }
    else if (act === "chatVoicePlay") { event.preventDefault(); voicePlay(a.dataset.mid); }
    else if (act === "chatViewImage") {
      event.preventDefault();
      // wait a moment so a double-tap (like) on a photo does not also open the viewer
      clearTimeout(window.__mrImgT); const mid = a.dataset.mid;
      window.__mrImgT = setTimeout(() => openImageViewerFor(mid), 260);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeImageViewer(); closePhotoPreview(); } });
  window.addEventListener("popstate", () => { closeImageViewer(); closePhotoPreview(); if (REC.active) recStop(false); });

  // The signed-in account changed (logout / login): forget the previous account's conversations and messages,
  // otherwise the next person on the same browser tab would see them (the inbox is only fetched once per load).
  function resetChatSession() {
    try { stopPolling(); } catch (_) {}
    UI.apiConversations = []; UI.apiLoaded = false; UI.apiLoading = false; UI.activeMessages = {}; UI.failedAt = {};
    UI.loadingIds = new Set(); UI.openingIds = new Set(); UI.canonicalizingIds = new Set();
    UI.error = ""; UI.reply = null; UI.edit = null; UI.typing = {}; UI.readAt = {}; UI.search = ""; UI.filter = "all";
    pendingListingId = null;
    try { voiceStop(); closePhotoPreview(); closeImageViewer(); if (REC.active) recStop(false); } catch (_) {}
  }
  window.addEventListener("carmaa:session-reset", resetChatSession);

  // ---- Attach a listing to the chat: bottom sheet with "نشان‌های من" (saved) and "آگهی‌های من" (own) ----
  const ATT = { form: null, tab: "saved" };
  function attachSources() {
    const liked = (typeof state !== "undefined" && Array.isArray(state.likedIds) && typeof LISTINGS !== "undefined") ? LISTINGS.filter((l) => state.likedIds.includes(l.id)) : [];
    const mine = ((typeof state !== "undefined" && state.myListings) || []).filter((m) => m && m.listing && m.status !== "deleted").map((m) => m.listing);
    return { saved: liked, mine };
  }
  function attachTile(l) {
    const snap = listingSnapshot(l); const ph = snap.photo;
    return `<button type="button" class="mr-att-tile" data-action="chatAttachPick" data-listing-id="${escapeHTML(snap.id)}">${ph ? `<img src="${escapeHTML(ph)}" alt="" decoding="async" />` : `<span class="mr-att-ph">${carThumbMarkup(snap, "")}</span>`}<span class="mr-att-cap"><b>${escapeHTML(snap.title)}</b><small>${escapeHTML(formatPrice(snap.price))}</small></span></button>`;
  }
  function renderAttachGrid() {
    const src = attachSources(); const list = src[ATT.tab] || [];
    if (!list.length) return `<div class="mr-att-empty"><b>${ATT.tab === "saved" ? "هنوز آگهی‌ای نشان نکرده‌اید" : "هنوز آگهی‌ای ثبت نکرده‌اید"}</b><p>${ATT.tab === "saved" ? "روی آیکن نشان هر آگهی ضربه بزنید تا اینجا بیاید." : "آگهی‌های ثبت‌شده‌ی شما اینجا نمایش داده می‌شود."}</p></div>`;
    return `<div class="mr-att-grid">${list.map(attachTile).join("")}</div>`;
  }
  // The sheet owns one history entry, so the phone's back button closes the sheet instead of leaving the chat.
  function closeAttachSheet(fromPop) {
    const el = document.getElementById("mrAttachSheet"); if (!el) return;
    el.classList.remove("is-open"); setTimeout(() => el.remove(), 220);
    if (window.__mrAttachHist) {
      window.__mrAttachHist = false;
      if (fromPop !== true) { window.__mrSkipPop = true; try { history.back(); } catch (_) { window.__mrSkipPop = false; } }
    }
  }
  window.addEventListener("popstate", () => { if (window.__mrAttachHist) closeAttachSheet(true); });
  function openAttachSheet(form) {
    if (!accountPhone()) { requireLogin(activeRoute()); return; }
    closeAttachSheet(); ATT.form = form; ATT.tab = "saved";
    const src = attachSources(); if (!src.saved.length && src.mine.length) ATT.tab = "mine";
    const el = document.createElement("div"); el.id = "mrAttachSheet"; el.className = "mr-att";
    el.innerHTML = `<div class="mr-att-backdrop" data-action="chatAttachClose"></div><div class="mr-att-panel" role="dialog" aria-label="ارسال آگهی"><i class="mr-att-grab" aria-hidden="true"></i><div class="mr-att-seg" role="tablist"><button type="button" role="tab" data-action="chatAttachTab" data-tab="saved">نشان‌های من<em>${FA(src.saved.length)}</em></button><button type="button" role="tab" data-action="chatAttachTab" data-tab="mine">آگهی‌های من<em>${FA(src.mine.length)}</em></button></div><div class="mr-att-body" data-slot="att-body"></div></div>`;
    document.body.appendChild(el);
    try { history.pushState(Object.assign({}, history.state || {}, { mrAttach: 1 }), "", location.href); window.__mrAttachHist = true; } catch (_) {}
    const sync = () => { el.querySelectorAll("[data-action=chatAttachTab]").forEach((b) => { const on = b.dataset.tab === ATT.tab; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", String(on)); }); el.querySelector("[data-slot=att-body]").innerHTML = renderAttachGrid(); };
    el._sync = sync; sync();
    requestAnimationFrame(() => el.classList.add("is-open"));
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAttachSheet(); });
  document.addEventListener("click", function (event) {
    const a = event.target.closest("[data-action]"); if (!a) return;
    const act = a.dataset.action;
    if (act === "chatAttach") { event.preventDefault(); openAttachSheet(a.closest("form")); }
    else if (act === "chatAttachClose") { event.preventDefault(); closeAttachSheet(); }
    else if (act === "chatAttachTab") { event.preventDefault(); ATT.tab = a.dataset.tab === "mine" ? "mine" : "saved"; const el = document.getElementById("mrAttachSheet"); if (el && el._sync) el._sync(); }
    else if (act === "chatAttachPick") {
      event.preventDefault();
      const src = attachSources(); const l = (src[ATT.tab] || []).find((x) => String(x.id) === String(a.dataset.listingId));
      const form = ATT.form && ATT.form.isConnected ? ATT.form : document.querySelector("form[data-chat-form]");
      closeAttachSheet();
      if (l && form) sendMessage(form, listingSnapshot(l));
    }
  });

  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (action === "openMessages") {
      event.preventDefault();
      if (!requireLogin({ page: "messages" })) return;
      UI.error = "";
      openRoute({ page: "messages" });
      if (MODE === "api") refreshApiInbox(true);
    } else if (action === "startListingChat") {
      event.preventDefault(); startListingChat(el.dataset.id || (activeRoute() && activeRoute().listing && activeRoute().listing.id));
    } else if (action === "openChat") {
      event.preventDefault(); openChat(el.dataset.id);
    } else if (action === "chatInboxBack") {
      event.preventDefault(); openRoute({ page: "home" });
    } else if (action === "chatBack") {
      event.preventDefault(); openRoute({ page: "messages" });
    } else if (action === "chatFilter") {
      event.preventDefault(); UI.filter = el.dataset.filter === "unread" ? "unread" : "all";
      const root = document.querySelector('[data-page="messages"]');
      if (root) {
        root.querySelectorAll("[data-action='chatFilter']").forEach((b) => b.classList.toggle("is-active", b.dataset.filter === UI.filter));
        const slot = root.querySelector('[data-slot="chat-list"]'); if (slot) slot.innerHTML = renderInboxRows();
      }
    } else if (action === "chatFilterToggle") {
      event.preventDefault(); UI.filter = UI.filter === "unread" ? "all" : "unread";
      el.classList.toggle("is-active", UI.filter === "unread"); el.setAttribute("aria-pressed", String(UI.filter === "unread"));
      const slot = document.querySelector('[data-page="messages"] [data-slot="chat-list"]'); if (slot) slot.innerHTML = renderInboxRows();
      showToastSafe(UI.filter === "unread" ? "فقط خوانده‌نشده‌ها" : "همه گفتگوها");
    } else if (action === "chatClearSearch") {
      event.preventDefault(); UI.search = "";
      const input = document.getElementById("mrChatSearch"); if (input) input.value = "";
      el.hidden = true;
      const slot = document.querySelector('[data-page="messages"] [data-slot="chat-list"]'); if (slot) slot.innerHTML = renderInboxRows();
    } else if (action === "chatResetFilters") {
      event.preventDefault(); UI.search = ""; UI.filter = "all";
      if (typeof render === "function") render();
    } else if (action === "chatOpenListing") {
      event.preventDefault();
      const listingId = el.dataset.listingId;
      const listing = listingById(listingId);
      if (listing && typeof navigateTo === "function") navigateTo({ page: "vehicle", listing });
      else showToastSafe("این آگهی دیگر در فهرست محلی وجود ندارد.");
    } else if (action === "chatOpenSeller") {
      event.preventDefault();
      let sellerId = el.dataset.sellerId || "";
      if (!sellerId) {
        const l = listingById(el.dataset.listingId);
        try { const s = l && typeof listingSeller === "function" ? listingSeller(l) : null; if (s && s.id) sellerId = String(s.id); } catch (_) {}
      }
      const serverUser = !!(window.CARMA_API && window.CARMA_API.enabled && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sellerId));
      if (sellerId && typeof sellerProfileById === "function" && (sellerProfileById(sellerId) || serverUser) && typeof navigateTo === "function") {
        stopPolling();
        navigateTo({ page: "seller", sellerId }, { menuOpen: false });
      } else showToastSafe("صفحه این کاربر در دسترس نیست.");
    } else if (action === "chatPlus") {
      event.preventDefault();
      const form = el.closest("form"); const tray = form && form.querySelector(".mr-cv-quick");
      if (tray) { tray.hidden = !tray.hidden; el.setAttribute("aria-expanded", String(!tray.hidden)); el.classList.toggle("is-open", !tray.hidden); }
      syncChatPad(form);
    } else if (action === "chatQuick") {
      event.preventDefault();
      const form = el.closest("form"); const ta = form && form.querySelector("textarea");
      const tray = form && form.querySelector(".mr-cv-quick"); if (tray) tray.hidden = true;
      syncChatPad(form);
      const plus = form && form.querySelector(".mr-cv-plus"); if (plus) { plus.classList.remove("is-open"); plus.setAttribute("aria-expanded", "false"); }
      if (ta && form) {
        ta.value = el.dataset.text || "";
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof form.requestSubmit === "function") form.requestSubmit(); else sendMessage(form);
      }
    } else if (action === "chatConversationInfo") {
      event.preventDefault(); showToastSafe("گفتگو به یک آگهی مشخص متصل است. برای پشتیبانی و گزارش، اتصال بک‌اند لازم است.");
    }
  });
  // Tapping send must not move focus off the textarea (that would dismiss the keyboard).
  ["pointerdown", "mousedown"].forEach((t) => document.addEventListener(t, function (e) {
    if (e.target.closest && e.target.closest(".mr-cv-send") && e.cancelable) e.preventDefault();
  }));
  document.addEventListener("submit", function (event) {
    const form = event.target.closest("form[data-chat-form]");
    if (!form) return;
    event.preventDefault(); sendMessage(form);
  });
  document.addEventListener("input", function (event) {
    const ta = event.target;
    if (!ta.matches || !ta.matches(".mr-cv-composer textarea")) return;
    ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    const form = ta.closest("form"); if (form) form.classList.toggle("has-text", ta.value.trim().length > 0);
    if (form) announceTyping(String(form.dataset.conversationId || ""), ta.value.trim().length > 0);
  });
  // ---- my typing state -> the other person ----
  const TYPING_KEY = "carmaa_typing_v1";
  let lastTypingSent = 0, typingStopTimer = null, typingSentFor = "";
  function sendTypingState(id, on) {
    if (!id) return;
    if (MODE === "api") { API.typing(id, on).catch(() => {}); return; }
    // local preview: shared through localStorage so another tab/window of the same browser sees it
    try {
      const all = JSON.parse(localStorage.getItem(TYPING_KEY) || "{}") || {};
      const me = accountPhone() || "";
      if (on) all[id + "|" + me] = Date.now(); else delete all[id + "|" + me];
      localStorage.setItem(TYPING_KEY, JSON.stringify(all));
    } catch (_) {}
  }
  function announceTyping(id, hasText) {
    if (!id) return;
    clearTimeout(typingStopTimer);
    if (!hasText) { if (typingSentFor) { sendTypingState(id, false); typingSentFor = ""; lastTypingSent = 0; } return; }
    const now = Date.now();
    if (now - lastTypingSent > 2500 || typingSentFor !== id) { lastTypingSent = now; typingSentFor = id; sendTypingState(id, true); }
    // no keystroke for 4s -> stop showing "typing" on the other side
    typingStopTimer = setTimeout(() => { sendTypingState(id, false); typingSentFor = ""; lastTypingSent = 0; }, 4000);
  }
  // ---- other person's typing state -> me ----
  let typingPollTimer = null, typingPollBusy = false;
  function localOtherTyping(id) {
    try {
      const all = JSON.parse(localStorage.getItem(TYPING_KEY) || "{}") || {};
      const me = accountPhone() || "";
      return Object.keys(all).some((k) => k.startsWith(id + "|") && k !== id + "|" + me && Date.now() - all[k] < 5000);
    } catch (_) { return false; }
  }
  function startTypingWatch() {
    if (typingPollTimer) return;
    window.addEventListener("storage", (e) => { if (e.key === TYPING_KEY) { const id = currentConvId(); if (id && MODE !== "api") setTyping(id, localOtherTyping(id)); } });
    typingPollTimer = setInterval(async () => {
      const id = currentConvId();
      if (!id) { if (Object.keys(UI.typing).length) UI.typing = {}; return; }
      if (document.hidden || typingPollBusy || !accountPhone()) return;
      if (MODE !== "api") { setTyping(id, localOtherTyping(id)); updateReceipt(id); return; }
      typingPollBusy = true;
      try {
        const r = await API.isTyping(id);
        if (currentConvId() === id) {
          setTyping(id, r.typing);
          if (r.readAt && UI.readAt[id] !== r.readAt) {
            UI.readAt[id] = r.readAt;
            const t = new Date(r.readAt).getTime();
            (UI.activeMessages[id] || []).forEach((m) => { if (msgIsMine(m) && msgTime(m).getTime() <= t) m.is_read = true; });
            updateReceipt(id);
          }
        }
      } catch (_) {} finally { typingPollBusy = false; }
    }, 2000);
  }
  startTypingWatch();
  document.addEventListener("keydown", function (event) {
    if (event.target.matches && event.target.matches("[data-chat-form] textarea") && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      const form = event.target.closest("[data-chat-form]");
      if (form && typeof form.requestSubmit === "function") form.requestSubmit();
    }
  });
  // Keyboard open/close must never leave the page scrolled/shifted: the chat
  // screen is position:fixed (see styles.css v102o); this just re-anchors it.
  function fixChatViewport() {
    if (!document.querySelector(".mr-cv")) return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
    const box = document.querySelector('[data-slot="chat-messages"]');
    if (box) box.scrollTop = box.scrollHeight;
  }
  // iOS Safari: the keyboard overlays the page (100dvh / fixed elements do NOT shrink), so the composer
  // ended up hidden behind it. Measure the real keyboard height from visualViewport and expose it as CSS vars;
  // styles.css (v102s) uses them to lift the composer and shrink the chat screen above the keyboard.
  function syncChatKeyboard() {
    const root = document.documentElement, vv = window.visualViewport;
    if (!vv || !document.querySelector(".mr-cv")) {
      root.classList.remove("cv-kb-open"); root.style.removeProperty("--cv-kb"); root.style.removeProperty("--cv-top"); return;
    }
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    const top = Math.max(0, Math.round(vv.offsetTop));
    if (kb > 80) {
      root.classList.add("cv-kb-open");
      root.style.setProperty("--cv-kb", kb + "px");
      root.style.setProperty("--cv-top", top + "px");
    } else {
      root.classList.remove("cv-kb-open"); root.style.removeProperty("--cv-kb"); root.style.removeProperty("--cv-top");
    }
    const box = document.querySelector('[data-slot="chat-messages"]');
    if (box) box.scrollTop = box.scrollHeight;
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncChatKeyboard);
    window.visualViewport.addEventListener("scroll", syncChatKeyboard);
  }
  document.addEventListener("focusout", function () { setTimeout(syncChatKeyboard, 120); setTimeout(syncChatKeyboard, 450); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fixChatViewport);
  document.addEventListener("focusin", function (e) { if (e.target.matches && e.target.matches(".mr-cv-composer textarea")) setTimeout(fixChatViewport, 280); });
  document.addEventListener("focusout", function (e) { if (e.target.matches && e.target.matches(".mr-cv-composer textarea")) { setTimeout(fixChatViewport, 80); setTimeout(fixChatViewport, 350); } });
  window.addEventListener("pagehide", stopPolling);
  window.addEventListener("pageshow", startPolling);

  // ---- In-app message banner: an iOS-style notification shown on ANY page when a new message arrives ----
  const ALERT = { seen: null, busy: false, hideTimer: null, current: null };
  (function injectAlertStyle() {
    if (document.getElementById("mrMsgAlertStyle")) return;
    const st = document.createElement("style");
    st.id = "mrMsgAlertStyle";
    st.textContent = `
.mr-alert{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:12px;right:12px;max-width:380px;margin:0 auto;z-index:100000;display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(38,38,40,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);color:#f2f2f7;border:1px solid rgba(255,255,255,.08);border-radius:18px;box-shadow:0 8px 28px rgba(0,0,0,.5),0 1px 3px rgba(0,0,0,.4);direction:rtl;cursor:pointer;transform:translateY(-160%);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.3,1.1),opacity .3s ease;touch-action:none;-webkit-tap-highlight-color:transparent;font-family:inherit;font-weight:400}
.mr-alert.is-in{transform:translateY(0);opacity:1}
.mr-alert.is-drag{transition:none}
.mr-alert-av{position:relative;flex:0 0 auto;width:44px;height:44px;border-radius:50%;background:#2c3e50;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#cfe6f5}
.mr-alert-av img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.mr-alert-badge{position:absolute;left:-4px;bottom:-3px;width:20px;height:20px;border-radius:7px;background:#ffffff;border:2px solid #262628;display:flex;align-items:center;justify-content:center;color:#1D1D1F}
.mr-alert-badge svg{width:11px;height:11px}
.mr-alert-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:right}
.mr-alert-body b{font-size:15px;font-weight:700;line-height:1.4;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mr-alert-body span{font-size:13px;font-weight:400;color:#a1a1a6;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mr-alert time{flex:0 0 auto;align-self:flex-start;font-size:12px;font-weight:400;color:#98989D;margin-top:2px}
@media (prefers-reduced-motion:reduce){.mr-alert{transition:opacity .2s}}`;
    document.head.appendChild(st);
  })();
  function hideMsgAlert() {
    clearTimeout(ALERT.hideTimer);
    const el = document.getElementById("mrMsgAlert");
    if (!el) return;
    el.classList.remove("is-in", "is-drag");
    el.style.transform = "";
    setTimeout(() => { if (el.parentNode && !el.classList.contains("is-in")) el.remove(); }, 600);
    ALERT.current = null;
  }
  function showMsgAlert(c) {
    const old = document.getElementById("mrMsgAlert");
    if (old) old.remove();
    clearTimeout(ALERT.hideTimer);
    const name = String(c.otherName || "کاربر");
    const text = String(c.lastMessage || c.last_message || "").trim() || "پیام جدید برای شما ارسال شد";
    const info = convAvatarInfo(c);
    const av = info && info.url ? `<img src="${escapeHTML(info.url)}" alt="" />` : escapeHTML(initials(name));
    const el = document.createElement("div");
    el.id = "mrMsgAlert";
    el.className = "mr-alert";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<div class="mr-alert-av">${av}<span class="mr-alert-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.6-.8L3 20.5l1.6-4.8A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/></svg></span></div><div class="mr-alert-body"><b>${escapeHTML(name)}</b><span>${escapeHTML(text)}</span></div><time>همین الان</time>`;
    document.body.appendChild(el);
    ALERT.current = c.id;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
    try { if (window.CARMA_NOTIFY_SOUND) window.CARMA_NOTIFY_SOUND(); } catch (_) {}
    const arm = () => { clearTimeout(ALERT.hideTimer); ALERT.hideTimer = setTimeout(hideMsgAlert, 6000); };
    arm();
    let y0 = null, dy = 0, moved = false;
    el.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; dy = 0; moved = false; clearTimeout(ALERT.hideTimer); el.classList.add("is-drag"); }, { passive: true });
    el.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.min(0, e.touches[0].clientY - y0); if (Math.abs(dy) > 6) moved = true; el.style.transform = `translateY(${dy}px)`; }, { passive: true });
    el.addEventListener("touchend", () => { el.classList.remove("is-drag"); if (dy < -28) { hideMsgAlert(); } else { el.style.transform = ""; arm(); } y0 = null; });
    el.addEventListener("click", () => {
      if (moved) { moved = false; return; }
      const id = c.id;
      hideMsgAlert();
      try { openChat(id); } catch (_) { openRoute({ page: "messages" }); }
    });
  }
  function msgAlertKey(c) { return String(c.last_message_at || c.lastMessageAt || c.updatedAt || ""); }
  async function pollMessageAlerts() {
    if (MODE !== "api" || ALERT.busy) return;
    if (!accountPhone()) { ALERT.seen = null; return; }
    if (document.hidden) return;
    ALERT.busy = true;
    try {
      const rows = await API.list();
      const route = activeRoute() || {};
      const first = ALERT.seen === null;
      if (first) ALERT.seen = {};
      let newest = null;
      rows.forEach((c) => {
        const unread = Number(c.unreadCount || 0);
        const key = msgAlertKey(c);
        const prev = ALERT.seen[c.id];
        ALERT.seen[c.id] = { unread, key };
        if (first || unread < 1) return;
        const isNew = !prev || unread > prev.unread || key !== prev.key;
        const viewing = route.page === "conversation" && String(route.conversationId) === String(c.id);
        if (isNew && !viewing && (!newest || new Date(key).getTime() > new Date(msgAlertKey(newest)).getTime())) newest = c;
      });
      UI.apiConversations = rows; UI.apiLoaded = true;
      updateChatDockBadge();
      if (newest) showMsgAlert(newest);
    } catch (_) {} finally { ALERT.busy = false; }
  }
  if (MODE === "api") {
    setInterval(pollMessageAlerts, 20000);
    setTimeout(pollMessageAlerts, 2000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pollMessageAlerts(); });
  }

  // Public adapter hooks for future integration/testing.
  window.MARQUE_CHAT = {
    mode: MODE,
    openInbox: () => { if (requireLogin({ page: "messages" })) openRoute({ page: "messages" }); },
    startForListing: startListingChat,
    connectWithBuyer,
    replyToStory,
    refresh: async () => { if (MODE === "api") { UI.apiLoaded = false; await refreshApiInbox(true); } else if (typeof render === "function") render(); },
    renderInboxPage: renderMessagesScreen,
    renderConversationPage: renderConversationScreen,
    openChat,
    skeletonMessages: skeletonMessagesScreen,
    skeletonConversation: skeletonConversationScreen,
    adapter: API,
    reset: resetChatSession
  };
  window.afterMarqueRender = afterMarqueRender;
})();

function renderMessagesScreen() { return window.MARQUE_CHAT ? window.MARQUE_CHAT.renderInboxPage() : document.createElement("section"); }
function renderConversationScreen() { return window.MARQUE_CHAT ? window.MARQUE_CHAT.renderConversationPage() : document.createElement("section"); }
