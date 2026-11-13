#!/bin/bash
set -e
R="${1:-$PWD}"
for f in index.html js/13-pages-home-listings-vehicle.js js/04-state-core.js; do [ -f "$R/$f" ] || { echo "❌ $f پیدا نشد"; exit 1; }; done
node - "$R" <<'JS'
var fs = require('fs'), path = require('path'), R = process.argv[2];
function edit(rel, pairs, marker) {
  var f = path.join(R, rel), s = fs.readFileSync(f, 'utf8');
  if (s.indexOf(marker) !== -1) { console.log('• ' + rel + ' از قبل پچ شده'); return; }
  pairs.forEach(function (p, i) {
    if (s.split(p[0]).length !== 2) { console.error('❌ ' + rel + ': بخش ' + (i + 1) + ' دقیقاً یک‌بار پیدا نشد'); process.exit(1); }
    s = s.replace(p[0], function () { return p[1]; });
  });
  fs.copyFileSync(f, f + '.bak-profile'); fs.writeFileSync(f, s); console.log('✔ ' + rel);
}
edit('js/13-pages-home-listings-vehicle.js', [
  ['      if (!profile) {\n        const uid = String(sellerId || "");',
   '      {\n        const uid = String(sellerId || "");'],
  ['        const miss = window.CARMA_USER_MISS[uid];\n        if (canFetch && !(miss === true || (miss && Date.now() - miss < 15000))) {',
   '        const miss = window.CARMA_USER_MISS[uid];\n        // SU-FIX: a personal page built from listings alone shows placeholder name/handle; wait for the server record first.\n        const wantServer = !profile || (profile.type === "personal" && !(window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[uid]));\n        if (wantServer && canFetch && !(miss === true || (miss && Date.now() - miss < 15000))) {'],
  ['if (r && r.user) { window.CARMA_SERVER_USERS = window.CARMA_SERVER_USERS || {}; window.CARMA_SERVER_USERS[uid] = r.user; }',
   'if (r && r.user) { window.CARMA_SERVER_USERS = window.CARMA_SERVER_USERS || {}; window.CARMA_SERVER_USERS[uid] = r.user; if (r.user.username && window.MR_PROFILE && window.MR_PROFILE.setServerHandle) window.MR_PROFILE.setServerHandle(uid, r.user.username); }'],
  ['        setDynamicHTML(hero, `<div class="seller-empty">صفحه این کاربر پیدا نشد.</div>`);\n        return;\n      }\n      const P = window.MR_PROFILE || {};',
   '        if (!profile) { setDynamicHTML(hero, `<div class="seller-empty">صفحه این کاربر پیدا نشد.</div>`); return; }\n      }\n      const P = window.MR_PROFILE || {};']
], 'SU-FIX');
edit('js/04-state-core.js', [
  ['        return { type: "personal", id, name: "فروشنده شخصی", city: withCity ? withCity.city : "", listings: mine };',
   '        const su0 = window.CARMA_SERVER_USERS && window.CARMA_SERVER_USERS[String(id)]; // SU-FIX\n        return { type: "personal", id, name: (su0 && su0.display_name) || "فروشنده شخصی", city: withCity ? withCity.city : "", listings: mine, logo: (su0 && su0.avatar_url) || "" };']
], 'SU-FIX');
var f = path.join(R, 'index.html'), h = fs.readFileSync(f, 'utf8'), n = h;
n = n.replace('js/13-pages-home-listings-vehicle.js?v=v47-price"', 'js/13-pages-home-listings-vehicle.js?v=v47-price-su1"');
n = n.replace('js/04-state-core.js?v=postlink-1-r2-dl-nd-urls1"', 'js/04-state-core.js?v=postlink-1-r2-dl-nd-urls1-su1"');
if (n !== h) { fs.copyFileSync(f, f + '.bak-profile'); fs.writeFileSync(f, n); console.log('✔ index.html'); } else console.log('• index.html بدون تغییر');
JS
