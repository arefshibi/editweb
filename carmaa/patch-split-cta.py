#!/usr/bin/env python3
import os, re, sys, shutil

R = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
if not os.path.isfile(os.path.join(R, "index.html")) and os.path.isfile(os.path.join(R, "carmaa", "index.html")):
    R = os.path.join(R, "carmaa")
P = lambda *a: os.path.join(R, *a)
for f in ("index.html", "js/34-trust-marketplace.js", "contact-bar.css"):
    if not os.path.isfile(P(f)):
        sys.exit("❌ %s پیدا نشد — اسکریپت رو داخل پوشه‌ی پروژه اجرا کن" % f)
rd = lambda f: open(P(f), encoding="utf-8").read()

NEW_BAR = '''<div class="detail-cta">
      <div class="detail-cta-inner detail-cta-split">
        <button type="button" data-action="openContactChooser" data-slot-id="contact-sticky" class="detail-cta-btn detail-cta-contact"><svg class="icon"><use href="#vd-i-chat"></use></svg><span>گفت‌وگو و تماس</span></button>
        <button type="button" data-action="openCarOffer" data-slot-id="offer-sticky" class="detail-cta-btn detail-cta-offer" hidden><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg><span>پیشنهاد قیمت</span></button>
        <div class="detail-cta-hidden" hidden><div class="detail-cta-price-value" data-slot="price-sticky"></div><div class="detail-cta-price-unit"></div><a data-slot="phone-sticky" data-action="clickContact" class="detail-cta-phone"></a></div>
      </div>
    </div>'''

def patch_html(name):
    if not os.path.isfile(P(name)):
        return None
    s = rd(name)
    if "detail-cta-split" in s:
        print("• %s از قبل پچ شده" % name); return None
    s2, n = re.subn(r'<div class="detail-cta">.*?</div>\s*</div>\s*</div>(?=\s*</section>)', lambda m: NEW_BAR, s, count=1, flags=re.S)
    if n != 1:
        sys.exit("❌ %s: بلوک نوار پایین پیدا نشد" % name)
    s2 = s2.replace("contact-bar.css?v=7-white", "contact-bar.css?v=8-split").replace("34-trust-marketplace.js?v=offer-3-urls1", "34-trust-marketplace.js?v=offer-4-split")
    return s2

CSS = r'''
/* CM-SPLIT-CTA — نوار پایین: دو دکمه‌ی هم‌اندازه + پاپ‌آپ‌ها */
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-inner.detail-cta-split{direction:rtl;gap:10px;padding:0 !important;background:none !important;border:0 !important;box-shadow:none !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-hidden{display:none !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-btn{flex:1 1 0;min-width:0;height:52px;padding:0 12px !important;border-radius:16px !important;font-size:14.5px !important;font-weight:800 !important;gap:8px;box-shadow:0 8px 22px rgba(0,0,0,.45) !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-btn[hidden]{display:none !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-contact,html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-contact *{background:#c6ff00 !important;color:#08090b !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-contact *{background:none !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-offer{background:#17181b !important;border:1px solid rgba(255,255,255,.16) !important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-offer,html body [data-page="vehicle"].vehicle-detail-page .detail-cta-split .detail-cta-offer *{color:#fff !important}
.cm-sheet{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-end;justify-content:center}
.cm-sheet-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);animation:ui-fade-in .25s ease both}
.cm-sheet-card{position:relative;width:100%;max-width:520px;box-sizing:border-box;max-height:94dvh;overflow:auto;background:#0b0b0c;color:#f4f4f5;border:1px solid rgba(255,255,255,.07);border-bottom:0;border-radius:26px 26px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.55);animation:sheet-up .34s cubic-bezier(.22,1,.36,1) both}
.cm-sheet.is-closing .cm-sheet-card{animation:sheet-down .26s cubic-bezier(.4,0,1,1) both}
.cm-sheet.is-closing .cm-sheet-backdrop{animation:ui-fade-out .26s ease both}
.cm-sheet-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.18);margin:0 auto 16px}
.cm-sheet-title{margin:0 0 16px;text-align:center;font-size:19px;font-weight:800}
.cm-opt{display:flex;align-items:center;gap:14px;width:100%;margin-bottom:10px;padding:14px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:#161719;color:inherit;font:inherit;text-align:right;cursor:pointer}
.cm-opt:active{background:#1d1e21}
.cm-opt-ic{flex:none;width:46px;height:46px;border-radius:14px;background:#222326;display:grid;place-items:center}
.cm-opt-tx{display:flex;flex-direction:column;gap:3px;min-width:0}
.cm-opt-tx b{font-size:15px;font-weight:800}
.cm-opt-tx small{font-size:12px;color:#8c8d93}
.cm-cancel{display:block;width:100%;margin-top:4px;height:44px;background:none;border:0;color:#8c8d93;font:600 14px inherit;font-family:inherit;cursor:pointer}
.cm-modes{display:flex;gap:12px;margin-bottom:16px}
.cm-mode{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:#0e0e0f;color:#8c8d93;font:inherit;cursor:pointer;text-align:center}
.cm-mode b{font-size:16px;font-weight:800}
.cm-mode small{font-size:12px;line-height:1.6}
.cm-mode.is-on{background:#222223;border-color:#f4f4f5;color:#f4f4f5}
.cm-field{display:block;margin-bottom:14px;padding:10px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#0e0e0f}
.cm-field>span{display:block;font-size:12.5px;color:#9b9ca2;margin-bottom:4px}
.cm-field>span i{color:#ff6a3d;font-style:normal}
.cm-field input,.cm-field textarea{display:block;width:100%;box-sizing:border-box;background:none;border:0;outline:0;color:#fff;font:600 19px inherit;font-family:inherit;padding:2px 0;resize:none}
.cm-field textarea{font-size:15px;font-weight:500;min-height:92px}
.cm-field input::-webkit-outer-spin-button,.cm-field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.cm-field input[type=number]{-moz-appearance:textfield}
.cm-field input::placeholder,.cm-field textarea::placeholder{color:#5f6066;font-weight:500}
.cm-hint{display:block;min-height:16px;margin:-6px 4px 12px;font-size:12px;color:#8c8d93}
.cm-actions{display:flex;gap:12px;margin-top:6px}
.cm-actions button{flex:1 1 0;height:54px;border-radius:27px;font:800 15.5px inherit;font-family:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:#0e0e0f;color:#fff}
.cm-actions button[type=submit]{background:#f4f4f5;color:#0b0b0c;border-color:#f4f4f5}
.cm-actions button:disabled{opacity:.55}
.cm-offer-body .mr-inline-offer-result{margin:6px 0 10px}
@media (prefers-reduced-motion:reduce){.cm-sheet-card,.cm-sheet.is-closing .cm-sheet-card{animation-duration:.01s}}
'''

JS_NEW = r'''  /* CM-SPLIT-CTA — پاپ‌آپ‌های نوار پایین (ارتباط با فروشنده + پیشنهاد قیمت) */
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
  function openOffer(listing) {
    if (!state.account) { requestLogin("برای ارسال پیشنهاد قیمت باید وارد حساب کاربری شوید."); return; }
    var offers = read(STORE.offers, []), dayAgo = Date.now() - 86400000;
    var used = offers.filter(function (o) { return o.listingId === String(listing.id) && o.buyerId === accountKey() && o.createdAt >= dayAgo; }).length;
    if (used >= 3) { if (typeof showToast === "function") showToast("برای این آگهی امروز به سقف ۳ پیشنهاد رسیده‌اید."); return; }
    var price = amountOf(listing), canTrade = listing.tradeIn === true;
    var sheet = cmSheet("cm-offer",
      '<h3 class="cm-sheet-title">پیشنهاد قیمت</h3>' +
      '<div class="cm-offer-body" data-inline-offer><form data-trust-form="offer" data-listing-id="' + esc(listing.id) + '" novalidate>' +
        '<div class="cm-modes"><button type="button" class="cm-mode is-on" data-mode="buy">' + CM_ICON.cart + '<b>خرید</b><small>پیشنهاد نقدی برای خرید</small></button>' +
        (canTrade ? '<button type="button" class="cm-mode" data-mode="trade">' + CM_ICON.swap + '<b>معاوضه</b><small>معاوضه با خودروی من</small></button>' : '') + '</div>' +
        '<label class="cm-field"><span>مبلغ پیشنهادی (تومان) <i>*</i></span><input type="number" name="amount" inputmode="numeric" min="1" required placeholder="' + (price != null ? esc(String(price)) : "") + '"></label>' +
        '<small class="cm-hint" data-cm-hint>' + (price != null ? "قیمت آگهی: " + esc(money(price)) : "") + '</small>' +
        '<label class="cm-field"><textarea name="message" rows="3" maxlength="300" placeholder="پیام (اختیاری)"></textarea></label>' +
        '<div class="cm-actions"><button type="button" data-cm-close>انصراف</button><button type="submit">ثبت پیشنهاد</button></div>' +
      '</form></div>', "پیشنهاد قیمت");
    var form = sheet.querySelector("form"), hint = sheet.querySelector("[data-cm-hint]"), input = form.elements.amount, mode = "buy";
    input.addEventListener("input", function () { var v = Number(input.value); hint.textContent = v > 0 ? v.toLocaleString("fa-IR") + " تومان" : (price != null ? "قیمت آگهی: " + money(price) : ""); });
    form.addEventListener("click", function (e) {
      var m = e.target.closest(".cm-mode"); if (!m) return;
      mode = m.dataset.mode; form.querySelectorAll(".cm-mode").forEach(function (x) { x.classList.toggle("is-on", x === m); });
    });
    form.addEventListener("submit", function () {
      var t = form.elements.message;
      if (mode === "trade" && t && t.value.indexOf("پیشنهاد معاوضه") !== 0) t.value = ("پیشنهاد معاوضه: " + t.value).trim();
    }, true);
    new MutationObserver(function (list, obs) {
      var ok = sheet.querySelector(".mr-inline-offer-result:not(.is-error)");
      if (ok) { obs.disconnect(); setTimeout(function () { if (sheet.isConnected) sheet._close(); }, 2200); }
    }).observe(sheet.querySelector(".cm-offer-body"), { childList: true });
    setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (_) {} }, 350);
  }
'''

def patch_js():
    s = rd("js/34-trust-marketplace.js")
    if "CM-SPLIT-CTA" in s:
        print("• js/34-trust-marketplace.js از قبل پچ شده"); return None
    a = s.find('    let offerButton = priceCard.querySelector(".mr-price-offer-button");')
    endm = "      offerButton.remove();\n    }\n"
    b = s.find(endm, a)
    if a < 0 or b < 0:
        sys.exit("❌ js34: بلوک دکمه‌ی پیشنهاد قیمت پیدا نشد")
    s = s[:a] + '    { const legacy = priceCard.querySelector(".mr-price-offer-button"); if (legacy) legacy.remove(); const lp = priceCard.querySelector("[data-inline-offer]"); if (lp) lp.remove(); }\n' + s[b + len(endm):]
    k = "    if (!root || !listing) return;\n"
    if s.count(k) != 1:
        sys.exit("❌ js34: ابتدای renderMarketplaceTrustFeatures پیدا نشد")
    s = s.replace(k, k + '    { /* CM-SPLIT-CTA */ const ob = root.querySelector(\'[data-slot-id="offer-sticky"]\'); if (ob) { ob.dataset.id = String(listing.id); ob.hidden = !(listing.acceptsOffers === true && !listing.negotiable && amountOf(listing) != null); } }\n', 1)
    k = "  function openOffer(listing, button) {"
    if s.count(k) != 1:
        sys.exit("❌ js34: تابع openOffer پیدا نشد")
    s = s.replace(k, JS_NEW + "  function openOfferLegacy(listing, button) {", 1)
    k = '    else if (action === "closeInlineOffer") {'
    if s.count(k) != 1:
        sys.exit("❌ js34: هندلر کلیک پیدا نشد")
    s = s.replace(k, '    else if (action === "openContactChooser") { event.preventDefault(); const l = listingById(el.dataset.id || (state.route && state.route.listing && state.route.listing.id)); if (l) openContactChooser(l); }\n' + k, 1)
    return s

out = {}
for n in ("index.html", "index_offline.html"):
    r = patch_html(n)
    if r is not None: out[n] = r
r = patch_js()
if r is not None: out["js/34-trust-marketplace.js"] = r
c = rd("contact-bar.css")
if "CM-SPLIT-CTA" in c: print("• contact-bar.css از قبل پچ شده")
else: out["contact-bar.css"] = c.rstrip("\n") + "\n" + CSS

for f, txt in out.items():
    shutil.copyfile(P(f), P(f) + ".bak-split")
    open(P(f), "w", encoding="utf-8").write(txt)
    print("✔ " + f)
print("\nتمام شد. صفحه رو با Hard Refresh باز کن (یا کش رو پاک کن). بکاپ‌ها: *.bak-split")
