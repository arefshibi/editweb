/* CarMaa (CM-FLUX1 · طراحی لوکس/مینیمال) — پیشنهاد استوری بعد از ثبت «اولین آگهی» (برای حساب شخصی و نمایشگاه جدا) */
(function () {
  "use strict";
  var KEY = "carma_first_story_offer_v1";
  var FA = function (s) { return String(s).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); };
  var open = null;

  function seenKey(listing) {
    var acc = ""; try { acc = String((typeof state !== "undefined" && state && state.account) || ""); } catch (_) {}
    return KEY + ":" + acc + ":" + ((listing && listing.sellerType) || "personal");
  }
  function flagged(k) { try { return !!localStorage.getItem(k); } catch (_) { return false; } }
  function setFlag(k) { try { localStorage.setItem(k, String(Date.now())); } catch (_) {} }

  // بنر اول (طرح اول + عکس اول) → JPEG سبک برای آپلود به‌عنوان استوری
  function toStoryMedia(blob) {
    return new Promise(function (ok, bad) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 1080 / im.naturalWidth), c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        try { ok(c.toDataURL("image/jpeg", 0.86)); } catch (e) { bad(e); }
      };
      im.onerror = function () { URL.revokeObjectURL(u); bad(new Error("img")); };
      im.src = u;
    });
  }

  function makeBanner(listing) {
    var S = window.CarmaaStoryShare, mk = window.carmaaStoryShareData;
    if (!S || typeof S.renderBlob !== "function" || typeof mk !== "function") return Promise.reject(new Error("no-banner"));
    return S.renderBlob(mk(listing), 0);
  }

  function close(m, bd) {
    if (!m || m._closing) return; m._closing = true;
    m.classList.add("is-out"); bd.classList.add("is-out");
    document.removeEventListener("keydown", m._esc);
    setTimeout(function () { m.remove(); bd.remove(); if (m._url) { try { URL.revokeObjectURL(m._url); } catch (_) {} } open = null; }, 380);
  }

  function show(listing) {
    if (open) return;
    var bd = document.createElement("div"); bd.className = "fl-bd";
    var m = document.createElement("div"); m.className = "fl-card"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "پیشنهاد استوری");
    m.innerHTML =
      '<div class="fl-grab"></div>' +
      '<button type="button" class="fl-x" aria-label="بستن"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="fl-stage"><div class="fl-ph is-loading"><img alt="" /></div></div>' +
      '<div class="fl-eb"><i></i>استوری ۲۴ ساعته</div>' +
      '<h3 class="fl-t">آگهی‌ات ثبت شد</h3>' +
      '<p class="fl-s">با یک ضربه، بنر آگهی را در استوری‌های Carma بگذار تا سریع‌تر دیده شود.</p>' +
      '<button type="button" class="fl-go"><span class="fl-lb">ثبت استوری در Carma</span>' +
      '<svg class="fl-sp" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>' +
      '<svg class="fl-ok" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>' +
      '<button type="button" class="fl-no">حالا نه</button>' +
      '<div class="fl-after"><div class="fl-after-in"><div class="fl-row">' +
      '<button type="button" class="fl-ig"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.3" cy="6.7" r=".9" class="d"/></svg><span>استوری در اینستاگرام</span></button>' +
      '<button type="button" class="fl-lt">بذارش بعداً</button></div></div></div>';
    document.body.appendChild(bd); document.body.appendChild(m);
    open = m;
    var go = m.querySelector(".fl-go"), lb = m.querySelector(".fl-lb"), no = m.querySelector(".fl-no"),
        ph = m.querySelector(".fl-ph"), ig = m.querySelector(".fl-ig"), lt = m.querySelector(".fl-lt"),
        tt = m.querySelector(".fl-t"), ss = m.querySelector(".fl-s"), img = ph.querySelector("img"), busy = false, done = false;
    m._esc = function (e) { if (e.key === "Escape" && !busy) close(m, bd); };
    document.addEventListener("keydown", m._esc);
    bd.addEventListener("click", function () { if (!busy) close(m, bd); });
    m.querySelector(".fl-x").addEventListener("click", function () { if (!busy) close(m, bd); });
    no.addEventListener("click", function () { if (!busy) close(m, bd); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { m.classList.add("is-in"); bd.classList.add("is-in"); }); });
    setTimeout(function () { try { go.focus({ preventScroll: true }); } catch (_) {} }, 450);

    // پیش‌ساخت بنر همزمان با نمایش پاپ‌آپ؛ پیش‌نمایش همان بنر واقعی است
    var photo = (Array.isArray(listing.photos) && listing.photos[0]) || "";
    var bannerP = makeBanner(listing).then(function (b) { m._url = URL.createObjectURL(b); return b; });
    bannerP.then(function () { img.src = m._url; }, function () { if (photo) img.src = photo; })
      .then(function () { if (!img.src) ph.classList.remove("is-loading"); });
    img.addEventListener("load", function () { ph.classList.remove("is-loading"); });
    img.addEventListener("error", function () { ph.classList.remove("is-loading"); });

    lt.addEventListener("click", function () { close(m, bd); });
    ig.addEventListener("click", function () {
      close(m, bd);
      setTimeout(function () {
        try { if (typeof window.openSharePoster === "function") window.openSharePoster(listing); } catch (_) {}
      }, 380);
    });
    go.addEventListener("click", function () {
      if (busy || done) return;
      busy = true; go.classList.remove("is-err"); go.classList.add("is-busy"); go.disabled = true; lb.textContent = "در حال ثبت…";
      var as = listing.sellerType === "dealer" ? "dealer" : "";
      bannerP.then(toStoryMedia, function () { return photo ? photo : Promise.reject(new Error("no-media")); })
        .then(function (media) {
          var S = window.MARQUE_STORIES;
          if (!S || typeof S.publish !== "function") throw new Error("no-stories");
          return S.publish(media, "", listing, as);
        })
        .then(function (okk) {
          if (!okk) throw new Error("fail");
          done = true; go.classList.remove("is-busy"); go.classList.add("is-done"); lb.textContent = "استوری در سایت آپلود شد";
          m.classList.add("is-done"); no.style.display = "none";
          tt.textContent = "استوری منتشر شد"; ss.textContent = "می‌خوای همین بنر را در اینستاگرام هم بگذاری؟";
          setTimeout(function () { m.classList.add("show-after"); try { ig.focus({ preventScroll: true }); } catch (_) {} }, 700);
          try { window.MARQUE_STORIES.refreshTop && window.MARQUE_STORIES.refreshTop(); window.MARQUE_STORIES.refreshRail && window.MARQUE_STORIES.refreshRail(); } catch (_) {}
          busy = false;
        })
        .catch(function () {
          busy = false; go.disabled = false; go.classList.remove("is-busy"); go.classList.add("is-err"); lb.textContent = "انتشار نشد؛ دوباره تلاش کن";
        });
    });
  }

  window.CARMA_FIRST_AD_STORY = {
    offer: function (listing, isFirst) {
      try {
        if (!isFirst || !listing) return;
        var k = seenKey(listing);
        if (flagged(k)) return;
        setFlag(k);
        setTimeout(function () { show(listing); }, 650);
      } catch (_) {}
    },
    show: show
  };
})();
