/* CM-HEADER v3: حذف دکمه پیام هدر بعد از ورود + هدر شیشه‌ای مات */
(function () {
  if (window.__cmHdr) return; window.__cmHdr = true;
  var s = document.createElement("style");
  /* هدر شیشه‌ای شفافِ دارک و تیره، سبک و بدون خط دور: یک blur کوچک روی خود هدر + گرادیان تیره‌ی نیمه‌شفاف + سایه‌ی نرم (نه border).
     سلکتورها عمداً با :not(#x) قوی شده‌اند تا از قانون !important در carmaa-layers.min.css جلو بزنند. */
  var SEL = 'html:not(.theme-light):not(#cmx) body:not(#cmy):not(#cmz):not(:has(#pageContent > [data-page="account"])):not(:has([data-page="conversation"])) #siteHeader:not(.account-header-active):not(.listings-header-hidden)';
  s.textContent =
    'html.cm-in #siteHeader [data-action="openMessages"]{display:none!important}' +
    'html:not(.theme-light):not(#cmx) #stickyHeaderGroup{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' +
    'html:not(.theme-light):not(#cmx) #stickyHeaderGroup::after{display:none!important}' +
    'html:not(.theme-light):not(#cmx) #stickyHeaderGroup::before{background:rgba(29,29,31,.55)!important}' +
    SEL + '{' +
      'background:linear-gradient(180deg,rgba(29,29,31,.55) 0%,rgba(29,29,31,.78) 100%)!important;' +
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
      'border:0!important;outline:0!important;' +
      'box-shadow:0 14px 28px -12px rgba(0,0,0,.6)!important}' +
    '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){' + SEL + '{background:rgba(29,29,31,.94)!important}}' +
    '@media (prefers-reduced-transparency:reduce){' + SEL + '{background:#1D1D1F!important;-webkit-backdrop-filter:none;backdrop-filter:none}}';
  document.head.appendChild(s);
  function logged() {
    try { if (window.CARMA_AUTH_USER) return true; } catch (_) {}
    try { return !!state.account; } catch (_) { return false; }
  }
  var last = null;
  function sync() {
    var v = logged();
    if (v !== last) { last = v; document.documentElement.classList.toggle("cm-in", v); }
  }
  sync(); setInterval(sync, 500);
})();

/* CM-DOCK-GLASS: شفافیت و blur داک پایین هم‌سطح هدر (گرادیان تیره‌ی نیمه‌شفاف، blur سبک) */
(function () {
  if (window.__cmDockGlass) return; window.__cmDockGlass = true;
  var DS = 'html:not(.theme-light):not(#cmx) body:not(#cmy):not(#cmz) #bottomDock#bottomDock.bottom-dock .dock-search,html:not(.theme-light):not(#cmx) body:not(#cmy):not(#cmz) #bottomDock#bottomDock.bottom-dock .dock-pill';
  var s = document.createElement("style");
  s.textContent =
    DS + '{background:linear-gradient(180deg,rgba(29,29,31,.55) 0%,rgba(29,29,31,.78) 100%)!important;background-color:transparent!important;' +
      '-webkit-backdrop-filter:blur(10px)!important;backdrop-filter:blur(10px)!important}' +
    '@media (prefers-reduced-transparency:reduce){' + DS + '{background:#1D1D1F!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}}';
  document.head.appendChild(s);
})();
