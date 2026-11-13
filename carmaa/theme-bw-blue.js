/* CM-BLUE2 detector: دکمه‌هایی که قبلاً قرمزِ پر بودند و الان سفیدند را آبی می‌کند */
(function () {
  "use strict";
  if (window.__CM_BW_BLUE) return;
  window.__CM_BW_BLUE = 1;
  var RAW = [":root", ".cnt.is-red", ".btn.bad", ".chip.bad", ".alertline", ".errbox", ".toast.err", ":root:not([data-theme=\"dark\"])", ":root[data-theme=\"light\"]", ":root[data-theme=\"dark\"]", ".tile b", ".line.bad", ".st.bad", ".cm-ai-glow", ".cm-ai-ring", ".cm-ai-bar i", ".cm-br5-all", ".cm-br5-ic", ".cm-br5-hint", ".bg-red-500", ".text-red-500", ".border-red-500", ".from-red-500", ".via-red-500", ".to-red-500", ".bg-red-500\\/90", ".shadow-red-500\\/30", ".bg-gradient-to-r", ".bg-gradient-to-b", ".manageAd-row.manageAd-row-danger .manageAd-row-label", ".manageAd-row.manageAd-row-danger .manageAd-row-icon", ".manageAd-delete-warn", ".manageAd-delete-warn-icon", ".manageAd-delete-warn-title", ".manageAd-delete-confirm-btn", ".manageAd-confirm-delete-btn.is-enabled", ".text-red-300", ".border-red-800", ".otp-cell input.is-error", ".auth-error", ".bcond-trigger-icon", ".bcond-range-badge", ".bcond-track", ".account-pin-rejected-badge", ".account-pin-card.is-rejected .account-pin-owner", ".manageAd-status.is-rejected", ".manageAd-status.is-rejected .manageAd-status-title", ".manageAd-reject-box", ".manageAd-reject-label", ".dealership-status.is-rejected", ".mr-chat-inline-error", ".mr-chat-dock-badge", ".xcd-flag--urgent", ".xcd-heart.is-on", ".mr-bell-badge", ".mr-nf-pill.is-bad", ".mr-nf-btn.is-ghost", ".ma-status.is-rejected .ma-pill", ".ma-row-ic[data-c=\"red\"]", ".ma-row--danger .ma-row-label", "#genericModal .manageAd-reject-label", "#genericModal .manageAd-delete-warn-icon", "#genericModal .manageAd-delete-warn-title", "#genericModal .manageAd-delete-confirm-btn", ".mr-price-offer-button", ".mr-price-offer-icon", ".mr-price-offer-arrow", ".mr-inline-offer-panel", ".sr-rank .sr-rank-movement.is-down", "html body .account-profile .account-edit-btn[data-action=\"logout\"]", ".header-wordmark .hw-c", "html body [data-page=\"vehicle\"].vehicle-detail-page .detail-cta-inner", "html body [data-page=\"vehicle\"].vehicle-detail-page .detail-cta-split .detail-cta-contact", "html body [data-page=\"vehicle\"].vehicle-detail-page .detail-cta-split .detail-cta-contact *", ".cm-field>span i", ".cm-err", ".cm-opt-ic", ".cm-mode.is-on", ".cm-kind.is-on", ".cm-mode.is-on svg", ".cm-field-within", ".cm-actions button[type=submit]", ".cm-offer-body .mr-inline-offer-result", ".cm-offer-body .mr-inline-offer-result-icon", ".mr-cv-act.is-danger", ".mr-cv-rec-x", ".mr-cv-rec-dot", ".cm-home-page .cm-ft.cm-ft2", ".cm-ft2 .cm-ft-eyebrow", ".cm-ft2 .cm-ft-dot", ".cm-ft2 .cm-ft-title em", ".cm-ft2 .cm-ft-btn.is-primary", ".cm-ft2 .cm-ft-tile", ".cm-ft2 .cm-ft-tile-ico", ".cm-ft2 .cm-ft-tile-ico svg", ".cm-home-page .cm-ft2 .cm-ft-social a", ".cm-home-page .cm-ft2 .cm-ft-mark", ".cm-home-page .cm-post-btn.is-on", ".cm-home-page .cm-hfs-move.is-down", ".cm-home-page .cm-hfs-featured", ".cm-home-page .cm-sr-intro", ".cm-home-page .cm-sr-eyebrow", ".cm-home-page .cm-sr-dot", ".cm-home-page .cm-sr-hl", ".cm-news-act.is-on", ".nw-card .cm-news-social .cm-news-act.is-on", ".nw-detail .cm-news-social .cm-news-act.is-on", ".nw-c-like.is-on", "html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock=\"sell\"]", "html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock=\"sell\"].is-active", "html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock=\"sell\"]-visible", "html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item.dock-plus", "html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item.dock-plus.is-active", ".mr-sv-vmenu-card button.is-danger", ".mr-cd-btn.is-danger", ".mr-cd-btn.is-danger.is-confirm", "html body #sellCityPicker .sell-trim-option.is-selected b", "html body #sellCityPicker .sell-trim-option.is-selected", ".sell-location-map .sell-confirm-btn", ".sell-location-map .sell-confirm-btn.is-confirmed", ".sell-center-circle.is-confirmed", ".sell-center-circle.is-confirmed .leaflet-app-pin", ".cm-feed-notify i", ".cm-cs-meta em", ".cm-cs-field-within", ".cm-cs-send", ".cm-fc-post", ".cm-fc-text", ".cm-fc-tool.is-on", ".cm-fc-ring .fg", ".cm-fc-ring.is-danger .fg", ".cm-fc-ring.is-danger b", ".cm-fc-confirm-card .is-danger", ".cm-lt-all svg", ".cm-lt-heart.is-on svg", ".cm-lt-promo.cm-xp", ".cm-xp .cm-lt-cta", ".cm-home-page .cm-lt-all", ".cm-lt-photo>.cm-lt-badge.cm-lt-badge", ".cm-lt-more", ".cm-lt-more-visible", ".cm-lt-more-ic", "html:not(.theme-light) body :is(.cm-ts-sug):not(#cmct-a):not(#cmct-b)", "html:not(.theme-light) body :is(.adc-cta):not(#cmct-a):not(#cmct-b)", ".cm-ct-hl", ".cm-ct-rule", ".cm-hl", ".cm-hl-glow i:nth-child(1)", ".cm-hl-pill", ".cm-hl-dot", ".cm-hl-l", ".cm-hl-hot", ".cm-hl-it svg", ".cm-home-page", ".cm-home-page .cm-lay-link", ".cm-home-page .cm-lay-head--showrooms .cm-lay-link", ".cm-home-page .cm-lay-link > span[aria-hidden]", ".cm-home-page .cm-lt-all svg", ".fas-ring", ".fas-go", ".cm-home-page .cm-qf-chip", ".cm-home-page .cm-sr-cta", ".mr-msg-screen .mr-msg-hero", ".mr-msg-screen .mr-msg-hero .mr-msg-story", ".mr-msg-screen .mr-msg-hero .mr-story-in", "html:not(.theme-light) body :is(.cm-lt-price > b):not(#cmct-a):not(#cmct-b)", "html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock:not(.cm-social-dock) .dock-item.dock-plus", "html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock:not(.cm-social-dock) .dock-item.dock-plus.is-active", ".mr-msg-screen", ".mr-msg-screen .mr-msg-hero > .mr-msg-topbar", ".mr-msg-screen .mr-msg-hero > .mr-stories-title", ".mr-msg-screen .mr-msg-hero > .mr-msg-stories", "[data-page=\"account-edit\"] form [data-slot=\"form-error\"]", ".qa-counter.is-over", ".qa-input.is-invalid", ".qa-error", ".mr-alert-badge", ".cm-ts-tour .cm-ts-av", ".cm-ts-tour.is-unseen .cm-ts-ring", ".cm-ts .cm-ts-tour .cm-ts-handle", ".cm-dc-tabs button.is-on", ".cm-home-page .cm-dc .cm-qf .cm-qf-chip", ".cm-home-page .cm-dc .cm-qf .cm-qf-chip.is-on", "#mrTour .tr-glow", "#mrTour .tr-di.is-on", "#mrTour .tr-di.plus", "#mrTour .tr-btn", "#mrTour .tr-caret", "#mrTour .tr-chips b:first-child", "#mrTour .ln i.s", "#mrTour .tr-cap i.s", "#mrTour .tr-banner span", "#mrTour .tr-stories span", "#mrTour .tr-b.b", "#mrTour .tr-bigplus", "#mrTour .tr-flow i", "#mrTour .tr-splus", "#mrTour .tr-s24", "#mrTour .tr-scap i.s", ".fp-err"];
  var EXC = '[class*="danger"],[class*="delete"],[class*="reject"],[class*="logout"],[class*="cancel"],[class*="ghost"],[class*="secondary"]';
  var sel = "", interval = 150, last = 0, timer = 0;

  function parse(s) {
    var m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,\/]+([\d.]+%?))?\s*\)/.exec(s || "");
    if (!m) return null;
    var a = m[4] === undefined ? 1 : (m[4].slice(-1) === "%" ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function lum(c) { return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
  function solidLight(cs) {
    var c = parse(cs.backgroundColor);
    if (c && c.a >= 0.9) return lum(c) > 0.85;
    var img = cs.backgroundImage;
    if (img && img.indexOf("gradient(") > -1) {
      var re = /rgba?\([^)]*\)/g, m, sum = 0, n = 0;
      while ((m = re.exec(img))) { var g = parse(m[0]); if (g && g.a >= 0.9) { sum += lum(g); n++; } }
      return n > 0 && sum / n > 0.8;
    }
    return false;
  }
  function buttonLike(el) {
    if (el.closest("#bottomDock")) return false;
    try { if (el.matches(EXC) || el.closest(EXC)) return false; } catch (e) {}
    var t = el.tagName, role = el.getAttribute("role"), cls = el.getAttribute("class") || "";
    if (!(t === "BUTTON" || t === "A" || t === "INPUT" || role === "button" || role === "tab" || /(^|[-_ ])(cta|btn|button|chip|tab)/.test(cls))) return false;
    var r = el.getBoundingClientRect();
    return r.height >= 28 && r.width >= 56;
  }
  function pickValid() {
    var probe = document.createElement("div"), ok = [];
    for (var i = 0; i < RAW.length; i++) { try { probe.matches(RAW[i]); ok.push(RAW[i]); } catch (e) {} }
    sel = ok.join(",");
  }
  function scan() {
    var t0 = performance.now();
    try {
      var keep = new Set(), cands = sel ? document.querySelectorAll(sel) : [];
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i];
        if (el.classList.contains("bw-primary")) { keep.add(el); continue; }
        if (buttonLike(el) && solidLight(getComputedStyle(el))) { el.classList.add("bw-primary"); keep.add(el); }
      }
      var old = document.querySelectorAll(".bw-primary");
      for (var j = 0; j < old.length; j++) if (!keep.has(old[j])) old[j].classList.remove("bw-primary");
    } catch (e) {}
    interval = performance.now() - t0 > 14 ? Math.min(interval * 2, 900) : Math.max(150, interval / 1.5);
    last = performance.now();
  }
  function schedule() {
    if (timer || document.hidden) return;
    timer = setTimeout(function () { timer = 0; scan(); }, Math.max(0, interval - (performance.now() - last)));
  }
  function init() {
    pickValid();
    if (!sel) return;
    scan();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "aria-selected", "aria-pressed", "disabled"] });
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("load", function () { schedule(); setTimeout(schedule, 800); setTimeout(schedule, 2200); });
  }
  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init);
})();
