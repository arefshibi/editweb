#!/usr/bin/env bash
set -euo pipefail
FROM="09160925575"; TO="09965926283"
cd "$(dirname "$0")"
[ -f package.json ] && [ -d src ] || { echo "باید داخل پوشه backend باشی"; exit 1; }
[ -d node_modules ] || npm install --omit=dev

mkdir -p src/scripts
cat > src/scripts/transfer-phone.js <<'JSEOF'
import { pool, transaction } from '../db.js';
import { normalizePhone } from '../util.js';

const get = (k) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) || '';
const from = normalizePhone(get('from'));
const to = normalizePhone(get('to'));
const apply = process.argv.includes('--apply');
if (!from || !to || from === to) {
  console.error('Usage: --from=09160925575 --to=09965926283 [--apply]');
  process.exit(2);
}

async function countOwned(q, id) {
  const tables = [
    ['listings', 'owner_id'], ['showrooms', 'owner_id'], ['images', 'owner_id'],
    ['conversations', 'buyer_id'], ['conversations', 'seller_id'], ['payment_orders', 'user_id'],
    ['listing_favorites', 'user_id'], ['qa_questions', 'author_id'], ['notifications', 'user_id'],
  ];
  const out = {};
  for (const [t, c] of tables) {
    const { rows } = await q(`SELECT count(*)::int n FROM ${t} WHERE ${c}=$1`, [id]);
    out[`${t}.${c}`] = rows[0].n;
  }
  return out;
}

try {
  await transaction(async (client) => {
    const q = (s, p) => client.query(s, p);
    const src = (await q('SELECT id,phone_e164,display_name,role,status FROM users WHERE phone_e164=$1 FOR UPDATE', [from])).rows[0];
    if (!src) throw new Error(`حسابی با شماره ${from} پیدا نشد.`);
    const dst = (await q('SELECT id,phone_e164,status FROM users WHERE phone_e164=$1 FOR UPDATE', [to])).rows[0];

    console.log('حساب مبدأ:', src);
    console.log('داده‌های مبدأ:', await countOwned(q, src.id));

    if (dst) {
      const c = await countOwned(q, dst.id);
      console.log('روی شمارهٔ مقصد از قبل حساب وجود دارد:', dst, c);
      if (Object.values(c).some((n) => n > 0)) {
        throw new Error('حساب مقصد از قبل داده دارد؛ ادغام خودکار انجام نمی‌شود.');
      }
      console.log('حساب مقصد خالی است و حذف می‌شود.');
      await q('DELETE FROM users WHERE id=$1', [dst.id]);
    }

    await q('DELETE FROM auth_otps WHERE phone_e164 IN ($1,$2)', [from, to]);
    await q('UPDATE users SET phone_e164=$2, phone_verified_at=now(), updated_at=now() WHERE id=$1', [src.id, to]);
    await q('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [src.id]);
    await q("INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata) VALUES(NULL,'user.phone_transfer','user',$1,$2)",
      [src.id, { from, to, via: 'cli' }]);

    console.log(`\n${from}  →  ${to}  (user ${src.id})`);
    if (!apply) { console.log('DRY-RUN: هیچ تغییری ذخیره نشد.'); throw Object.assign(new Error('dry-run'), { dry: true }); }
    console.log('انجام شد.');
  });
} catch (e) {
  if (!e.dry) { console.error(e.message); process.exitCode = 1; }
} finally { await pool.end(); }
JSEOF

node -e '
const fs=require("fs"),p=JSON.parse(fs.readFileSync("package.json"));
p.scripts["phone:transfer"]="node src/scripts/transfer-phone.js";
fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'

if [ -f .env ]; then
  cp .env ".env.bak-transfer-$(date +%s)"
  sed -i "s/+989160925575/+98${TO#0}/g" .env
fi
sed -i "s/+989160925575/+98${TO#0}/g" src/config.js .env.example 2>/dev/null || true

RUN=(node); [ -f .env ] && RUN+=(--env-file=.env)
RUN+=(src/scripts/transfer-phone.js "--from=$FROM" "--to=$TO")

echo "=== بررسی اولیه (dry-run) ==="
"${RUN[@]}"
echo
read -r -p "اعمال انتقال؟ (yes/no) " ans
[ "$ans" = "yes" ] || { echo "لغو شد."; exit 0; }
"${RUN[@]}" --apply
echo "تمام شد. بک‌اند را ری‌استارت کن (docker compose restart یا pm2 restart all)."
