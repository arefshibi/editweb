"use strict";
/*
 * C♻️RMA trust & transparency features (front-end implementation).
 * Storage is browser-local for now. Sensitive decisions and notifications
 * must move to a server before production use; the UI never calls this a
 * real verification service.
 */
(function () {
  const STORE = {
    history: "marque_listing_price_history_v1",
    reports: "marque_listing_reports_v1",
    offers: "marque_listing_offers_v1",
    searches: "marque_saved_searches_v1",
    dealerSlugs: "marque_dealer_slugs_v1",
  };
  const esc = (value) => typeof escHtml === "function" ? escHtml(String(value == null ? "" : value)) : String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
  const fa = (n) => Number(n || 0).toLocaleString("fa-IR");
  const read = (key, fallback) => { try { const x = JSON.parse(localStorage.getItem(key) || "null"); return x == null ? fallback : x; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { if (typeof showToast === "function") showToast("فضای ذخیره‌سازی مرورگر کافی نیست."); return false; } };
  const listingById = (id) => (Array.isArray(LISTINGS) ? LISTINGS.find(x => String(x.id) === String(id)) : null) || (state.myListings || []).map(x => x.listing).find(x => x && String(x.id) === String(id)) || null;
  const amountOf = (listing) => {
    const raw = listing && (listing.priceAmount != null ? listing.priceAmount : listing.price);
    const digits = String(raw == null ? "" : raw).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, "");
    const n = Number(digits); return Number.isFinite(n) && n > 0 ? n : null;
  };
  const money = (amount) => amount == null ? "توافقی" : `${Number(amount).toLocaleString("fa-IR")} تومان`;
  function ageLabel(ts) {
    let stamp = Number(ts);
    if (!Number.isFinite(stamp) && typeof ts === "string") stamp = Date.parse(ts);
    if (!Number.isFinite(stamp) || stamp <= 0) return "زمان ثبت نامشخص";
    const mins = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
    if (mins < 60) return `ثبت‌شده ${fa(Math.max(1, mins))} دقیقه پیش`;
    const hours = Math.floor(mins / 60); if (hours < 24) return `ثبت‌شده ${fa(hours)} ساعت پیش`;
    const days = Math.floor(hours / 24); return `ثبت‌شده ${fa(days)} روز پیش`;
  }
  function historyStore() { return read(STORE.history, {}); }
  function listingHistory(id) { const all = historyStore(); return Array.isArray(all[id]) ? all[id].slice().sort((a,b) => a.changedAt - b.changedAt) : []; }
  function recordPriceChange(previous, next) {
    if (!previous || !next || String(previous.id) !== String(next.id)) return;
    const oldPrice = amountOf(previous), newPrice = amountOf(next);
    if (oldPrice == null || newPrice == null || oldPrice === newPrice) return;
    const all = historyStore(); const rows = Array.isArray(all[next.id]) ? all[next.id] : [];
    rows.push({ oldPrice, newPrice, changedAt: Date.now() });
    all[next.id] = rows.slice(-30); write(STORE.history, all);
  }
  function chartMarkup(rows) {
    if (!rows.length) return "";
    const vals = rows.flatMap(r => [Number(r.oldPrice), Number(r.newPrice)]).filter(Number.isFinite);
    if (vals.length < 2) return "";
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const points = vals.map((v,i) => `${8 + i * (184 / Math.max(1, vals.length - 1))},${58 - ((v - min) / span) * 42}`).join(" ");
    return `<svg class="mr-price-chart" viewBox="0 0 200 64" role="img" aria-label="نمودار تغییر قیمت"><line x1="8" y1="58" x2="192" y2="58"/><polyline points="${points}"/><circle cx="${8 + (vals.length - 1) * (184 / Math.max(1, vals.length - 1))}" cy="${58 - ((vals[vals.length - 1] - min) / span) * 42}" r="3.5"/></svg>`;
  }
  function historyHTML(listing) {
    const rows = listingHistory(listing.id);
    const detail = rows.length ? `${chartMarkup(rows)}<ol class="mr-history-list">${rows.slice().reverse().map(row => `<li class="${row.newPrice < row.oldPrice ? "is-down" : "is-up"}"><span class="mr-history-dot"></span><span><b>${esc(money(row.newPrice))}</b><small>${row.newPrice < row.oldPrice ? "کاهش" : "افزایش"} از ${esc(money(row.oldPrice))}</small></span><time>${esc(new Date(row.changedAt).toLocaleDateString("fa-IR"))}</time></li>`).join("")}</ol>` : `<p class="mr-trust-muted">در اطلاعات فعلی، تغییری برای این آگهی ثبت نشده است. تغییرات بعدی قیمت در همین مرورگر ثبت می‌شوند.</p>`;
    const icon = '<span class="mr-history-sum-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/></svg></span>';
    const badge = rows.length ? `<em class="mr-history-sum-badge">${fa(rows.length)} تغییر</em>` : "";
    return `<summary>${icon}<span class="mr-history-sum-text">مشاهده سوابق قیمت</span>${badge}</summary><div class="mr-history-content">${detail}<p class="mr-trust-footnote">سوابق بر اساس اطلاعات ثبت‌شده در سایت نمایش داده می‌شوند و جایگزین کارشناسی خودرو نیستند.</p></div>`;
  }
  function accountKey() { const phone = String(state.account || ""); if (!phone) return ""; try { return typeof sellerIdForPhone === "function" ? sellerIdForPhone(phone) : phone; } catch (_) { return phone; } }
  function reportExists(id) {
    const reports = read(STORE.reports, []); return reports.some(r => r.listingId === String(id) && r.reporterId === accountKey());
  }
  function reportMarkup(listing) {
    const reportsDone = !!state.account && reportExists(listing.id);
    return `<button type="button" class="mr-trust-report" data-action="reportCarListing" data-id="${esc(listing.id)}" ${reportsDone ? "disabled" : ""}><span aria-hidden="true">⚑</span>${reportsDone ? "گزارش شما ثبت شده" : "این آگهی مشکل دارد؟"}</button>`;
  }
  window.renderMarketplaceTrustFeatures = function (root, listing) {
    if (!root || !listing) return;
    { /* CM-SPLIT-CTA */ const ob = root.querySelector('[data-slot-id="offer-sticky"]'); if (ob) { ob.dataset.id = String(listing.id); ob.hidden = !(listing.acceptsOffers === true && !listing.negotiable && amountOf(listing) != null); } }
    const priceCard = root.querySelector(".price-card");
    if (!priceCard) return;

    // Put the offer CTA immediately below the displayed price, inside the price card.
    const priceLine = priceCard.querySelector(".price-line");

    // Price-history disclosure sits directly under the price (no box, no heading).
    let historyEl = priceCard.querySelector(".mr-price-history");
    const wasOpen = !!(historyEl && historyEl.open);
    if (false && !historyEl && priceLine) {
      historyEl = document.createElement("details");
      historyEl.className = "mr-price-history";
      priceLine.insertAdjacentElement("afterend", historyEl);
    }
    if (historyEl) { historyEl.innerHTML = historyHTML(listing); if (wasOpen) historyEl.open = true; }

    // Report link lives under the gallery card, without any box.
    const reportSlot = root.querySelector('[data-slot="report-slot"]');
    if (reportSlot) reportSlot.innerHTML = reportMarkup(listing);

    { const legacy = priceCard.querySelector(".mr-price-offer-button"); if (legacy) legacy.remove(); const lp = priceCard.querySelector("[data-inline-offer]"); if (lp) lp.remove(); }

  };

  function openDialog(title, body, className) {
    let host = document.getElementById("mrTrustDialog");
    if (!host) { host = document.createElement("div"); host.id = "mrTrustDialog"; host.className = "mr-trust-dialog"; host.hidden = true; document.body.appendChild(host); }
    host.className = `mr-trust-dialog ${className || ""}`;
    host.innerHTML = `<button type="button" class="mr-trust-backdrop" data-trust-action="close" aria-label="بستن پنجره"></button><section class="mr-trust-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><small>C♻️RMA · شفافیت معامله</small><h2>${esc(title)}</h2></div><button type="button" class="mr-trust-close" data-trust-action="close" aria-label="بستن">×</button></header><div class="mr-trust-sheet-body">${body}</div></section>`;
    host.hidden = false; document.documentElement.classList.add("mr-trust-dialog-open");
    const first = host.querySelector("input,button,textarea,select"); if (first) setTimeout(() => first.focus({preventScroll:true}), 20);
  }
  function closeDialog() { const host = document.getElementById("mrTrustDialog"); if (host) host.hidden = true; document.documentElement.classList.remove("mr-trust-dialog-open"); }
  function requestLogin(message) {
    if (typeof resetOtpVerifiedAnimation === "function") resetOtpVerifiedAnimation();
    state = { ...state, modal: { type: "login", reason: message || "برای ادامه ابتدا وارد حساب کاربری شوید." }, loginStep: "phone", loginPhone: "", loginReturnTo: state.route };
    if (typeof render === "function") render(); else if (typeof updateOverlays === "function") updateOverlays();
  }
  function openReport(listing) {
    if (!state.account) { requestLogin("برای گزارش مشکل آگهی باید وارد حساب کاربری شوید."); return; }
    if (reportExists(listing.id)) { if (typeof showToast === "function") showToast("قبلاً برای این آگهی گزارش ثبت کرده‌اید."); return; }
    const reasons = ["قیمت غیرواقعی", "خودرو فروخته شده", "عکس تکراری یا نامرتبط", "اطلاعات نادرست", "احتمال کلاهبرداری"];
    openDialog("گزارش مشکل آگهی", `<form data-trust-form="report" data-listing-id="${esc(listing.id)}"><p class="mr-trust-intro">دلیل را انتخاب کنید تا بررسی آگهی دقیق‌تر انجام شود.</p><div class="mr-report-options">${reasons.map((r,i) => `<label><input type="radio" name="reason" value="${esc(r)}" ${i===0?"checked":""}><span>${esc(r)}</span></label>`).join("")}</div><label class="mr-trust-field"><span>توضیحات تکمیلی <small>(اختیاری)</small></span><textarea name="note" rows="3" maxlength="500" placeholder="جزئیات مشکل را بنویسید…"></textarea></label><p class="mr-trust-muted">${window.CARMA_API?.enabled ? "گزارش شما برای بررسی مدیر در سرور ثبت می‌شود." : "گزارش در همین مرورگر ذخیره می‌شود و برای مدیر ارسال نمی‌شود."}</p><button class="mr-trust-primary" type="submit">ثبت گزارش</button></form>`);
  }
  /* CM-SPLIT-CTA — پاپ‌آپ‌های نوار پایین (ارتباط با فروشنده + پیشنهاد قیمت) */
  function cmSheet(cls, inner, label) {
    document.querySelectorAll(".cm-sheet").forEach(function (n) { n.remove(); });
    var wrap = document.createElement("div");
    wrap.className = "cm-sheet " + cls;
    wrap.innerHTML = '<div class="cm-sheet-backdrop" data-cm-close></div><div class="cm-sheet-card" role="dialog" aria-modal="true" dir="rtl" aria-label="' + esc(label) + '"><div class="cm-sheet-handle" aria-hidden="true"></div>' + inner + '</div>';
    function onKey(e) { if (e.key === "Escape") close(); }
    function close() { if (wrap.classList.contains("is-closing")) return; wrap.classList.add("is-closing"); document.removeEventListener("keydown", onKey); setTimeout(function () { wrap.remove(); }, 260); }
    wrap.addEventListener("click", function (e) { if (e.target.closest('[data-cm-close],[data-action="closeInlineOffer"]')) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap._close = close;
    return wrap;
  }
  var CM_SVG = function (d) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var CM_ICON = {
    chat: CM_SVG('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
    phone: CM_SVG('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    cart: CM_SVG('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/>'),
    swap: CM_SVG('<path d="M4 8h15m0 0-4-4m4 4-4 4M20 16H5m0 0 4-4m-4 4 4 4"/>')
  };
  function openContactChooser(listing) {
    var id = String(listing.id);
    var sheet = cmSheet("cm-contact",
      '<h3 class="cm-sheet-title">ارتباط با فروشنده</h3>' +
      '<button type="button" class="cm-opt" data-cm-chat><span class="cm-opt-ic">' + CM_ICON.chat + '</span><span class="cm-opt-tx"><b>گفت‌وگوی آنلاین</b><small>همین‌جا پیام بده، فروشنده جواب می‌دهد</small></span></button>' +
      '<button type="button" class="cm-opt" data-cm-call><span class="cm-opt-ic">' + CM_ICON.phone + '</span><span class="cm-opt-tx"><b>تماس تلفنی</b><small>نمایش شماره‌ی فروشنده</small></span></button>' +
      '<button type="button" class="cm-cancel" data-cm-close>بستن</button>', "ارتباط با فروشنده");
    sheet.querySelector("[data-cm-chat]").addEventListener("click", function () {
      sheet._close();
      var b = document.createElement("button"); b.type = "button"; b.hidden = true;
      b.setAttribute("data-action", "startListingChat"); b.dataset.id = id;
      document.body.appendChild(b); b.click(); b.remove();
    });
    sheet.querySelector("[data-cm-call]").addEventListener("click", function () {
      sheet._close();
      var a = document.querySelector('[data-slot="phone-sticky"]');
      if (a) { a.dataset.id = id; a.click(); }
    });
  }
  function openOffer(listing) { /* CM-SPLIT-CTA2 */
    if (!state.account) { requestLogin("برای ارسال پیشنهاد قیمت باید وارد حساب کاربری شوید."); return; }
    var listingId = String(listing.id);
    var offers = read(STORE.offers, []), dayAgo = Date.now() - 86400000;
    var used = offers.filter(function (o) { return o.listingId === listingId && o.buyerId === accountKey() && o.createdAt >= dayAgo; }).length;
    if (used >= 3) { if (typeof showToast === "function") showToast("برای این آگهی امروز به سقف ۳ پیشنهاد رسیده‌اید."); return; }
    var price = amountOf(listing), canTrade = listing.tradeIn === true;
    var sheet = cmSheet("cm-offer",
      '<h3 class="cm-sheet-title">پیشنهاد قیمت</h3>' +
      '<div class="cm-offer-body"><form data-cm-offer-form novalidate>' +
        '<div class="cm-modes"><button type="button" class="cm-mode is-on" data-mode="buy">' + CM_ICON.cart + '<b>خرید</b><small>پیشنهاد نقدی برای خرید</small></button>' +
        (canTrade ? '<button type="button" class="cm-mode" data-mode="trade">' + CM_ICON.swap + '<b>معاوضه</b><small>معاوضه با خودروی من</small></button>' : '') + '</div>' +
        '<div class="cm-kinds" hidden><button type="button" class="cm-kind is-on" data-kind="swap">کلید به کلید</button><button type="button" class="cm-kind" data-kind="pay">من سر می‌دهم</button><button type="button" class="cm-kind" data-kind="get">من سر می‌گیرم</button></div>' +
        '<label class="cm-field" data-cm-amount><span data-cm-label>مبلغ پیشنهادی (تومان) <i>*</i></span><input type="number" name="amount" inputmode="numeric" min="1" placeholder="' + (price != null ? esc(String(price)) : "") + '"></label>' +
        '<small class="cm-hint" data-cm-hint></small>' +
        '<label class="cm-field"><textarea name="message" rows="3" maxlength="300" placeholder="پیام (اختیاری)"></textarea></label>' +
        '<div class="cm-err" role="alert" hidden></div>' +
        '<div class="cm-actions"><button type="button" data-cm-close>انصراف</button><button type="submit">ثبت پیشنهاد</button></div>' +
      '</form></div>', "پیشنهاد قیمت");
    var form = sheet.querySelector("form"), body = sheet.querySelector(".cm-offer-body"), hint = sheet.querySelector("[data-cm-hint]"),
        errBox = sheet.querySelector(".cm-err"), kinds = sheet.querySelector(".cm-kinds"), amountWrap = sheet.querySelector("[data-cm-amount]"),
        label = sheet.querySelector("[data-cm-label]"), input = form.elements.amount, text = form.elements.message,
        submitBtn = form.querySelector('[type="submit"]'), mode = "buy", kind = "swap";
    function showErr(m) { errBox.textContent = m; errBox.hidden = !m; }
    function refresh() {
      var trade = mode === "trade";
      kinds.hidden = !trade;
      amountWrap.hidden = trade && kind === "swap";
      var lt = (!trade ? "مبلغ پیشنهادی (تومان)" : kind === "pay" ? "مبلغ سری که می‌دهم (تومان)" : "مبلغ سری که می‌گیرم (تومان)") + " <i>*</i>"; /* CM-OFFER-V2: فقط وقتی تغییر کرده DOM را بنویس */
      if (label.dataset.cm !== lt) { label.dataset.cm = lt; label.innerHTML = lt; }
      var ph = trade ? "خودروی شما برای معاوضه (مدل، سال، کارکرد)…" : "پیام (اختیاری)"; if (text.placeholder !== ph) text.placeholder = ph;
      var v = Number(input.value);
      hint.textContent = amountWrap.hidden ? "معاوضه‌ی مستقیم، بدون پرداخت وجه از هیچ طرف" : (v > 0 ? v.toLocaleString("fa-IR") + " تومان" : (!trade && price != null ? "قیمت آگهی: " + money(price) : ""));
      showErr("");
    }
    refresh();
    input.addEventListener("input", refresh);
    form.addEventListener("click", function (e) {
      var m = e.target.closest(".cm-mode"), k = e.target.closest(".cm-kind");
      if (m) { mode = m.dataset.mode; form.querySelectorAll(".cm-mode").forEach(function (x) { x.classList.toggle("is-on", x === m); }); refresh(); }
      if (k) { kind = k.dataset.kind; form.querySelectorAll(".cm-kind").forEach(function (x) { x.classList.toggle("is-on", x === k); }); refresh(); }
    });
    function done(msgText) {
      body.innerHTML = '<div class="mr-inline-offer-result"><span class="mr-inline-offer-result-icon" aria-hidden="true">✓</span><div><strong>پیشنهاد شما ثبت شد</strong><p>' + esc(msgText) + '</p></div></div><div class="cm-actions"><button type="button" data-cm-close>بستن</button></div>';
      if (typeof showToast === "function") showToast("پیشنهاد شما برای فروشنده ارسال شد.");
      setTimeout(function () { if (sheet.isConnected) sheet._close(); }, 2600);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault(); e.stopPropagation();
      var msg = String(text.value || "").trim(), amount, note = msg, trade = mode === "trade";
      if (!trade || kind !== "swap") {
        amount = Math.round(Number(input.value));
        if (!(amount > 0)) { showErr(trade ? "مبلغ سر را وارد کنید." : "مبلغ پیشنهادی معتبر وارد کنید."); return; }
      }
      if (trade) {
        if (kind === "swap") { amount = price != null && price > 0 ? Math.round(price) : 1; note = "پیشنهاد معاوضه: کلید به کلید (بدون پرداخت وجه)" + (msg ? " — " + msg : ""); }
        else note = "پیشنهاد معاوضه: من " + amount.toLocaleString("fa-IR") + " تومان " + (kind === "pay" ? "سر می‌دهم" : "سر می‌گیرم") + (msg ? " — " + msg : "");
      }
      showErr("");
      if (window.CARMA_API && window.CARMA_API.enabled) {
        if (!window.CARMA_AUTH_USER || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) { showErr("برای ثبت پیشنهاد باید وارد حساب شوید و آگهی از سرور بارگذاری شده باشد."); return; }
        submitBtn.disabled = true;
        window.CARMA_API.listings.offer(listingId, amount, note).then(function () { done("پیشنهاد در سرور ثبت شد و از طریق اعلان به فروشنده اطلاع داده می‌شود."); })
          .catch(function (err) { showErr((err && err.message) || "ثبت پیشنهاد انجام نشد."); })
          .finally(function () { if (submitBtn.isConnected) submitBtn.disabled = false; });
        return;
      }
      var list = read(STORE.offers, []), d0 = Date.now() - 86400000;
      if (list.filter(function (o) { return o.listingId === listingId && o.buyerId === accountKey() && o.createdAt >= d0; }).length >= 3) { showErr("حداکثر ۳ پیشنهاد در روز مجاز است."); return; }
      var offerId = "of" + Date.now().toString(36);
      list.push({ id: offerId, listingId: listingId, buyerId: accountKey(), buyerPhone: String(state.account || ""), amount: amount, message: note, kind: trade ? kind : "buy", status: "pending", createdAt: Date.now() });
      if (!write(STORE.offers, list)) { showErr("ذخیره‌سازی مرورگر در دسترس نیست. دوباره تلاش کنید."); return; }
      try {
        var ent = MR_STORE.read().entries[listingId], owner = (ent && ent.owner) || listing.phone || "";
        if (owner && owner !== String(state.account || "")) {
          var pf = state.accountProfile || {}, bname = [pf.firstName, pf.lastName].filter(Boolean).join(" ").trim() || "یک خریدار";
          MR_NOTIFS.push(owner, { type: "offer", icon: "offer", title: trade ? "پیشنهاد معاوضه‌ی جدید" : "پیشنهاد قیمت جدید",
            body: bname + " برای «" + (listing.title || listing.brand || "خودرو") + "» " + (trade ? note : money(amount) + " پیشنهاد داد."),
            data: { offerId: offerId, listingId: listingId, buyerPhone: String(state.account || ""), buyerName: bname, amount: amount, status: "pending" } });
        }
      } catch (_) {}
      done("پیشنهاد برای فروشنده ارسال شد. نتیجه را در بخش اعلان‌ها (زنگ بالای صفحه) می‌بینید.");
    });
    var cmCoarse = false; try { cmCoarse = window.matchMedia("(pointer:coarse)").matches; } catch (_) {} /* CM-OFFER-V2: در موبایل کیبرد خودکار باز نشود (پرش پاپ‌آپ هنگام انتخاب) */
    if (!cmCoarse) setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (_) {} }, 350);
  }
  function openOfferLegacy(listing, button) {
    if (!state.account) { requestLogin("برای ارسال پیشنهاد قیمت باید وارد حساب کاربری شوید."); return; }
    if (!button) return;

    // This is an inline disclosure below the price CTA, not a modal dialog.
    const existing = button.parentElement && button.parentElement.querySelector(':scope > [data-inline-offer]');
    if (existing) {
      existing.remove();
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-controls");
      return;
    }

    const offers = read(STORE.offers, []);
    const dayAgo = Date.now() - 86400000;
    const used = offers.filter(o => o.listingId === String(listing.id) && o.buyerId === accountKey() && o.createdAt >= dayAgo).length;
    if (used >= 3) { if (typeof showToast === "function") showToast("برای این آگهی امروز به سقف ۳ پیشنهاد رسیده‌اید."); return; }

    const listPrice = amountOf(listing);
    const panelId = `mr-inline-offer-${String(listing.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const panel = document.createElement("section");
    panel.className = "mr-inline-offer-panel";
    panel.id = panelId;
    panel.setAttribute("data-inline-offer", "");
    panel.setAttribute("aria-label", "فرم ارسال پیشنهاد قیمت");
    panel.innerHTML = `<div class="mr-inline-offer-head"><div><strong>پیشنهاد خود را وارد کنید</strong><p>مبلغ پیشنهادی برای این خودرو</p></div><button type="button" class="mr-inline-offer-close" data-action="closeInlineOffer" aria-label="بستن فرم پیشنهاد قیمت">×</button></div><form data-trust-form="offer" data-listing-id="${esc(listing.id)}"><label class="mr-trust-field"><span>مبلغ پیشنهادی شما (تومان)</span><input type="number" name="amount" inputmode="numeric" min="1" required placeholder="مثلاً ۲٬۴۵۰٬۰۰۰٬۰۰۰"></label><label class="mr-trust-field"><span>پیام به فروشنده <small>(اختیاری)</small></span><textarea name="message" rows="2" maxlength="300" placeholder="شرایط یا زمان بازدید…"></textarea></label><button class="mr-trust-primary" type="submit">ثبت پیشنهاد قیمت</button></form>`;
    button.insertAdjacentElement("afterend", panel);
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", panelId);
  }
  // Saved searches ("جستجوهای دلخواه") were removed entirely.
  window.mountMarketplaceTrustWidgets = function () {};


  function normalizeSlugPart(value) {
    return String(value || "").trim().toLowerCase().normalize("NFKC").replace(/[\s_]+/g, "-").replace(/[^a-z0-9\u0600-\u06ff-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 52);
  }
  // Server mode: a showroom's public slug is the one stored on the server (showrooms.slug), never a browser-made one.
  const serverShowrooms = () => (Array.isArray(window.CARMA_SERVER_SHOWROOMS) ? window.CARMA_SERVER_SHOWROOMS : []);
  function serverSlugFor(id) {
    const own = state && state.dealership && String(state.dealership.id) === String(id) ? state.dealership.slug : "";
    if (own) return String(own);
    const hit = serverShowrooms().find((x) => String(x.id) === String(id));
    return hit && hit.slug ? String(hit.slug) : "";
  }
  function sellerSlug(id) {
    if (window.CARMA_API?.enabled) { const sv = serverSlugFor(id); if (sv) return sv; }
    const map = read(STORE.dealerSlugs, {}); if (map[id]) return map[id];
    const profile = typeof sellerProfileById === "function" ? sellerProfileById(id) : null;
    const name = profile && profile.name ? profile.name : "نمایشگاه";
    const tail = String(id || "dealer").replace(/[^a-z0-9]/gi, "").slice(-7).toLowerCase() || "dealer";
    const slug = `${normalizeSlugPart(name) || "namayeshgah"}-${tail}`;
    if (window.CARMA_API?.enabled) return slug; // not remembered locally in server mode
    map[id] = slug; write(STORE.dealerSlugs, map); return slug;
  }
  function resolveDealerSlug(slug) {
    const needle = String(slug || "");
    if (window.CARMA_API?.enabled) {
      if (state && state.dealership && state.dealership.slug === needle && state.dealership.id) return String(state.dealership.id);
      const hit = serverShowrooms().find((x) => String(x.slug) === needle);
      if (hit) return String(hit.id);
    }
    const map = read(STORE.dealerSlugs, {});
    const known = Object.keys(map).find(id => map[id] === needle); if (known) return known;
    const ids = new Set();
    (Array.isArray(LISTINGS) ? LISTINGS : []).forEach(l => { const seller = typeof listingSeller === "function" ? listingSeller(l) : null; if (seller && seller.type === "dealer") ids.add(seller.id); });
    (state.myListings || []).forEach(e => { const l = e && e.listing; const seller = l && typeof listingSeller === "function" ? listingSeller(l) : null; if (seller && seller.type === "dealer") ids.add(seller.id); });
    if (state.account && state.dealership && typeof sellerIdForPhone === "function") ids.add(sellerIdForPhone(state.account));
    for (const id of ids) { if (sellerSlug(id) === needle) return id; }
    return null;
  }
  function sellerPublicUrl(id) {
    const profile = typeof sellerProfileById === "function" ? sellerProfileById(id) : null;
    if (/^https?:$/.test(location.protocol)) {
      if (profile && profile.type === "dealer") return `${location.origin}/showrooms/${encodeURIComponent(sellerSlug(id))}`;
      const h = (window.CARMA_AUTH_USER && String(window.CARMA_AUTH_USER.id) === String(id) && window.CARMA_AUTH_USER.username) || (window.CARMA_USER_HANDLES || {})[String(id)] || id;
      return `${location.origin}/account/${encodeURIComponent(typeof window.prettyHandle === "function" ? window.prettyHandle(h) : h)}`;
    }
    const route = profile && profile.type === "dealer" ? `#/n/${encodeURIComponent(sellerSlug(id))}` : `#/seller/${encodeURIComponent(id)}`;
    return `${location.origin}${location.pathname}${location.search}${route}`;
  }
  function getProfileUrl() { const page = document.querySelector('[data-page="seller"]'); return page && page.dataset.publicUrl ? page.dataset.publicUrl : location.href; }
  function shareText(title, url) {
    if (navigator.share) { navigator.share({ title, text: `مشاهده ${title} در C♻️RMA`, url }).catch(() => {}); }
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => showToast("لینک عمومی کپی شد")).catch(() => window.prompt("لینک عمومی را کپی کنید", url));
    else window.prompt("لینک عمومی را کپی کنید", url);
  }

  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-action]"); if (!el) return;
    const action = el.getAttribute("data-action");
    if (action === "reportCarListing") { event.preventDefault(); const l = listingById(el.dataset.id); if (l) openReport(l); }
    else if (action === "openCarOffer") { event.preventDefault(); const l = listingById(el.dataset.id); if (l) openOffer(l, el); }
    else if (action === "openContactChooser") { event.preventDefault(); const l = listingById(el.dataset.id || (state.route && state.route.listing && state.route.listing.id)); if (l) openContactChooser(l); }
    else if (action === "closeInlineOffer") { event.preventDefault(); const panel = el.closest("[data-inline-offer]"); const card = el.closest(".price-card"); const button = card && card.querySelector(".mr-price-offer-button"); if (panel) panel.remove(); if (button) { button.setAttribute("aria-expanded", "false"); button.removeAttribute("aria-controls"); } }
    else if (action === "shareSellerPublic") { event.preventDefault(); const id = el.dataset.sellerId || (state.route && state.route.sellerId); if (id) shareText("صفحه عمومی فروشنده در C♻️RMA", sellerPublicUrl(id)); }
    else if (action === "copySellerPublic") { event.preventDefault(); const id = el.dataset.sellerId || (state.route && state.route.sellerId); if (!id) return; const url = sellerPublicUrl(id); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => showToast("لینک صفحه عمومی کپی شد")).catch(() => window.prompt("لینک صفحه عمومی", url)); else window.prompt("لینک صفحه عمومی", url); }
    else if (action === "showSellerQR") {
      event.preventDefault(); const id = el.dataset.sellerId || (state.route && state.route.sellerId); if (!id) return;
      const url = sellerPublicUrl(id), qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&format=png&margin=12&data=${encodeURIComponent(url)}`;
      openDialog("کد QR صفحه نمایشگاه", `<div class="mr-qr-wrap"><p>مشتری با اسکن این کد مستقیماً به صفحه عمومی نمایشگاه می‌رسد.</p><img src="${esc(qrUrl)}" alt="کد QR صفحه عمومی نمایشگاه" width="240" height="240" loading="eager"/><a class="mr-trust-primary" href="${esc(qrUrl)}" target="_blank" rel="noopener noreferrer">باز کردن تصویر برای ذخیره</a><button type="button" class="mr-trust-secondary" data-action="copySellerPublic" data-seller-id="${esc(id)}">کپی لینک صفحه</button><small>برای ذخیره در موبایل، تصویر را باز کنید و از منوی مرورگر گزینه ذخیره/دانلود تصویر را بزنید.</small></div>`);
    }
  });

  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-trust-action]"); if (!el) return;
    if (el.dataset.trustAction === "close") closeDialog();
  });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeDialog(); });
  document.addEventListener("submit", function (event) {
    const form = event.target.closest("form[data-trust-form]"); if (!form) return;
    event.preventDefault(); const fd = new FormData(form); const listingId = String(form.dataset.listingId || ""); const listing = listingById(listingId); if (!listing) { if (form.dataset.trustForm === "offer") { const panel = form.closest("[data-inline-offer]"); if (panel) panel.remove(); } else closeDialog(); return; }
    if (form.dataset.trustForm === "report") {
      if (window.CARMA_API?.enabled) {
        if (!window.CARMA_AUTH_USER || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) { closeDialog(); showToast("برای گزارش آگهی واقعی باید وارد شوید و آگهی از سرور بارگذاری شده باشد."); return; }
        const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
        window.CARMA_API.reports.create({listingId,reason:String(fd.get("reason")||"اطلاعات نادرست"),details:String(fd.get("note")||"").trim()}).then(()=>{closeDialog();showToast("گزارش برای بررسی مدیر ارسال شد.");}).catch(err=>showToast(err.message||"ثبت گزارش انجام نشد.")).finally(()=>{if(submit&&submit.isConnected)submit.disabled=false;});
        return;
      }
      const reports = read(STORE.reports, []); if (reports.some(r => r.listingId === listingId && r.reporterId === accountKey())) { closeDialog(); showToast("قبلاً برای این آگهی گزارش داده‌اید."); return; }
      reports.push({ id: "rp" + Date.now().toString(36), listingId, reporterId: accountKey(), reason: String(fd.get("reason") || "اطلاعات نادرست"), note: String(fd.get("note") || "").trim(), status: "new", createdAt: Date.now() }); const saved = write(STORE.reports, reports); closeDialog(); if (saved) showToast("گزارش در همین مرورگر ثبت شد."); if (typeof render === "function") render();
    } else if (form.dataset.trustForm === "offer") {
      const amount = Math.max(0, Number(fd.get("amount")) || 0); if (!amount) { showToast("مبلغ پیشنهادی معتبر وارد کنید."); return; }
      if (window.CARMA_API?.enabled) {
        if (!window.CARMA_AUTH_USER || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) { showToast("برای ثبت پیشنهاد باید وارد شوید و آگهی از سرور بارگذاری شده باشد."); return; }
        const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
        window.CARMA_API.listings.offer(listingId,Math.round(amount),String(fd.get("message")||"").trim()).then(()=>{const panel=form.closest("[data-inline-offer]");if(panel)panel.innerHTML='<div class="mr-inline-offer-result"><span class="mr-inline-offer-result-icon" aria-hidden="true">✓</span><div><strong>پیشنهاد شما ثبت شد</strong><p>پیشنهاد در سرور ثبت شد و از طریق اعلان به فروشنده اطلاع داده می‌شود.</p></div><button type="button" class="mr-inline-offer-close" data-action="closeInlineOffer" aria-label="بستن">×</button></div>';showToast("پیشنهاد قیمت ثبت شد.");}).catch(err=>showToast(err.message||"ثبت پیشنهاد انجام نشد.")).finally(()=>{if(submit&&submit.isConnected)submit.disabled=false;});
        return;
      }
      const offers = read(STORE.offers, []); const dayAgo = Date.now() - 86400000; const used = offers.filter(o => o.listingId === listingId && o.buyerId === accountKey() && o.createdAt >= dayAgo).length; if (used >= 3) { showToast("حداکثر ۳ پیشنهاد در روز مجاز است."); return; }
      // Never compare against the seller's private minimum in buyer-side JS.
      // With no backend, an offer is a local prototype record only; acceptance
      // and seller notification are deliberately not simulated or exposed.
      const status = "pending";
      const offerId = "of" + Date.now().toString(36); offers.push({ id: offerId, listingId, buyerId: accountKey(), buyerPhone: String(state.account || ""), amount, message: String(fd.get("message") || "").trim(), status, createdAt: Date.now() }); const saved = write(STORE.offers, offers);
      if (saved) { try { const ent = MR_STORE.read().entries[listingId]; const owner = (ent && ent.owner) || listing.phone || ""; if (owner && owner !== String(state.account || "")) { const pf = state.accountProfile || {}; const bname = [pf.firstName, pf.lastName].filter(Boolean).join(" ").trim() || "یک خریدار"; MR_NOTIFS.push(owner, { type: "offer", icon: "offer", title: "پیشنهاد قیمت جدید", body: bname + " برای «" + (listing.title || listing.brand || "خودرو") + "» " + money(amount) + " پیشنهاد داد.", data: { offerId, listingId, buyerPhone: String(state.account || ""), buyerName: bname, amount, status: "pending" } }); } } catch (_) {} }
      const panel = form.closest("[data-inline-offer]");
      if (panel) {
        panel.innerHTML = saved
          ? `<div class="mr-inline-offer-result"><span class="mr-inline-offer-result-icon" aria-hidden="true">✓</span><div><strong>پیشنهاد شما ثبت شد</strong><p>پیشنهاد برای فروشنده ارسال شد. نتیجه را در بخش اعلان‌ها (زنگ بالای صفحه) می‌بینید.</p></div><button type="button" class="mr-inline-offer-close" data-action="closeInlineOffer" aria-label="بستن">×</button></div>`
          : `<div class="mr-inline-offer-result is-error"><div><strong>ثبت پیشنهاد انجام نشد</strong><p>ذخیره‌سازی مرورگر در دسترس نیست. دوباره تلاش کنید.</p></div><button type="button" class="mr-inline-offer-close" data-action="closeInlineOffer" aria-label="بستن">×</button></div>`;
      }
      if (saved && typeof showToast === "function") showToast("پیشنهاد شما برای فروشنده ارسال شد.");
    }
  });

  function syncSellOfferPanel() {
    const form = document.querySelector('[data-page="sell-step"]'); if (!form) return;
    const toggle = form.querySelector('input[name="acceptsOffers"]'); const wrap = form.querySelector('[data-trust-min-wrap]'); const min = form.querySelector('input[name="minPrice"]');
    if (!toggle || !wrap || !min) return;
    const enabled = toggle.checked;
    wrap.hidden = !enabled; min.disabled = !enabled;
    if (state.sellForm) {
      if (document.activeElement !== toggle) toggle.checked = state.sellForm.acceptsOffers === true;
      if (document.activeElement !== min && state.sellForm.minPrice != null) min.value = state.sellForm.minPrice;
      wrap.hidden = !toggle.checked; min.disabled = !toggle.checked;
    }
  }
  document.addEventListener("change", function (event) {
    const t = event.target;
    if (t && t.matches('[data-page="sell-step"] input[name="acceptsOffers"]')) {
      state = { ...state, sellForm: { ...state.sellForm, acceptsOffers: !!t.checked } };
      const wrap = document.querySelector('[data-page="sell-step"] [data-trust-min-wrap]'); const min = document.querySelector('[data-page="sell-step"] input[name="minPrice"]');
      if (wrap) wrap.hidden = !t.checked; if (min) { min.disabled = !t.checked; if (!t.checked) { min.value = ""; state = { ...state, sellForm: { ...state.sellForm, minPrice: "" } }; } }
    }
  });
  document.addEventListener("input", function (event) {
    const t = event.target;
    if (t && t.matches('[data-page="sell-step"] input[name="minPrice"]')) state = { ...state, sellForm: { ...state.sellForm, minPrice: String(t.value || "").replace(/[^0-9۰-۹]/g, "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)) } };
    if (t && t.matches("[data-seller-list-filter]")) {
      const root = t.closest('[data-page="seller"]');
      const cards = root && root.querySelector('[data-slot="cards"]');
      if (!cards) return;
      const query = String(t.value || "").trim().toLocaleLowerCase("fa-IR");
      const items = Array.from(cards.children).filter(el => !el.hasAttribute("data-dealer-filter-empty") && !el.classList.contains("seller-empty"));
      let visible = 0;
      items.forEach(item => { const match = !query || item.textContent.toLocaleLowerCase("fa-IR").includes(query); item.hidden = !match; if (match) visible++; });
      let empty = cards.querySelector("[data-dealer-filter-empty]");
      if (!empty) { empty = document.createElement("div"); empty.className = "mr-dealer-filter-empty"; empty.setAttribute("data-dealer-filter-empty", ""); empty.hidden = true; empty.textContent = "آگهی‌ای با این مشخصات پیدا نشد؛ عبارت کوتاه‌تری را امتحان کنید."; cards.appendChild(empty); }
      empty.hidden = !query || visible > 0;
    }
  });

  // Chain rather than replace features supplied by other modules.
  const prevAfterRender = window.afterMarqueRender;
  window.afterMarqueRender = function () {
    if (typeof prevAfterRender === "function") prevAfterRender.apply(this, arguments);
    try { window.mountMarketplaceTrustWidgets(); } catch (_) {}
    try { syncSellOfferPanel(); } catch (_) {}
  };

  // Store prototype values by logged-in account. This prevents accidental
  // cross-account UI leakage on a shared browser, but localStorage is not a
  // security boundary; the real minimum must live on the server in production.
  function sellerMinimumStore() { return read("marque_seller_minimum_prices_v1", {}); }
  function setSellerMinimumPrice(id, amount, enabled) {
    const key = accountKey(); if (!key) return false;
    const all = sellerMinimumStore(); all[key] = all[key] && typeof all[key] === "object" ? all[key] : {};
    if (enabled && Number(amount) > 0) all[key][String(id)] = Number(amount); else delete all[key][String(id)];
    if (!Object.keys(all[key]).length) delete all[key];
    return write("marque_seller_minimum_prices_v1", all);
  }
  function getSellerMinimumPrice(id) { const key = accountKey(); const all = sellerMinimumStore(); return key && all[key] ? Number(all[key][String(id)] || 0) || null : null; }
  window.MARQUE_TRUST = { recordPriceChange, listingHistory, getReports: () => read(STORE.reports, []), getOffers: () => read(STORE.offers, []), sellerPublicUrl, sellerSlug, resolveDealerSlug, setSellerMinimumPrice, getSellerMinimumPrice };
})();
