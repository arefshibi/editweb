"use strict";

/* ---------------------------------------------------------------
   NOTIFICATIONS UI — the bell in the header (it replaced the hamburger
   menu) opens a full-screen panel with this account's notifications:
   follows (personal + showroom), new messages, ad approved / rejected,
   ladder / urgent / promoted ads, and price offers on my ads. An offer
   can be accepted or declined; once accepted the seller gets a
   «ارتباط با خریدار» button that opens the chat with that buyer.
   Data lives in MR_NOTIFS (js/02a-admin-store.js).
--------------------------------------------------------------- */
(function () {
  const OFFERS_KEY = "marque_listing_offers_v1";
  const fa = (n) => (typeof faNum === "function" ? faNum(n) : String(n));
  const esc = (v) => (typeof escHtml === "function" ? escHtml(v) : String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const me = () => String((typeof state !== "undefined" && state.account) || "");
  const toast = (m) => { if (typeof showToast === "function") showToast(m); };
  let serverNotes = [], serverUnread = 0, serverLoading = false, notesLoadedOnce = false;
  const serverMode = () => !!(window.CARMA_API?.enabled && window.CARMA_AUTH_USER);
  function visibleNotes() { return serverMode() ? serverNotes : (me() ? MR_NOTIFS.list(me()) : []); }
  async function refreshServerNotes() {
    if (!serverMode() || serverLoading) return;
    serverLoading = true;
    try {
      const [r, offersResult] = await Promise.all([window.CARMA_API.notifications.list({limit:'100'}), window.CARMA_API.account.incomingOffers({limit:'100'}).catch(() => ({items:[]}))]);
      const offers = new Map((offersResult.items || []).map(o => [String(o.id), o]));
      serverNotes = (r.items || []).map(n => {
        const d = n.data && typeof n.data === 'object' ? {...n.data} : {};
        let type = String(n.type || 'system'); let icon = 'bell'; let route = null;
        if (type === 'offer') { icon='offer'; const o=offers.get(String(d.offerId||'')); if(o){d.amount=Number(o.amount_toman||0);d.buyerName=String(o.buyer_name||'خریدار');d.listingId=String(o.listing_id||d.listingId||'');d.status=String(o.status||'pending');d.listingTitle=String(o.listing_title||'');} }
        else if (type === 'qa') { icon='ok'; /* Q&A disabled (temporary): no deep link */ }
        else if (type === 'showroom_review') { type='dealer'; icon='dealer'; route={page:'account'}; }
        else if (type === 'weekly_report') { type='dealer'; icon='dealer'; route={page:'account'}; }
        else if (type.includes('listing')) { type='listing'; icon='ok'; route={page:'manageListings'}; }
        else if (String(n.type).indexOf('partner') === 0) { var pt = String(n.type); type='dealer'; icon='dealer'; route={page:'partners',tab:({partner_offer:'offers',partner_offer_update:'offers',partner_deal:'offers',partner_review:'me',partner_match:'opps',partner_alert:'market',partner_hidden:'me'})[pt]||'market'}; }
        else if (type === 'message') { icon='msg'; if(d.conversationId)route={page:'conversation',conversationId:String(d.conversationId)}; }
        return {id:String(n.id),type,icon,title:String(n.title||'اعلان'),body:String(n.body||''),data:d,read:!!n.read_at,at:Date.parse(n.created_at||'')||Date.now(),route,serverBacked:true};
      });
      serverUnread = Number(r.unreadCount||0);
    } catch (_) { /* retain last-known cache; UI displays API errors only on explicit refresh */ }
    finally { serverLoading=false; notesLoadedOnce=true; updateBadges(); }
  }

  function readOffers() { try { const a = JSON.parse(localStorage.getItem(OFFERS_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function setOfferStatus(id, status) {
    const a = readOffers(); const o = a.find((x) => x.id === id);
    if (o) { o.status = status; try { localStorage.setItem(OFFERS_KEY, JSON.stringify(a)); } catch (_) {} }
  }

  // sellerId -> phone, by scanning every phone this browser knows about
  function phoneForSellerId(id) {
    if (!id || typeof sellerIdForPhone !== "function") return "";
    const phones = new Set();
    try { Object.keys(JSON.parse(localStorage.getItem("marqueAccountMeta") || "{}")).forEach((p) => phones.add(p)); } catch (_) {}
    try { const d = MR_STORE.read(); Object.keys(d.dealers || {}).forEach((p) => phones.add(p)); Object.values(d.entries || {}).forEach((e) => e.owner && phones.add(e.owner)); } catch (_) {}
    try { (JSON.parse(localStorage.getItem("marque_messages_v1") || "{}").conversations || []).forEach((c) => { c.buyerPhone && phones.add(c.buyerPhone); c.sellerPhone && phones.add(c.sellerPhone); }); } catch (_) {}
    if (me()) phones.add(me());
    for (const p of phones) { if (sellerIdForPhone(p) === id) return p; }
    return "";
  }

  // someone (the signed-in user) followed `targetId`
  function followed(targetId, isDealer) {
    const phone = phoneForSellerId(targetId); const myPhone = me();
    if (!phone || phone === myPhone) return;
    const P = window.MR_PROFILE || {}; const myId = P.myId ? P.myId() : "";
    const pf = (typeof state !== "undefined" && state.accountProfile) || {};
    const name = [pf.firstName, pf.lastName].filter(Boolean).join(" ").trim() || ("@" + (P.getUsername ? P.getUsername(myId) : "user"));
    if (MR_NOTIFS.list(phone).some((n) => n.type === "follow" && !n.read && n.data && n.data.from === myId && n.data.dealer === !!isDealer)) return;
    MR_NOTIFS.push(phone, { type: "follow", icon: "follow", title: isDealer ? "دنبال‌کننده‌ی جدید برای نمایشگاه" : "دنبال‌کننده‌ی جدید", body: name + (isDealer ? " نمایشگاه شما را دنبال کرد." : " شما را دنبال کرد."), route: { page: "seller", sellerId: myId }, data: { from: myId, dealer: !!isDealer, whoId: myId, whoKind: "p", who: name } });
    updateBadges();
  }

  /* ---------------- bell badge ---------------- */
  let prevUnread = null, prevOwner = "";
  function updateBadges() {
    if (serverMode() && !notesLoadedOnce) return; // wait for the first real count so the page load never rings
    const n = serverMode() ? serverUnread : (me() ? MR_NOTIFS.unread(me()) : 0);
    const owner = me() + "|" + (window.CARMA_AUTH_USER && window.CARMA_AUTH_USER.id || "");
    if (owner !== prevOwner) { prevOwner = owner; prevUnread = null; } // another account: new baseline, no sound
    const txt = n > 9 ? "۹+" : fa(n);
    document.querySelectorAll(".mr-bell-badge").forEach((b) => {
      const changed = b.textContent !== txt || b.hidden !== (n < 1);
      b.hidden = n < 1; b.textContent = txt;
      if (changed && n > 0) { b.classList.remove("is-pop"); void b.offsetWidth; b.classList.add("is-pop"); }
    });
    if (prevUnread !== null && n > prevUnread) { try { if (window.CARMA_NOTIFY_SOUND) window.CARMA_NOTIFY_SOUND(); } catch (_) {} }
    /* CM-UNREAD-HOOK */ try { if (typeof window.CARMA_UNREAD_HOOK === "function") window.CARMA_UNREAD_HOOK(n, owner, prevUnread); } catch (_) {}
    prevUnread = n;
  }

  /* ---------------- panel ---------------- */
  const svg = (d, w) => `<svg width="${w || 22}" height="${w || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    follow: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    msg: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.6-.8L3 20.5l1.6-4.8A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    bad: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    offer: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    ladder: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    urgent: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    renew: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    promo: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    dealer: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.6-.8L3 20.5l1.6-4.8A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    checks: '<path d="m2 12.5 4 4L13 8"/><path d="m11 14.5 1.5 1.5L21 7.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const TONE = { follow: "#34d399", msg: "#22d3ee", ok: "#2dd4bf", bad: "#ffffff", offer: "#3b82f6", ladder: "#ffffff", urgent: "#fb923c", renew: "#ffffff", promo: "#fbbf24", dealer: "#2dd4bf" };
  const TABS = [["all", "همه"], ["msg", "پیام‌ها"], ["ads", "آگهی‌ها"], ["offers", "پیشنهادها"], ["follow", "دنبال‌کننده‌ها"]];
  const GROUP = { message: "msg", listing: "ads", service: "ads", dealer: "ads", offer: "offers", offer_result: "offers", follow: "follow" };
  let tab = "all";
  function ago(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return "همین الان";
    if (s < 3600) return fa(Math.floor(s / 60)) + " دقیقه پیش";
    if (s < 86400) return fa(Math.floor(s / 3600)) + " ساعت پیش";
    return fa(Math.floor(s / 86400)) + " روز پیش";
  }
  const toman = (n) => (Number(n) || 0).toLocaleString("fa-IR") + " تومان";
  function listingOf(id) { try { return (typeof LISTINGS !== "undefined" ? LISTINGS : []).find((l) => String(l.id) === String(id)) || null; } catch (_) { return null; } }
  function badge(kind, text) { return `<span class="mr-nf-pill is-${kind}">${text}</span>`; }
  function offerCard(n) {
    const d = n.data || {}; const l = listingOf(d.listingId); const photo = l && Array.isArray(l.photos) && l.photos[0];
    const name = d.buyerName || "خریدار";
    const st = d.status === "accepted" ? badge("ok", "تأیید شد") : d.status === "declined" ? badge("bad", "رد شد") : badge("wait", "در انتظار پاسخ شما");
    const acts = d.status === "pending"
      ? `<div class="mr-nf-acts"><button type="button" class="mr-nf-btn is-pri" data-nf="accept" data-id="${esc(n.id)}">${svg(IC.ok, 17)}تأیید پیشنهاد</button><button type="button" class="mr-nf-btn is-ghost" data-nf="decline" data-id="${esc(n.id)}">رد</button></div>`
      : d.status === "accepted" ? `<div class="mr-nf-acts"><button type="button" class="mr-nf-btn is-pri is-wide" data-nf="connect" data-id="${esc(n.id)}">${svg(IC.chat, 17)}ارتباط با ${esc(name)}</button></div>` : "";
    return `<div class="mr-nf-offer"><div class="mr-nf-car">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : `<span>${svg(IC.offer, 20)}</span>`}</div><div class="mr-nf-offer-info"><div class="mr-nf-offer-car">${esc(l ? (l.title || l.brand) : "آگهی شما")}</div><div class="mr-nf-offer-who">${avatarHTML(name, "p", d.buyerPhone && typeof sellerIdForPhone === "function" ? sellerIdForPhone(d.buyerPhone) : "", 22)}<span><b>${esc(name)}</b> پیشنهاد داده</span></div></div></div><div class="mr-nf-price"><span>مبلغ پیشنهادی</span><strong>${toman(d.amount)}</strong></div><div class="mr-nf-offer-foot">${st}</div>${acts}`;
  }
  function hue(name) { let h = 0; const t = String(name || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return h; }
  function avatarHTML(name, kind, id, size) {
    let url = ""; try { if (id && typeof mrGetAvatar === "function") url = mrGetAvatar(kind || "p", id); } catch (_) {}
    const init = esc(String(name || "؟").trim().charAt(0) || "؟");
    return `<span class="mr-nf-av" style="--h:${hue(name)};${size ? "width:" + size + "px;height:" + size + "px;" : ""}">${url ? `<img src="${esc(url)}" alt="">` : `<b>${init}</b>`}</span>`;
  }
  function leadHTML(n, icon) {
    const d = n.data || {};
    const mini = `<i class="mr-nf-mini">${svg(icon, 11)}</i>`;
    if (n.type === "offer") return `<span class="mr-nf-lead">${avatarHTML(d.buyerName, "p", d.buyerPhone && typeof sellerIdForPhone === "function" ? sellerIdForPhone(d.buyerPhone) : "", 46)}${mini}</span>`;
    if (n.type === "follow" || n.type === "message") return `<span class="mr-nf-lead">${avatarHTML(d.who, d.whoKind, d.whoId || d.from, 46)}${mini}</span>`;
    const l = d.listingId ? listingOf(d.listingId) : null; const photo = l && Array.isArray(l.photos) && l.photos[0];
    if (photo && (n.type === "listing" || n.type === "service" || n.type === "offer_result")) return `<span class="mr-nf-lead"><span class="mr-nf-thumb"><img src="${esc(photo)}" alt="" loading="lazy"></span>${mini}</span>`;
    return `<span class="mr-nf-ico">${svg(icon, 21)}</span>`;
  }
  function itemHTML(n) {
    const tone = TONE[n.icon] || "#9aa3ad";
    const d = n.data || {};
    const isOffer = n.type === "offer";
    const icon = IC[n.icon === "msg" ? "msg" : n.icon === "follow" ? "follow" : n.type === "dealer" && n.icon === "ok" ? "dealer" : n.icon] || IC.bell;
    let body;
    if (isOffer) body = offerCard(n);
    else {
      body = `<div class="mr-nf-body">${esc(n.body || "")}</div>`;
      if (n.type === "offer_result" && d.status === "accepted") body += `<div class="mr-nf-acts"><button type="button" class="mr-nf-btn is-pri is-wide" data-nf="chatSeller" data-id="${esc(n.id)}">${svg(IC.chat, 17)}گفتگو با فروشنده</button></div>`;
    }
    const head = isOffer ? "پیشنهاد قیمت جدید" : n.title;
    return `<article class="mr-nf-card${n.read ? "" : " is-unread"}" style="--tone:${tone}"><div class="mr-nf-row">${leadHTML(n, icon)}<div class="mr-nf-col"><div class="mr-nf-top"><h3${n.route ? ` data-nf="open" data-id="${esc(n.id)}"` : ""}>${esc(head)}</h3><time>${ago(n.at)}</time></div>${body}</div>${n.read ? "" : '<i class="mr-nf-dot" aria-hidden="true"></i>'}</div></article>`;
  }
  function panel() {
    let p = document.getElementById("mrNotifPanel");
    if (!p) {
      p = document.createElement("div"); p.id = "mrNotifPanel"; p.className = "mr-nf-panel"; p.hidden = true;
      p.innerHTML = `<div class="mr-nf-backdrop" data-nf="close"></div><section class="mr-nf-sheet" role="dialog" aria-modal="true" aria-label="اعلان‌ها"><header class="mr-nf-head"><div class="mr-nf-title"><h2>اعلان‌ها</h2><span class="mr-nf-count" id="mrNfCount" hidden></span></div><div class="mr-nf-tools"><button type="button" data-nf="readAll" aria-label="خواندن همه" title="خواندن همه">${svg(IC.checks, 19)}</button><button type="button" data-nf="sample" aria-label="افزودن نمونه" title="افزودن نمونه">${svg(IC.plus, 19)}</button><button type="button" data-nf="clear" aria-label="پاک کردن همه" title="پاک کردن همه">${svg(IC.trash, 19)}</button><button type="button" class="is-close" data-nf="close" aria-label="بستن">${svg(IC.x, 18)}</button></div></header><nav class="mr-nf-tabs" id="mrNfTabs"></nav><div class="mr-nf-list" id="mrNotifList"></div></section>`;
      document.body.appendChild(p);
    }
    return p;
  }
  function paint() {
    const list = document.getElementById("mrNotifList"); if (!list) return;
    const all = visibleNotes();
    const unread = all.filter((n) => !n.read).length;
    const cnt = document.getElementById("mrNfCount"); if (cnt) { cnt.hidden = !unread; cnt.textContent = fa(unread) + " جدید"; }
    const tabs = document.getElementById("mrNfTabs");
    if (tabs) tabs.innerHTML = TABS.map(([k, label]) => { const u = all.filter((n) => !n.read && (k === "all" || GROUP[n.type] === k)).length; return `<button type="button" class="${tab === k ? "is-on" : ""}" data-nf="tab" data-tab="${k}">${label}${u ? `<em>${fa(u)}</em>` : ""}</button>`; }).join("");
    const items = all.filter((n) => tab === "all" || GROUP[n.type] === tab);
    if (!items.length && serverMode() && !notesLoadedOnce) {
      const b = (w, h, r) => `<span class="skeleton-block" aria-hidden="true" style="display:block;width:${w};height:${h}px;border-radius:${r || 8}px"></span>`;
      list.setAttribute("aria-busy", "true");
      list.innerHTML = [0,1,2,3,4].map(() => `<div class="mr-nf-sk-row">${b("44px",44,14)}<div class="mr-nf-sk-body">${b("58%",13)}${b("90%",11)}${b("34%",9)}</div></div>`).join("");
    } else if (!items.length) {
      list.removeAttribute("aria-busy");
      list.innerHTML = `<div class="mr-nf-empty"><span>${svg(IC.bell, 34)}</span><p>اعلانی وجود ندارد</p><small>دنبال‌کننده‌ها، پیام‌ها، وضعیت آگهی‌ها و پیشنهاد قیمت‌ها اینجا نمایش داده می‌شوند.</small></div>`;
    } else {
      const day = new Date(); day.setHours(0, 0, 0, 0); const t0 = day.getTime();
      const today = items.filter((n) => n.at >= t0), older = items.filter((n) => n.at < t0);
      list.innerHTML = (today.length ? `<div class="mr-nf-day">امروز</div>` + today.map(itemHTML).join("") : "") + (older.length ? `<div class="mr-nf-day">قبل‌تر</div>` + older.map(itemHTML).join("") : "");
    }
    updateBadges();
  }

  // Demo notifications of every kind, for testing the panel.
  function seedSamples() {
    const phone = me(); if (!phone) return;
    const L = (typeof LISTINGS !== "undefined" && LISTINGS[0]) || {}; const lid = String(L.id || "demo");
    const lt = L.title || "خودروی نمونه"; const t = Date.now(); const min = 60000;
    const P = (n, ago) => { const r = MR_NOTIFS.push(phone, n); if (r) MR_NOTIFS.update(r.id, { at: t - ago * min }); };
    const fid = (typeof sellerIdForPhone === "function") ? sellerIdForPhone("09120000009") : "";
    P({ type: "follow", icon: "follow", title: "دنبال‌کننده‌ی جدید", body: "سارا محمدی شما را دنبال کرد.", route: { page: "seller", sellerId: fid }, data: { sample: 1, who: "سارا محمدی" } }, 2);
    P({ type: "follow", icon: "follow", title: "دنبال‌کننده‌ی جدید برای نمایشگاه", body: "رضا احمدی نمایشگاه شما را دنبال کرد.", route: { page: "seller", sellerId: fid }, data: { sample: 1, who: "رضا احمدی" } }, 9);
    P({ type: "message", icon: "msg", title: "پیام جدید از بابک", body: "۳ پیام جدید: سلام، هنوز موجوده؟", data: { count: 3, sample: 1, who: "بابک", listingId: lid } }, 14);
    P({ type: "listing", icon: "ok", title: "آگهی شما تأیید شد", body: "«" + lt + "» منتشر شد و در سایت نمایش داده می‌شود.", route: { page: "manageListings" }, data: { listingId: lid } }, 30);
    P({ type: "listing", icon: "bad", title: "آگهی شما رد شد", body: "«" + lt + "»: علت: عکس نامناسب", route: { page: "manageListings" }, data: { listingId: lid } }, 55);
    P({ type: "service", icon: "ladder", title: "نردبان آگهی فعال شد", body: "«" + lt + "» به بالای فهرست آگهی‌ها منتقل شد.", route: { page: "manageListings" }, data: { listingId: lid } }, 80);
    P({ type: "service", icon: "urgent", title: "برچسب فوری فعال شد", body: "«" + lt + "» به مدت ۳ روز با برچسب فوری نمایش داده می‌شود.", route: { page: "manageListings" }, data: { listingId: lid } }, 120);
    P({ type: "listing", icon: "promo", title: "آگهی شما تبلیغ (ویژه) شد", body: "«" + lt + "»: آگهی شما در بخش آگهی‌های ویژه نمایش داده می‌شود.", route: { page: "manageListings" }, data: { listingId: lid } }, 180);
    P({ type: "offer", icon: "offer", title: "پیشنهاد قیمت جدید", body: "بابک برای «" + lt + "» ۹۰۰٬۰۰۰٬۰۰۰ تومان پیشنهاد داد.", data: { offerId: "demo1", listingId: lid, buyerPhone: "09120000002", buyerName: "بابک", amount: 900000000, status: "pending", sample: 1 } }, 5);
    P({ type: "offer", icon: "offer", title: "پیشنهاد قیمت جدید", body: "نیلوفر برای «" + lt + "» ۸۷۰٬۰۰۰٬۰۰۰ تومان پیشنهاد داد.", data: { offerId: "demo2", listingId: lid, buyerPhone: "09120000003", buyerName: "نیلوفر", amount: 870000000, status: "accepted", sample: 1 } }, 240);
    P({ type: "offer", icon: "offer", title: "پیشنهاد قیمت جدید", body: "کامران برای «" + lt + "» ۷۰۰٬۰۰۰٬۰۰۰ تومان پیشنهاد داد.", data: { offerId: "demo3", listingId: lid, buyerPhone: "09120000004", buyerName: "کامران", amount: 700000000, status: "declined", sample: 1 } }, 300);
    P({ type: "offer_result", icon: "ok", title: "پیشنهاد قیمت شما پذیرفته شد", body: "فروشنده پیشنهاد شما را تأیید کرد. می‌توانید با او گفتگو کنید.", data: { status: "accepted", listingId: lid, sample: 1 } }, 360);
    P({ type: "offer_result", icon: "bad", title: "پیشنهاد قیمت شما پذیرفته نشد", body: "فروشنده پیشنهاد شما را نپذیرفت. می‌توانید پیشنهاد دیگری بدهید.", data: { status: "declined", listingId: lid, sample: 1 } }, 420);
    P({ type: "dealer", icon: "ok", title: "نمایشگاه شما تأیید شد", body: "اکنون می‌توانید در پنل نمایشگاه آگهی ثبت کنید.", route: { page: "account" } }, 500);
    P({ type: "dealer", icon: "bad", title: "درخواست نمایشگاه رد شد", body: "علت: آدرس ناقص است.", route: { page: "dealershipEdit" } }, 560);
    try { localStorage.setItem("mr_nf_seeded_" + phone, "1"); } catch (_) {}
  }
  function open() {
    if (!me() || (window.CARMA_API?.enabled && !window.CARMA_AUTH_USER)) {
      if (typeof state !== "undefined") { state = { ...state, modal: { type: "login", reason: "برای دیدن اعلان‌ها باید وارد حساب کاربری شوید." }, modalClosing: false, loginStep: "phone", loginPhone: "", loginReturnTo: state.route }; if (typeof render === "function") render(); }
      return;
    }
    if (!serverMode()) { try { if (!localStorage.getItem("mr_nf_seeded_" + me())) seedSamples(); } catch (_) {} }
    const p = panel(); p.hidden = false; document.documentElement.classList.add("mr-nf-open"); paint();
    if (serverMode()) refreshServerNotes().then(paint);
  }
  function close() { const p = document.getElementById("mrNotifPanel"); if (p) p.hidden = true; document.documentElement.classList.remove("mr-nf-open"); }
  function go(route) { close(); if (route && route.page === "partners") { if (window.CARMA_PARTNERS) window.CARMA_PARTNERS.open(route.tab); return; } if (route && typeof navigateTo === "function") navigateTo(route, {}); }

  document.addEventListener("click", function (e) {
    const bell = e.target.closest('[data-action="openNotifications"]');
    if (bell) { e.preventDefault(); e.stopPropagation(); open(); return; }
    const el = e.target.closest("[data-nf]"); if (!el) return;
    const act = el.dataset.nf; const id = el.dataset.id;
    const note = id ? visibleNotes().find((x) => x.id === id) : null;
    if (act === "close") close();
    else if (act === "tab") { tab = el.dataset.tab || "all"; paint(); }
    else if (act === "sample") { if (!serverMode()) { seedSamples(); paint(); } }
    else if (act === "readAll") { if (serverMode()) window.CARMA_API.notifications.readAll().then(refreshServerNotes).then(paint).catch(err=>toast(err.message||"عملیات انجام نشد.")); else { MR_NOTIFS.markRead(me(), "all"); paint(); } }
    else if (act === "clear") { if (serverMode()) window.CARMA_API.notifications.clear().then(()=>{serverNotes=[];serverUnread=0;paint();}).catch(err=>toast(err.message||"عملیات انجام نشد.")); else { MR_NOTIFS.clear(me()); paint(); } }
    else if (act === "open" && note) { if(serverMode()){window.CARMA_API.notifications.read(note.id).then(refreshServerNotes).then(()=>{paint();go(note.route);}).catch(err=>toast(err.message||"اعلان باز نشد."));}else{MR_NOTIFS.markRead(me(), note.id); go(note.route);} }
    else if (act === "accept" && note) {
      const d = note.data || {};
      if (serverMode()) { window.CARMA_API.account.updateOffer(d.offerId,'accepted').then(()=>window.CARMA_API.notifications.read(note.id)).then(refreshServerNotes).then(async()=>{paint();toast("پیشنهاد در سرور تأیید شد.");if(window.MARQUE_CHAT?.connectWithBuyer && d.buyerId) await window.MARQUE_CHAT.connectWithBuyer({listingId:d.listingId,buyerId:d.buyerId});}).catch(err=>toast(err.message||"تأیید پیشنهاد انجام نشد.")); return; }
      setOfferStatus(d.offerId, "accepted");
      MR_NOTIFS.update(note.id, { read: true, data: Object.assign({}, d, { status: "accepted" }) });
      MR_NOTIFS.push(d.buyerPhone, { type: "offer_result", icon: "ok", title: "پیشنهاد قیمت شما پذیرفته شد", body: "فروشنده پیشنهاد " + (Number(d.amount) || 0).toLocaleString("fa-IR") + " تومان" + " شما را تأیید کرد. می‌توانید با او گفتگو کنید.", data: { status: "accepted", listingId: d.listingId, sellerPhone: me() } });
      paint(); toast("پیشنهاد تأیید شد؛ حالا می‌توانید با خریدار ارتباط بگیرید.");
    } else if (act === "decline" && note) {
      const d = note.data || {};
      if (serverMode()) { window.CARMA_API.account.updateOffer(d.offerId,'declined').then(()=>window.CARMA_API.notifications.read(note.id)).then(refreshServerNotes).then(paint).catch(err=>toast(err.message||"رد پیشنهاد انجام نشد.")); return; }
      setOfferStatus(d.offerId, "declined");
      MR_NOTIFS.update(note.id, { read: true, data: Object.assign({}, d, { status: "declined" }) });
      MR_NOTIFS.push(d.buyerPhone, { type: "offer_result", icon: "bad", title: "پیشنهاد قیمت شما پذیرفته نشد", body: "فروشنده پیشنهاد شما را نپذیرفت. می‌توانید پیشنهاد دیگری بدهید.", data: { status: "declined", listingId: d.listingId } });
      paint();
    } else if (act === "connect" && note) {
      const d = note.data || {};
      close();
      if (window.MARQUE_CHAT && window.MARQUE_CHAT.connectWithBuyer) window.MARQUE_CHAT.connectWithBuyer({ listingId: d.listingId, buyerPhone: d.buyerPhone, buyerName: d.buyerName });
    } else if (act === "chatSeller" && note) {
      MR_NOTIFS.markRead(me(), note.id); close();
      if (window.MARQUE_CHAT) window.MARQUE_CHAT.startForListing((note.data || {}).listingId);
    }
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  window.addEventListener("storage", (e) => { if (e.key === "mr_notifs_v1") { updateBadges(); const p = document.getElementById("mrNotifPanel"); if (p && !p.hidden) paint(); } });
  // Badge safety refresh only: the open panel is repainted by explicit actions,
  // storage events and SSE notifications, not by rebuilding its DOM every 2.5s.
  setInterval(() => { if (!document.hidden) updateBadges(); }, 15000);
  // Live updates (server push, js/47-live.js)
  window.addEventListener("carma:live", (e) => {
    if (!e.detail || e.detail.t !== "notifications" || !serverMode()) return;
    refreshServerNotes().then(() => { const p = document.getElementById("mrNotifPanel"); if (p && !p.hidden) paint(); });
  });
  document.addEventListener("DOMContentLoaded", () => { if(serverMode()) refreshServerNotes(); else updateBadges(); });
  setTimeout(() => { if(serverMode()) refreshServerNotes(); else updateBadges(); }, 300);

  window.MR_NOTIF_UI = { open, close, followed, refresh: updateBadges };
})();
