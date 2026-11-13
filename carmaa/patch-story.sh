#!/bin/bash
set -e
R="${1:-$PWD}"
for f in index.html js/27-stories.js; do [ -f "$R/$f" ] || { echo "❌ $f پیدا نشد"; exit 1; }; done
node - "$R" <<'JS'
var fs = require('fs'), path = require('path'), R = process.argv[2];
var f = path.join(R, 'js/27-stories.js'), s = fs.readFileSync(f, 'utf8');
if (s.indexOf('BG-UPLOAD') !== -1) { console.log('• 27-stories.js از قبل پچ شده'); }
else {
  var pairs = [
    ['  function openComposer(media) {',
     '  function openComposer(media, draftCaption, draftLinked) {'],
    ['    function openPicker() {\n      const list = myPublishedListings();',
     '    if (draftCaption) o.querySelector("textarea").value = draftCaption; // BG-UPLOAD: restore the draft after a failed upload\n    if (draftLinked) setLinked(draftLinked);\n    function openPicker() {\n      const list = myPublishedListings();'],
    ['      else if (b.dataset.sv === "publish") {\n        b.disabled = true;\n        publish(media, o.querySelector("textarea").value.trim(), linked).then((ok) => { if (ok) closeOverlay(); else if (b.isConnected) b.disabled = false; });\n      }',
     '      else if (b.dataset.sv === "publish") {\n        const caption = o.querySelector("textarea").value.trim();\n        if (window.CARMA_API && window.CARMA_API.enabled) {\n          // BG-UPLOAD: leave the composer right away and upload in the background.\n          if (!window.CARMA_AUTH_USER) { toast("برای انتشار استوری وارد حساب کاربری شوید."); return; }\n          const keepLinked = linked;\n          closeOverlay();\n          toast("در حال آپلود استوری… می‌توانید در سایت بگردید.");\n          publish(media, caption, keepLinked).then((ok) => { if (!ok && !overlay) openComposer(media, caption, keepLinked); });\n          return;\n        }\n        b.disabled = true;\n        publish(media, caption, linked).then((ok) => { if (ok) closeOverlay(); else if (b.isConnected) b.disabled = false; });\n      }']
  ];
  pairs.forEach(function (p, i) {
    if (s.split(p[0]).length !== 2) { console.error('❌ 27-stories.js: بخش ' + (i + 1) + ' دقیقاً یک‌بار پیدا نشد'); process.exit(1); }
    s = s.replace(p[0], function () { return p[1]; });
  });
  fs.copyFileSync(f, f + '.bak-story'); fs.writeFileSync(f, s); console.log('✔ js/27-stories.js');
}
var h = path.join(R, 'index.html'), t = fs.readFileSync(h, 'utf8'), n = t.replace('js/27-stories.js?v=media-6-own-dedupe"', 'js/27-stories.js?v=media-6-own-dedupe-bg1"');
if (n !== t) { fs.copyFileSync(h, h + '.bak-story'); fs.writeFileSync(h, n); console.log('✔ index.html'); } else console.log('• index.html بدون تغییر');
JS
