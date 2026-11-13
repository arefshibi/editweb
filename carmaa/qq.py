#!/usr/bin/env python3
# پچ «پیشنهاد استوری برای اولین آگهی» — CarMaa
# اجرا: داخل پوشهی پروژه (جایی که index.html و js/ هست):  python3 patch-first-story.py [مسیر]
# چند بار اجرا کردنش امنه (idempotent). از هر فایل تغییرداده‌شده نسخهی .bak-fas میسازد.
import os, re, sys, shutil

cands = [sys.argv[1]] if len(sys.argv) > 1 else [os.getcwd(), os.path.join(os.getcwd(), "carmaa")]
R = next((c for c in cands if os.path.isfile(os.path.join(c, "index.html")) and os.path.isdir(os.path.join(c, "js"))), None)
if not R:
    sys.exit("❌ پوشهی پروژه پیدا نشد (index.html + js/). اسکریپت را داخل پوشهی پروژه اجرا کن یا مسیرش را بده.")
P = lambda *a: os.path.join(R, *a)
rd = lambda f: open(P(f), encoding="utf-8").read()
def wr(f, s):
    with open(P(f), "w", encoding="utf-8", newline="") as fh: fh.write(s)
def backup(f):
    b = P(f) + ".bak-fas"
    if os.path.isfile(P(f)) and not os.path.exists(b): shutil.copy2(P(f), b)

NEED = ["js/22a-carmaa-story-share.js", "js/22-share-poster.js", "js/27-stories.js", "js/17-chip-dropdown.js", "index.html"]
for f in NEED:
    if not os.path.isfile(P(f)): sys.exit("❌ %s پیدا نشد" % f)

JS = r'''/* CarMaa — پیشنهاد استوری بعد از ثبت «اولین آگهی» (برای حساب شخصی و نمایشگاه جدا) */
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
    var bd = document.createElement("div"); bd.className = "fas-bd";
    var m = document.createElement("div"); m.className = "fas-card"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "پیشنهاد استوری");
    m.innerHTML =
      '<button type="button" class="fas-x" aria-label="بستن"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="fas-stage"><span class="fas-glow"></span><span class="fas-ring"></span>' +
      '<div class="fas-ph is-loading"><img alt="" /><i class="fas-sh"></i><b class="fas-tag">استوری ۲۴ ساعته</b></div></div>' +
      '<h3 class="fas-t">آگهی‌ات ثبت شد</h3>' +
      '<p class="fas-s">با یک ضربه، بنر آگهی را در استوری‌های Carma بگذار تا سریع‌تر دیده شود.</p>' +
      '<button type="button" class="fas-go"><span class="fas-lb">ثبت استوری در Carma</span>' +
      '<svg class="fas-sp" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>' +
      '<svg class="fas-ok" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>' +
      '<button type="button" class="fas-no">حالا نه</button>' +
      '<div class="fas-after"><div class="fas-after-in"><div class="fas-row">' +
      '<button type="button" class="fas-ig"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.3" cy="6.7" r=".9" class="d"/></svg><span>استوری در اینستاگرام</span></button>' +
      '<button type="button" class="fas-lt">بذارش بعداً</button></div></div></div>';
    document.body.appendChild(bd); document.body.appendChild(m);
    open = m;
    var go = m.querySelector(".fas-go"), lb = m.querySelector(".fas-lb"), no = m.querySelector(".fas-no"),
        ph = m.querySelector(".fas-ph"), ig = m.querySelector(".fas-ig"), lt = m.querySelector(".fas-lt"),
        tt = m.querySelector(".fas-t"), ss = m.querySelector(".fas-s"), img = ph.querySelector("img"), busy = false, done = false;
    m._esc = function (e) { if (e.key === "Escape" && !busy) close(m, bd); };
    document.addEventListener("keydown", m._esc);
    bd.addEventListener("click", function () { if (!busy) close(m, bd); });
    m.querySelector(".fas-x").addEventListener("click", function () { if (!busy) close(m, bd); });
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
'''
CSS = r'''/* CarMaa — پاپ‌آپ پیشنهاد استوری اولین آگهی */
.fas-bd{position:fixed;inset:0;z-index:100000;background:rgba(5,2,3,.62);-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);opacity:0;transition:opacity .35s ease,backdrop-filter .35s ease,-webkit-backdrop-filter .35s ease}
.fas-bd.is-in{opacity:1;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.fas-bd.is-out{opacity:0;-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0)}
.fas-card{position:fixed;z-index:100001;left:50%;bottom:0;width:min(440px,100%);box-sizing:border-box;direction:rtl;text-align:center;font-family:'Vazirmatn',Tahoma,sans-serif;color:#f5f1f1;
  padding:26px 22px calc(22px + env(safe-area-inset-bottom,0px));border-radius:30px 30px 0 0;background:linear-gradient(180deg,#171011 0%,#0e0809 100%);
  box-shadow:0 -24px 80px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.07);transform:translate(-50%,105%);opacity:.6;transition:transform .55s cubic-bezier(.2,.9,.25,1),opacity .35s ease}
.fas-card.is-in{transform:translate(-50%,0);opacity:1}
.fas-card.is-out{transform:translate(-50%,105%);opacity:0;transition:transform .36s cubic-bezier(.5,0,.75,0),opacity .3s ease}
@media(min-width:640px){.fas-card{bottom:auto;top:50%;border-radius:30px;padding-bottom:24px;transform:translate(-50%,-44%) scale(.94);opacity:0}.fas-card.is-in{transform:translate(-50%,-50%) scale(1);opacity:1}.fas-card.is-out{transform:translate(-50%,-46%) scale(.96)}}
.fas-x{position:absolute;top:14px;left:14px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.07);display:grid;place-items:center;cursor:pointer;transition:background .2s,transform .2s}
.fas-x:hover{background:rgba(255,255,255,.13)}.fas-x:active{transform:scale(.9)}
.fas-x svg{width:16px;height:16px;fill:none;stroke:#e9dede;stroke-width:2.2;stroke-linecap:round}
.fas-stage{position:relative;width:128px;height:210px;margin:6px auto 18px;display:grid;place-items:center}
.fas-glow{position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(closest-side,rgba(200,20,31,.5),transparent 72%);filter:blur(8px);animation:fasBreath 3.6s ease-in-out infinite}
.fas-ring{position:absolute;inset:-5px;border-radius:26px;padding:2.5px;background:conic-gradient(from 0deg,#c8141f,#ff6a4d,#8a0d16,#e8444e,#c8141f);animation:fasSpin 5s linear infinite;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.fas-ph{position:relative;width:100%;height:100%;border-radius:22px;overflow:hidden;background:#1b1213;box-shadow:0 18px 40px rgba(0,0,0,.5);animation:fasFloat 4.2s ease-in-out infinite;transform:rotate(-2deg)}
.fas-ph img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transform:scale(1.06);transition:opacity .6s ease,transform .8s cubic-bezier(.2,.8,.2,1)}
.fas-ph:not(.is-loading) img{opacity:1;transform:scale(1)}
.fas-sh{position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.1) 50%,transparent 70%);background-size:220% 100%;animation:fasShine 1.5s linear infinite;opacity:0;transition:opacity .3s}
.fas-ph.is-loading .fas-sh{opacity:1}
.fas-tag{position:absolute;top:8px;right:8px;font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:99px;background:rgba(10,5,6,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#fff}
.fas-t{margin:0 0 6px;font-size:21px;font-weight:800;letter-spacing:-.2px;opacity:0;transform:translateY(10px);transition:opacity .5s .18s,transform .5s .18s cubic-bezier(.2,.9,.25,1)}
.fas-s{margin:0 auto 20px;max-width:300px;font-size:13.5px;line-height:1.85;color:#b9adad;opacity:0;transform:translateY(10px);transition:opacity .5s .26s,transform .5s .26s cubic-bezier(.2,.9,.25,1)}
.fas-card.is-in .fas-t,.fas-card.is-in .fas-s,.fas-card.is-in .fas-go,.fas-card.is-in .fas-no{opacity:1;transform:none}
.fas-go{position:relative;width:100%;height:54px;border:0;border-radius:18px;cursor:pointer;color:#fff;font:700 15.5px 'Vazirmatn',Tahoma,sans-serif;background:linear-gradient(135deg,#e8444e,#c8141f 55%,#9c0f19);
  box-shadow:0 10px 26px rgba(200,20,31,.38),inset 0 1px 0 rgba(255,255,255,.22);overflow:hidden;display:flex;align-items:center;justify-content:center;gap:10px;
  opacity:0;transform:translateY(12px);transition:opacity .5s .34s,transform .5s .34s cubic-bezier(.2,.9,.25,1),box-shadow .25s,background .4s,filter .2s}
.fas-go::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);transform:translateX(-120%);animation:fasSweep 3.2s 1.2s ease-in-out infinite}
.fas-go:active:not(:disabled){transform:scale(.97)}
.fas-go:disabled{cursor:default}
.fas-sp,.fas-ok{display:none;width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.fas-sp{stroke-dasharray:36 22;animation:fasSpin .8s linear infinite}
.fas-go.is-busy{filter:saturate(.9)}.fas-go.is-busy::after{display:none}.fas-go.is-busy .fas-sp{display:block}
.fas-go.is-done{background:linear-gradient(135deg,#2fb36a,#1f8f52);box-shadow:0 10px 26px rgba(47,179,106,.35),inset 0 1px 0 rgba(255,255,255,.25)}
.fas-go.is-done::after{display:none}.fas-go.is-done .fas-ok{display:block;stroke-dasharray:28;stroke-dashoffset:28;animation:fasDraw .5s .05s ease forwards}
.fas-go.is-done .fas-lb{animation:fasPop .45s cubic-bezier(.2,.9,.25,1)}
.fas-go.is-err{animation:fasShake .45s}
.fas-no{display:block;margin:12px auto 0;border:0;background:none;color:#8f8484;font:600 13px 'Vazirmatn',Tahoma,sans-serif;padding:8px 18px;cursor:pointer;opacity:0;transition:opacity .5s .42s,color .2s}
.fas-no:hover{color:#cfc4c4}
.fas-card.is-done .fas-ring{animation-duration:1.4s}
.fas-card.is-done .fas-glow{background:radial-gradient(closest-side,rgba(47,179,106,.45),transparent 72%)}
/* گزینه‌های بعد از انتشار */
.fas-after{display:grid;grid-template-rows:0fr;transition:grid-template-rows .55s cubic-bezier(.2,.9,.25,1)}
.fas-after-in{overflow:hidden;min-height:0}
.fas-card.show-after .fas-after{grid-template-rows:1fr}
.fas-row{display:flex;gap:10px;padding-top:12px;opacity:0;transform:translateY(10px);transition:opacity .45s .12s,transform .5s .12s cubic-bezier(.2,.9,.25,1)}
.fas-card.show-after .fas-row{opacity:1;transform:none}
.fas-ig,.fas-lt{height:48px;border-radius:16px;font:700 13.5px 'Vazirmatn',Tahoma,sans-serif;cursor:pointer;transition:transform .2s,filter .2s,background .2s}
.fas-ig{flex:1.7;border:0;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#f58529,#dd2a7b 50%,#8134af);box-shadow:0 8px 22px rgba(221,42,123,.3),inset 0 1px 0 rgba(255,255,255,.25)}
.fas-ig svg{width:19px;height:19px;fill:none;stroke:#fff;stroke-width:2}.fas-ig svg .d{fill:#fff;stroke:none}
.fas-lt{flex:1;border:0;background:rgba(255,255,255,.08);color:#d9cfcf}
.fas-lt:hover{background:rgba(255,255,255,.13)}
.fas-ig:active,.fas-lt:active{transform:scale(.96)}
html.theme-light .fas-lt{background:rgba(0,0,0,.06);color:#3a2f30}
@keyframes fasSpin{to{transform:rotate(360deg)}}
@keyframes fasBreath{50%{opacity:.55;transform:scale(1.08)}}
@keyframes fasFloat{50%{transform:rotate(-2deg) translateY(-7px)}}
@keyframes fasShine{to{background-position:-120% 0}}
@keyframes fasSweep{60%,100%{transform:translateX(120%)}}
@keyframes fasDraw{to{stroke-dashoffset:0}}
@keyframes fasPop{0%{transform:scale(.85);opacity:.4}100%{transform:none;opacity:1}}
@keyframes fasShake{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
html.theme-light .fas-card{background:linear-gradient(180deg,#fff,#f6f1f1);color:#161011;box-shadow:0 -24px 80px rgba(0,0,0,.25),inset 0 0 0 1px rgba(0,0,0,.06)}
html.theme-light .fas-s{color:#6b6061}html.theme-light .fas-x{background:rgba(0,0,0,.06)}html.theme-light .fas-x svg{stroke:#2a2021}html.theme-light .fas-no{color:#7d7273}
@media(prefers-reduced-motion:reduce){.fas-card,.fas-bd,.fas-t,.fas-s,.fas-go,.fas-no{transition-duration:.01s!important;transition-delay:0s!important}.fas-glow,.fas-ring,.fas-ph,.fas-go::after,.fas-sh{animation:none!important}}
'''

def one(s, old, new, what):
    if s.count(old) != 1: sys.exit("❌ %s: محل پچ پیدا نشد (%s) — نسخهی فایل با انتظار من فرق دارد؛ هیچ فایلی عوض نشد" % (what, old[:50]))
    return s.replace(old, new)

# ---- مرحلهی بررسی: همهی تغییرات اول در حافظه ساخته می‌شود؛ اگر یکی شکست خورد هیچ فایلی دست نمیخورد ----
plan = {}
def edit(f, marker, fn):
    s = rd(f)
    if marker in s: print("• %s از قبل پچ شده" % f); return
    plan[f] = fn(s)

# 1) ساخت بنر استوری (طرح اول + عکس اول) بدون باز شدن اسلایدر
def p22a(s):
    fn = '''  function renderBlob(d, i) {
    ensureStyle(); d = d || {};
    var first = (Array.isArray(d.images) && d.images[0]) || d.image || '';
    return Promise.all([h2cLib(), qrLib().catch(function () {}), first ? toObjUrl(first, 1600) : Promise.resolve('')]).then(function (r) {
      return render(i || 0, d, r[2]).then(function (b) { if (/^blob:/.test(r[2])) { try { URL.revokeObjectURL(r[2]); } catch (_) {} } return b; });
    });
  }
  w.CarmaaStoryShare = { open: open, config: CFG, renderBlob: renderBlob };'''
    return one(s, "  w.CarmaaStoryShare = { open: open, config: CFG };", fn, "22a")
edit("js/22a-carmaa-story-share.js", "renderBlob", p22a)

# 2) دادهی بنر آگهی
edit("js/22-share-poster.js", "carmaaStoryShareData",
     lambda s: one(s, "  window.openSharePoster = function (listing) {", "  window.carmaaStoryShareData = storyShareData;\n  window.openSharePoster = function (listing) {", "22-share-poster"))

# 3) انتشار استوری از بیرون
def p27(s):
    old = "hasDealer, syncDealerRing };"
    new = 'hasDealer, syncDealerRing, publish: function (media, caption, linked, as) { postAs = as === "dealer" && typeof state !== "undefined" && state.dealership ? "dealer" : ""; return publish(media, caption, linked); } };'
    return one(s, old, new, "27-stories")
edit("js/27-stories.js", "publish: function (media", p27)

# 4) هوک بعد از ثبت آگهی (اولین آگهی هر حساب: شخصی و نمایشگاه جدا)
def p17(s):
    a = "      sellPublishingDraft = { ...sellForm, photos: [...photos], damagedParts: [...damagedParts] };"
    s = one(s, a, "      const __fasFirst = !state.myListings.some((m) => m && m.listing && (m.listing.sellerType || \"personal\") === (newListing.sellerType || \"personal\"));\n" + a, "17 first")
    i = s.index("const sheetOpened = openSellPublishingSheet(")
    j = s.index("// With manual review on", i)
    blk = s[i:j]
    t = 'showToast("آگهی شما ثبت شد و در حال بررسی است.");'
    if blk.count(t) != 2: sys.exit("❌ 17: بلوک ثبت آگهی با انتظار من نمیخواند")
    blk = blk.replace(t, t + "\n        try { window.CARMA_FIRST_AD_STORY && window.CARMA_FIRST_AD_STORY.offer(newListing, __fasFirst); } catch (_) {}")
    return s[:i] + blk + s[j:]
edit("js/17-chip-dropdown.js", "CARMA_FIRST_AD_STORY", p17)

# 5) لینک‌ها + بامپ کش
for page in ("index.html", "index_offline.html"):
    if not os.path.isfile(P(page)): continue
    s = rd(page); o = s
    if "first-ad-story.css" not in s:
        s = one(s, "</head>", '    <link rel="stylesheet" href="first-ad-story.css?v=1" />\n  </head>', page)
    if "64-first-ad-story.js" not in s:
        m = re.search(r'^[ \t]*<script src="js/27-stories\.js[^"]*"></script>[ \t]*$', s, re.M)
        if not m: sys.exit("❌ %s: تگ 27-stories پیدا نشد" % page)
        s = s[:m.end()] + '\n    <script src="js/64-first-ad-story.js?v=1"></script>' + s[m.end():]
    for js in ("22a-carmaa-story-share", "22-share-poster", "27-stories", "17-chip-dropdown"):
        s = re.sub(r'(js/%s\.js\?v=)([^"]*?)(?<!-fas1)"' % js, r'\g<1>\g<2>-fas1"', s)
    if s != o: plan[page] = s

# ---- اعمال ----
for f, s in plan.items():
    backup(f); wr(f, s); print("✓ %s" % f)
wr("js/64-first-ad-story.js", JS); wr("first-ad-story.css", CSS); print("✓ js/64-first-ad-story.js + first-ad-story.css")

print("\nتمام ✅")
print("اگر سایت با docker compose بالا می‌آید، ایمیج وب باید دوباره ساخته شود:  docker compose build web && docker compose up -d web   (یا ./deploy.sh)")
print("بعد مرورگر را رفرش سخت کن (Ctrl+Shift+R).")
print("تست: با حسابی که آگهی ندارد اولین آگهی را ثبت کن؛ بعد از پایان انیمیشن ثبت، پاپ‌آپ می‌آید (برای هر حساب شخصی/نمایشگاه فقط یک بار).")
print("برای دیدن دوبارهی پاپ‌آپ (کنسول مرورگر):  Object.keys(localStorage).filter(k=>k.startsWith('carma_first_story_offer_v1')).forEach(k=>localStorage.removeItem(k))")
