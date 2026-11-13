#!/usr/bin/env python3
import os, sys, shutil

R = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
if not os.path.isfile(os.path.join(R, "index.html")) and os.path.isfile(os.path.join(R, "carmaa", "index.html")):
    R = os.path.join(R, "carmaa")
P = lambda *a: os.path.join(R, *a)
JS, CSSF = "js/34-trust-marketplace.js", "contact-bar.css"
for f in (JS, CSSF, "index.html"):
    if not os.path.isfile(P(f)):
        sys.exit("❌ %s پیدا نشد — اسکریپت رو داخل پوشه‌ی پروژه اجرا کن" % f)
js = open(P(JS), encoding="utf-8").read()
css = open(P(CSSF), encoding="utf-8").read()
if "CM-SPLIT-CTA2" in js:
    sys.exit("• از قبل پچ شده")
if "CM-SPLIT-CTA" not in js:
    sys.exit("❌ اول باید patch-split-cta.py اجرا شده باشه")

NEW_OFFER = r'''  function openOffer(listing) { /* CM-SPLIT-CTA2 */
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
      label.innerHTML = (!trade ? "مبلغ پیشنهادی (تومان)" : kind === "pay" ? "مبلغ سری که می‌دهم (تومان)" : "مبلغ سری که می‌گیرم (تومان)") + " <i>*</i>";
      text.placeholder = trade ? "خودروی شما برای معاوضه (مدل، سال، کارکرد)…" : "پیام (اختیاری)";
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
    setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (_) {} }, 350);
  }
'''
a = js.find("  function openOffer(listing) {\n")
b = js.find("  function openOfferLegacy(listing, button) {")
if a < 0 or b < a:
    sys.exit("❌ تابع openOffer نسخه‌ی قبل پیدا نشد")
js2 = js[:a] + NEW_OFFER + js[b:]

CSS2 = r'''
/* CM-SPLIT-CTA2 */
html body .toast,html body .vehicle-demo-layout .toast{z-index:2100 !important}
.cm-kinds{display:flex;gap:8px;margin:-4px 0 14px}
.cm-kinds[hidden],.cm-field[hidden],.cm-err[hidden]{display:none !important}
.cm-kind{flex:1 1 0;height:44px;padding:0 4px;white-space:nowrap;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#0e0e0f;color:#8c8d93;font:700 12px inherit;font-family:inherit;cursor:pointer}
.cm-kind.is-on{background:#222223;border-color:#f4f4f5;color:#f4f4f5}
.cm-err{margin:0 2px 12px;padding:11px 14px;border-radius:12px;background:rgba(255,80,60,.12);border:1px solid rgba(255,80,60,.35);color:#ff8f7d;font-size:13px;line-height:1.8}
'''
css2 = css.rstrip("\n") + "\n" + CSS2
for f, txt in ((JS, js2), (CSSF, css2)):
    shutil.copyfile(P(f), P(f) + ".bak-offer2")
    open(P(f), "w", encoding="utf-8").write(txt)
    print("✔ " + f)
for n in ("index.html", "index_offline.html"):
    if os.path.isfile(P(n)):
        t = open(P(n), encoding="utf-8").read().replace("contact-bar.css?v=8-split", "contact-bar.css?v=9-offer2").replace("34-trust-marketplace.js?v=offer-4-split", "34-trust-marketplace.js?v=offer-5-offer2")
        open(P(n), "w", encoding="utf-8").write(t)
print("\nتمام شد. Hard Refresh کن. بکاپ‌ها: *.bak-offer2")
