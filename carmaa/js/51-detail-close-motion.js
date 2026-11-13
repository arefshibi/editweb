"use strict";
/*
 * CarMaa · Shared-element close/open motion
 *
 * Complements the existing listing→vehicle photo morph with its reverse
 * transition, and gives showroom cards the same image-to-cover continuity.
 * Only one fixed photo layer is animated (never a clone of the whole page).
 * Route changes are observed around the existing render() function so both
 * in-app Back buttons and the browser / Android Back gesture are supported.
 */
(function () {
  if (window.__CARMA_DETAIL_MOTION_INSTALLED) return;
  window.__CARMA_DETAIL_MOTION_INSTALLED = true;

  const DURATION = 470;
  const FADE_DURATION = 112;
  const EASE = "cubic-bezier(.22,1,.36,1)";
  const reduceMotion = () => {
    try { return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  };

  let lastRoute = null;
  let pendingShowroomOpen = null;
  let activeFlight = null;
  let fadeAnimation = null;

  function routeInfo(route) {
    if (!route) return null;
    return {
      page: String(route.page || ""),
      listingId: String((route.listing && route.listing.id) || route.listingId || ""),
      sellerId: String(route.sellerId || route.slug || ""),
      brand: String(route.brand || ""),
      kind: String(route.kind || "")
    };
  }

  function currentRouteInfo() {
    try {
      // `state` is a top-level lexical binding in the existing classic scripts,
      // not necessarily a property on window.
      if (typeof state !== "undefined" && state && state.route) return routeInfo(state.route);
    } catch (_) {}
    return routeInfo(window.state && window.state.route);
  }

  function sameRoute(a, b) {
    if (!a || !b || a.page !== b.page) return false;
    if (a.page === "vehicle") return a.listingId === b.listingId;
    if (a.page === "seller" || a.page === "dealerPublic") return a.sellerId === b.sellerId && a.kind === b.kind;
    if (a.page === "listings" || a.page === "brand") return a.brand === b.brand;
    return true;
  }

  function pageRoot() {
    const host = document.getElementById("pageContent");
    if (!host) return null;
    return host.querySelector('[data-page="vehicle"], [data-page="seller"], [data-page="listings"], [data-page="dealers"], [data-page="home"], [data-page="brand"]') || host.firstElementChild;
  }

  function isShowroomRoot(root) {
    return !!root && (root.classList?.contains("sp-dealer") || !!root.querySelector?.(".sp-hero--has-banner"));
  }

  function rectOf(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    if (!Number.isFinite(r.left) || r.width < 36 || r.height < 36) return null;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function styleSnapshot(el, box, type, src) {
    if (!el || !box) return null;
    const rect = rectOf(box);
    if (!rect) return null;
    const cs = getComputedStyle(box);
    const img = type === "image" ? (el.tagName === "IMG" ? el : box.querySelector?.("img")) : null;
    const imgStyle = img ? getComputedStyle(img) : null;
    return {
      type,
      src: src || (img && (img.currentSrc || img.src)) || "",
      backgroundImage: type === "background" ? (cs.backgroundImage || "none") : "none",
      backgroundPosition: cs.backgroundPosition || "center",
      backgroundSize: cs.backgroundSize || "cover",
      rect,
      radius: cs.borderRadius || "0px",
      objectPosition: imgStyle ? (imgStyle.objectPosition || "50% 50%") : "50% 50%"
    };
  }

  function imageSource(img) {
    return img && (img.currentSrc || img.src) || "";
  }

  function showroomCardSnapshot(trigger) {
    if (!trigger) return null;
    const card = trigger.closest(".sr-card");
    let box = card && card.querySelector(".sr-media");
    if (!box && trigger.closest(".cm-hfs")) {
      box = trigger.closest(".cm-hfs-media") || trigger.closest(".cm-hfs-profile") || trigger.closest(".cm-hfs-open");
    }
    if (!box && trigger.matches?.(".seller-mini--dealer")) box = trigger;
    if (!box) box = trigger;
    const img = box.querySelector?.("img:not(.smart-photo-bg), img") || (box.tagName === "IMG" ? box : null);
    if (!img || !imageSource(img)) return null;
    const snap = styleSnapshot(img, box, "image", imageSource(img));
    if (snap) snap.kind = "showroom";
    return snap;
  }

  // Capture the card before the existing delegated click handler changes route.
  document.addEventListener("click", (event) => {
    const trigger = event.target && event.target.closest
      ? event.target.closest('[data-action="goSeller"][data-seller-id]')
      : null;
    if (!trigger) return;
    const kind = trigger.getAttribute("data-seller-kind") || "";
    if (kind === "personal") { pendingShowroomOpen = null; return; }
    const snap = showroomCardSnapshot(trigger);
    if (snap) {
      snap.sellerId = String(trigger.getAttribute("data-seller-id") || "");
      pendingShowroomOpen = snap;
    } else {
      pendingShowroomOpen = null;
    }
  }, true);

  function coverElement(root) {
    return document.querySelector('#pageBlurWrap > .sp-banner-cover.sp-cover-banner-layer')
      || (root && root.querySelector('.sp-banner-cover.has-banner'))
      || (root && root.querySelector('.sp-banner-cover'));
  }

  function captureOutgoing(root, route) {
    if (!root || !route) return null;
    if (route.page === "vehicle") {
      const img = root.querySelector('.hero-photo-wrap img.hero-photo, [data-slot="hero"] img.hero-photo, [data-slot="hero"] > img');
      if (!img || !imageSource(img)) return null;
      const box = img.closest(".hero-photo-wrap") || img;
      const snap = styleSnapshot(img, box, "image", imageSource(img));
      if (snap) {
        snap.kind = "vehicle";
        snap.listingId = route.listingId;
      }
      return snap;
    }
    if ((route.page === "seller" || route.page === "dealerPublic") && isShowroomRoot(root)) {
      const cover = coverElement(root);
      if (!cover) return null;
      const cs = getComputedStyle(cover);
      if (!cs.backgroundImage || cs.backgroundImage === "none") return null;
      const snap = styleSnapshot(cover, cover, "background", "");
      if (snap) {
        snap.kind = "showroom";
        snap.sellerId = route.sellerId;
      }
      return snap;
    }
    return null;
  }

  function createFlyer(snapshot) {
    if (!snapshot || !snapshot.rect) return null;
    let el;
    if (snapshot.type === "background") {
      el = document.createElement("div");
      // Preserve the cover image while keeping a dark, premium edge throughout the flight.
      el.style.backgroundImage = snapshot.backgroundImage && snapshot.backgroundImage !== "none"
        ? `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.22)),${snapshot.backgroundImage}`
        : "linear-gradient(180deg,#1D1D1F,#000)";
      el.style.backgroundPosition = snapshot.backgroundPosition || "center";
      el.style.backgroundSize = snapshot.backgroundSize || "cover";
      el.style.backgroundRepeat = "no-repeat";
    } else {
      el = document.createElement("img");
      el.src = snapshot.src;
      el.alt = "";
      el.draggable = false;
      el.decoding = "async";
      el.style.objectFit = "cover";
      el.style.objectPosition = snapshot.objectPosition || "50% 50%";
    }
    const r = snapshot.rect;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText += `;position:fixed!important;z-index:100002!important;left:${r.left}px!important;top:${r.top}px!important;width:${r.width}px!important;height:${r.height}px!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;display:block!important;box-sizing:border-box!important;margin:0!important;padding:0!important;border:0!important;border-radius:${snapshot.radius || "0px"}!important;overflow:hidden!important;pointer-events:none!important;opacity:1;object-fit:cover;background-color:#000;transform:translateZ(0);will-change:left,top,width,height,border-radius,opacity;contain:layout paint;`;
    return el;
  }

  function cancelActiveFlight() {
    if (!activeFlight) return;
    try { activeFlight.animations.forEach((a) => a && a.cancel()); } catch (_) {}
    if (activeFlight.timer) clearTimeout(activeFlight.timer);
    if (activeFlight.target) activeFlight.target.style.opacity = activeFlight.oldOpacity;
    if (activeFlight.fly && activeFlight.fly.isConnected) activeFlight.fly.remove();
    activeFlight = null;
  }

  function animateFly(snapshot, target, pageToFade, targetOpacityOverride) {
    if (!snapshot || !target || reduceMotion() || typeof target.animate !== "function") return false;
    cancelActiveFlight();
    const dest = rectOf(target);
    if (!dest) return false;
    const fly = createFlyer(snapshot);
    if (!fly) return false;
    const oldOpacity = targetOpacityOverride !== undefined ? targetOpacityOverride : target.style.opacity;
    target.style.opacity = "0";
    document.body.appendChild(fly);

    const flight = { fly, target, oldOpacity, animations: [], timer: null };
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (flight.timer) clearTimeout(flight.timer);
      try { flight.animations.forEach((a) => a && a.cancel()); } catch (_) {}
      if (target.isConnected) target.style.opacity = oldOpacity;
      if (fly.isConnected) fly.remove();
      if (activeFlight === flight) activeFlight = null;
    };
    activeFlight = flight;

    // Start on the next frame so the just-rendered route and the shared image
    // layer are composited together; no white gap flashes between the pages.
    requestAnimationFrame(() => {
      if (activeFlight !== flight) return;
      if (!fly.isConnected || !target.isConnected) { finish(); return; }
      const currentDest = rectOf(target) || dest;
      const cs = getComputedStyle(target);
      const endRadius = cs.borderRadius || "0px";
      const frames = [
        { left: `${snapshot.rect.left}px`, top: `${snapshot.rect.top}px`, width: `${snapshot.rect.width}px`, height: `${snapshot.rect.height}px`, borderRadius: snapshot.radius || "0px", opacity: 1 },
        { left: `${currentDest.left}px`, top: `${currentDest.top}px`, width: `${currentDest.width}px`, height: `${currentDest.height}px`, borderRadius: endRadius, opacity: 1 }
      ];
      try {
        const move = fly.animate(frames, { duration: DURATION, easing: EASE, fill: "both" });
        const fade = fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_DURATION, delay: DURATION - FADE_DURATION, easing: "ease-out", fill: "both" });
        const reveal = target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_DURATION, delay: DURATION - FADE_DURATION, easing: "ease-out", fill: "both" });
        flight.animations = [move, fade, reveal];
      } catch (_) { finish(); return; }
      Promise.all(flight.animations.map((a) => a.finished.catch(() => null))).then(finish);
      flight.timer = setTimeout(finish, DURATION + 260);
    });
    if (pageToFade) fadePage(pageToFade, 360);
    return true;
  }

  function fadePage(root, duration = 330) {
    if (!root || reduceMotion() || typeof root.animate !== "function") return;
    try {
      if (fadeAnimation) fadeAnimation.cancel();
      const animation = root.animate(
        [{ opacity: 0.35 }, { opacity: 1 }],
        { duration, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" }
      );
      fadeAnimation = animation;
      animation.finished.catch(() => {}).finally(() => { if (fadeAnimation === animation) fadeAnimation = null; });
    } catch (_) {}
  }

  function targetBoxForVehicle(trigger) {
    if (!trigger) return null;
    const card = trigger.closest(".xcd, .xc, .sr-card, .card-fade-in, article") || trigger;
    return card.querySelector(".xcd-photo, .xc-photo, .sr-media, .car-card-photo, [class*='photo-wrap']")
      || (trigger.querySelector && trigger.querySelector("img") && trigger.querySelector("img").parentElement)
      || card.querySelector("img:not(.smart-photo-bg)")?.parentElement
      || trigger;
  }

  function candidateScore(el) {
    const r = rectOf(el);
    if (!r) return -1;
    const viewportArea = Math.max(1, (window.innerWidth || 1) * (window.innerHeight || 1));
    return Math.min((r.width * r.height) / viewportArea, 1);
  }

  function findDestination(snapshot, nextRoute) {
    if (!snapshot || !nextRoute) return null;
    let candidates = [];
    if (snapshot.kind === "vehicle" && snapshot.listingId) {
      candidates = Array.from(document.querySelectorAll('[data-action="goVehicle"][data-id]'))
        .filter((el) => String(el.getAttribute("data-id")) === String(snapshot.listingId))
        .map((el) => targetBoxForVehicle(el));
    } else if (snapshot.kind === "showroom" && snapshot.sellerId) {
      candidates = Array.from(document.querySelectorAll('[data-action="goSeller"][data-seller-id]'))
        .filter((el) => String(el.getAttribute("data-seller-id")) === String(snapshot.sellerId))
        .map((el) => {
          const card = el.closest(".sr-card");
          if (card && card.querySelector(".sr-media")) return card.querySelector(".sr-media");
          return el.closest(".cm-hfs-media, .seller-mini--dealer") || el;
        });
    }
    candidates = candidates.filter(Boolean);
    candidates.sort((a, b) => candidateScore(b) - candidateScore(a));
    return candidates[0] || null;
  }

  function findShowroomCover(root) {
    // The showroom renderer moves this layer into #pageBlurWrap on the next frame.
    return document.querySelector('#pageBlurWrap > .sp-banner-cover.sp-cover-banner-layer')
      || (root && root.querySelector('.sp-banner-cover.has-banner'))
      || (root && root.querySelector('.sp-banner-cover'));
  }

  function openShowroom(snapshot, root) {
    if (!snapshot || !root || !isShowroomRoot(root) || reduceMotion()) return false;
    // Hide it synchronously before the browser paints the newly rendered profile.
    const initialCover = findShowroomCover(root);
    const initialOpacity = initialCover ? initialCover.style.opacity : "";
    if (initialCover) initialCover.style.opacity = "0";
    let tries = 0;
    const seekCover = () => {
      if (!root.isConnected || tries++ > 4) {
        if (initialCover && initialCover.isConnected) initialCover.style.opacity = initialOpacity;
        if (root.isConnected) fadePage(root, 360);
        return;
      }
      const cover = findShowroomCover(root);
      if (cover) cover.style.opacity = "0";
      const ready = cover && rectOf(cover);
      if (!ready) { requestAnimationFrame(seekCover); return; }
      const targetOpacity = cover === initialCover ? initialOpacity : cover.style.opacity;
      if (!animateFly(snapshot, cover, root, targetOpacity)) {
        cover.style.opacity = targetOpacity;
        fadePage(root, 360);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(seekCover));
    return true;
  }

  // Wrap the existing renderer, not the routing logic. This catches history
  // popstate / Android Back as well as in-app Back without changing navigation.
  const originalRender = window.render;
  if (typeof originalRender !== "function") return;

  window.render = function carmaaMotionAwareRender() {
    const rootBefore = pageRoot();
    const routeBefore = lastRoute || currentRouteInfo() || null;
    const routeNext = currentRouteInfo();
    const changed = !!routeBefore && !!routeNext && !sameRoute(routeBefore, routeNext);
    const outgoing = changed ? captureOutgoing(rootBefore, routeBefore) : null;
    const incomingShowroom = changed && routeNext.page === "seller" ? pendingShowroomOpen : null;

    // Route render remains synchronous; the single-photo motion begins after it.
    const result = originalRender.apply(this, arguments);
    const rootAfter = pageRoot();

    // Close transitions for vehicle listings and both directions of showroom
    // navigation are intentionally disabled per product request. Navigation
    // itself remains unchanged; the existing listing-open animation in
    // 50-card-morph.js is preserved.
    if (changed || pendingShowroomOpen) pendingShowroomOpen = null;
    lastRoute = currentRouteInfo() || routeNext;
    return result;
  };

  // Seed route identity if this bundle is evaluated after the first paint.
  if (!lastRoute) lastRoute = currentRouteInfo();
})();
