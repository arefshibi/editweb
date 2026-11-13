#!/bin/bash
set -e
B="${1:-$PWD}"
F="$B/src/routes/messages.js"
[ -f "$F" ] || { echo "❌ داخل پوشه backend نیستی"; exit 1; }
node - "$F" <<'JS'
var fs = require('fs'), f = process.argv[2];
var s = fs.readFileSync(f, 'utf8');
if (s.indexOf('AS other_avatar') !== -1) { console.log('• از قبل پچ شده'); process.exit(0); }
var anchor = " (SELECT CASE m.kind WHEN 'image'";
var i = s.indexOf(anchor);
if (i < 0) { console.error('❌ جای درج پیدا نشد'); process.exit(1); }
var add = " CASE WHEN c.buyer_id=$1 THEN seller.avatar_url ELSE buyer.avatar_url END AS other_avatar,\n";
fs.copyFileSync(f, f + '.bak-avatar');
fs.writeFileSync(f, s.slice(0, i) + add + s.slice(i));
console.log('✔ messages.js پچ شد');
JS
grep -n 'other_avatar' "$F"
