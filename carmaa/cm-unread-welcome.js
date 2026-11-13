/* CM-UNREAD-WELCOME: هنگام ورود به سایت، تعداد اعلان‌های خوانده‌نشده را در یک بنر نشان می‌دهد */
(function () {
  if (window.__cmUnreadWelcome) return; window.__cmUnreadWelcome = true;
  var css = [
    ".cm-unread-banner{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);transform:translate(-50%,-150%);width:min(92vw,420px);box-sizing:border-box;z-index:10050;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:rgba(51,51,54,.94);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:.5px solid rgba(255,255,255,.14);color:#F5F5F7;box-shadow:0 14px 40px -12px rgba(0,0,0,.75);cursor:pointer;opacity:0;direction:rtl;font-family:inherit;transition:transform .45s cubic-bezier(.2,.9,.25,1.1),opacity .3s ease;-webkit-tap-highlight-color:transparent}",
    ".cm-unread-banner.is-in{transform:translate(-50%,0);opacity:1}",
    ".cm-ub-ic{flex:0 0 auto;width:38px;height:38px;border-radius:12px;background:#0071E3;display:grid;place-items:center;box-shadow:0 6px 16px -6px rgba(0,113,227,.8)}",
    ".cm-ub-ic svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
    ".cm-ub-tx{min-width:0}",
    ".cm-ub-tx b{display:block;font-size:14px;font-weight:700;line-height:1.5}",
    ".cm-ub-tx small{display:block;font-size:12px;color:#a1a1a9;line-height:1.4}",
    ".cm-ub-x{margin-inline-start:auto;flex:0 0 auto;width:28px;height:28px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#c7c7cc;font-size:16px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}",
    "html.theme-light .cm-unread-banner{background:rgba(255,255,255,.96);color:#111114;border-color:rgba(0,0,0,.08);box-shadow:0 14px 34px -14px rgba(20,24,35,.35)}",
    "html.theme-light .cm-ub-tx small{color:#667085}",
    "html.theme-light .cm-ub-x{background:rgba(0,0,0,.06);color:#555}",
    "@media (prefers-reduced-motion:reduce){.cm-unread-banner{transition:opacity .2s ease}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var timer = 0;
  function fa(n) { return typeof faNum === "function" ? faNum(n) : Number(n).toLocaleString("fa-IR"); }
  function hide(el) {
    if (!el) return; clearTimeout(timer);
    el.classList.remove("is-in");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
  }
  function show(n) {
    var old = document.querySelector(".cm-unread-banner"); if (old) old.parentNode.removeChild(old);
    var el = document.createElement("div");
    el.className = "cm-unread-banner"; el.setAttribute("role", "status"); el.setAttribute("data-action", "openNotifications");
    el.innerHTML =
      '<span class="cm-ub-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg></span>' +
      '<span class="cm-ub-tx"><b>شما ' + fa(n) + ' اعلان خوانده‌نشده دارید</b><small>برای مشاهده ضربه بزنید</small></span>' +
      '<button type="button" class="cm-ub-x" aria-label="بستن">×</button>';
    el.querySelector(".cm-ub-x").addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); hide(el); });
    el.addEventListener("click", function () { hide(el); });
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
    timer = setTimeout(function () { hide(el); }, 9000);
  }
  /* prev === null یعنی اولین محاسبه برای این حساب (ورود به سایت یا لاگین تازه) */
  window.CARMA_UNREAD_HOOK = function (n, owner, prev) {
    if (prev !== null) return;
    if (!String(owner || "").replace("|", "") || !(n >= 1)) return;
    var key = "cmUnreadWelcome:" + owner;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (_) {}
    show(n);
  };
})();
