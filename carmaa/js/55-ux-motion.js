"use strict";
/* Smooth motion: (1) page enter transition on route change, (2) sliding highlight in the bottom dock. */
(function () {
  const reduce = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let lastKey = null, popped = false, popTimer = 0;
  window.addEventListener("popstate", () => { popped = true; clearTimeout(popTimer); popTimer = setTimeout(() => { popped = false; }, 700); });

  function enter(page) { /* CM-DOCK-MOTION: فقط fade کوتاه روی کامپوزیتور؛ بدون left/position که لگ می‌داد */
    if (!page.animate) return;
    page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  }

  function onContent(root) {
    const page = root.firstElementChild;
    if (!page) return;
    if (page.classList.contains("cm-skeleton-screen") || page.getAttribute("aria-busy") === "true") return;
    const key = (page.getAttribute("data-page") || page.className || page.tagName) + "|" + location.pathname;
    if (key === lastKey) return;
    const first = lastKey === null;
    lastKey = key;
    if (first || reduce()) return;
    enter(page);
  }

  function setupDock() {
    const pill = document.querySelector("#bottomDock .dock-pill");
    if (!pill || pill.querySelector(".cm-dock-ind")) return;
    const ind = document.createElement("span");
    ind.className = "cm-dock-ind"; ind.setAttribute("aria-hidden", "true");
    pill.insertBefore(ind, pill.firstChild);
    pill.classList.add("cm-ind-on");
    let placed = false, lastW = 0;

    const target = () => pill.querySelector(".dock-item.is-tap") || pill.querySelector(".dock-item.is-active");
    function place() {
      const t = target();
      if (!t) { ind.style.opacity = "0"; return; }
      const pr = pill.getBoundingClientRect(), tr = t.getBoundingClientRect();
      if (!tr.width || !pr.width) return;
      let x = tr.left - pr.left - pill.clientLeft; const y = tr.top - pr.top - pill.clientTop;
      x = Math.max(0, Math.min(x, pr.width - pill.clientLeft * 2 - tr.width)); /* CM-DOCK-MOTION: هرگز بیرون از کادر */
      const snap = !placed || reduce();
      if (snap) ind.classList.add("cm-snap");
      ind.style.width = tr.width + "px"; ind.style.height = tr.height + "px";
      ind.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      ind.style.opacity = "1";
      if (snap) { void ind.offsetWidth; ind.classList.remove("cm-snap"); placed = true; }
    }

    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target;
        if (el === pill || !el.classList || !el.classList.contains("dock-item")) continue;
        const was = (r.oldValue || "").split(/\s+/);
        if (el.classList.contains("is-active") && !was.includes("is-active")) {
          el.classList.add("cm-pop"); setTimeout(() => el.classList.remove("cm-pop"), 520);
        }
      }
      place();
    }).observe(pill, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });

    if (window.ResizeObserver) {
      new ResizeObserver(() => { const w = pill.getBoundingClientRect().width; if (!lastW && w) placed = false; lastW = w; place(); }).observe(pill);
    }
    window.addEventListener("resize", () => { placed = false; place(); }, { passive: true });
    place();
  }

  function start() {
    const content = document.getElementById("pageContent");
    if (content) {
      onContent(content);
      new MutationObserver(() => onContent(content)).observe(content, { childList: true });
    }
    setupDock();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

/* CM-DOCK-MOTION */
(function () {
  try {
    if (document.getElementById("cmDockMotionCss")) return;
    var st = document.createElement("style"); st.id = "cmDockMotionCss";
    st.textContent = 'html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock:not(.cm-social-dock) .dock-pill .cm-dock-ind:not(.cm-snap),html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock .dock-pill .cm-dock-ind:not(.cm-snap){transition:transform .2s cubic-bezier(.3,.8,.3,1),width .2s cubic-bezier(.3,.8,.3,1),opacity .12s linear!important}html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock:not(.cm-social-dock) .dock-pill .cm-dock-ind.cm-snap,html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock .dock-pill .cm-dock-ind.cm-snap{transition:none!important}html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock .dock-pill .cm-dock-ind{box-shadow:none!important}html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock .dock-pill .dock-item.cm-pop svg,html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock:not(.cm-social-dock) .dock-pill .dock-item.is-active .dock-label{animation:none!important}html body:not(#x):not(#y) #bottomDock#bottomDock.bottom-dock .dock-pill .dock-item svg{transition:transform .12s ease-out!important}';
    document.head.appendChild(st);
  } catch (_) {}
})();
