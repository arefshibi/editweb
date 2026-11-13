"use strict";
/* ADD-TO-HOME-SCREEN PROMPT — a small bottom sheet that appears a few seconds after the site opens on a phone.
   • Android / Chrome: «افزودن» triggers the browser's real install dialog (beforeinstallprompt).
   • iPhone / iPad (Safari): there is no install API, so the sheet shows the two taps needed (Share → Add to Home Screen).
   • Never shown inside the installed app, on desktop, or again after «بعداً» for 7 days (after 3 «بعداً» -> never).
   • Preview while designing: open the site with ?installpreview=android or ?installpreview=ios */
(function () {
  const KEY = "carma_install_prompt_v1";
  const DAY = 86400000;
  const q = new URLSearchParams(location.search).get("installpreview");
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { return {}; } };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} };

  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  const isMobile = () => isIOS || /Android|Mobile/i.test(ua) || (window.matchMedia && window.matchMedia("(pointer:coarse)").matches && innerWidth < 900);
  let deferred = null, shown = false;

  function allowed() {
    if (q) return true;
    if (isStandalone() || !isMobile()) return false;
    const s = read();
    if (s.installed) return false;
    if ((s.dismissed || 0) >= 3) return false;
    if (s.last && Date.now() - s.last < 7 * DAY) return false;
    return true;
  }

  const css = `
#mrInstall{position:fixed;inset:0;z-index:100001;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;direction:rtl;font-family:inherit;-webkit-font-smoothing:antialiased}
#mrInstall .mri-dim{position:absolute;inset:0;background:rgba(0,0,0,.42);opacity:0;transition:opacity .4s ease;pointer-events:auto}
#mrInstall .mri-sheet{position:relative;width:calc(100% - 16px);max-width:440px;margin:0 8px calc(8px + env(safe-area-inset-bottom,0px));padding:22px 20px 14px;box-sizing:border-box;pointer-events:auto;text-align:center;color:#fff;
  background:rgba(38,38,40,.78);-webkit-backdrop-filter:saturate(180%) blur(30px);backdrop-filter:saturate(180%) blur(30px);
  border:.5px solid rgba(255,255,255,.14);border-radius:34px;box-shadow:0 24px 60px rgba(0,0,0,.5);
  transform:translateY(120%);transition:transform .55s cubic-bezier(.22,1,.36,1)}
#mrInstall.is-in .mri-dim{opacity:1}
#mrInstall.is-in .mri-sheet{transform:none}
#mrInstall .mri-icon{display:block;width:76px;height:76px;margin:0 auto 14px;border-radius:22.4%;object-fit:cover;background:#262628;box-shadow:0 0 0 .5px rgba(255,255,255,.16),0 10px 28px rgba(0,0,0,.45)}
#mrInstall h2{margin:0;font-size:21px;font-weight:800;line-height:1.45;letter-spacing:-.2px;color:#fff}
#mrInstall .mri-sub{margin:6px auto 0;max-width:290px;font-size:14px;line-height:1.7;color:rgba(235,235,245,.6)}
#mrInstall .mri-list{margin:20px 0 0;padding:0;list-style:none;text-align:right;background:rgba(255,255,255,.07);border-radius:20px;overflow:hidden}
#mrInstall .mri-row{display:flex;align-items:center;gap:13px;padding:11px 14px;position:relative}
#mrInstall .mri-row + .mri-row::before{content:"";position:absolute;top:0;inset-inline:61px 0;height:.5px;background:rgba(255,255,255,.12)}
#mrInstall .mri-tile{flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 .5px 0 rgba(255,255,255,.28),0 2px 6px rgba(0,0,0,.25)}
#mrInstall .mri-tile svg{width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#mrInstall .t-amber{background:linear-gradient(180deg,#ffb340,#ff8a00)}
#mrInstall .t-blue{background:linear-gradient(180deg,#4aa3ff,#0a6cff)}
#mrInstall .t-red{background:linear-gradient(180deg,#ffffff,#ffffff)}
#mrInstall .t-green{background:linear-gradient(180deg,#52d97a,#1fb14c)}
#mrInstall .t-gray{background:linear-gradient(180deg,#98989D,#636366)}
#mrInstall .mri-txt{display:flex;flex-direction:column;min-width:0}
#mrInstall .mri-txt b{font-size:15px;font-weight:700;line-height:1.5;color:#fff}
#mrInstall .mri-txt span{font-size:12.5px;line-height:1.5;color:rgba(235,235,245,.55)}
#mrInstall .mri-cta{display:flex;flex-direction:column;gap:2px;margin-top:16px}
#mrInstall .mri-btn{height:54px;border:0;border-radius:999px;background:#fff;color:#1D1D1F;font:inherit;font-size:16.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s ease,opacity .15s ease;-webkit-tap-highlight-color:transparent}
#mrInstall .mri-btn:active{transform:scale(.97);opacity:.88}
#mrInstall .mri-btn svg{width:19px;height:19px;stroke:#1D1D1F;fill:none;stroke-width:2.5;stroke-linecap:round}
#mrInstall .mri-later{height:46px;border:0;background:transparent;color:rgba(235,235,245,.55);font:inherit;font-size:15px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent}
#mrInstall .mri-arrow{display:flex;justify-content:center;margin:2px 0 4px;color:rgba(235,235,245,.5);animation:mriBob 1.6s ease-in-out infinite}
#mrInstall .mri-arrow svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
@keyframes mriBob{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
@media (prefers-reduced-motion:reduce){#mrInstall .mri-sheet,#mrInstall .mri-dim{transition:opacity .2s}#mrInstall .mri-arrow{animation:none}}
`;
  const I = {
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z"/>',
    full: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 7.5 2.5 7.5h-17S6 15.5 6 9"/><path d="M10.2 20a2 2 0 0 0 3.6 0"/>',
    share: '<path d="M12 15V3.5"/><path d="m8.2 7.2 3.8-3.8 3.8 3.8"/><path d="M8 10.5H7a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2h-1"/>',
    add: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
  const row = (tone, icon, title, sub) => `<li class="mri-row"><span class="mri-tile ${tone}">${svg(icon)}</span><span class="mri-txt"><b>${title}</b><span>${sub}</span></span></li>`;

  function build(mode) {
    const root = document.createElement("div");
    root.id = "mrInstall";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "افزودن کارما به صفحه اصلی");
    const head = `<img class="mri-icon" src="icons/icon-192.v2.png" alt="" />
      <h2>کارما را به صفحه اصلی اضافه کن</h2>
      <p class="mri-sub">مثل یک اپ واقعی؛ تمام‌صفحه، سریع و همیشه دم‌دست.</p>`;
    const body = mode === "ios"
      ? `<ul class="mri-list">
           ${row("t-blue", "share", "دکمهٔ اشتراک‌گذاری را بزن", "پایین صفحهٔ Safari")}
           ${row("t-gray", "add", "<bdi dir=\"ltr\">Add to Home Screen</bdi>", "را انتخاب کن")}
         </ul>
         <div class="mri-cta"><button type="button" class="mri-later" data-mri="later">متوجه شدم</button></div>
         <div class="mri-arrow">${svg("down")}</div>`
      : `<ul class="mri-list">
           ${row("t-amber", "bolt", "سریع‌تر باز می‌شود", "بدون انتظار، فقط یک لمس")}
           ${row("t-blue", "full", "تمام‌صفحه", "بدون نوار مرورگر")}
           ${row("t-red", "bell", "اعلان پیام‌ها", "هیچ پاسخی را از دست نده")}
         </ul>
         <div class="mri-cta">
           <button type="button" class="mri-btn" data-mri="install">${svg("plus")}افزودن به صفحه اصلی</button>
           <button type="button" class="mri-later" data-mri="later">بعداً</button>
         </div>`;
    root.innerHTML = `<div class="mri-dim" data-mri="later"></div><div class="mri-sheet">${head}${body}</div>`;
    return root;
  }

  function close(markLater) {
    const root = document.getElementById("mrInstall");
    if (!root) return;
    if (markLater) { const s = read(); s.last = Date.now(); s.dismissed = (s.dismissed || 0) + 1; write(s); }
    root.classList.remove("is-in");
    setTimeout(() => root.remove(), 550);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(true); }

  function show(mode) {
    if (shown || document.getElementById("mrInstall")) return;
    if (window.CARMA_TOUR && window.CARMA_TOUR.busy()) { setTimeout(() => show(mode), 2500); return; } // wait for the onboarding tour to finish
    shown = true;
    if (!document.getElementById("mrInstallCss")) {
      const st = document.createElement("style"); st.id = "mrInstallCss"; st.textContent = css; document.head.appendChild(st);
    }
    const root = build(mode);
    document.body.appendChild(root);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-in")));
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", async (e) => {
      const el = e.target.closest("[data-mri]"); if (!el) return;
      const act = el.getAttribute("data-mri");
      if (act === "later") return close(true);
      if (act === "install") {
        if (!deferred) return close(false);
        try {
          deferred.prompt();
          const r = await deferred.userChoice;
          if (r && r.outcome === "accepted") { const s = read(); s.installed = true; write(s); close(false); }
          else close(true);
        } catch (_) { close(false); }
        deferred = null;
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e;
    if (allowed()) setTimeout(() => show("android"), 4000);
  });
  window.addEventListener("appinstalled", () => { const s = read(); s.installed = true; write(s); close(false); });

  function start() {
    if (q === "ios" || q === "android") return setTimeout(() => show(q), 600);
    if (isIOS && allowed()) setTimeout(() => show("ios"), 4500);
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
  window.CARMA_INSTALL_PROMPT = { show, close };
})();
