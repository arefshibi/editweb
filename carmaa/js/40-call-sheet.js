/* پاپ‌آپ تماس با فروشنده — از پایین صفحه، مشکی مات، لوگوی C در باکس مشکی */
(function () {
  "use strict";
  var sheet = null, closeTimer = 0;

  function findListing(el) {
    var id = el && el.getAttribute && el.getAttribute("data-id");
    try {
      var l = id && typeof LISTINGS !== "undefined" ? LISTINGS.find(function (x) { return x.id === id; }) : null;
      if (l) return l;
      if (state && state.route && state.route.listing && (!id || state.route.listing.id === id)) return state.route.listing;
    } catch (_) {}
    return null;
  }

  function close() {
    if (!sheet) return;
    var s = sheet; sheet = null;
    s.classList.add("is-closing");
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { s.remove(); }, 260);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open(listing) {
    var raw = String((listing && listing.phone) || "");
    var tel = raw.replace(/[^0-9+]/g, "");
    if (!tel) { if (typeof showToast === "function") showToast("شماره‌ای برای این آگهی ثبت نشده است"); return; }
    if (sheet) { sheet.remove(); sheet = null; }
    var wrap = document.createElement("div");
    wrap.className = "callsheet";
    wrap.innerHTML =
      '<div class="callsheet-backdrop" data-cs-close></div>' +
      '<div class="callsheet-card" role="dialog" aria-modal="true" aria-label="تماس با فروشنده" dir="rtl">' +
        '<div class="callsheet-handle" aria-hidden="true"></div>' +
        '<div class="callsheet-note">' +
          '<span class="callsheet-logo" aria-hidden="true">C</span>' +
          '<p><b>به فروشنده بگو از «کارمآ» تماس گرفتی.</b><br>تماس از یه جای معتبر براش اهمیت داره.</p>' +
        '</div>' +
        '<a class="callsheet-phone" data-action="clickContact" data-id="' + String(listing.id).replace(/"/g, "") + '" href="tel:' + tel + '">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>' +
          '<span class="callsheet-num" dir="ltr"></span>' +
        '</a>' +
        '<button type="button" class="callsheet-cancel" data-cs-close>بستن</button>' +
      '</div>';
    wrap.querySelector(".callsheet-num").textContent = raw;
    wrap.addEventListener("click", function (e) { if (e.target.closest("[data-cs-close]")) close(); });
    document.body.appendChild(wrap);
    sheet = wrap;
    document.addEventListener("keydown", onKey);
  }

  // قبل از هندلر اصلی اجرا می‌شود تا تماس مستقیم (tel:) و مودال قدیمی جایگزین شوند
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest('[data-slot="phone-sticky"], [data-slot="phone"], [data-action="openContactSeller"]');
    if (!t) return;
    var l = findListing(t);
    if (!l) return;
    e.preventDefault(); e.stopPropagation();
    open(l);
  }, true);
})();
