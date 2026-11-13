"use strict";
/*
 * CarMaa listing → vehicle transition, lightweight shared-photo morph.
 *
 * The previous implementation cloned the entire app viewport, animated a
 * page-sized clip-path, faded every child and moved a copied photo toward the
 * hero container (rather than the actual hero image). That was expensive on
 * phones and could make the photo visibly drift away from its destination.
 *
 * This version keeps only the clicked card's photo DOM, moves that small,
 * fixed overlay to the exact hero-image bounds, then cross-fades to the real
 * image. It never clones the page or changes the viewport's dimensions.
 */
(function () {
  const DURATION = 440;
  const EASE = "cubic-bezier(.22,1,.36,1)";
  let busy = false;

  const reduceMotion = () => {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (_) { return false; }
  };

  function getPhotoBox(trigger) {
    if (!trigger || !trigger.closest) return null;
    const card = trigger.closest(".xcd, .xc, article, .card-fade-in") || trigger;
    let box = card.querySelector(".xcd-photo") || card.querySelector(".xc-photo");
    if (box) return { card, box };

    const img = card.querySelector("img:not(.smart-photo-bg)") || card.querySelector("img");
    if (!img) return null;
    box = img.closest("[class*='photo']") || img.parentElement;
    return box ? { card, box } : null;
  }

  // Keep only the photo and the wrappers needed to preserve its exact crop.
  // Badges, labels, buttons, IDs and other card content are deliberately left
  // behind, so the animated overlay is tiny and inert.
  function pruneToPhotos(root) {
    Array.from(root.children).forEach((child) => {
      if (child.tagName === "IMG") return;
      if (!child.querySelector("img")) {
        child.remove();
        return;
      }
      pruneToPhotos(child);
    });
  }

  function begin(trigger) {
    try {
      if (busy || reduceMotion() || !trigger) return null;
      const found = getPhotoBox(trigger);
      if (!found) return null;
      const { card, box } = found;
      const rect = box.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.width < 40 || rect.height < 40 || rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) return null;

      const images = Array.from(box.querySelectorAll("img"));
      const primary = images.find((img) => !img.classList.contains("smart-photo-bg")) || images[0];
      if (!primary || !(primary.currentSrc || primary.src)) return null;

      const cs = getComputedStyle(box);
      const clone = box.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("inert", "");
      clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      clone.querySelectorAll("a,button,input,textarea,select,[tabindex],[data-action]").forEach((el) => {
        el.removeAttribute("data-action");
        el.removeAttribute("tabindex");
      });
      pruneToPhotos(clone);

      const cloneImages = Array.from(clone.querySelectorAll("img"));
      cloneImages.forEach((img, index) => {
        const source = images[index];
        if (source && (source.currentSrc || source.src)) img.src = source.currentSrc || source.src;
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.loading = "eager";
        img.decoding = "async";
        img.alt = "";
        img.style.setProperty("transition", "none", "important");
        img.style.setProperty("animation", "none", "important");
        // The decorative portrait fill stays simple while moving; avoid a
        // full-size blur/filter being recomputed on every frame on mobile.
        if (img.classList.contains("smart-photo-bg")) {
          img.style.setProperty("filter", "none", "important");
          img.style.setProperty("transform", "none", "important");
          img.style.setProperty("opacity", ".52", "important");
        }
      });

      const startClip = cs.clipPath && cs.clipPath !== "none"
        ? cs.clipPath
        : "polygon(0% 0%,100% 0%,100% 100%,0% 100%)";
      const startRadius = cs.borderRadius || "0px";
      clone.style.cssText += `;position:fixed!important;z-index:100000;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;box-sizing:border-box;flex:none;display:block;margin:0!important;overflow:hidden;pointer-events:none;contain:layout paint;will-change:left,top,width,height,clip-path,border-radius;clip-path:${startClip};border-radius:${startRadius};transform:none;`;

      return {
        clone,
        card,
        start: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        startClip,
        startRadius,
        imageSrc: primary.currentSrc || primary.src,
      };
    } catch (_) { return null; }
  }

  function run(morph) {
    if (!morph) return;
    let finished = false;
    let flyAnimation = null;
    let flyFadeAnimation = null;
    let targetAnimation = null;
    let targetImage = null;
    let originalTargetOpacity = "";
    let fallbackTimer = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try { if (flyAnimation) flyAnimation.cancel(); } catch (_) {}
      try { if (flyFadeAnimation) flyFadeAnimation.cancel(); } catch (_) {}
      try { if (targetAnimation) targetAnimation.cancel(); } catch (_) {}
      if (targetImage) targetImage.style.opacity = originalTargetOpacity;
      if (morph.clone && morph.clone.isConnected) morph.clone.remove();
      busy = false;
    };

    try {
      if (typeof state === "undefined" || !state.route || state.route.page !== "vehicle") return;
      const target = document.querySelector('#pageContent [data-slot="hero"] img.hero-photo, #pageContent [data-slot="hero"] > img');
      if (!target || !target.animate || !morph.clone) return;
      const dest = target.getBoundingClientRect();
      if (dest.width < 40 || dest.height < 40) return;

      busy = true;
      targetImage = target;
      originalTargetOpacity = target.style.opacity;
      target.style.opacity = "0";
      document.body.appendChild(morph.clone);

      const targetFrame = target.closest(".hero-photo-wrap") || target.parentElement;
      const frameStyle = targetFrame ? getComputedStyle(targetFrame) : null;
      const endRadius = frameStyle ? (frameStyle.borderRadius || "0px") : "0px";
      const endClip = "polygon(0% 0%,100% 0%,100% 100%,0% 100%)";
      const s = morph.start;
      flyAnimation = morph.clone.animate([
        {
          left: `${s.left}px`, top: `${s.top}px`, width: `${s.width}px`, height: `${s.height}px`,
          borderRadius: morph.startRadius, clipPath: morph.startClip, opacity: 1,
        },
        {
          left: `${dest.left}px`, top: `${dest.top}px`, width: `${dest.width}px`, height: `${dest.height}px`,
          borderRadius: endRadius, clipPath: endClip, opacity: 1,
        },
      ], { duration: DURATION, easing: EASE, fill: "both" });

      // Let the real hero image take over only at the end of the flight. This
      // hides any difference between thumbnail crop and full-size hero crop.
      flyFadeAnimation = morph.clone.animate([
        { opacity: 1 },
        { opacity: 0 },
      ], { duration: 105, delay: DURATION - 105, easing: "ease-out", fill: "both" });
      targetAnimation = target.animate([
        { opacity: 0 },
        { opacity: 1 },
      ], { duration: 105, delay: DURATION - 105, easing: "ease-out", fill: "both" });

      Promise.all([flyAnimation.finished, flyFadeAnimation.finished, targetAnimation.finished])
        .then(finish).catch(finish);
      fallbackTimer = setTimeout(finish, DURATION + 260);
    } catch (_) { finish(); }
  }

  window.CARMA_MORPH = { begin, run };
})();
