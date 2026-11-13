#!/bin/bash
# CarMaa patch: home page "latest listings" as a horizontal card rail + promo banner below it.
# Run inside the project root (where index.html is). Safe to re-run. Set SKIP_DEPLOY=1 to skip the docker rebuild.
set -e
R="${1:-$PWD}"
[ -f "$R/index.html" ] || { [ -f "$R/../index.html" ] && R="$R/.."; }
for f in index.html js/35-home-dashboard.js; do
  [ -f "$R/$f" ] || { echo "ERROR: $f not found in $R - cd to the project root first"; exit 1; }
done
command -v node >/dev/null || { echo "ERROR: node is not installed"; exit 1; }
node - "$R" <<'JS'
var fs = require('fs'), path = require('path'), R = process.argv[2];
var plan = {};
function get(rel) { if (!(rel in plan)) plan[rel] = fs.existsSync(path.join(R, rel)) ? fs.readFileSync(path.join(R, rel), 'utf8') : ''; return plan[rel]; }
function set(rel, s) { plan[rel] = s; }
function fail(m) { console.error('ERROR: ' + m + ' (nothing was changed)'); process.exit(1); }
function once(rel, a, label) { if (get(rel).split(a).length !== 2) fail(rel + ': anchor "' + label + '" not found exactly once (file differs from expected version)'); }
function rep(rel, a, b, label) { once(rel, a, label); set(rel, get(rel).replace(a, function () { return b; })); }
var J = 'js/35-home-dashboard.js', IDX = 'index.html', CSS = 'latest-rail.css';

/* ---------- 1) stylesheet (new file) ---------- */
set(CSS, [
'/* CM-LT: home latest-listings rail + promo banner */',
'.cm-home-page .cm-lt-sec{margin:26px 0 0;padding-inline:16px}',
'.cm-lt-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}',
'.cm-lt-head h2{margin:0;font-size:20px;line-height:1.35;font-weight:800;color:#f4f6f9;display:flex;align-items:center;gap:8px}',
'.cm-lt-head h2::before{content:"";width:12px;height:3px;border-radius:2px;background:#f08a24}',
'.cm-lt-all{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:#c9ccd3;font:inherit;font-size:13px;font-weight:600;padding:6px 0;cursor:pointer}',
'.cm-lt-all svg{width:16px;height:16px;fill:none;stroke:#f08a24;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
'.cm-lt-wrap{position:relative}',
'.cm-lt-rail{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;padding:2px 2px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',
'.cm-lt-rail::-webkit-scrollbar{display:none}',
'.cm-lt-card{flex:0 0 clamp(212px,62vw,250px);scroll-snap-align:start;position:relative;overflow:hidden;border-radius:18px;background:#17181c;border:1px solid rgba(255,255,255,.07);color:#f4f6f9;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .2s ease}',
'.cm-lt-card:active{transform:scale(.985)}',
'.cm-lt-photo{position:relative;aspect-ratio:16/10;background:#202228;overflow:hidden}',
'.cm-lt-photo>*:not(.cm-lt-heart){position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}',
'.cm-lt-photo::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,rgba(0,0,0,.28) 0,rgba(0,0,0,0) 38%,rgba(23,24,28,0) 62%,#17181c 100%)}',
'.cm-lt-heart{position:absolute;top:8px;left:8px;z-index:2;width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:#fff;cursor:pointer}',
'.cm-lt-heart svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}',
'.cm-lt-heart.is-on svg{fill:#ff4d6d;stroke:#ff4d6d}',
'.cm-lt-body{position:relative;z-index:1;padding:0 14px 14px;margin-top:-4px;display:flex;flex-direction:column;gap:8px;text-align:right}',
'.cm-lt-title{margin:0;font-size:15px;line-height:1.4;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.cm-lt-meta{display:flex;align-items:center;gap:12px;font-size:11.5px;color:#a9adb6;white-space:nowrap}',
'.cm-lt-meta span{display:inline-flex;align-items:center;gap:5px;min-width:0}',
'.cm-lt-meta svg{width:14px;height:14px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
'.cm-lt-price{display:flex;align-items:baseline;gap:5px;font-size:14.5px;font-weight:800}',
'.cm-lt-price b{font-weight:800;direction:ltr;unicode-bidi:isolate}',
'.cm-lt-price small{font-size:12px;font-weight:600;color:#d5d8de}',
'.cm-lt-tag{align-self:flex-start;display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:9px;background:rgba(255,255,255,.1);color:#e6e8ee;font-size:11px;font-weight:700}',
'.cm-lt-tag.is-urgent{color:#ffb454}',
'.cm-lt-nav{position:absolute;top:34%;z-index:3;width:38px;height:38px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:rgba(44,45,51,.94);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer}',
'.cm-lt-nav[hidden]{display:none}',
'.cm-lt-nav svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
'.cm-lt-next{left:-6px}',
'.cm-lt-prev{right:-6px}',
'@media (hover:none){.cm-lt-nav{display:none!important}}',
'.cm-lt-promo{position:relative;margin:18px 16px 0;height:clamp(170px,46vw,250px);border-radius:20px;overflow:hidden;background:#0c0d10;border:1px solid rgba(255,255,255,.07);isolation:isolate}',
'.cm-lt-promo-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}',
'.cm-lt-promo-img.is-flip{transform:scaleX(-1)}',
'.cm-lt-promo::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to right,rgba(8,9,12,.88) 0,rgba(8,9,12,.55) 38%,rgba(8,9,12,0) 72%)}',
'.cm-lt-promo-copy{position:absolute;z-index:2;left:clamp(16px,5vw,34px);top:50%;transform:translateY(-50%);width:62%;max-width:420px;text-align:left;color:#f5f6f8}',
'.cm-lt-promo-copy h3{margin:0 0 8px;font-size:clamp(17px,4.8vw,26px);line-height:1.4;font-weight:800;color:#fff}',
'.cm-lt-promo-copy p{margin:0 0 14px;font-size:clamp(12px,3.3vw,15px);line-height:1.6;color:#c9ccd3}',
'.cm-lt-cta{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border:0;border-radius:999px;background:#fff;color:#111;font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
'.cm-lt-cta svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
'html.theme-light .cm-lt-head h2{color:#16181c}',
'html.theme-light .cm-lt-all{color:#4b5058}',
'html.theme-light .cm-lt-card{background:#fff;border-color:rgba(0,0,0,.08);color:#16181c}',
'html.theme-light .cm-lt-photo::after{background:linear-gradient(to bottom,rgba(0,0,0,.22) 0,rgba(0,0,0,0) 38%,rgba(255,255,255,0) 62%,#fff 100%)}',
'html.theme-light .cm-lt-meta{color:#5b6068}',
'html.theme-light .cm-lt-price small{color:#3a3e45}',
'html.theme-light .cm-lt-tag{background:rgba(0,0,0,.07);color:#2a2d33}',
''
].join('\n'));

/* ---------- 2) index.html: stylesheet link + cache-bust ---------- */
if (get(IDX).indexOf('latest-rail.css') === -1) {
  var m = get(IDX).match(/<link rel="stylesheet" href="social-feed-ios\.css[^>]*>/);
  if (!m) fail('index.html: social-feed-ios.css link not found');
  rep(IDX, m[0], m[0] + '\n    <link rel="stylesheet" href="latest-rail.css?v=1" />', 'css link');
}
set(IDX, get(IDX).replace(/(js\/35-home-dashboard\.js\?v=)([^"']*)/, function (_, a, b) { return /(^|-)lt1(-|$)/.test(b) ? a + b : a + b + '-lt1'; }));

/* ---------- 3) js/35-home-dashboard.js ---------- */
if (get(J).indexOf('CM-LT') === -1) {
  /* 3a) section markup */
  var s0 = get(J), st = s0.indexOf('<section class="cm-home-latest cm-lay-section"');
  if (st < 0 || s0.indexOf('<section class="cm-home-latest cm-lay-section"', st + 5) >= 0) fail(J + ': latest section not found exactly once');
  var en = s0.indexOf('</section>', st);
  if (en < 0) fail(J + ': latest section end not found');
  en += '</section>'.length;
  var markup = [
'<!-- CM-LT -->',
'<section class="cm-lt-sec" aria-label="\u062c\u062f\u06cc\u062f\u062a\u0631\u06cc\u0646 \u0622\u06af\u0647\u06cc\u200c\u0647\u0627">',
'      <div class="cm-lt-head"><h2>\u062c\u062f\u06cc\u062f\u062a\u0631\u06cc\u0646 \u0622\u06af\u0647\u06cc\u200c\u0647\u0627</h2><button type="button" class="cm-lt-all" data-action="goListings" data-brand="all">\u0645\u0634\u0627\u0647\u062f\u0647 \u0647\u0645\u0647 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button></div>',
'      <div class="cm-lt-wrap">',
'        <div class="cm-lt-rail" data-slot="latest-listings" aria-label="\u0622\u06af\u0647\u06cc\u200c\u0647\u0627\u06cc \u062c\u062f\u06cc\u062f"></div>',
'        <button type="button" class="cm-lt-nav cm-lt-prev" aria-label="\u0642\u0628\u0644\u06cc" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>',
'        <button type="button" class="cm-lt-nav cm-lt-next" aria-label="\u0628\u0639\u062f\u06cc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>',
'      </div>',
'    </section>',
'',
'    <section class="cm-lt-promo" aria-label="\u062a\u0628\u0644\u06cc\u063a">',
'      <img class="cm-lt-promo-img" src="assets/home-experience-banner.webp" alt="" width="1923" height="817" loading="lazy" decoding="async" draggable="false" />',
'      <div class="cm-lt-promo-copy"><h3>\u062a\u062c\u0631\u0628\u0647\u200c\u0627\u06cc \u0645\u062a\u0641\u0627\u0648\u062a \u062f\u0631 \u062e\u0631\u06cc\u062f \u062e\u0648\u062f\u0631\u0648</h3><p>\u0628\u0627 CarMaa\u060c \u0645\u0637\u0645\u0626\u0646 \u0628\u062e\u0631\u060c \u0645\u0637\u0645\u0626\u0646 \u0628\u0641\u0631\u0648\u0634</p><button type="button" class="cm-lt-cta" data-action="goListings" data-brand="all">\u0647\u0645\u06cc\u0646 \u062d\u0627\u0644\u0627 \u0634\u0631\u0648\u0639 \u06a9\u0646\u06cc\u062f <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg></button></div>',
'    </section>'
  ].join('\n');
  set(J, s0.slice(0, st) + markup + s0.slice(en));

  /* 3b) helper functions (before cmBannerList) */
  var helpers = [
'/* CM-LT: latest listings rail (horizontal cards) + promo image fallback */',
'function cmLtFa(v) { return String(v).replace(/[0-9]/g, (d) => "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[d]); }',
'function cmLtCard(l) {',
'  const esc = (v) => (typeof escHtml === "function" ? escHtml(String(v == null ? "" : v)) : String(v == null ? "" : v));',
'  const title = (typeof listingDisplayTitle === "function" ? listingDisplayTitle(l) : "") || l.adTitle || l.title || "";',
'  const miles = parseInt(String(l.miles == null ? "" : l.miles).replace(/[^0-9]/g, ""), 10);',
'  const km = Number.isFinite(miles) ? Math.round((miles * 1.60934) / 10) * 10 : null;',
'  const raw = typeof normalizePriceDigits === "function" ? normalizePriceDigits(l.price) : l.price;',
'  let num = Number(l.priceAmount);',
'  if (!Number.isFinite(num) || num <= 0) num = parseInt(String(raw == null ? "" : raw).replace(/[^0-9]/g, ""), 10);',
'  const nego = typeof isNegotiablePrice === "function" && isNegotiablePrice(l.price);',
'  const priceHtml = Number.isFinite(num) && num > 0 && !nego ? `<b dir="ltr">${cmLtFa(num.toLocaleString("en-US"))}</b><small>\u062a\u0648\u0645\u0627\u0646</small>` : `<b>${nego ? "\u062a\u0648\u0627\u0641\u0642\u06cc" : "\u062a\u0645\u0627\u0633 \u0628\u06af\u06cc\u0631\u06cc\u062f"}</b>`;',
'  const city = typeof cardCityLabel === "function" ? cardCityLabel(l) : (l.city || "");',
'  const urgent = typeof isListingUrgent === "function" && isListingUrgent(l);',
'  let dealer = false; try { dealer = typeof listingSeller === "function" && listingSeller(l).type === "dealer"; } catch (_) {}',
'  const tag = urgent ? "\u0641\u0648\u0631\u06cc" : (dealer ? "\u0641\u0631\u0648\u0634\u06af\u0627\u0647\u06cc" : "\u0634\u062e\u0635\u06cc");',
'  let liked = false; try { liked = typeof state !== "undefined" && state.likedIds.includes(l.id); } catch (_) {}',
'  const photo = typeof cardPhotoMarkup === "function" ? cardPhotoMarkup(l) : "";',
'  return `<article class="cm-lt-card" data-action="goVehicle" data-id="${esc(l.id)}">',
'    <div class="cm-lt-photo">${photo}<button type="button" class="cm-lt-heart${liked ? " is-on" : ""}" data-action="toggleLike" data-id="${esc(l.id)}" aria-label="\u0630\u062e\u06cc\u0631\u0647 \u0622\u06af\u0647\u06cc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button></div>',
'    <div class="cm-lt-body">',
'      <h3 class="cm-lt-title" dir="auto">${esc(title)}</h3>',
'      <div class="cm-lt-meta">${km != null ? `<span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m12 12 3.5-3.5"/></svg>${cmLtFa(km.toLocaleString("en-US"))} \u06a9\u06cc\u0644\u0648\u0645\u062a\u0631</span>` : ""}${city ? `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10.2c0 5-7 10.2-7 10.2S5 15.2 5 10.2a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></svg>${esc(city)}</span>` : ""}</div>',
'      <div class="cm-lt-price">${priceHtml}</div>',
'      <span class="cm-lt-tag${urgent ? " is-urgent" : ""}">${tag}</span>',
'    </div>',
'  </article>`;',
'}',
'function cmLtFill(rail, sorted, page) {',
'  if (!rail) return;',
'  rail.innerHTML = sorted.slice(0, 10).map(cmLtCard).join("");',
'  const wrap = rail.parentElement;',
'  const next = wrap && wrap.querySelector(".cm-lt-next"), prev = wrap && wrap.querySelector(".cm-lt-prev");',
'  const step = () => Math.max(200, Math.round(rail.clientWidth * 0.8));',
'  const sync = () => {',
'    const max = rail.scrollWidth - rail.clientWidth, pos = Math.abs(rail.scrollLeft);',
'    if (prev) prev.hidden = pos < 8;',
'    if (next) next.hidden = max <= 8 || pos > max - 8;',
'  };',
'  if (next) next.addEventListener("click", (e) => { e.stopPropagation(); rail.scrollBy({ left: -step(), behavior: "smooth" }); });',
'  if (prev) prev.addEventListener("click", (e) => { e.stopPropagation(); rail.scrollBy({ left: step(), behavior: "smooth" }); });',
'  rail.addEventListener("scroll", sync, { passive: true });',
'  window.requestAnimationFrame(sync); window.setTimeout(sync, 400);',
'  const pi = page && page.querySelector(".cm-lt-promo-img");',
'  if (pi) {',
'    const fallback = () => { if (pi.dataset.fb) return; pi.dataset.fb = "1"; pi.classList.add("is-flip"); pi.src = "assets/promo-suv-light.webp"; };',
'    pi.addEventListener("error", fallback);',
'    if (pi.complete && pi.naturalWidth === 0 && pi.getAttribute("src")) fallback();',
'  }',
'}',
''
  ].join('\n');
  rep(J, 'function cmBannerList() {', helpers + 'function cmBannerList() {', 'cmBannerList');

  /* 3c) fill call: build the rail, old 2-card block becomes a no-op */
  rep(J, '  const latest = latestSorted.slice(0, 2);\n', '  cmLtFill(rail, latestSorted, page);\n  const latest = [];\n', 'latest slice');
}

/* ---------- write ---------- */
var n = 0;
Object.keys(plan).forEach(function (rel) {
  var f = path.join(R, rel), had = fs.existsSync(f), old = had ? fs.readFileSync(f, 'utf8') : null;
  if (old === plan[rel]) { console.log('- unchanged: ' + rel); return; }
  if (had) fs.copyFileSync(f, f + '.bak-lt1');
  fs.writeFileSync(f, plan[rel]); console.log('OK ' + (had ? 'patched: ' : 'created: ') + rel); n++;
});
console.log(n ? 'Done: ' + n + ' file(s) written (backups: *.bak-lt1)' : 'Nothing to change (already patched)');
JS
if [ "${SKIP_DEPLOY:-0}" = "1" ]; then echo "SKIP_DEPLOY=1: web container not rebuilt"; exit 0; fi
if [ -f "$R/docker-compose.prod.yml" ] && command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  cd "$R"; ENVF=""; [ -f backend/.env ] && ENVF="--env-file backend/.env"
  echo "Rebuilding web container ..."
  docker compose -f docker-compose.prod.yml $ENVF up -d --build --no-deps web
  echo "Applied. Hard-refresh the browser (Ctrl+F5)."
else
  echo "docker-compose.prod.yml not found: files patched, rebuild the web container manually if needed."
fi
