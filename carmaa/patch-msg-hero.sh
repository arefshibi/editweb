#!/bin/bash
# CarMaa — هدر قرمز دارک با پایین منحنی برای صفحه‌ی پیام‌ها
set -e
R="${1:-$PWD}"
for f in index.html js/26-messaging.js; do [ -f "$R/$f" ] || { echo "❌ $f پیدا نشد (مسیر: $R)"; exit 1; }; done
command -v node >/dev/null || { echo "❌ node نصب نیست"; exit 1; }

cat > "$R/msg-hero.css" <<'CSS'
.mr-msg-screen .mr-msg-hero{
  position:relative;
  margin:calc(-16px - env(safe-area-inset-top,0px)) -16px 0;
  padding:calc(16px + env(safe-area-inset-top,0px)) 16px 26px;
  border-radius:0 0 44px 44px;
  background:
    radial-gradient(120% 90% at 85% 0%, rgba(232,68,78,.28) 0%, rgba(232,68,78,0) 60%),
    linear-gradient(180deg,#5c0a12 0%,#3d070c 55%,#2a0508 100%);
}
.mr-msg-screen .mr-msg-hero .mr-msg-search,
.mr-msg-screen .mr-msg-hero .mr-msg-back{background:#000;box-shadow:none}
.mr-msg-screen .mr-msg-hero .mr-msg-search input::placeholder{color:rgba(255,255,255,.55)}
.mr-msg-screen .mr-msg-hero .mr-stories-title{margin-top:20px}
.mr-msg-screen .mr-msg-hero .mr-msg-story,
.mr-msg-screen .mr-msg-hero .mr-story-in{--msg-bg:#3d070c}
.mr-msg-screen .mr-msg-hero .mr-msg-stories > *{background-color:rgba(0,0,0,.28)}
.mr-msg-screen .mr-msg-title{margin-top:26px}
.theme-light .mr-msg-screen .mr-msg-hero{--msg-text:#fff}
CSS
echo "✔ msg-hero.css"

node - "$R" <<'JS'
var fs = require('fs'), path = require('path'), R = process.argv[2];
var f = path.join(R, 'js/26-messaging.js'), s = fs.readFileSync(f, 'utf8');
if (s.indexOf('mr-msg-hero') !== -1) { console.log('• 26-messaging.js از قبل پچ شده'); }
else {
  var pairs = [
    ['root.innerHTML = `\n      <div class="mr-msg-topbar">', 'root.innerHTML = `\n      <div class="mr-msg-hero"><div class="mr-msg-topbar">'],
    ['      ${renderStoryRail()}\n      <h1 class="mr-msg-title">', '      ${renderStoryRail()}</div>\n      <h1 class="mr-msg-title">'],
    ['root.innerHTML = `<div class="mr-msg-topbar">', 'root.innerHTML = `<div class="mr-msg-hero"><div class="mr-msg-topbar">'],
    ['${skeletonStories()}<h1 class="mr-msg-title">', '${skeletonStories()}</div><h1 class="mr-msg-title">']
  ];
  pairs.forEach(function (p, i) {
    if (s.split(p[0]).length !== 2) { console.error('❌ 26-messaging.js: بخش ' + (i + 1) + ' دقیقاً یک‌بار پیدا نشد'); process.exit(1); }
  });
  pairs.forEach(function (p) { s = s.replace(p[0], function () { return p[1]; }); });
  fs.copyFileSync(f, f + '.bak-hero'); fs.writeFileSync(f, s); console.log('✔ js/26-messaging.js');
}
['index.html', 'index_offline.html'].forEach(function (name) {
  var h = path.join(R, name);
  if (!fs.existsSync(h)) return;
  var t = fs.readFileSync(h, 'utf8'), n = t;
  if (n.indexOf('msg-hero.css') === -1) n = n.replace('</head>', function () { return '    <link rel="stylesheet" href="msg-hero.css?v=1" />\n  </head>'; });
  n = n.replace(/(js\/26-messaging\.js\?v=)([^"']*?)(-hero1)?(["'])/, function (m, a, b, c, d) { return a + b + '-hero1' + d; });
  if (n !== t) { fs.copyFileSync(h, h + '.bak-hero'); fs.writeFileSync(h, n); console.log('✔ ' + name); } else console.log('• ' + name + ' بدون تغییر');
});
JS
echo "تمام شد. اگر کش مرورگر قدیمی را نشان داد، یک‌بار رفرش سخت بزن."
