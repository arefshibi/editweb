#!/usr/bin/env bash
# CarMaa — سیستم بکاپ استاندارد برای سایت مارکت‌پلیس/آگهی
# ─────────────────────────────────────────────────────────────────────────────
# چی بکاپ می‌گیره:
#   ۱) دیتابیس Postgres (pg_dump -Fc + نقش‌ها/globals)       ← کاربران، آگهی‌ها، پیام‌ها، پرداخت‌ها
#   ۲) فایل‌های آپلودی (volume carmaa_media: عکس/ویدیو/صدا)   ← incremental و dedupe
#   ۳) تنظیمات (backend/.env، Caddyfile، compose، docs/security) + گواهی‌های Caddy
# چطور: restic (داخل Docker، نیاز به نصب ندارد) → رمزنگاری AES-256 + dedupe + snapshot
# زمان‌بندی:  DB هر ساعت (RPO ≤ ۱ ساعت) | کامل روزانه ۰۳:۱۷ | check هفتگی | تست restore هفتگی
# نگهداری:    ساعتی ۴۸ | روزانه ۱۴ | هفتگی ۸ | ماهانه ۱۲ | سالانه ۲
# ۳-۲-۱:      کپی محلی + کپی آف‌سایت (S3-سازگار: آروان/لیارا/Backblaze/…) با remote-init
#
# اجرا (داخل پوشهٔ سایت، کنار docker-compose.prod.yml):
#   bash carmaa-backup.sh install            نصب + اولین بکاپ + تست restore + cron
#   bash carmaa-backup.sh run | db           بکاپ کامل / فقط دیتابیس
#   bash carmaa-backup.sh status | list      وضعیت / فهرست snapshotها
#   bash carmaa-backup.sh check              بررسی سلامت repo (restic check)
#   bash carmaa-backup.sh restore-test       بازیابی آزمایشی در کانتینر موقت (به production دست نمی‌زند)
#   bash carmaa-backup.sh restore-db [ID] [--apply]    بازیابی دیتابیس (بدون --apply فقط آماده می‌کند)
#   bash carmaa-backup.sh restore-media [ID]           بازیابی فایل‌های آپلودی (additive، چیزی را بازنویسی نمی‌کند)
#   bash carmaa-backup.sh remote-init        فعال‌سازی کپی آف‌سایت (بعد از پر کردن REMOTE_REPO در backup.env)
#   bash carmaa-backup.sh uninstall-cron     حذف cron (بکاپ‌ها می‌مانند)
set -Eeuo pipefail
umask 077
export LC_ALL=C.UTF-8 2>/dev/null || true
CMD="${1:-install}"; shift || true
SELF="$(readlink -f "$0")"
if [ "${CARMAA_SITE_DIR:-}" ]; then SITE="$CARMAA_SITE_DIR"; else SITE="$(pwd)"; fi
[ -f "$SITE/docker-compose.prod.yml" ] || { echo "❌ داخل پوشهٔ سایت (کنار docker-compose.prod.yml) اجرا کن"; exit 1; }
SITE="$(cd "$SITE" && pwd)"; cd "$SITE"
PRIV="$(dirname "$SITE")/carmaa-private"; CONF="$PRIV/backup.env"; REPO="$PRIV/restic-repo"; STAGE="$PRIV/backup-stage"
LOG="$PRIV/backup.log"; STATUS="$PRIV/backup-status.txt"; BIN="$PRIV/carmaa-backup.sh"; RTMP="$PRIV/restore-tmp"
RESTIC_IMG="restic/restic:0.17.3"
C="docker compose -f docker-compose.prod.yml --env-file backend/.env"
command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || { echo "❌ docker compose لازم است"; exit 1; }
mkdir -p "$PRIV"; chmod 700 "$PRIV"; touch "$LOG"; chmod 600 "$LOG"
[ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -lt 5242880 ] || { tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; chmod 600 "$LOG"; }

cv(){ grep -m1 "^$1=" "$CONF" 2>/dev/null | cut -d= -f2- || true; }
setst(){ touch "$STATUS"; if grep -q "^$1=" "$STATUS"; then sed -i "s|^$1=.*|$1=$2|" "$STATUS"; else echo "$1=$2" >> "$STATUS"; fi; }
getst(){ grep -m1 "^$1=" "$STATUS" 2>/dev/null | cut -d= -f2- || true; }
say(){ echo "$(date '+%F %T') $*" | tee -a "$LOG"; }
kcurl(){ # curl با URL از stdin (توکن/URL در لیست پردازش‌ها دیده نمی‌شود)
  printf 'url = "%s"\n' "$1" | curl -fsS -m 10 --retry 2 -K - "${@:2}" >/dev/null 2>&1 || true; }
notify(){ # $1=متن؛ با throttle ۶ ساعته برای هر متن
  local k now last u t c; k="ALERT_$(printf '%s' "$1" | cksum | cut -d' ' -f1)"; now="$(date +%s)"; last="$(getst "$k")"
  [ -z "$last" ] || [ $((now - last)) -ge 21600 ] || return 0; setst "$k" "$now"
  u="$(cv HC_URL)"; t="$(cv TG_BOT_TOKEN)"; c="$(cv TG_CHAT_ID)"
  [ -z "$u" ] || kcurl "$u/fail"
  [ -z "$t" ] || [ -z "$c" ] || kcurl "https://api.telegram.org/bot$t/sendMessage" --data-urlencode "chat_id=$c" --data-urlencode "text=🚨 CarMaa backup: $1 ($(hostname))"; }
ping_ok(){ local u; u="$(cv HC_URL)"; [ -z "$u" ] || kcurl "$u"; }
on_err(){ say "❌ $CMD ناموفق (خط $1)"; notify "$CMD failed (line $1)"; }

media_vol(){ local n; n="$(docker inspect "$($C ps -q api 2>/dev/null | head -1)" --format '{{range .Mounts}}{{if eq .Destination "/app/var/media"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
  [ -n "$n" ] || n="$(docker volume ls -q | grep -E '(^|_)carmaa_media$' | head -1 || true)"; echo "$n"; }
caddy_vol(){ docker volume ls -q | grep -E '(^|_)caddy_data$' | head -1 || true; }
db_image(){ $C config 2>/dev/null | awk '/image: postgres/{print $2; exit}' || true; }

MOUNTS=(); PASSF="$PRIV/.restic-pass"; CACHE="$PRIV/restic-cache"; CACHER="$PRIV/restic-cache-remote"
mkenv(){ local f; f="$(mktemp "$PRIV/.env.XXXXXX")"; chmod 600 "$f"; for k in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION B2_ACCOUNT_ID B2_ACCOUNT_KEY; do v="$(cv $k)"; [ -z "$v" ] || echo "$k=$v" >> "$f"; done; echo "$f"; }
build_mounts(){ MOUNTS=(-v "$REPO:/repo" -v "$STAGE:/stage:ro" -v "$RTMP:/restore" -v "$CACHE:/cache" -v "$PASSF:/run/restic.pass:ro"); local m cvv
  m="$(media_vol)"; [ -z "$m" ] || MOUNTS+=(-v "$m:/media:ro")
  cvv="$(caddy_vol)"; [ -z "$cvv" ] || MOUNTS+=(-v "$cvv:/caddy:ro"); }
HARDEN=(--rm --hostname carmaa --security-opt no-new-privileges --cap-drop ALL --cap-add DAC_READ_SEARCH --cap-add DAC_OVERRIDE --cap-add CHOWN --cap-add FOWNER -e RESTIC_PASSWORD_FILE=/run/restic.pass -e RESTIC_FROM_PASSWORD_FILE=/run/restic.pass -e RESTIC_CACHE_DIR=/cache)
rx(){ docker run "${HARDEN[@]}" --network none -e RESTIC_REPOSITORY=/repo "${MOUNTS[@]}" "$RESTIC_IMG" "$@"; }   # عملیات محلی: بدون شبکه و بدون کلید ابری
rx_remote(){ local e rc=0; e="$(mkenv)"; docker run "${HARDEN[@]}" -e RESTIC_CACHE_DIR=/cache --env-file "$e" -e RESTIC_REPOSITORY="$(cv REMOTE_REPO)" -e RESTIC_FROM_REPOSITORY=/repo \
  -v "$REPO:/repo" -v "$PASSF:/run/restic.pass:ro" -v "$CACHER:/cache" "$RESTIC_IMG" "$@" || rc=$?; rm -f "$e"; return $rc; }

perm_check(){ local m o; for f in "$PRIV:700" "$CONF:600" "$PASSF:600"; do [ -e "${f%%:*}" ] || continue
    m="$(stat -c %a "${f%%:*}")"; o="$(stat -c %u "${f%%:*}")"
    if [ "$m" != "${f##*:}" ] || [ "$o" != "$(id -u)" ]; then say "🚨 دسترسی/مالک ${f%%:*} دستکاری شده (mode=$m owner=$o) — اجرا متوقف شد"; notify "permissions tampered: ${f%%:*}"; exit 1; fi; done; }
img_check(){ local id pin; id="$(docker image inspect --format '{{.Id}}' "$RESTIC_IMG" 2>/dev/null || true)"; pin="$(cv RESTIC_IMG_ID)"
  [ -n "$id" ] || { say "❌ ایمیج $RESTIC_IMG موجود نیست (docker pull)"; exit 1; }
  if [ -z "$pin" ]; then echo "RESTIC_IMG_ID=$id" >> "$CONF"; return 0; fi
  [ "$id" = "$pin" ] || { say "🚨 ایمیج restic عوض شده (احتمال دستکاری) — اجرا متوقف شد. اگر خودت آپدیت کردی: bash $0 pin-image"; notify "restic image changed"; exit 1; }; }
need_conf(){ [ -f "$CONF" ] || { echo "❌ اول نصب کن: bash carmaa-backup.sh install"; exit 1; }
  mkdir -p "$STAGE" "$RTMP" "$CACHE" "$CACHER"; chmod 700 "$STAGE" "$RTMP" "$CACHE" "$CACHER"; perm_check; img_check
  ( umask 077; printf '%s' "$(cv RESTIC_PASSWORD)" > "$PASSF" ); chmod 600 "$PASSF"
  [ -s "$PASSF" ] || { echo "❌ RESTIC_PASSWORD در backup.env خالی است"; exit 1; }; build_mounts; }
cleanup(){ rm -rf "$STAGE/db" "$STAGE/config" "${RTMP:?}"/* 2>/dev/null || true; find "$PRIV" -maxdepth 1 -name "restored-*" -mtime +1 -exec rm -rf {} + 2>/dev/null || true; rm -f "$PRIV"/.env.?????? 2>/dev/null || true; }
trap cleanup EXIT
valid_id(){ [[ "$1" =~ ^([0-9a-f]{6,64}|latest)$ ]] || { echo "❌ شناسهٔ snapshot نامعتبر: $1"; exit 2; }; }
LOCKED=0
lock(){ [ "$LOCKED" = 1 ] && return 0; exec 9>"$PRIV/backup.lock"; flock -n 9 || { say "ℹ بکاپ دیگری در حال اجراست؛ رد شد"; exit 0; }; LOCKED=1; }
disk_ok(){ local free min; free="$(df -Pm "$PRIV" | awk 'NR==2{print $4}')"; min="$(cv MIN_FREE_MB)"; min="${min:-2048}"
  if [ "${free:-0}" -lt "$min" ]; then say "🚨 فضای آزاد دیسک ${free}MB < ${min}MB"; notify "disk free ${free}MB"; return 1; fi; return 0; }

dump_db(){ say "▸ dump دیتابیس"
  rm -rf "$STAGE/db"; mkdir -p "$STAGE/db"
  $C exec -T db pg_dump -U carmaa -d carmaa -Fc > "$STAGE/db/carmaa.dump"
  $C exec -T db pg_dumpall -U carmaa --globals-only > "$STAGE/db/globals.sql"
  [ "$(wc -c < "$STAGE/db/carmaa.dump")" -gt 20000 ] || { say "❌ dump خیلی کوچک است"; return 1; }
  [ "$($C exec -T db pg_restore -l < "$STAGE/db/carmaa.dump" | wc -l)" -gt 20 ] || { say "❌ dump قابل خواندن نیست"; return 1; }
  chmod -R go-rwx "$STAGE"; say "  ✔ dump سالم ($(du -h "$STAGE/db/carmaa.dump" | cut -f1))"; }
stage_config(){ rm -rf "$STAGE/config"; mkdir -p "$STAGE/config"
  for f in backend/.env deploy/Caddyfile docker-compose.prod.yml Dockerfile.web backend/Dockerfile deploy.sh; do [ -f "$f" ] && { mkdir -p "$STAGE/config/$(dirname "$f")"; cp -p "$f" "$STAGE/config/$f"; }; done
  [ -d docs/security ] && cp -a docs/security "$STAGE/config/" || true
  [ -f "$PRIV/backup.env" ] || true; chmod -R go-rwx "$STAGE"; }
remote_copy(){ [ -n "$(cv REMOTE_REPO)" ] || return 0; say "▸ کپی آف‌سایت ($1)"
  if rx_remote copy --tag "$1" >>"$LOG" 2>&1; then say "  ✔ آف‌سایت"; setst LAST_REMOTE "$(date +%s)"; else say "⚠ کپی آف‌سایت ناموفق (لاگ)"; notify "offsite copy failed"; fi; }
remote_forget(){ [ -n "$(cv REMOTE_REPO)" ] || return 0; [ "$(cv REMOTE_APPEND_ONLY)" != 1 ] || return 0   # append-only: پاکسازی از ماشین مورد اعتماد دیگر
  rx_remote forget --tag full --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --keep-yearly 2 --group-by tags --prune >>"$LOG" 2>&1 || true
  rx_remote forget --tag hourly --keep-hourly 48 --keep-daily 3 --group-by tags --prune >>"$LOG" 2>&1 || true; }

do_db(){ lock; need_conf; disk_ok; dump_db
  rx backup /stage/db --tag hourly --exclude-caches >>"$LOG" 2>&1
  rx forget --tag hourly --keep-hourly 48 --keep-daily 3 --group-by tags --prune >>"$LOG" 2>&1 || true
  setst LAST_DB "$(date +%s)"; remote_copy hourly; cleanup; say "✔ بکاپ ساعتی دیتابیس تمام شد"; ping_ok; }
do_full(){ lock; need_conf; disk_ok; dump_db; stage_config
  local paths=(/stage); [ -n "$(media_vol)" ] && paths+=(/media) || say "⚠ volume فایل‌های آپلودی پیدا نشد؛ فقط DB و تنظیمات"
  [ -n "$(caddy_vol)" ] && paths+=(/caddy)
  say "▸ restic backup: ${paths[*]}"
  rx backup "${paths[@]}" --tag full --exclude-caches >>"$LOG" 2>&1
  rx forget --tag full --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --keep-yearly 2 --group-by tags --prune >>"$LOG" 2>&1 || true
  setst LAST_FULL "$(date +%s)"; remote_copy full; remote_copy hourly; remote_forget; cleanup
  say "✔ بکاپ کامل تمام شد ($(rx stats --mode raw-data 2>/dev/null | awk '/Total Size/{print $3,$4}'))"; ping_ok; }

do_check(){ lock; need_conf; say "▸ restic check (۱۰٪ دادهها)"
  rx check --read-data-subset=10% >>"$LOG" 2>&1 && { setst LAST_CHECK "$(date +%s)"; say "✔ repo سالم است"; ping_ok; } || { say "🚨 restic check خطا داد"; notify "restic check FAILED"; return 1; }; }

latest_id(){ rx snapshots --tag "${1:-full}" --json 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[-1]['short_id'] if d else '')"; }
do_restore_test(){ lock; need_conf; say "▸ تست restore (کانتینر موقت)"
  local id img T N rc=0 live_users live_listings rest_users rest_listings tables
  id="$(latest_id full)"; [ -n "$id" ] || { say "❌ snapshot کامل وجود ندارد"; return 1; }
  rm -rf "${RTMP:?}/"*; rx restore "$id" --target /restore --include /stage/db >>"$LOG" 2>&1
  D="$(find "$RTMP" -name carmaa.dump | head -1)"; [ -n "$D" ] || { say "❌ dump در snapshot نبود"; return 1; }
  img="$(db_image)"; img="${img:-postgres:17-alpine}"; N=carmaa-restore-test; docker rm -fv $N >/dev/null 2>&1 || true
  docker run -d --name $N --network none --memory 2g -e POSTGRES_PASSWORD="$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9)" -e POSTGRES_USER=carmaa -e POSTGRES_DB=carmaa "$img" >/dev/null
  trap 'docker rm -fv carmaa-restore-test >/dev/null 2>&1 || true' RETURN
  for i in $(seq 1 60); do docker exec $N pg_isready -U carmaa -d carmaa >/dev/null 2>&1 && break; sleep 1; done; sleep 2
  docker exec -i $N psql -q -U carmaa -d postgres -v ON_ERROR_STOP=0 < "$(dirname "$D")/globals.sql" >/dev/null 2>&1 || true
  docker exec -i $N pg_restore -U carmaa -d carmaa --no-owner < "$D" >>"$LOG" 2>&1 || say "  ⚠ pg_restore هشدار داد (معیار نهایی: تعداد جدول/ردیف)"
  q(){ docker exec $N psql -U carmaa -d carmaa -Atc "$1" 2>/dev/null || echo -1; }
  lq(){ $C exec -T db psql -U carmaa -d carmaa -Atc "$1" 2>/dev/null || echo -1; }
  tables="$(q "select count(*) from information_schema.tables where table_schema='public'")"
  rest_users="$(q "select count(*) from users")"; rest_listings="$(q "select count(*) from listings")"
  live_users="$(lq "select count(*) from users")"; live_listings="$(lq "select count(*) from listings")"
  say "  جدول‌ها=$tables | کاربران بازیابی/زنده=$rest_users/$live_users | آگهی‌ها=$rest_listings/$live_listings"
  [ "$tables" -ge 20 ] && [ "$rest_users" -ge 0 ] || { say "🚨 دیتابیس بازیابی‌شده ناقص است"; rc=1; }
  [ "$live_users" -le 0 ] || [ "$rest_users" -ge $(( live_users * 8 / 10 )) ] || { say "🚨 کاربران بازیابی‌شده خیلی کمتر از زنده است"; rc=1; }
  if [ -n "$(media_vol)" ]; then
    rx ls "$id" /media 2>/dev/null | grep -E '^/media/.+\.[a-z0-9]+$' | shuf -n 5 > "$RTMP/sample.txt" || true
    while read -r p; do [ -z "$p" ] && continue; case "$p" in *..*|-*) continue;; esac; rx restore "$id" --target /restore --include "$p" >>"$LOG" 2>&1 || true
      f="$RTMP$p"; [ -s "$f" ] || { say "🚨 فایل نمونه بازیابی نشد: $p"; rc=1; }; done < "$RTMP/sample.txt"
    say "  ✔ ۵ فایل تصادفی از media بازیابی شد"
  fi
  rm -rf "${RTMP:?}/"*
  if [ $rc = 0 ]; then setst LAST_RESTORE_TEST "$(date +%s)"; setst RESTORE_TEST_RESULT "OK tables=$tables users=$rest_users"; say "✔ تست restore موفق"; ping_ok; else setst RESTORE_TEST_RESULT FAIL; notify "restore-test FAILED"; return 1; fi; }

do_restore_db(){ need_conf; local id="" apply=0; for a in "$@"; do case "$a" in --apply) apply=1;; *) id="$a";; esac; done
  [ -n "$id" ] || id="$(latest_id full)"; [ -n "$id" ] || { echo "❌ snapshot پیدا نشد (bash $0 list)"; exit 1; }; valid_id "$id"; lock
  rm -rf "${RTMP:?}/"*; rx restore "$id" --target /restore --include /stage/db >/dev/null
  D="$(find "$RTMP" -name carmaa.dump | head -1)"; [ -n "$D" ] || { echo "❌ dump در snapshot $id نیست (snapshot ساعتی را با ID بده)"; exit 1; }
  OUTD="$PRIV/restored-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$OUTD"; cp "$D" "$OUTD/carmaa.dump"; cp "$(dirname "$D")/globals.sql" "$OUTD/"; chmod -R go-rwx "$OUTD"
  echo "✔ snapshot $id آماده شد در $OUTD"
  if [ $apply = 0 ]; then echo "⚠ این پوشه dump خام (بدون رمزنگاری) دارد؛ بعد از استفاده حذفش کن (خودکار بعد از ۱ روز پاک می‌شود)."; echo "برای جایگزینی دیتابیس زنده: bash $0 restore-db $id --apply"; return 0; fi
  echo "⚠ این کار دیتابیس زنده را با snapshot $id جایگزین می‌کند و سایت چند دقیقه قطع می‌شود."
  read -r -p "برای ادامه عبارت RESTORE را تایپ کن: " ans; [ "$ans" = RESTORE ] || { echo "لغو شد"; exit 1; }
  do_db; SAFE="$(latest_id hourly)"; echo "✔ بکاپ ایمنی از وضعیت فعلی گرفته شد (snapshot $SAFE)"
  trap "echo \"🚨 بازیابی وسط کار شکست خورد. برگشت به وضعیت قبل: bash $(printf '%q' "$SELF") restore-db $SAFE --apply\"; on_err \$LINENO" ERR
  $C stop web api >/dev/null
  $C exec -T db psql -U carmaa -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS carmaa WITH (FORCE)" -c "CREATE DATABASE carmaa OWNER carmaa"
  $C exec -T db psql -q -U carmaa -d postgres < "$OUTD/globals.sql" >/dev/null 2>&1 || true
  $C exec -T db pg_restore -U carmaa -d carmaa --no-owner < "$OUTD/carmaa.dump"
  $C up -d >/dev/null; rm -rf "$OUTD"; echo "✔ دیتابیس برگشت و سرویس‌ها بالا آمدند. پس از چند ثانیه سایت را چک کن."; }
do_restore_media(){ need_conf; lock; local id="${1:-$(latest_id full)}" v; valid_id "$id"; v="$(media_vol)"; [ -n "$v" ] || { echo "❌ volume پیدا نشد"; exit 1; }
  rm -rf "${RTMP:?}/"*; say "▸ بازیابی media از snapshot $id (additive)"
  rx restore "$id" --target /restore --include /media >>"$LOG" 2>&1
  docker run --rm -v "$v:/vol" -v "$RTMP:/restore:ro" alpine sh -c 'cp -an /restore/media/. /vol/ && echo done'
  rm -rf "${RTMP:?}/"*; echo "✔ فایل‌های گم‌شده برگشتند (فایل‌های موجود دست نخوردند)"; }

do_status(){ need_conf; local now f; now="$(date +%s)"
  age(){ local t; t="$(getst "$1")"; [ -n "$t" ] && echo "$(( (now - t) / 3600 )) ساعت پیش" || echo "هرگز"; }
  echo "━━ وضعیت بکاپ CarMaa ━━"
  echo "بکاپ ساعتی DB:     $(age LAST_DB)"; echo "بکاپ کامل:         $(age LAST_FULL)"; echo "کپی آف‌سایت:       $( [ -n "$(cv REMOTE_REPO)" ] && age LAST_REMOTE || echo 'تنظیم نشده ⚠ (فقط ۱ کپی روی همین سرور)')"
  echo "ضد حذف/باج‌افزار:  $( [ "$(cv REMOTE_APPEND_ONLY)" = 1 ] && echo 'فعال (append-only)' || echo 'اعلام نشده ⚠ (کلید آف‌سایت نباید اجازهٔ Delete داشته باشد)')"
  echo "restic check:      $(age LAST_CHECK)"; echo "تست restore:       $(age LAST_RESTORE_TEST) — $(getst RESTORE_TEST_RESULT)"
  echo "اندازهٔ repo:      $(rx stats --mode raw-data 2>/dev/null | awk '/Total Size/{print $3,$4}')"; echo "فضای آزاد دیسک:    $(df -Ph "$PRIV" | awk 'NR==2{print $4}')"
  echo "اعلان خطا:         $( [ -n "$(cv HC_URL)" ] && echo 'فعال + dead-man switch (HC_URL)' || { [ -n "$(cv TG_BOT_TOKEN)" ] && echo 'فقط تلگرام ⚠ (اگر سرور هک شود و cron خاموش شود خبری نمی‌آید؛ HC_URL بگذار)' || echo 'تنظیم نشده ⚠'; } )"
  echo; rx snapshots --compact 2>/dev/null | tail -15; }
do_watch(){ need_conf; local now t; now="$(date +%s)"; t="$(getst LAST_DB)"; [ -n "$t" ] && [ $((now - t)) -lt 12600 ] || notify "بکاپ ساعتی DB بیش از ۳ ساعت است اجرا نشده"
  t="$(getst LAST_FULL)"; [ -n "$t" ] && [ $((now - t)) -lt 93600 ] || notify "بکاپ کامل بیش از ۲۶ ساعت است اجرا نشده"
  t="$(getst LAST_RESTORE_TEST)"; [ -n "$t" ] && [ $((now - t)) -lt 777600 ] || notify "تست restore بیش از ۹ روز است اجرا نشده"; }
remote_url_ok(){ case "$(cv REMOTE_REPO)" in s3:https://*|b2:*|rest:https://*|azure:*|gs:*) return 0;; *) return 1;; esac; }
do_remote_init(){ need_conf; [ -n "$(cv REMOTE_REPO)" ] || { echo "❌ در $CONF خط REMOTE_REPO=s3:https://ENDPOINT/BUCKET و کلیدها را اضافه کن (راهنما: bash $0 help)"; exit 1; }; remote_url_ok || { echo "❌ REMOTE_REPO باید رمزنگاری‌شده (https) باشد: s3:https://… | b2:… | rest:https://…"; exit 1; }
  rx_remote init --copy-chunker-params >>"$LOG" 2>&1 || true
  rx_remote copy >>"$LOG" 2>&1 && { setst LAST_REMOTE "$(date +%s)"; echo "✔ کپی آف‌سایت فعال شد و همهٔ snapshotها کپی شدند"
    echo "🛡 ضد-باج‌افزار/هک: برای این کلیدها در پنل ذخیره‌ساز فقط Put/Get/List بده (Delete نه)، Versioning/Object-Lock را روشن کن، سپس REMOTE_APPEND_ONLY=1 را در backup.env بگذار؛ پاکسازی قدیمی‌ها را از یک ماشین مورد اعتماد با کلید ادمین انجام بده."; } || { echo "❌ ناموفق — $LOG را ببین (کلید/endpoint/اینترنت)"; exit 1; }; }
write_policy(){ mkdir -p docs/security; cat > docs/security/backup-policy.md <<POL
# backup-policy.md — سیاست بکاپ و بازیابی ($(date +%F))

| مورد | مقدار |
|---|---|
| ابزار | restic ${RESTIC_IMG##*:} (رمزنگاری AES-256، dedupe، snapshot) داخل Docker |
| RPO (حداکثر از دست رفتن داده) | ۱ ساعت (بکاپ ساعتی دیتابیس) |
| RTO (زمان بازیابی هدف) | کمتر از ۱ ساعت (restore-db) |
| محتوا | Postgres (pg_dump -Fc + globals)، فایل‌های آپلودی (carmaa_media)، .env/Caddyfile/compose، گواهی Caddy |
| برنامه | DB هر ساعت · کامل روزانه ۰۳:۱۷ · restic check هفتگی (۱۰٪ داده) · تست restore هفتگی |
| نگهداری | ساعتی ۴۸ · روزانه ۱۴ · هفتگی ۸ · ماهانه ۱۲ · سالانه ۲ |
| ۳-۲-۱ | کپی محلی + کپی آف‌سایت (REMOTE_REPO) — وضعیت: $( [ -n "$(cv REMOTE_REPO)" ] && echo فعال || echo "فعال نیست ⚠" ) |
| رمز repo | در \`carmaa-private/backup.env\` (RESTIC_PASSWORD) — یک نسخه بیرون از سرور نگه دار |
| اعلان خطا | HC_URL (healthchecks.io) و/یا TG_BOT_TOKEN+TG_CHAT_ID |

## مدل تهدید (هک)
- **مهاجم به سرور رسید:** رمز repo و کلید آف‌سایت روی همان سرور است؛ پس تنها دفاع واقعی = کلید آف‌سایت بدون اجازهٔ Delete + Object-Lock/Versioning + هشدار dead-man (HC_URL) از بیرون سرور.
- **باکت/دیسک بکاپ دزدیده شد:** همه‌چیز با AES-256 رمز است (بدون رمز repo بی‌فایده).
- **ایمیج restic دستکاری شد:** ایمیج پین می‌شود و تغییرش اجرا را متوقف و هشدار می‌دهد؛ عملیات محلی بدون شبکه و بدون کلید ابری اجرا می‌شوند.
- **dump خام روی دیسک:** فقط موقت (پوشهٔ ۷۰۰) و بعد از کار پاک می‌شود؛ کانتینر تست restore بدون شبکه و با volume پاک‌شونده است.
- **تغییر دسترسی فایل‌ها (مثلاً backup.env):** اسکریپت اجرا نمی‌شود و هشدار می‌دهد.

## بازیابی
- فهرست: \`bash carmaa-backup.sh list\`
- دیتابیس: \`bash carmaa-backup.sh restore-db [ID] --apply\` (قبلش از وضعیت فعلی بکاپ می‌گیرد)
- فایل‌های آپلودی: \`bash carmaa-backup.sh restore-media [ID]\`
- سرور از صفر: Docker نصب → پوشهٔ سایت را بساز → \`backup.env\` و repo را برگردان (یا REMOTE_REPO) → \`restic restore latest --tag full --target /\` از طریق همین اسکریپت → \`.env\` و Caddyfile از /stage/config → \`docker compose up -d\` → restore-db → restore-media.
POL
}
install_cron(){ command -v crontab >/dev/null || { echo "ℹ crontab نیست؛ دستی زمان‌بندی کن (db ساعتی، run روزانه)"; return 0; }
  local P; P="PATH=/usr/local/bin:/usr/bin:/bin CARMAA_SITE_DIR=$(printf '%q' "$SITE")"; local BQ LQ; BQ="$(printf '%q' "$BIN")"; LQ="$(printf '%q' "$LOG")"
  ( crontab -l 2>/dev/null | grep -v 'carmaa-private/db-' | grep -v 'carmaa-backup.sh' || true
    echo "5 * * * * $P bash $BQ db >> $LQ 2>&1"
    echo "17 3 * * * $P bash $BQ run >> $LQ 2>&1"
    echo "40 4 * * 0 $P bash $BQ check >> $LQ 2>&1"
    echo "10 5 * * 0 $P bash $BQ restore-test >> $LQ 2>&1"
    echo "20 * * * * $P bash $BQ watch >> $LQ 2>&1" ) | crontab -
  echo "✔ cron نصب شد: DB ساعتی، کامل ۰۳:۱۷، check و restore-test یکشنبه‌ها، watch ساعتی"; }

case "$CMD" in
  install)
    trap 'on_err $LINENO' ERR
    echo "━━ ۱) آماده‌سازی ━━"; mkdir -p "$REPO" "$STAGE" "$RTMP" "$CACHE"; chmod 700 "$REPO" "$STAGE" "$RTMP" "$CACHE"
    if [ ! -f "$CONF" ]; then umask 077; { echo "RESTIC_PASSWORD=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"; echo "MIN_FREE_MB=2048"
      echo "# آف‌سایت (۳-۲-۱): خط‌های زیر را پر کن و سپس: bash carmaa-backup.sh remote-init"
      echo "# REMOTE_REPO=s3:https://ENDPOINT/BUCKET/carmaa"; echo "# AWS_ACCESS_KEY_ID="; echo "# AWS_SECRET_ACCESS_KEY="
      echo "# اعلان خطا (هرکدام که خواستی)"; echo "# HC_URL=https://hc-ping.com/UUID"; echo "# TG_BOT_TOKEN="; echo "# TG_CHAT_ID="; } > "$CONF"; chmod 600 "$CONF"; echo "✔ backup.env ساخته شد (رمز repo داخلش است)"; fi
    cp -f "$SELF" "$BIN" 2>/dev/null || true; chmod 700 "$BIN"
    ( umask 077; printf '%s' "$(cv RESTIC_PASSWORD)" > "$PASSF" ); chmod 600 "$PASSF"; mkdir -p "$CACHER"; chmod 700 "$CACHER"; build_mounts; docker pull -q "$RESTIC_IMG" >/dev/null 2>&1 || true; img_check
    [ -f "$REPO/config" ] || { rx init >>"$LOG" 2>&1; echo "✔ repo رمزشدهٔ restic ساخته شد: $REPO"; }
    old="$(ls "$PRIV"/db-backups 2>/dev/null | head -1 || true)"; [ -z "$old" ] || echo "ℹ بکاپ‌های قدیمی openssl در $PRIV/db-backups می‌مانند؛ فقط cron قدیمی جایگزین می‌شود"
    write_policy
    echo "━━ ۲) اولین بکاپ کامل ━━"; do_full
    echo "━━ ۳) تست restore ━━"; do_restore_test || echo "⚠ تست restore ناموفق؛ لاگ: $LOG"
    echo "━━ ۴) زمان‌بندی ━━"; install_cron
    echo
    echo "🔑 همین الان رمز repo را بیرون از سرور ذخیره کن (password manager):"
    echo "   grep RESTIC_PASSWORD $CONF"
    echo "   بدون این رمز هیچ بکاپی قابل بازیابی نیست — و روی همین سرور بودن بکاپ در برابر خرابی دیسک کافی نیست."
    echo "▶ قدم بعدی (مهم): آف‌سایت: $CONF را ویرایش کن (REMOTE_REPO و کلیدها) و بزن: bash $BIN remote-init"
    echo "▶ وضعیت: bash $BIN status";;
  run) trap 'on_err $LINENO' ERR; do_full;;
  db) trap 'on_err $LINENO' ERR; do_db;;
  check) trap 'on_err $LINENO' ERR; do_check;;
  restore-test) trap 'on_err $LINENO' ERR; do_restore_test;;
  restore-db) do_restore_db "$@";;
  restore-media) do_restore_media "$@";;
  status) do_status;;
  list) need_conf; rx snapshots;;
  watch) do_watch;;
  remote-init) do_remote_init;;
  pin-image) docker pull -q "$RESTIC_IMG" >/dev/null; sed -i '/^RESTIC_IMG_ID=/d' "$CONF"; echo "RESTIC_IMG_ID=$(docker image inspect --format '{{.Id}}' "$RESTIC_IMG")" >> "$CONF"; echo "✔ ایمیج restic پین شد";;
  uninstall-cron) crontab -l 2>/dev/null | grep -v 'carmaa-backup.sh' | crontab - && echo "✔ cron حذف شد";;
  help|-h|--help) sed -n 2,26p "$SELF";;
  *) echo "❌ دستور ناشناخته: $CMD (bash $0 help)"; exit 2;;
esac
