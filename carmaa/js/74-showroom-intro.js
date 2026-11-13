/* CM-SR-INTRO2 — صفحه‌ی «ویژگی‌های پنل نمایشگاه» قبل از فرم ساخت نمایشگاه.
   هر مسیری که به «ایجاد نمایشگاه» برسد (حساب من، خانه، لینک مستقیم، اعلان‌ها) اول این صفحه را می‌بیند؛
   آخرِ لیست دکمه‌ی «ساخت نمایشگاه» فرم را باز می‌کند. برای نمایشگاه‌های موجود (ویرایش) نمایش داده نمی‌شود. */
(function () {
  "use strict";
  if (window.__cmSrIntro2) return; window.__cmSrIntro2 = true;

  var root = null, ok = false, closing = false;
  function S() { try { return typeof state !== "undefined" ? state : null; } catch (_) { return null; } }
  function onPage() { var s = S(); return !!(s && s.route && s.route.page === "dealershipEdit"); }
  function creating() { var s = S(); return !!(s && s.account && !s.dealership); }

  var I = {
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5Z"/>',
    badge: '<path d="M12 3.2l6.8 2.8v5.4c0 4.1-2.8 7.5-6.8 9.4-4-1.9-6.8-5.3-6.8-9.4V6L12 3.2Z"/><path d="M8.9 12l2.3 2.3 4-4.2"/>',
    story: '<circle cx="12" cy="12" r="8.5"/><path d="M10.3 8.8v6.4l5.3-3.2-5.3-3.2Z"/>',
    chart: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
    qr: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.3"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.3"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.3"/><path d="M14 14h2.6v2.6M20 14v.01M14 20h2.6M20 17.4V20h-2"/>',
    award: '<circle cx="12" cy="9.2" r="5.3"/><path d="M8.8 13.5L7.6 20.8l4.4-2.5 4.4 2.5-1.2-7.3"/>',
    chat: '<path d="M5.5 5h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.4V17h-2A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5Z"/>',
    shop: '<path d="M4 9l1.6-4.6h12.8L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5.5 11.8V20h13v-8.2M10 20v-4.5h4V20"/>'
  };
  var ROWS = [
    ["globe", "#0071E3", "#5ac8fa", "صفحه‌ی اختصاصی با آدرس خودت", "همه‌ی آگهی‌هایت در یک صفحه‌ی عمومی، با لینک کوتاه و قابل‌اشتراک."],
    ["badge", "#30d158", "#6fe38e", "برچسب و نشان تأیید نمایشگاه", "پس از تأیید مدیریت، روی همه‌ی آگهی‌هایت می‌نشیند و اعتماد خریدار را بالا می‌برد."],
    ["story", "#ff375f", "#ff7a93", "استوری و پوستر آماده‌ی آگهی", "بنر استوری ۲۴ ساعته و پوستر اینستاگرام را با یک ضربه بساز."],
    ["chart", "#32ade6", "#64d2ff", "آمار ۷ روز گذشته", "ببین کدام آگهی‌هایت بیشتر دیده می‌شود و کجا باید تمرکز کنی."],
    ["qr", "#5e5ce6", "#8e8cf5", "QR قابل‌چاپ برای شیشه‌ی نمایشگاه", "مشتری با اسکن آن مستقیم به آگهی‌هایت می‌رسد."],
    ["award", "#ff9f0a", "#ffc552", "نشان‌های افتخار و رتبه", "با فعال‌بودن و امتیاز مشتری‌ها در فهرست نمایشگاه‌ها بالاتر بیا."],
    ["chat", "#bf5af2", "#d78cf7", "دنبال‌کننده و پیام مستقیم", "مشتری‌ها دنبالت می‌کنند و از همان صفحه برایت پیام می‌دهند."]
  ];
  function svg(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[k] + "</svg>"; }

  function css() {
    if (document.getElementById("cm-sri-css")) return;
    var st = document.createElement("style"); st.id = "cm-sri-css";
    st.textContent = [
      ".sri{--bg:#000;--card:#262628;--fg:#F5F5F7;--mut:#98989D;--line:rgba(255,255,255,.1);--glass:rgba(255,255,255,.07);--acc:var(--bw-blue,#0071E3);",
      "position:fixed;inset:0;z-index:100002;background:var(--bg);color:var(--fg);direction:rtl;font-family:'Vazirmatn',Tahoma,sans-serif;-webkit-font-smoothing:antialiased;",
      "display:flex;flex-direction:column;opacity:0;transform:translateY(18px);transition:opacity .35s ease,transform .55s cubic-bezier(.22,.9,.24,1)}",
      ".sri.is-in{opacity:1;transform:none}.sri.is-out{opacity:0;transform:translateY(12px);transition-duration:.25s}",
      /* نوار بالا (متریال شیشه‌ای که با اسکرول ظاهر می‌شود) */
      ".sri-nav{position:absolute;top:0;left:0;right:0;z-index:3;height:calc(54px + env(safe-area-inset-top,0px));padding:env(safe-area-inset-top,0px) 16px 0;display:flex;align-items:center;justify-content:space-between}",
      ".sri-nav::before{content:'';position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(18px);backdrop-filter:saturate(1.8) blur(18px);border-bottom:.5px solid var(--line);opacity:0;transition:opacity .25s}",
      ".sri.is-sc .sri-nav::before{opacity:1}",
      ".sri-nt{position:relative;font-size:15px;font-weight:700;opacity:0;transition:opacity .25s}.sri.is-sc .sri-nt{opacity:1}",
      ".sri-back,.sri-sp{position:relative;width:36px;height:36px}",
      ".sri-back{border:0;border-radius:50%;background:var(--glass);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:transform .2s}",
      ".sri-back:active{transform:scale(.9)}.sri-back svg{width:17px;height:17px;fill:none;stroke:var(--fg);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}",
      ".sri-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:calc(62px + env(safe-area-inset-top,0px)) 18px 150px}",
      ".sri-in{max-width:520px;margin:0 auto}",
      /* هیرو: ترکیب لایه‌ای از کارت‌های شیشه‌ای */
      ".sri-hero{position:relative;height:218px;margin:2px 0 22px}",
      ".sri-glow{position:absolute;left:50%;top:46%;width:300px;height:220px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(0,113,227,.5),rgba(94,92,230,.18) 55%,transparent 75%);filter:blur(22px);opacity:0;transition:opacity 1s .1s}",
      ".sri.is-in .sri-glow{opacity:1}",
      ".sri-h{position:absolute;opacity:0;transform:translateY(22px) scale(.97);transition:opacity .6s var(--d,0s) ease,transform .85s var(--d,0s) cubic-bezier(.2,.95,.25,1)}",
      ".sri.is-in .sri-h{opacity:1;transform:none}",
      ".sri-main{left:50%;top:14px;margin-left:-139px;width:278px;height:176px;border-radius:28px;padding:16px;box-sizing:border-box;--d:.1s;",
      "background:linear-gradient(165deg,#26262a,#262628 70%);box-shadow:0 0 0 .5px rgba(255,255,255,.16),inset 0 .5px 0 rgba(255,255,255,.2),0 30px 60px -18px rgba(0,0,0,.9)}",
      ".sri-id{display:flex;align-items:center;gap:11px}",
      ".sri-logo{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#64d2ff,#0071E3 55%,#5e5ce6);box-shadow:inset 0 .5px 0 rgba(255,255,255,.5),0 8px 18px -6px rgba(0,113,227,.7)}",
      ".sri-logo svg{width:24px;height:24px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
      ".sri-nm{min-width:0;flex:1;text-align:right}.sri-nm b{display:flex;align-items:center;gap:5px;font-size:15px;font-weight:800}.sri-nm b svg{width:16px;height:16px;flex:none}",
      ".sri-nm span{display:block;margin-top:1px;font:500 11px 'Inter',system-ui,sans-serif;color:var(--mut);direction:ltr;text-align:right;letter-spacing:.1px}",
      ".sri-th{display:flex;gap:8px;margin-top:16px}",
      ".sri-th i{flex:1;height:64px;border-radius:12px;background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.04));box-shadow:inset 0 0 0 .5px rgba(255,255,255,.1);position:relative;overflow:hidden}",
      ".sri-th i::after{content:'';position:absolute;left:8px;right:8px;bottom:8px;height:5px;border-radius:3px;background:rgba(255,255,255,.18)}",
      ".sri-th i::before{content:'';position:absolute;left:8px;width:38%;bottom:17px;height:5px;border-radius:3px;background:rgba(255,255,255,.1)}",
      ".sri-st{right:calc(50% - 170px);bottom:0;width:126px;padding:12px 13px;border-radius:20px;box-sizing:border-box;--d:.24s;background:color-mix(in srgb,#2c2c30 70%,transparent);-webkit-backdrop-filter:blur(20px) saturate(1.6);backdrop-filter:blur(20px) saturate(1.6);box-shadow:0 0 0 .5px rgba(255,255,255,.18),0 18px 34px -12px rgba(0,0,0,.8)}",
      ".sri-st small{display:block;font-size:10.5px;font-weight:600;color:var(--mut)}",
      ".sri-st b{display:block;margin:1px 0 7px;font-size:17px;font-weight:800}",
      ".sri-bars{display:flex;align-items:flex-end;gap:4px;height:26px}.sri-bars i{flex:1;border-radius:3px;background:linear-gradient(180deg,#64d2ff,#0071E3)}",
      ".sri-ring{left:calc(50% - 172px);top:-2px;width:62px;height:62px;border-radius:50%;--d:.36s;padding:3px;box-sizing:border-box;background:conic-gradient(from 200deg,#0071E3,#bf5af2,#ff375f,#ff9f0a,#0071E3);box-shadow:0 14px 28px -10px rgba(191,90,242,.6)}",
      ".sri-ring span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:#262628;box-shadow:inset 0 0 0 2.5px #262628}",
      ".sri-ring svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
      ".sri-t{margin:0 0 8px;text-align:center;font-size:29px;line-height:1.45;font-weight:900;letter-spacing:-.5px;text-wrap:balance;opacity:0;transform:translateY(10px);transition:opacity .6s .3s,transform .7s .3s cubic-bezier(.22,.9,.24,1)}",
      ".sri-t em{display:block;font-style:normal;font-size:32px;background:linear-gradient(100deg,#64d2ff,#0071E3 45%,#bf5af2);-webkit-background-clip:text;background-clip:text;color:transparent}",
      ".sri-t span{display:block;margin-top:2px;font-size:17px;line-height:1.7;font-weight:600;letter-spacing:0;color:var(--mut)}.sri-s{margin:0 auto 24px;max-width:330px;text-align:center;font-size:14px;line-height:2;color:var(--mut);opacity:0;transform:translateY(10px);transition:opacity .6s .38s,transform .7s .38s cubic-bezier(.22,.9,.24,1)}",
      ".sri.is-in .sri-t,.sri.is-in .sri-s{opacity:1;transform:none}",
      /* لیست گروهی به سبک iOS */
      ".sri-list{list-style:none;margin:0;padding:0;background:var(--card);border-radius:22px;overflow:hidden;box-shadow:inset 0 0 0 .5px var(--line)}",
      ".sri-li{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;opacity:0;transform:translateY(10px);transition:opacity .55s calc(.46s + var(--i)*.055s) ease,transform .7s calc(.46s + var(--i)*.055s) cubic-bezier(.22,.9,.24,1)}",
      ".sri.is-in .sri-li{opacity:1;transform:none}",
      ".sri-li+.sri-li::before{content:'';position:absolute;top:0;left:0;right:70px;height:.5px;background:var(--line)}",
      ".sri-ic{flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(160deg,var(--c2),var(--c1));box-shadow:inset 0 .5px 0 rgba(255,255,255,.35),0 6px 12px -6px var(--c1)}",
      ".sri-ic svg{width:21px;height:21px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
      ".sri-tx{min-width:0;text-align:right}.sri-tx b{display:block;font-size:15px;font-weight:700;line-height:1.7}",
      ".sri-tx span{display:block;margin-top:1px;font-size:12.5px;line-height:1.85;color:var(--mut)}",
      ".sri-note{margin:16px 6px 0;text-align:center;font-size:12px;line-height:1.9;color:var(--mut)}",
      ".sri-bar{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:34px 20px calc(14px + env(safe-area-inset-bottom,0px));background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--bg) 88%,transparent) 42%,var(--bg))}",
      ".sri-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;max-width:520px;margin:0 auto;height:56px;border:0;border-radius:18px;background:linear-gradient(180deg,#2e93ff,#0071E3);color:#fff;font:800 16px 'Vazirmatn',Tahoma,sans-serif;cursor:pointer;box-shadow:inset 0 .5px 0 rgba(255,255,255,.4),0 14px 30px -12px rgba(0,113,227,.8);transition:transform .15s}",
      ".sri-go:active{transform:scale(.98)}.sri-go svg{width:17px;height:17px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}",
      "html body .sri button{outline:0!important}html body .sri button:focus-visible{box-shadow:inset 0 0 0 2px rgba(255,255,255,.5)!important}",
      "html.theme-light .sri{--bg:#f2f2f7;--card:#fff;--fg:#262628;--mut:#6e6e73;--line:rgba(0,0,0,.1);--glass:rgba(0,0,0,.06)}",
      "html.theme-light .sri-glow{opacity:.55!important}",
      "html.theme-light .sri-main{background:linear-gradient(165deg,#fff,#eef0f4 80%);box-shadow:0 0 0 .5px rgba(0,0,0,.1),0 30px 50px -20px rgba(0,0,0,.35)}",
      "html.theme-light .sri-th i{background:linear-gradient(160deg,rgba(0,0,0,.08),rgba(0,0,0,.03))}html.theme-light .sri-th i::after,html.theme-light .sri-th i::before{background:rgba(0,0,0,.1)}",
      "html.theme-light .sri-st{background:rgba(255,255,255,.78);box-shadow:0 0 0 .5px rgba(0,0,0,.1),0 18px 34px -14px rgba(0,0,0,.3)}",
      "html.theme-light .sri-ring span{background:#fff;box-shadow:inset 0 0 0 2.5px #fff}html.theme-light .sri-ring svg{stroke:#262628}",
      "@media(max-width:360px){.sri-t em{font-size:28px}}",
      "@media(prefers-reduced-motion:reduce){.sri,.sri-li,.sri-h,.sri-t,.sri-s,.sri-glow{transition-duration:.01s!important;transition-delay:0s!important}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function back() {
    try { var h = history.state; if (history.length > 1 && h && h.marqueRoute) { history.back(); return; } } catch (_) {}
    try { if (typeof navigateTo === "function") navigateTo({ page: "account" }, { menuOpen: false }); } catch (_) {}
  }
  function onKey(e) { if (e.key === "Escape") back(); }

  function show() {
    if (root) return;
    css(); closing = false;
    root = document.createElement("div"); root.className = "sri"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "ویژگی‌های پنل نمایشگاه");
    var rows = ROWS.map(function (r, i) {
      return '<li class="sri-li" style="--i:' + i + ";--c1:" + r[1] + ";--c2:" + r[2] + '"><span class="sri-ic">' + svg(r[0]) + '</span><div class="sri-tx"><b>' + r[3] + "</b><span>" + r[4] + "</span></div></li>";
    }).join("");
    var check = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#0071E3"/><path d="M5.800 10.200l2.600 2.600 5.200-5.400" fill="none" stroke="#fff" stroke-width="1.900" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    root.innerHTML =
      '<div class="sri-nav"><button type="button" class="sri-back" aria-label="بازگشت"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button><span class="sri-nt">پنل نمایشگاه</span><i class="sri-sp"></i></div>' +
      '<div class="sri-scroll"><div class="sri-in">' +
      '<div class="sri-hero" aria-hidden="true"><div class="sri-glow"></div>' +
      '<div class="sri-h sri-main"><div class="sri-id"><span class="sri-logo"><svg viewBox="0 0 24 24">' + I.shop + '</svg></span><div class="sri-nm"><b>نمایشگاه شما ' + check + '</b><span>Carma-app.ir/you</span></div></div><div class="sri-th"><i></i><i></i><i></i></div></div>' +
      '<div class="sri-h sri-st"><small>۷ روز گذشته</small><b>۱٬۲۴۸</b><div class="sri-bars"><i style="height:38%"></i><i style="height:56%"></i><i style="height:44%"></i><i style="height:78%"></i><i style="height:62%"></i><i style="height:100%"></i></div></div>' +
      '<div class="sri-h sri-ring"><span><svg viewBox="0 0 24 24"><path d="M9.800 7.800v8.400l6.600-4.200-6.600-4.200Z"/></svg></span></div>' +
      "</div>" +
      '<h1 class="sri-t"><em>پنل نمایشگاه</em><span>مخصوص فروشنده‌های حرفه‌ای</span></h1>' +
      '<p class="sri-s">هرچه برای دیده‌شدن و جلب اعتماد لازم داری، در یک پنل کنار هم است.</p>' +
      '<ul class="sri-list">' + rows + "</ul>" +
      '<p class="sri-note">ثبت آگهی در پنل نمایشگاه پس از تأیید مدیریت فعال می‌شود.</p>' +
      "</div></div>" +
      '<div class="sri-bar"><button type="button" class="sri-go"><span>ساخت نمایشگاه</span><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button></div>';
    document.body.appendChild(root);
    var sc = root.querySelector(".sri-scroll"), rr = root;
    sc.addEventListener("scroll", function () { rr.classList.toggle("is-sc", sc.scrollTop > 90); }, { passive: true });
    root.querySelector(".sri-back").addEventListener("click", back);
    root.querySelector(".sri-go").addEventListener("click", function () { ok = true; hide(); try { window.scrollTo(0, 0); } catch (_) {} });
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (root) root.classList.add("is-in"); }); });
  }
  function hide(instant) {
    if (!root || closing) return;
    var r = root; closing = true; document.removeEventListener("keydown", onKey);
    var done = function () { try { r.remove(); } catch (_) {} if (root === r) root = null; closing = false; };
    if (instant) return done();
    r.classList.remove("is-in"); r.classList.add("is-out"); setTimeout(done, 280);
  }

  function sync() {
    if (!onPage()) { ok = false; hide(true); return; }
    if (creating() && !ok) show(); else hide(true);
  }

  var orig = window.render;
  if (typeof orig === "function") {
    window.render = function carmaaShowroomIntroRender() {
      var r = orig.apply(this, arguments);
      try { sync(); } catch (_) {}
      return r;
    };
  }
  try { sync(); } catch (_) {}
})();
