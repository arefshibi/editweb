#!/bin/bash
# CarMaa combined patch: (1) seller avatar on car detail page, (2) showroom avatar + separate banner.
# Run inside the project root (where index.html and docker-compose.prod.yml are). Safe to re-run.
set -e
R="${1:-$PWD}"
[ -f "$R/index.html" ] || { [ -f "$R/../index.html" ] && R="$R/.."; }
for f in index.html demo-showrooms.css js/13-pages-home-listings-vehicle.js js/15-pages-account.js js/17-chip-dropdown.js; do
  [ -f "$R/$f" ] || { echo "ERROR: $f not found in $R - cd to the project root first"; exit 1; }
done
command -v node >/dev/null || { echo "ERROR: node is not installed"; exit 1; }
node - "$R" <<'JS'
var fs = require('fs'), path = require('path'), R = process.argv[2];
var plan = {};
function get(rel) { if (!(rel in plan)) plan[rel] = fs.readFileSync(path.join(R, rel), 'utf8'); return plan[rel]; }
function set(rel, s) { plan[rel] = s; }
function fail(m) { console.error('ERROR: ' + m + ' (nothing was changed)'); process.exit(1); }
function once(rel, a, label) { if (get(rel).split(a).length !== 2) fail(rel + ': anchor "' + label + '" not found exactly once (file differs from expected version)'); }
function rep(rel, a, b, label) { once(rel, a, label); set(rel, get(rel).replace(a, function () { return b; })); }
function bump(rel, re, tag) {
  var t = new RegExp('(^|-)' + tag + '(-|$)');
  set(rel, get(rel).replace(re, function (_, a, b) { return t.test(b) ? a + b : a + b + '-' + tag; }));
}
var J13 = 'js/13-pages-home-listings-vehicle.js';

/* ===== PATCH 1: seller avatar on the car detail page ===== */
if (get(J13).indexOf('SA-FIX') === -1) {
  var aFn = '  // cm-seller-ava: small round seller avatar inside the title/price card (replaces the old seller card).\n  function renderSellerAvatarMarkup(listing) {';
  var aLine = '    if (!avatarUrl && s.id) { try { const pr = sellerProfileById(s.id, kind); avatarUrl = (pr && (pr.logo || pr.avatar)) || ""; } catch (_) {} }\n';
  once(J13, aFn, 'renderSellerAvatarMarkup'); once(J13, aLine, 'avatarUrl line');
  var helper =
'  // SA-FIX: listings API has no seller avatar; fetch the public user record in the background and fill the circle.\n' +
'  function saEnsureAvatar(uid) {\n' +
'    try {\n' +
'      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid)) return;\n' +
'      const api = window.CARMA_API;\n' +
'      if (!api || !api.enabled || !api.social || typeof api.social.user !== "function") return;\n' +
'      const apply = (url) => {\n' +
'        if (!url) return;\n' +
'        document.querySelectorAll(\'.cm-seller-ava[data-seller-id="\' + uid + \'"] .cm-sa-circle\').forEach((c) => {\n' +
'          if (c.querySelector("img")) return;\n' +
'          const old = c.innerHTML, img = document.createElement("img");\n' +
'          img.alt = ""; img.decoding = "async";\n' +
'          img.onerror = () => { try { c.innerHTML = old; } catch (_) {} };\n' +
'          img.onload = () => { img.style.opacity = "1"; };\n' +
'          img.style.cssText = "opacity:0;transition:opacity .25s ease";\n' +
'          img.src = url;\n' +
'          c.textContent = ""; c.appendChild(img);\n' +
'        });\n' +
'      };\n' +
'      const cached = window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[uid];\n' +
'      if (cached) { apply(cached.avatar_url); return; }\n' +
'      window.CARMA_USER_MISS = window.CARMA_USER_MISS || {};\n' +
'      const miss = window.CARMA_USER_MISS[uid];\n' +
'      if (miss === true || (miss && Date.now() - miss < 15000)) return;\n' +
'      window.CARMA_SA_INFLIGHT = window.CARMA_SA_INFLIGHT || {};\n' +
'      if (window.CARMA_SA_INFLIGHT[uid]) return;\n' +
'      window.CARMA_SA_INFLIGHT[uid] = api.social.user(uid).then((r) => {\n' +
'        if (r && r.user) {\n' +
'          window.CARMA_SERVER_USERS = window.CARMA_SERVER_USERS || {};\n' +
'          window.CARMA_SERVER_USERS[uid] = r.user;\n' +
'          apply(r.user.avatar_url);\n' +
'        }\n' +
'      }).catch((err) => {\n' +
'        window.CARMA_USER_MISS[uid] = (err && err.status === 404) ? true : Date.now();\n' +
'      }).then(() => { delete window.CARMA_SA_INFLIGHT[uid]; });\n' +
'    } catch (_) {}\n' +
'  }\n\n';
  var addLine =
'    // SA-FIX: personal seller -> use cached public user record, or fetch it now.\n' +
'    const saUid = isDealer ? "" : String(listing.sellerUserId || s.id || "");\n' +
'    if (!avatarUrl && saUid) { const su = window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[saUid]; if (su && su.avatar_url) avatarUrl = su.avatar_url; }\n' +
'    if (!avatarUrl && saUid) setTimeout(() => saEnsureAvatar(saUid), 0);\n';
  rep(J13, aFn, helper + aFn, 'fn'); rep(J13, aLine, aLine + addLine, 'line');
}

/* ===== PATCH 2: showroom avatar + separate banner ===== */
var IDX = 'index.html';
if (get(IDX).indexOf('id="dealerBannerInput"') === -1) {
  var anchor = '                <div class="dealer-media-edit">\n';
  var block =
'                <!-- SB-FIX -->\n' +
'                <div class="dealer-banner-edit">\n' +
'                  <label class="dealer-banner-pick2" aria-label="\u062a\u063a\u06cc\u06cc\u0631 \u0639\u06a9\u0633 \u0628\u0646\u0631 \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647"><input type="file" id="dealerBannerInput" accept="image/*" class="hidden"/><div data-slot="banner" class="dealer-banner-preview2"></div><span class="dealer-banner-badge">\u0639\u06a9\u0633 \u0628\u0646\u0631</span></label>\n' +
'                </div>\n';
  rep(IDX, anchor, block + anchor, 'dealer-media-edit');
  var re = /(<div class="text-\[12px\] text-neutral-500 text-center">)\u0639\u06a9\u0633 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647:[^<]*(<\/div>)/;
  if (!re.test(get(IDX))) fail('index.html: profile-photo hint text not found');
  set(IDX, get(IDX).replace(re, function (_, a, b) {
    return a + '\u0639\u06a9\u0633 \u0628\u0646\u0631 (\u0645\u0633\u062a\u0637\u06cc\u0644\u06cc\u060c \u0628\u0627\u0644\u0627): \u0647\u0645\u0627\u0646 \u0639\u06a9\u0633 \u0628\u0632\u0631\u06af \u06a9\u0627\u0631\u062a \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647 \u062f\u0631 \u0635\u0641\u062d\u0647\u0654 \u0627\u0635\u0644\u06cc \u0648 \u0628\u0646\u0631 \u0628\u0627\u0644\u0627\u06cc \u0635\u0641\u062d\u0647\u0654 \u0639\u0645\u0648\u0645\u06cc \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647 \u0627\u0633\u062a. \u0639\u06a9\u0633 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 (\u062f\u0627\u06cc\u0631\u0647\u200c\u0627\u06cc\u060c \u067e\u0627\u06cc\u06cc\u0646): \u0622\u0648\u0627\u062a\u0627\u0631 \u06a9\u0648\u0686\u06a9 \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647 \u062f\u0631 \u06a9\u0627\u0631\u062a\u200c\u0647\u0627\u060c \u0622\u06af\u0647\u06cc\u200c\u0647\u0627 \u0648 \u0686\u062a \u0627\u0633\u062a. \u0647\u0631 \u062f\u0648 \u0631\u0627 \u0628\u0627 \u0639\u06a9\u0633 \u0628\u0627\u06a9\u06cc\u0641\u06cc\u062a \u0648 \u0648\u0633\u0637\u200c\u0686\u06cc\u0646 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.' + b;
  }));
}
var CSS = 'demo-showrooms.css';
if (get(CSS).indexOf('SB-FIX') === -1) {
  rep(CSS, '.dealer-banner-preview2 { width:100%; aspect-ratio:16/9;', '/* SB-FIX */\n.dealer-banner-preview2 { width:100%; aspect-ratio:4/3;', 'preview2');
}
var J15 = 'js/15-pages-account.js';
if (get(J15).indexOf('SB-FIX') === -1) {
  var oldB = '        const bannerUrl=state.dealershipBannerDraft||(d&&d.banner)||(state.account?sellerBannerFor(sellerIdForPhone(state.account)):"");\n        if(bannerUrl) bannerSlot.innerHTML=`<img src="${bannerUrl}" alt="" class="w-full h-full object-cover"/>`;\n';
  rep(J15, oldB,
'        // SB-FIX: show only the real showroom banner (or the draft), never the auto-generated one.\n' +
'        const bannerUrl=state.dealershipBannerDraft||(d&&d.banner)||(state.account&&typeof mrGetAvatar==="function"?mrGetAvatar("db",sellerIdForPhone(state.account)):"")||"";\n' +
'        if(bannerUrl) bannerSlot.innerHTML=`<img src="${bannerUrl}" alt="" class="w-full h-full object-cover"/>`;\n' +
'        else bannerSlot.innerHTML=\'<span style="color:#8b8f94;font-size:13px;font-weight:600">\u0627\u0641\u0632\u0648\u062f\u0646 \u0639\u06a9\u0633 \u0628\u0646\u0631</span>\';\n', 'bannerUrl');
  var oldAlt = 'alt="\u0628\u0646\u0631 \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647" class="w-full h-full object-cover"';
  if (get(J15).split(oldAlt).length === 2) rep(J15, oldAlt, 'alt="\u0639\u06a9\u0633 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0646\u0645\u0627\u06cc\u0634\u06af\u0627\u0647" class="w-full h-full object-cover"', 'alt');
}
var J17 = 'js/17-chip-dropdown.js';
if (get(J17).indexOf('SB-FIX') === -1) {
  var c1 = 'let sw = w, sh = Math.round(w * 9 / 16);\n          if (sh > h) { sh = h; sw = Math.round(h * 16 / 9); }';
  var c2 = 'const ow = Math.min(960, sw), oh = Math.round(ow * 9 / 16);';
  once(J17, c1, 'crop1'); once(J17, c2, 'crop2');
  rep(J17, c1, '/* SB-FIX: 4:3 banner crop */ let sw = w, sh = Math.round(w * 3 / 4);\n          if (sh > h) { sh = h; sw = Math.round(h * 4 / 3); }', 'crop1');
  rep(J17, c2, 'const ow = Math.min(1280, sw), oh = Math.round(ow * 3 / 4);', 'crop2');
}
if (get(J13).indexOf('SB-FIX') === -1) {
  var sbA = '      const showroomBanner = isDealerPage\n        ? (profile.logo || matchingShowroom.logo';
  rep(J13, sbA,
'      // SB-FIX: the real banner saved by the showroom wins; without one the old behaviour (avatar) is kept.\n' +
'      const sbSrv = isDealerPage ? (window.CARMA_SERVER_SHOWROOMS || []).find((x) => String(x.id) === String(profile.id)) : null;\n' +
'      const sbReal = isDealerPage ? ((sbSrv && sbSrv.banner_url) || (state.dealership && String(state.dealership.id) === String(profile.id) && state.dealership.banner_image_id && state.dealership.banner) || (typeof mrGetAvatar === "function" ? mrGetAvatar("db", profile.id) : "") || "") : "";\n' +
'      const showroomBanner = isDealerPage\n        ? (sbReal || profile.logo || matchingShowroom.logo', 'showroomBanner');
}

/* ===== cache-bust in index.html ===== */
bump(IDX, /(js\/13-pages-home-listings-vehicle\.js\?v=)([^"']*)/, 'sa1');
bump(IDX, /(js\/13-pages-home-listings-vehicle\.js\?v=)([^"']*)/, 'sb1');
bump(IDX, /(js\/15-pages-account\.js\?v=)([^"']*)/, 'sb1');
bump(IDX, /(js\/17-chip-dropdown\.js\?v=)([^"']*)/, 'sb1');
bump(IDX, /(demo-showrooms\.css\?v=)([^"']*)/, 'sb1');

/* ===== write (only changed files, with backup) ===== */
var n = 0;
Object.keys(plan).forEach(function (rel) {
  var f = path.join(R, rel);
  if (fs.readFileSync(f, 'utf8') === plan[rel]) { console.log('- unchanged: ' + rel); return; }
  fs.copyFileSync(f, f + '.bak-carma1'); fs.writeFileSync(f, plan[rel]); console.log('OK patched: ' + rel); n++;
});
console.log(n ? 'Done: ' + n + ' file(s) patched (backups: *.bak-carma1)' : 'Nothing to change (already patched)');
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
