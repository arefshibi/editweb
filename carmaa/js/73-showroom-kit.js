/* CM-SHOWROOM-KIT v1 — «ابزار نمایشگاه» زیر کارت نمایشگاه در صفحه‌ی حساب:
   آمار ۷ روز گذشته، پوستر استوری آگهی‌ها، QR قابل‌چاپ برای شیشه، لینک بایو. */
(function () {
  if (window.__cmShowroomKit) return; window.__cmShowroomKit = true;
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function fa(n) { return String(Math.round(Number(n) || 0)).replace(/[0-9]/g, function (d) { return FA[d]; }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(m) { try { if (typeof showToast === "function") return showToast(m); } catch (e) {} }
  function S() { return typeof state !== "undefined" ? state : null; }
  function dealer() { var s = S(); return s && s.dealership && s.dealership.status === "approved" ? s.dealership : null; }
  function myId() { var s = S(); try { return s && s.account && typeof sellerIdForPhone === "function" ? sellerIdForPhone(s.account) : ""; } catch (e) { return ""; } }
  function pubUrl(id) { try { if (window.MARQUE_TRUST && window.MARQUE_TRUST.sellerPublicUrl) return window.MARQUE_TRUST.sellerPublicUrl(id); } catch (e) {} return location.href; }
  function photoOf(l) { return (Array.isArray(l.photos) ? l.photos.filter(Boolean)[0] : l.photo) || ""; }
  function titleOf(l) { return String(l.adTitle || l.title || ((l.brand || "") + " " + (l.model || "")) || "آگهی").trim(); }
  function myListings() {
    var out = [];
    try { var p = typeof sellerProfileById === "function" ? sellerProfileById(myId()) : null; if (p && Array.isArray(p.listings)) out = p.listings.slice(); } catch (e) {}
    if (!out.length) { try { (S().myListings || []).forEach(function (e) { if (e && e.listing) out.push(e.listing); }); } catch (e) {} }
    return out.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  /* ---------- stats ---------- */
  var cache = { at: 0, data: null, busy: null };
  function loadStats() {
    if (!(window.CARMA_API && window.CARMA_API.enabled && window.CARMA_API.request)) return Promise.resolve(null);
    if (cache.data && Date.now() - cache.at < 60000) return Promise.resolve(cache.data);
    if (cache.busy) return cache.busy;
    cache.busy = window.CARMA_API.request("/showrooms/mine/report")
      .then(function (d) { cache.data = d; cache.at = Date.now(); return d; })
      .catch(function () { return null; })
      .then(function (d) { cache.busy = null; return d; });
    return cache.busy;
  }
  function statsHTML(d) {
    if (!d || !d.last7) return "";
    var s = d.last7;
    function cell(n, l) { return '<div class="cmk-st"><b>' + fa(n) + "</b><span>" + l + "</span></div>"; }
    var h = '<div class="cmk-stats">' + cell(s.views, "بازدید") + cell(s.chats, "مشتری پیام‌داده") + cell(s.contacts, "تماس") + cell(s.followers, "دنبال‌کننده‌ی جدید") + "</div>";
    if (s.top && s.top.views > 0) h += '<div class="cmk-top">پربازدیدترین آگهی: <b>' + esc(s.top.title) + "</b> · " + fa(s.top.views) + " بازدید</div>";
    return h + '<div class="cmk-note">آمار ۷ روز گذشته · گزارش کامل هر جمعه می‌آید</div>';
  }

  /* ---------- sheet ---------- */
  function closeSheet() { var o = document.querySelector(".cmk-ov"); if (o) o.remove(); }
  function openSheet(title, body) {
    closeSheet();
    var o = document.createElement("div"); o.className = "cmk-ov";
    o.innerHTML = '<div class="cmk-bd" data-cmk-act="close"></div><div class="cmk-sheet" role="dialog" aria-modal="true"><div class="cmk-grab"></div><div class="cmk-sh"><b>' + esc(title) + '</b><button type="button" class="cmk-x" data-cmk-act="close" aria-label="بستن">×</button></div><div class="cmk-sb">' + body + "</div></div>";
    document.body.appendChild(o);
    requestAnimationFrame(function () { o.classList.add("on"); });
    return o;
  }

  /* ---------- QR ---------- */
  var QR_LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"];
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  async function ensureQR() {
    if (window.QRCode) return true;
    for (var i = 0; i < QR_LIBS.length; i++) { try { await loadScript(QR_LIBS[i]); if (window.QRCode) return true; } catch (e) {} }
    return false;
  }
  async function makeQR(text) {
    if (!(await ensureQR())) return null;
    try {
      var host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
      document.body.appendChild(host);
      new window.QRCode(host, { text: text, width: 760, height: 760, colorDark: "#1D1D1F", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
      var cv = host.querySelector("canvas");
      var out = document.createElement("canvas"); out.width = 760; out.height = 760;
      if (cv) out.getContext("2d").drawImage(cv, 0, 0, 760, 760);
      host.remove();
      return cv ? out : null;
    } catch (e) { return null; }
  }
  function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  async function drawPrint(d, url, qr) {
    try { await Promise.all([document.fonts.load('800 60px "Vazirmatn"'), document.fonts.load('500 30px "Vazirmatn"'), document.fonts.load('600 120px "Fredoka"', "Carma")]); } catch (e) {}
    var W = 1240, H = 1754, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#08090b"; x.fillRect(0, 0, W, 300);
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#ffffff"; x.font = '600 128px "Fredoka", sans-serif'; x.fillText("Carma", W / 2, 195);
    x.direction = "rtl";
    var name = String(d.name || "نمایشگاه"), px = 96;
    do { x.font = "800 " + px + 'px "Vazirmatn", sans-serif'; px -= 4; } while (x.measureText(name).width > W - 160 && px > 40);
    x.fillStyle = "#08090b"; x.fillText(name, W / 2, 470);
    x.font = '500 40px "Vazirmatn", sans-serif'; x.fillStyle = "#5b6168";
    x.fillText(d.city ? "نمایشگاه خودرو · " + d.city : "نمایشگاه خودرو", W / 2, 545);
    var QS = 760, fx = (W - QS) / 2 - 40, fy = 620;
    rr(x, fx, fy, QS + 80, QS + 80, 56); x.lineWidth = 8; x.strokeStyle = "#08090b"; x.stroke();
    if (qr) x.drawImage(qr, fx + 40, fy + 40, QS, QS);
    x.fillStyle = "#08090b"; x.font = '800 62px "Vazirmatn", sans-serif';
    x.fillText("اسکن کن، همه‌ی خودروهای ما را ببین", W / 2, 1565);
    x.direction = "ltr"; x.font = '500 34px "Vazirmatn", sans-serif'; x.fillStyle = "#5b6168";
    x.fillText(String(url).replace(/^https?:\/\//, ""), W / 2, 1640);
    x.fillStyle = "#08090b"; x.fillRect(0, H - 56, W, 56);
    return new Promise(function (ok, no) { c.toBlob(function (b) { b ? ok(b) : no(new Error("blob")); }, "image/png"); });
  }
  var qrBlob = null, qrName = "carma-qr.png";
  function openQR() {
    var d = dealer(); if (!d) return;
    var url = pubUrl(myId());
    var o = openSheet("QR شیشه‌ی نمایشگاه",
      '<div class="cmk-qrbox"><div class="cmk-load">در حال ساخت…</div><img class="cmk-qrimg" alt="QR نمایشگاه" hidden></div>' +
      '<p class="cmk-hint">برگه‌ی A4 آماده‌ی چاپ؛ بزن روی شیشه یا میز نمایشگاه.</p>' +
      '<button type="button" class="cmk-main" data-cmk-act="qrsave" disabled>ذخیره‌ی تصویر A4</button>' +
      '<button type="button" class="cmk-sub" data-cmk-act="bio">کپی لینک نمایشگاه</button>');
    qrName = "carma-qr-" + String(d.slug || "showroom") + ".png";
    makeQR(url).then(function (qr) {
      if (!qr) throw new Error("qr");
      return drawPrint(d, url, qr);
    }).then(function (blob) {
      qrBlob = blob;
      var img = o.querySelector(".cmk-qrimg"), ld = o.querySelector(".cmk-load");
      if (!img) return;
      img.src = URL.createObjectURL(blob); img.hidden = false; if (ld) ld.remove();
      var b = o.querySelector('[data-cmk-act="qrsave"]'); if (b) b.disabled = false;
    }).catch(function () { var ld = o.querySelector(".cmk-load"); if (ld) ld.textContent = "ساخت QR ممکن نشد؛ اینترنت را بررسی کن"; });
  }
  async function saveQR() {
    if (!qrBlob) return;
    try {
      var f = new File([qrBlob], qrName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: "QR نمایشگاه" }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    var a = document.createElement("a"); a.href = URL.createObjectURL(qrBlob); a.download = qrName; document.body.appendChild(a); a.click(); a.remove();
    toast("تصویر ذخیره شد");
  }

  /* ---------- actions ---------- */
  var pickList = [];
  function openPicker() {
    pickList = myListings().slice(0, 30);
    if (!pickList.length) { toast("هنوز آگهی‌ای ثبت نکرده‌ای"); return; }
    var rows = pickList.map(function (l, i) {
      var ph = photoOf(l);
      return '<button type="button" class="cmk-row" data-cmk-act="pick" data-i="' + i + '"><span class="cmk-th">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy">' : "") + '</span><span class="cmk-rt">' + esc(titleOf(l)) + '</span><span class="cmk-go">پوستر ←</span></button>';
    }).join("");
    openSheet("پوستر استوری کدام آگهی؟", '<div class="cmk-list">' + rows + "</div>");
  }
  function copyBio() {
    var url = pubUrl(myId());
    var done = function () { toast("لینک کپی شد — توی بیوی اینستاگرامت بذار"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(function () { window.prompt("لینک نمایشگاه", url); });
    else window.prompt("لینک نمایشگاه", url);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-cmk-act]"); if (!el) return;
    var a = el.getAttribute("data-cmk-act");
    if (a === "close") { closeSheet(); return; }
    e.preventDefault();
    if (a === "poster") openPicker();
    else if (a === "qr") openQR();
    else if (a === "qrsave") saveQR();
    else if (a === "bio") copyBio();
    else if (a === "banner") { var id = myId(); if (id && typeof window.openShowroomPoster === "function") window.openShowroomPoster(id); }
    else if (a === "pick") {
      var l = pickList[Number(el.getAttribute("data-i"))]; closeSheet();
      if (l && typeof window.openSharePoster === "function") setTimeout(function () { window.openSharePoster(l); }, 60);
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  /* ---------- card ---------- */
  var IC = {
    poster: '<path d="M4 4h16v16H4z"/><path d="M4 15l4.5-4.5 4 4 3-3L20 16"/><circle cx="9" cy="8.5" r="1.4"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h3v3h-3zM19 14v1M14 19h1M18 18h2v2h-2z"/>',
    bio: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    banner: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9.5 18.5h5"/>'
  };
  function ico(k) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + "</svg>"; }
  function btn(act, k, t, s) { return '<button type="button" class="cmk-b" data-cmk-act="' + act + '">' + ico(k) + "<b>" + t + "</b><span>" + s + "</span></button>"; }
  function fill(root) {
    var box = root.querySelector("[data-cmk-stats]"); if (!box) return;
    loadStats().then(function (d) { if (root.isConnected) box.innerHTML = statsHTML(d); });
  }
  function inject() {
    if (!dealer()) return;
    var card = document.querySelector('[data-page="account"] .dealership-card'); if (!card) return;
    var nx = card.nextElementSibling; if (nx && nx.hasAttribute("data-cmk-root")) return;
    var root = document.createElement("section"); root.className = "cmk"; root.setAttribute("data-cmk-root", "");
    root.innerHTML = '<div class="cmk-h"><b>ابزار نمایشگاه</b><span>هر روز یه دلیل برای سر زدن به کارما</span></div>' +
      '<div data-cmk-stats>' + (cache.data ? statsHTML(cache.data) : "") + "</div>" +
      '<div class="cmk-grid">' + btn("poster", "poster", "پوستر استوری آگهی", "یک‌لمسی، آماده‌ی اینستاگرام") + btn("qr", "qr", "QR شیشه‌ی نمایشگاه", "برگه‌ی A4 قابل‌چاپ") +
      btn("bio", "bio", "لینک بایو", "کپی لینک اختصاصی") + btn("banner", "banner", "بنر استوری نمایشگاه", "با لوگو و QR") + "</div>";
    card.insertAdjacentElement("afterend", root);
    fill(root);
  }
  var pend = false;
  function sched() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { inject(); } catch (e) {} }); }
  new MutationObserver(sched).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", sched);
  sched();

  var st = document.createElement("style");
  st.textContent =
    ".cmk{direction:rtl;margin:12px 16px;padding:16px;border-radius:22px;background:#101215;border:1px solid rgba(255,255,255,.07);box-shadow:0 14px 34px rgba(0,0,0,.45);color:#eceef0;font-family:inherit}" +
    ".cmk-h{display:flex;flex-direction:column;gap:3px;margin-bottom:12px}.cmk-h b{font-size:15px;font-weight:800}.cmk-h span{font-size:12px;color:#8f959a}" +
    ".cmk-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}" +
    ".cmk-st{background:#171a1e;border-radius:14px;padding:10px 4px;text-align:center;display:flex;flex-direction:column;gap:4px}.cmk-st b{font-size:19px;font-weight:800}.cmk-st span{font-size:10.5px;color:#8f959a;line-height:1.5}" +
    ".cmk-top{font-size:12px;color:#b9bec3;margin:2px 2px 4px;line-height:1.8}.cmk-top b{color:#fff;font-weight:700}.cmk-note{font-size:11px;color:#6d737a;margin:0 2px 12px}" +
    ".cmk-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".cmk-b{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:right;padding:13px;border-radius:16px;background:#171a1e;border:1px solid rgba(255,255,255,.06);color:#eceef0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".cmk-b:active{transform:scale(.97)}.cmk-b svg{margin-bottom:4px}.cmk-b b{font-size:13px;font-weight:800}.cmk-b span{font-size:11px;color:#8f959a}" +
    ".cmk-ov{position:fixed;inset:0;z-index:100000;direction:rtl}.cmk-bd{position:absolute;inset:0;background:rgba(0,0,0,.6);opacity:0;transition:opacity .2s}" +
    ".cmk-sheet{position:absolute;left:0;right:0;bottom:0;max-height:86vh;display:flex;flex-direction:column;background:#101215;color:#eceef0;border-radius:26px 26px 0 0;padding:8px 16px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .28s cubic-bezier(.2,.8,.2,1);font-family:inherit}" +
    ".cmk-ov.on .cmk-bd{opacity:1}.cmk-ov.on .cmk-sheet{transform:none}" +
    ".cmk-grab{width:38px;height:4px;border-radius:4px;background:#2b3036;margin:4px auto 10px}.cmk-sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.cmk-sh b{font-size:16px;font-weight:800}" +
    ".cmk-x{width:34px;height:34px;border-radius:50%;border:0;background:#1b1e22;color:#c9cdd1;font-size:20px;line-height:1;cursor:pointer}.cmk-sb{overflow:auto;-webkit-overflow-scrolling:touch}" +
    ".cmk-list{display:flex;flex-direction:column;gap:8px}.cmk-row{display:flex;align-items:center;gap:12px;padding:8px;border-radius:16px;border:0;background:#171a1e;color:#eceef0;font:inherit;text-align:right;cursor:pointer}" +
    ".cmk-th{flex:0 0 64px;height:48px;border-radius:10px;background:#22262b;overflow:hidden}.cmk-th img{width:100%;height:100%;object-fit:cover;display:block}.cmk-rt{flex:1;min-width:0;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cmk-go{font-size:11.5px;color:#8f959a}" +
    ".cmk-qrbox{display:flex;justify-content:center;align-items:center;min-height:200px;background:#171a1e;border-radius:18px;padding:12px;margin-bottom:10px}.cmk-qrimg{max-width:100%;max-height:46vh;border-radius:8px;display:block}.cmk-load{font-size:13px;color:#8f959a}" +
    ".cmk-hint{font-size:12px;color:#8f959a;margin:0 2px 12px;line-height:1.9}" +
    ".cmk-main,.cmk-sub{display:block;width:100%;height:50px;border-radius:16px;border:0;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer;margin-top:8px}.cmk-main{background:#eceef0;color:#08090b}.cmk-main:disabled{opacity:.45}.cmk-sub{background:#1b1e22;color:#eceef0}";
  document.head.appendChild(st);
})();
