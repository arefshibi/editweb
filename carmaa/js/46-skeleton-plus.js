/* 46 — Skeleton for every image.
   Any <img> that has not finished loading shows a shimmering placeholder (avatars, story rings, listing photos,
   banners…) and fades in once ready. Works for images added later too (MutationObserver). Opt out with data-no-sk. */
(function () {
  "use strict";
  if (typeof MutationObserver === "undefined") return;

  function done(img) {
    img.__cmSk = 0;
    img.classList.remove("cm-img-sk", "cm-img-sk-wait");
    img.classList.add("cm-img-ready");
  }
  // PERF: a lazy image that is off-screen never loads, so it would shimmer (and repaint every frame)
  // forever. Only start the skeleton once a lazy image actually approaches the viewport.
  const lazyIO = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { lazyIO.unobserve(en.target); en.target.__cmLazyWait = 0; mark(en.target); } });
  }, { rootMargin: "200px" }) : null;
  function mark(img) {
    if (!img || img.__cmSk || img.hasAttribute("data-no-sk")) return;
    if (lazyIO && img.loading === "lazy" && !img.complete && !img.__cmLazyWait && !img.__cmLazyOk) {
      // static skeleton tint right away (no animation) so a not-yet-loaded lazy photo is never an empty hole
      img.__cmLazyWait = 1; img.__cmLazyOk = 1; img.classList.add("cm-img-sk-wait"); lazyIO.observe(img);
      const fin0 = () => done(img); img.addEventListener("load", fin0, { once: true }); img.addEventListener("error", fin0, { once: true }); return;
    }
    if (!img.getAttribute("src") && !img.currentSrc) return;
    if (img.complete && img.naturalWidth > 0) return;
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) { /* already failed */ return; }
    img.__cmSk = 1;
    img.classList.remove("cm-img-sk-wait");
    img.classList.add("cm-img-sk");
    const fin = () => done(img);
    img.addEventListener("load", fin, { once: true });
    img.addEventListener("error", fin, { once: true });
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === "IMG") mark(node);
    else if (node.querySelectorAll) node.querySelectorAll("img").forEach(mark);
  }

  // ---- elements whose photo is an inline CSS background-image (showroom covers, banners, brand logos…) ----
  // While the picture downloads, a shimmer replaces it (class cm-bg-sk, !important); once loaded the real background shows.
  const bgLoaded = new Set();
  const BG_RE = /^\s*url\(\s*["']?([^"')]+)["']?\s*\)\s*$/;
  function markBg(el) {
    if (!el || el.nodeType !== 1 || el.hasAttribute("data-no-sk") || el.closest(".cm-share-poster,[data-no-sk]")) return;
    const v = el.style && el.style.backgroundImage; if (!v) return;
    const m = BG_RE.exec(v); if (!m) return;
    const url = m[1];
    if (/^(data|blob):/i.test(url) || bgLoaded.has(url) || el.__cmBgUrl === url) return;
    el.__cmBgUrl = url; el.classList.add("cm-bg-sk");
    const im = new Image();
    const fin = () => { bgLoaded.add(url); if (el.__cmBgUrl === url) { el.classList.remove("cm-bg-sk"); el.classList.add("cm-bg-ready"); } };
    im.onload = fin; im.onerror = fin; im.src = url;
    if (im.complete && im.naturalWidth > 0) fin();
  }
  function scanBg(node) {
    if (!node || node.nodeType !== 1) return;
    markBg(node);
    if (node.querySelectorAll) node.querySelectorAll('[style*="background-image"]').forEach(markBg);
  }

  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "attributes") {
        if (m.attributeName === "style") markBg(m.target);
        else if (m.target.tagName === "IMG") { m.target.classList.remove("cm-img-ready"); mark(m.target); }
      } else m.addedNodes.forEach((n) => { scan(n); scanBg(n); });
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style"] });

  const first = () => { scan(document.documentElement); scanBg(document.documentElement); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", first, { once: true });
  else first();
})();
