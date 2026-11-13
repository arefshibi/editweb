#!/bin/bash
# CarMaa patch v3: پاپ‌آپ تا ۸۷٪ + حذف بلور پشت پاپ‌آپ (سبک‌تر). روی نسخهٔ v2 اعمال می‌شود.
set -e
R="${1:-$PWD}"
F="$R/js/61-edit-sheet.js"
[ -f "$F" ] || { echo "❌ $F پیدا نشد — اول پچ قبلی را اجرا کنید (داخل پوشهٔ پروژه اجرا کنید)"; exit 1; }
[ -f "$F.bak-v2" ] || cp "$F" "$F.bak-v2"
node - "$F" <<'NJS'
var fs = require('fs'), f = process.argv[2], s = fs.readFileSync(f, 'utf8'), n = 0;
function rep(a, b, name) {
  if (s.indexOf(a) === -1) { if (s.indexOf(b) !== -1) return; console.error('❌ بخش پیدا نشد: ' + name); process.exit(1); }
  s = s.split(a).join(b); n++;
}
rep('var RATIO = 0.75;', 'var RATIO = 0.87;', 'ratio');
rep('height:75vh;height:var(--es-h,75dvh);', 'height:87vh;height:var(--es-h,87dvh);', 'css height');
rep('-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);', '', 'blur');
rep('--es-scrim:rgba(0,0,0,.56)', '--es-scrim:rgba(0,0,0,.6)', 'scrim');
rep('box-shadow:0 -18px 60px rgba(0,0,0,.5);', 'box-shadow:0 -6px 24px rgba(0,0,0,.35);', 'shadow');
rep('will-change:transform}', 'will-change:transform;contain:layout paint}', 'contain');
fs.writeFileSync(f, s); console.log(n ? '✔ js/61-edit-sheet.js به‌روز شد' : '• از قبل v3 است');
NJS
node -e '
var fs=require("fs"),p=process.argv[1]+"/index.html",s=fs.readFileSync(p,"utf8"),t=s.replace(/61-edit-sheet\.js\?v=es\d+/,"61-edit-sheet.js?v=es3");
if(t!==s){if(!fs.existsSync(p+".bak-editsheet"))fs.copyFileSync(p,p+".bak-editsheet");fs.writeFileSync(p,t);console.log("✔ index.html (cache bust)")}else console.log("• index.html بدون تغییر")' "$R"
if [ "${NO_REBUILD:-0}" != 1 ] && [ -f "$R/docker-compose.prod.yml" ] && command -v docker >/dev/null 2>&1; then
  ( cd "$R" && docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build web ) && echo "✔ سایت به‌روز شد"
else echo ">> rebuild انجام نشد؛ اگر سایت از همین پوشه سرو می‌شود Refresh کنید."; fi
