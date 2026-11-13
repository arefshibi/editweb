/* CM-404 — صفحه‌ی ۴۰۴ فارسی (بازنویسی بومی کامپوننت NotFound بدون React/framer-motion) */
(function () {
  "use strict";
  if (window.__cm404) return; window.__cm404 = true;
  if (location.protocol === "file:") return;

  var KNOWN = /^(cars|brands|showrooms?|seller|account|sell|saved|my-listings|messages|feed|news|qa)$/;
  var STYLE_ID = "cm404-style", ROOT_ID = "cm404";
  var prevTitle = null, robots = null;

  function isUnknown() {
    var parts = location.pathname.split("/").filter(Boolean);
    if (!parts.length) return false;
    if (location.hash && location.hash.length > 1) return false;
    if (/\.(html?|php)$/i.test(parts[parts.length - 1])) return false;
    if (KNOWN.test(parts[0])) return false;
    if (parts.length === 2 && /^[^.]+$/.test(parts[0]) && /^[^.]+$/.test(parts[1])) return false; /* لینک کوتاه آگهی: /owner/postId */
    return true;
  }

  var CSS =
    '#cm404{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;direction:rtl;text-align:center;overflow:hidden;font-family:inherit;color:#f3f5f8;background:radial-gradient(70% 55% at 50% 38%,rgba(0,113,227,.16),transparent 70%),#1D1D1F;--c4-mut:rgba(243,245,248,.62)}' +
    'html.theme-light #cm404{color:#12151a;background:radial-gradient(70% 55% at 50% 38%,rgba(0,113,227,.12),transparent 70%),#f6f8fb;--c4-mut:rgba(18,21,26,.6)}' +
    '#cm404 .c4-in{animation:c4Up .9s ease-out both}' +
    '#cm404 .c4-row{display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:40px;direction:ltr}' +
    '#cm404 .c4-n{font-size:72px;line-height:1;font-weight:700;opacity:.8;user-select:none;-webkit-user-select:none}' +
    '#cm404 .c4-globe{position:relative;width:96px;height:96px;animation:c4Globe 1s ease-out both,c4Float 5s ease-in-out 1s infinite alternate}' +
    '#cm404 .c4-globe svg{width:100%;height:100%;display:block;filter:drop-shadow(0 10px 28px rgba(0,113,227,.5))}' +
    '#cm404 h1{margin:0 0 16px;font-size:30px;line-height:1.5;font-weight:600;letter-spacing:-.01em}' +
    '#cm404 p{margin:0 auto 40px;max-width:28rem;font-size:16px;line-height:1.9;color:var(--c4-mut)}' +
    '#cm404 .c4-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 22px;border:0;border-radius:14px;font:inherit;font-size:14.5px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,#2a96ff,#0a64d6);box-shadow:0 10px 26px -10px rgba(0,113,227,.9);transition:transform .5s,filter .5s;-webkit-tap-highlight-color:transparent}' +
    '#cm404 .c4-btn:hover{transform:scale(1.05)}#cm404 .c4-btn:active{transform:scale(.97)}' +
    '#cm404 .c4-btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '@media(min-width:768px){#cm404 .c4-n{font-size:96px}#cm404 .c4-globe{width:128px;height:128px}#cm404 h1{font-size:48px}#cm404 p{font-size:18px}}' +
    '@keyframes c4Up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}' +
    '@keyframes c4Globe{from{opacity:0;transform:translateY(10px) scale(.85)}to{opacity:1;transform:none}}' +
    '@keyframes c4Float{from{translate:0 -4px}to{translate:0 4px}}' +
    '@media(prefers-reduced-motion:reduce){#cm404 .c4-in,#cm404 .c4-globe{animation:none!important}}';

  var GLOBE =
    '<svg viewBox="0 0 100 100" aria-hidden="true"><defs>' +
    '<radialGradient id="c4g" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#5db0ff"/><stop offset=".5" stop-color="#0a64d6"/><stop offset="1" stop-color="#062250"/></radialGradient>' +
    '<radialGradient id="c4s" cx="38%" cy="32%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
    '<clipPath id="c4c"><circle cx="50" cy="50" r="44"/></clipPath></defs>' +
    '<circle cx="50" cy="50" r="44" fill="url(#c4g)"/>' +
    '<g clip-path="url(#c4c)">' +
      '<g fill="rgba(255,255,255,.42)"><g>' +
        '<animateTransform attributeName="transform" type="translate" from="0 0" to="-100 0" dur="16s" repeatCount="indefinite"/>' +
        '<path id="c4land" d="M8 36c6-8 16-9 22-4 4 4 2 10-2 13-5 3-4 9-9 11-6 2-10-3-12-8-2-4-3-8 1-12zM44 58c5-3 12-1 14 4 2 6-3 12-9 12-5 0-8-5-7-9 0-3 0-5 2-7zM62 24c5-4 14-3 18 2 3 5-1 10-5 12-4 1-6 5-10 4-5-1-7-8-5-13 0-2 1-4 2-5zM80 60c4-2 9 0 10 4s-2 8-6 8-6-5-5-9z"/>' +
        '<use href="#c4land" x="100"/>' +
      '</g></g>' +
      '<g fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".8">' +
        '<ellipse cx="50" cy="50" rx="44" ry="44" stroke-width="1"/>' +
        '<path d="M6 50h88M10 30h80M10 70h80M22 14h56M22 86h56"/>' +
        '<ellipse cx="50" cy="50" ry="44" rx="44"><animate attributeName="rx" values="44;31;0;31;44" dur="9s" repeatCount="indefinite"/></ellipse>' +
        '<ellipse cx="50" cy="50" ry="44" rx="44"><animate attributeName="rx" values="44;31;0;31;44" dur="9s" begin="-3s" repeatCount="indefinite"/></ellipse>' +
        '<ellipse cx="50" cy="50" ry="44" rx="44"><animate attributeName="rx" values="44;31;0;31;44" dur="9s" begin="-6s" repeatCount="indefinite"/></ellipse>' +
      '</g>' +
    '</g>' +
    '<circle cx="50" cy="50" r="44" fill="url(#c4s)"/>' +
    '<circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>';

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m0 0-6-6m6 6-6 6"/></svg>'; /* در راست‌به‌چپ، فلشِ «بازگشت» به راست اشاره می‌کند */

  function show() {
    if (document.getElementById(ROOT_ID)) return;
    if (!document.getElementById(STYLE_ID)) { var st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    var el = document.createElement("div");
    el.id = ROOT_ID; el.setAttribute("role", "alert");
    el.innerHTML =
      '<div class="c4-in">' +
        '<div class="c4-row"><span class="c4-n">۴</span><div class="c4-globe">' + GLOBE + '</div><span class="c4-n">۴</span></div>' +
        '<h1>اوه! در فضا گم شدی</h1>' +
        '<p>صفحه‌ای که دنبالش بودی پیدا نشد. ممکن است جابه‌جا شده یا حذف شده باشد.</p>' +
        '<button type="button" class="c4-btn">' + ARROW + 'بازگشت</button>' +
      '</div>';
    el.querySelector(".c4-btn").addEventListener("click", back);
    document.body.appendChild(el);
    prevTitle = document.title; document.title = "۴۰۴ | صفحه پیدا نشد";
    robots = document.createElement("meta"); robots.name = "robots"; robots.content = "noindex"; document.head.appendChild(robots);
  }
  function hide() {
    var el = document.getElementById(ROOT_ID); if (el) el.remove();
    if (prevTitle != null) { document.title = prevTitle; prevTitle = null; }
    if (robots) { robots.remove(); robots = null; }
  }
  function home() { try { history.replaceState(history.state, "", "/"); } catch (_) {} hide(); }
  function back() {
    var same = false; try { same = document.referrer && new URL(document.referrer).origin === location.origin; } catch (_) {}
    if (same && history.length > 1) history.back(); else home();
  }
  function check() { if (isUnknown()) show(); else hide(); }

  window.addEventListener("popstate", function () { setTimeout(check, 0); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", check); else check();
})();
