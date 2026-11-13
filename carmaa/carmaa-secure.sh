#!/usr/bin/env bash
# CarMaa — پکیج امنیتی کامل (sec.sh + sec-plus.sh در یک فایل)
# اجرا داخل پوشهی سایت (کنار docker-compose.prod.yml):   bash carmaa-secure.sh
# گزینهها:
#   --rotate-secrets        چرخاندن pepperها (اگر .env از بیرون قابل دانلود بوده)
#   --admin-mfa +98912...   فعالسازی 2FA برای یک ادمین/ناظر (کلید را یکبار نشان میدهد)
#   --admin-mfa-off         خاموش کردن اجبار 2FA
#   --admin-ip IP[,IP]|off  محدود کردن پنل ادمین به IP (اختیاری)
#   --no-host-cookie --no-vendor --no-dbrole --no-fix-deps --no-rebuild
#   --legacy-backup        بکاپ قدیمی openssl (پیش‌فرض خاموش؛ بکاپ اصلی: bash carmaa-backup.sh install)
#   --rollback              برگشت هر دو مرحله به آخرین بکاپ
set -euo pipefail
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
cat > "$T/sec.sh" <<'EOF_SEC_1'
#!/usr/bin/env bash
# CarMaa — پچ امنیتی (Security Kit: S/A/D/H/R) — پرتابل، idempotent، با بکاپ و برگشت خودکار
# اجرا داخل پوشهی سایت (همونجا که docker-compose.prod.yml هست):
#   bash sec.sh [مسیر] [--host-cookie] [--rotate-secrets] [--no-vendor] [--no-rebuild]
#   برگشت:       bash sec.sh --rollback
set -euo pipefail
ROLLBACK=0; HOSTCOOKIE=0; ROTATE=0; VENDOR=1; REBUILD=1; ARG=""
for a in "$@"; do case "$a" in
  --rollback) ROLLBACK=1;; --host-cookie) HOSTCOOKIE=1;; --rotate-secrets) ROTATE=1;;
  --no-vendor) VENDOR=0;; --no-rebuild) REBUILD=0;;
  -*) echo "❌ گزینهی ناشناخته: $a"; exit 2;; *) ARG="$a";; esac; done
R="$(cd "${ARG:-.}" && pwd)"; cd "$R"
for f in docker-compose.prod.yml deploy/Caddyfile backend/src/app.js backend/.env index.html; do
  [ -f "$f" ] || { echo "❌ $f پیدا نشد (مسیر: $R) — اسکریپت را داخل پوشهی سایت اجرا کن"; exit 1; }; done
command -v python3 >/dev/null || { echo "❌ python3 نصب نیست"; exit 1; }
TS="$(date +%Y%m%d-%H%M%S)"; PRIV="$(dirname "$R")/carmaa-private"; BK="$PRIV/sec-backup-$TS"
FILES="deploy/Caddyfile .dockerignore .gitignore docker-compose.prod.yml backend/Dockerfile backend/src/config.js backend/src/app.js backend/src/middleware/security.js backend/src/routes/auth.js js/00-leaflet-loader.js js/22-share-poster.js js/22a-carmaa-story-share.js index.html index_offline.html backend/.env"
C="docker compose -f docker-compose.prod.yml --env-file backend/.env"
HAVE_DOCKER=0; command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1 && HAVE_DOCKER=1
[ "$REBUILD" = 1 ] && [ "$HAVE_DOCKER" = 0 ] && { echo "⚠ docker پیدا نشد؛ فقط فایلها تغییر میکنند (--no-rebuild)"; REBUILD=0; }

backup(){ mkdir -p "$BK"; chmod 700 "$PRIV" "$BK"; for f in $FILES; do if [ -f "$f" ]; then mkdir -p "$BK/$(dirname "$f")"; cp -p "$f" "$BK/$f"; fi; done; return 0; }
restore(){ for f in $FILES; do if [ -f "$1/$f" ]; then cp -p "$1/$f" "$f"; fi; done; return 0; }
deploy(){ $C up -d --build --remove-orphans; }
healthy(){ for i in $(seq 1 30); do $C exec -T api node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 && return 0; sleep 3; done; return 1; }
fail_rollback(){ echo "❌ $1 — برگشت خودکار به بکاپ"; restore "$BK"; if [ "$REBUILD" = 1 ]; then deploy || true; fi; echo "↩ برگشت انجام شد. بکاپ: $BK"; exit 1; }

if [ "$ROLLBACK" = 1 ]; then
  L="$(ls -dt "$PRIV"/sec-backup-* 2>/dev/null | head -1 || true)"; [ -n "$L" ] || { echo "❌ بکاپی پیدا نشد"; exit 1; }
  restore "$L"; echo "✔ فایلها از $L برگشت"; if [ "$REBUILD" = 1 ]; then deploy; fi; echo "تمام شد."; exit 0
fi

SITE="$(grep -m1 '^SITE_ADDRESS=' backend/.env | cut -d= -f2- || true)"
case "$SITE" in ""|:*) BASE="http://127.0.0.1"; RES="";; *) BASE="https://$SITE"; RES="--resolve $SITE:443:127.0.0.1";; esac
probe(){ curl -sSk -o /dev/null -w '%{http_code} %{size_download}' --max-time 8 $RES "$BASE$1" 2>/dev/null || echo "000 0"; }
candidates(){ { echo /backend/.env; echo /.env; echo /docker-compose.prod.yml; echo /deploy.sh; echo /deploy/Caddyfile; echo /backend/src/config.js
  find backend -maxdepth 1 -name '.env*' 2>/dev/null | sed 's|^|/|'; find carmaa/backend -maxdepth 1 -name '.env*' 2>/dev/null | sed 's|^|/|'
  find . -maxdepth 1 -type f \( -name '*.sh' -o -name '*.zip' -o -name '*.b64' -o -name '*.save' -o -name '*.bak*' -o -name '.*-applied' \) 2>/dev/null | head -14 | sed 's|^\./|/|'
  find . -maxdepth 2 -type f -path './_bak*' 2>/dev/null | head -4 | sed 's|^\./|/|'; } | sort -u; }
exposed(){ local rs p code size; rs="$(probe / | awk '{print $2}')"; for p in $(candidates); do read -r code size <<<"$(probe "$p")"; if [ "$code" = 200 ] && [ "$size" != "$rs" ]; then echo "$p"; fi; done; return 0; }

echo "━━ ۱) بکاپ + بررسی افشا (قبل از پچ) ━━"
backup; echo "✔ بکاپ: $BK"
BEFORE=""; NB=0
if [ "$HAVE_DOCKER" = 1 ] && [ "$REBUILD" = 1 ]; then
  BEFORE="$(exposed)"; NB="$(printf '%s' "$BEFORE" | grep -c . || true)"
  if [ "${NB:-0}" -gt 0 ]; then echo "🚨 $NB فایل حساس/بکاپ الان از اینترنت قابل دانلود است، از جمله:"; printf '%s\n' "$BEFORE" | head -8 | sed 's/^/   /'
    printf '%s\n' "$BEFORE" | grep -q '\.env' && echo "🚨 فایل .env دانلودشدنی بود ⇒ همهی رمزها لو رفته حساب میشوند (بعد از پچ: --rotate-secrets و چرخاندن کلید ملیپیامک/کاوهنگار/HF/Anthropic/زرینپال)"
  else echo "✔ فایل حساسی از بیرون قابل دانلود نبود"; fi
fi

echo "━━ ۲) انتقال کپیهای رمزدار از پوشهی وب به $PRIV ━━"
Q="$PRIV/quarantine-$TS"
for f in backend/.env.bak-* carmaa/backend/.env carmaa/backend/.env.bak-*; do
  if [ -e "$f" ]; then mkdir -p "$Q/$(dirname "$f")"; mv "$f" "$Q/$f"; echo "  ↪ $f"; fi; done
chmod 600 backend/.env; if [ -d "$Q" ]; then chmod -R go-rwx "$Q"; fi

echo "━━ ۳) کتابخانههای لوکال (حذف CDN از صفحهی اصلی) ━━"
VENDOR_OK=0
if [ "$VENDOR" = 1 ]; then
  V=js/vendor; mkdir -p $V/leaflet/images
  fetch(){ o="$1"; m="$2"; shift 2; for u in "$@"; do if curl -fsSL --max-time 40 "$u" -o "$o.tmp" 2>/dev/null && [ "$(wc -c <"$o.tmp")" -gt 800 ] && grep -qF "$m" "$o.tmp"; then mv "$o.tmp" "$o"; return 0; fi; done; rm -f "$o.tmp"; return 1; }
  ok=1; L=https://unpkg.com/leaflet@1.9.4/dist; J=https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist
  fetch $V/leaflet/leaflet.js "Leaflet 1.9.4" $L/leaflet.js $J/leaflet.js || ok=0
  fetch $V/leaflet/leaflet.css ".leaflet-pane" $L/leaflet.css $J/leaflet.css || ok=0
  for im in layers.png layers-2x.png marker-icon.png marker-icon-2x.png marker-shadow.png; do
    fetch $V/leaflet/images/$im "PNG" $L/images/$im $J/images/$im || ok=0; done
  fetch $V/html2canvas.min.js "html2canvas" https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js || ok=0
  fetch $V/qrcode.min.js "QRCode" https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js || ok=0
  if [ $ok = 1 ]; then VENDOR_OK=1; (cd $V && find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS); echo "✔ js/vendor ساخته شد (leaflet 1.9.4, html2canvas 1.4.1, qrcodejs 1.0.0)"
  else rm -rf $V; echo "⚠ دانلود کتابخانهها نشد؛ CDNها در CSP مجاز میمانند (بعداً با اینترنت دوباره اجرا کن)"; fi
fi
export VENDOR_OK HOSTCOOKIE ROTATE

echo "━━ ۴) Caddy (هدرهای امنیتی + بستن فایلهای حساس) / .dockerignore / .gitignore ━━"
if [ "$VENDOR_OK" = 1 ]; then CDN=""; CSSCDN=""; else CDN="https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com"; CSSCDN="https://unpkg.com https://cdn.jsdelivr.net"; fi
KEEP_ADMIN_IP="$(sed -n '/# SEC2-ADMIN-IP begin/,/# SEC2-ADMIN-IP end/p' deploy/Caddyfile 2>/dev/null || true)"
cat > deploy/Caddyfile <<'CADDY'
{$SITE_ADDRESS::80} {
	encode gzip zstd
	request_body {
		max_size 25MB
	}
	header -Server
	root * /srv

	# SEC-PATCH: بکاپ/اسکریپت/env/کپی قدیمی هیچوقت سرو نشوند (فقط اگر فایل واقعاً وجود داشته باشد؛ مسیرهای SPA آزادند)
	@private {
		path_regexp private (?i)(^|/)(\.[^/]+|(_bak|_backup|backup-)[^/]*|(backend|deploy|docs|security|carmaa|test|var|node_modules))(/|$)|\.(env|sh|save|b64|zip|tar|gz|tgz|7z|py|ps1|md|log|sql|yml|yaml|pem|key|orig|swp)(\.[^/]*)?$|\.(bak|pre-rollback)[^/]*$
		file {
			root /srv
			try_files {path}
		}
	}
	@privtxt {
		path_regexp privtxt (?i)\.txt$
		not path_regexp keeptxt ^/([0-9]+|robots|humans|ads)\.txt$
		file {
			root /srv
			try_files {path}
		}
	}
	handle @private {
		respond "Not Found" 404
	}
	handle @privtxt {
		respond "Not Found" 404
	}
	handle /api/v1/live {
		reverse_proxy api:3000 {
			flush_interval -1
		}
	}
	handle /api/* {
		reverse_proxy api:3000
	}
	handle /media/* {
		reverse_proxy api:3000
	}
	handle {
		root * /srv
		@static path *.webp *.png *.jpg *.jpeg *.svg *.ico *.woff *.woff2 *.mp4
		@frontendCode path *.css *.js *.json *.webmanifest
		@aiWorker path /js/ai-vision-worker.js
		header Cache-Control "no-cache"
		header @static Cache-Control "public, max-age=86400"
		header @frontendCode Cache-Control "public, max-age=300, must-revalidate"
		header {
			X-Content-Type-Options "nosniff"
			Referrer-Policy "strict-origin-when-cross-origin"
			Permissions-Policy "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()"
			Strict-Transport-Security "max-age=15552000"
			Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' @@CDN@@; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com @@CSSCDN@@; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: data:; connect-src 'self' blob: data: https:; worker-src 'self' blob:; manifest-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
		}
		header @aiWorker Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval' blob:; connect-src 'self' https: blob: data:; worker-src 'self' blob:; frame-ancestors 'none'"
		try_files {path} /index.html
		file_server
	}
}
CADDY
sed -i "s|@@CDN@@|$CDN|; s|@@CSSCDN@@|$CSSCDN|" deploy/Caddyfile
if [ -n "$KEEP_ADMIN_IP" ]; then KEEP_ADMIN_IP="$KEEP_ADMIN_IP" python3 - <<'PYK'
import os
s=open('deploy/Caddyfile',encoding='utf-8').read(); blk=os.environ['KEEP_ADMIN_IP'].rstrip('\n')+'\n'
s=s.replace('\thandle /api/v1/live {',blk+'\thandle /api/v1/live {',1); open('deploy/Caddyfile','w',encoding='utf-8').write(s)
PYK
echo "✔ محدودیت IP ادمین (قبلی) حفظ شد"; fi
cat > .dockerignore <<'DI'
# SEC-PATCH — فقط چیزهای لازم وارد ایمیج وب شود (آخرین الگوی منطبق برنده است)
backend
.git
.env
**/.env
**/.env.*
**/*.md
**/*.ps1
**/*.py
**/*.sh
**/*.save
**/*.b64
**/*.zip
**/*.bak*
**/*.pre-rollback*
**/*.txt
!54642084.txt
!robots.txt
_bak*
_backup*
backup-*
carmaa
docs
security
node_modules
Dockerfile.web
docker-compose.prod.yml
deploy.sh
DI
if ! grep -q 'SEC-PATCH' .gitignore 2>/dev/null; then cat >> .gitignore <<'GI'
# SEC-PATCH (S2)
.env
.env.*
!.env.example
**/.env
**/.env.*
!**/.env.example
*.pem
*.key
_bak*/
_backup*/
backup-*/
*.bak*
*.pre-rollback*
node_modules/
backend/var/
GI
fi
echo "✔ Caddyfile / .dockerignore / .gitignore"

echo "━━ ۵) پچ کد بکاند، compose، فرانت و مستندات ━━"
python3 - "$R" <<'PY' || fail_rollback "پچ کد ناموفق بود"
import os,re,sys,datetime
os.chdir(sys.argv[1]); E=os.environ
def rd(p): return open(p,encoding='utf-8').read()
def wr(p,s): open(p,'w',encoding='utf-8').write(s)
def die(m): print('❌',m); sys.exit(1)
def sub(p,old,new,mark,count=1):
    s=rd(p)
    if mark in s: print('•',p,'— از قبل پچ شده'); return
    if s.count(old)!=count: die(f'{p}: نقطهی اتصال پیدا نشد (تعداد={s.count(old)}): {old[:70]!r}')
    wr(p,s.replace(old,new)); print('✔',p)
def setenv(k,v):
    L=rd('backend/.env').split('\n'); hit=False
    for i,l in enumerate(L):
        if l.startswith(k+'='): L[i]=k+'='+v; hit=True
    if not hit:
        if L and L[-1]=='': L.insert(len(L)-1,k+'='+v)
        else: L.append(k+'='+v)
    wr('backend/.env','\n'.join(L))
def getenv(k):
    m=re.search(r'^'+k+r'=(.*)$',rd('backend/.env'),re.M); return m.group(1).strip() if m else ''
# ---- config.js
cfg='backend/src/config.js'; s=rd(cfg)
m=re.search(r"ADMIN_BOOTSTRAP_PHONES: z\.string\(\)\.default\('([^']*)'\)",s)
if m and m.group(1):
    if not getenv('ADMIN_BOOTSTRAP_PHONES'): setenv('ADMIN_BOOTSTRAP_PHONES',m.group(1)); print('✔ شمارهی ادمین از کد به .env منتقل شد')
    wr(cfg,s.replace(m.group(0),"ADMIN_BOOTSTRAP_PHONES: z.string().default('')")); print('✔ config.js: شمارهی ادمین دیگر در کد نیست')
sub(cfg,"  TRUST_PROXY: z.enum(['0', '1']).default('0'),",
"""  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  // SEC-PATCH (A9): session timeouts
  SESSION_IDLE_MINUTES_USER: z.coerce.number().int().min(5).max(43200).default(7200),
  SESSION_IDLE_MINUTES_STAFF: z.coerce.number().int().min(5).max(43200).default(120),
  SESSION_ABSOLUTE_HOURS_STAFF: z.coerce.number().int().min(1).max(720).default(12),""",'SEC-PATCH (A9)')
# ---- app.js (HSTS بدون includeSubDomains)
sub('backend/src/app.js',"referrerPolicy: { policy:'no-referrer' },","referrerPolicy: { policy:'no-referrer' },\n  strictTransportSecurity: { maxAge: 15552000, includeSubDomains: false }, // SEC-PATCH (S14)",'SEC-PATCH (S14)')
# ---- middleware/security.js
sc='backend/src/middleware/security.js'
sub(sc,"redis.on('error', () => { /* connection details/secrets must not be logged */ });","""redis.on('error', () => { /* connection details/secrets must not be logged */ });

// SEC-PATCH (A9): idle + absolute session timeouts; staff get shorter limits
const SESSION_SQL = `SELECT s.id AS session_id, u.* FROM sessions s JOIN users u ON u.id=s.user_id
  WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.expires_at > now()
    AND s.last_seen_at > now() - (CASE WHEN u.role IN ('admin','moderator') THEN $2::int ELSE $3::int END) * interval '1 minute'
    AND (u.role NOT IN ('admin','moderator') OR s.created_at > now() - $4::int * interval '1 hour')
  LIMIT 1`;
const sessionParams = (digest) => [digest, config.SESSION_IDLE_MINUTES_STAFF, config.SESSION_IDLE_MINUTES_USER, config.SESSION_ABSOLUTE_HOURS_STAFF];
const touched = new Map();
function touchSession(id) {
  const now = Date.now();
  if (now - (touched.get(id) || 0) < 120_000) return;
  if (touched.size > 5000) touched.clear();
  touched.set(id, now);
  pool.query('UPDATE sessions SET last_seen_at=now() WHERE id=$1', [id]).catch(() => {});
}""",'SEC-PATCH (A9)')
s=rd(sc)
if 'SESSION_SQL, sessionParams' not in s:
    o1="""      `SELECT s.id AS session_id, u.* FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.expires_at > now() LIMIT 1`, [sessionDigest(token)]);"""
    o2=o1.replace('[sessionDigest(token)]','[digest]')
    for o,n in ((o1,"      SESSION_SQL, sessionParams(sessionDigest(token)));"),(o2,"      SESSION_SQL, sessionParams(digest));")):
        if s.count(o)!=1: die('security.js: SELECT نشست پیدا نشد')
        s=s.replace(o,n)
    wr(sc,s); print('✔ security.js: کوئری نشست (idle/absolute)')
sub(sc,"if (Math.random() < 0.08) pool.query('UPDATE sessions SET last_seen_at=now() WHERE id=$1', [row.session_id]).catch(() => {});","touchSession(row.session_id);",'touchSession(row')
sub(sc,"res.setHeader('Retry-After', String(Math.max(ttl, 1)));","res.setHeader('Retry-After', String(Math.max(ttl, 1))); req.log?.warn({ event: 'rate_limited', limiter: name }, 'Rate limit hit');",'event: \'rate_limited\'')
sub(sc,"  if (origin && !config.allowedOrigins.includes(origin)) return res.status(403)","  if (origin && !config.allowedOrigins.includes(origin)) req.log?.warn({ event: 'bad_origin' }, 'Untrusted origin rejected');\n  if (origin && !config.allowedOrigins.includes(origin)) return res.status(403)",'event: \'bad_origin\'')
sub(sc,"    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403)","    if (!req.auth || !roles.includes(req.auth.role)) req.log?.warn({ event: 'access_denied', userId: req.auth?.userId || null, role: req.auth?.role || null, path: req.path }, 'Role check failed');\n    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403)",'event: \'access_denied\'')
# ---- routes/auth.js
au='backend/src/routes/auth.js'
sub(au,"    if (result.error === 'BLOCKED') return res.status(403)","    if (result.error) req.log?.warn({ event: result.error === 'BLOCKED' ? 'login_blocked_account' : 'otp_verify_failed', ip: req.ip }, 'Login failed');\n    if (result.error === 'BLOCKED') return res.status(403)",'otp_verify_failed')
sub(au,"    setSessionCookie(res, result.token);","    setSessionCookie(res, result.token);\n    req.log?.info({ event: 'login_success', userId: result.user.id }, 'Login ok');",'login_success')
sub(au,"export const MAX_HANDLE_CHANGES = 2;","""// SEC-PATCH (A12): خروج از همهی دستگاهها
router.post('/logout-all', authRequired, async (req, res, next) => {
  try {
    await pool.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.auth.userId]);
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    req.log?.info({ event: 'logout_all', userId: req.auth.userId }, 'All sessions revoked');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

export const MAX_HANDLE_CHANGES = 2;""",'logout-all')
# ---- .env
if getenv('TRUST_PROXY')!='1':
    setenv('TRUST_PROXY','1'); print('✔ TRUST_PROXY=1 (پشت Caddy؛ بدون آن محدودیت نرخ/لاگ IP همهی کاربران را یکی میبیند)')
if E.get('HOSTCOOKIE')=='1':
    if getenv('COOKIE_SECURE')=='true' or getenv('NODE_ENV')=='production':
        if not getenv('COOKIE_NAME').startswith('__Host-'): setenv('COOKIE_NAME','__Host-'+(getenv('COOKIE_NAME') or 'carmaa_session')); print('✔ COOKIE_NAME با پیشوند __Host- (همه یکبار دوباره وارد میشوند)')
    else: print('⚠ --host-cookie نیاز به COOKIE_SECURE=true دارد؛ رد شد')
# ---- compose: سقف لاگ (D10)
cp='docker-compose.prod.yml'; s=rd(cp)
if 'max-size' not in s:
    out=[]
    for l in s.split('\n'):
        out.append(l)
        if re.match(r'^    restart: ',l): out+=['    logging:','      driver: json-file','      options:','        max-size: "10m"','        max-file: "5"']
    wr(cp,'\n'.join(out)); print('✔ docker-compose.prod.yml: سقف لاگ ۵×۱۰MB')
# ---- فرانت: لودرهای لوکال
if E.get('VENDOR_OK')=='1':
    def rx(p,pat,new,mark):
        s=rd(p)
        if mark in s: print('•',p,'— از قبل لوکال'); return
        s2,n=re.subn(pat,lambda _:new,s,count=1,flags=re.S)
        if n!=1: die(f'{p}: الگوی CDN پیدا نشد')
        wr(p,s2); print('✔',p)
    lf='js/00-leaflet-loader.js'
    rx(lf,r"'https://unpkg\.com/leaflet@1\.9\.4/dist/leaflet\.js',\s*'https://cdn\.jsdelivr\.net/npm/leaflet@1\.9\.4/dist/leaflet\.js',","'/js/vendor/leaflet/leaflet.js',",'/js/vendor/leaflet/leaflet.js')
    rx(lf,r"'https://unpkg\.com/leaflet@1\.9\.4/dist/leaflet\.css',\s*'https://cdn\.jsdelivr\.net/npm/leaflet@1\.9\.4/dist/leaflet\.css',","'/js/vendor/leaflet/leaflet.css',",'/js/vendor/leaflet/leaflet.css')
    rx('js/22-share-poster.js',r'const QR_LIBS = \[[^\]]*\];','const QR_LIBS = ["/js/vendor/qrcode.min.js"];','/js/vendor/qrcode.min.js')
    sh='js/22a-carmaa-story-share.js'
    rx(sh,r"html2canvas: \[[^\]]*\],","html2canvas: ['/js/vendor/html2canvas.min.js'],",'/js/vendor/html2canvas.min.js')
    rx(sh,r"qrcode: \[[^\]]*\]","qrcode: ['/js/vendor/qrcode.min.js']",'/js/vendor/qrcode.min.js')
    for h in ('index.html','index_offline.html'):
        if not os.path.exists(h): continue
        s=rd(h)
        for n in ('00-leaflet-loader','22-share-poster','22a-carmaa-story-share'):
            s=re.sub(r'(js/'+n+r'\.js\?v=)([^"\']*?)(-sec1)?(["\'])',lambda m:m.group(1)+m.group(2)+'-sec1'+m.group(4),s)
        wr(h,s)
# ---- docs/security (D1, H2, H17, D16)
os.makedirs('docs/security',exist_ok=True)
today=datetime.date.today().isoformat()
app=rd('backend/src/app.js')
imp=dict(re.findall(r"import (\w+Router) from '\./(?:routes/)?([\w-]+)\.js'",app))
rows=[]
for path,var in re.findall(r"app\.use\('(/api/v1/[a-z-]+)',\s*(?:[\w, ]*?)(\w+Router)\)",app):
    f=imp.get(var); fp=f'backend/src/routes/{f}.js' if f else ''
    if not f or not os.path.exists(fp): fp=f'backend/src/{f}.js'
    if not f or not os.path.exists(fp): continue
    s=rd(fp); gl='authRequired' if re.search(r'router\.use\(\s*authRequired',s) else ''
    if re.search(r"router\.use\([^)]*requireRole",s): gl='admin/moderator'
    for m,p,rest in re.findall(r"router\.(get|post|put|patch|delete)\(\s*'([^']*)'\s*,([^\n]*)",s):
        a=gl or ('admin/moderator' if 'requireRole' in rest or 'requirePerm' in rest else 'login' if 'authRequired' in rest else 'اختیاری' if 'authOptional' in rest else 'عمومی')
        if a=='admin/moderator' and 'requirePerm' in rest: a+=' + مجوز'
        rows.append(f'| {path}{p if p!="/" else ""} | {m.upper()} | {a} |')
wr('docs/security/attack-surface.md','# attack-surface.md (خودکار از کد ساخته شده — '+today+')\n\nبهعلاوه: `/media/*` (فایلهای آپلودی، CSP sandbox)، `/health/*`، وب استاتیک Caddy، پنل admin.html.\n\n| مسیر | متد | احراز هویت |\n|---|---|---|\n'+'\n'.join(rows)+'\n')
print('✔ docs/security/attack-surface.md —',len(rows),'مسیر')
# data-inventory از روی migrationها (ستونهای شخصی)
PII=re.compile(r'phone|email|name|address|ip|user_agent|device|avatar|banner|birth|national|lat|lng|location|bio|body|text|content|caption|title|message',re.I)
RET={'auth_otps':'حذف خودکار ۱ روز بعد از انقضا (server.js sweep)','sessions':'حذف خودکار ۳۰ روز بعد از انقضا/ابطال (server.js sweep)','payment_orders':'طبق قانون/حسابداری (بدون شماره کارت/CVV)','users':'تا حذف حساب — ⚠ «حذف حساب» هنوز پیادهسازی نشده (finding F2)'}
tabs=[]
for mf in sorted(os.listdir('backend/migrations')):
    if not mf.endswith('.sql'): continue
    for name,body in re.findall(r'CREATE TABLE IF NOT EXISTS (\w+)\s*\((.*?)\n\);',rd('backend/migrations/'+mf),re.S):
        cols=[l.split()[0] for l in body.split('\n') if l.strip() and not l.strip().startswith(('--','PRIMARY','UNIQUE','CHECK','FOREIGN','CONSTRAINT')) and re.match(r'\s+\w+\s+\w',l)]
        tabs.append((name,[c for c in cols if PII.search(c)]))
inv='# data-inventory.md (D1 — خودکار از migrationها، '+today+')\n\nستونهایی که احتمالاً داده شخصی/متن کاربر هستند. بازبینی دستی لازم است (D2: دلیل هر فیلد).\n\n| جدول | ستونهای حساس/شخصی | نگهداری (retention) |\n|---|---|---|\n'
for n,c in tabs: inv+=f"| {n} | {', '.join(c) or '—'} | {RET.get(n,'نیاز به تصمیم صاحب سایت')} |\n"
inv+='\n**پرداخت (D4):** فقط authority/ref_id/مبلغ؛ شماره کارت و CVV هرگز ذخیره نمیشود (زرینپال صفحهی میزبانی).\n**شخص ثالث (D13):** کاوهنگار/ملیپیامک (شماره)، زرینپال (مبلغ/سفارش)، Anthropic (فقط متن خبر RSS، نه داده کاربر)، HuggingFace (فقط دانلود مدل).\n'
wr('docs/security/data-inventory.md',inv); print('✔ docs/security/data-inventory.md —',len(tabs),'جدول')
if not os.path.exists('docs/security/incident.md'):
    wr('docs/security/incident.md','''# incident.md — طرح واکنش به حادثه (D16)
1. **مهار:** اگر نشت مشکوک است: `docker compose -f docker-compose.prod.yml --env-file backend/.env stop web` (سایت قطع، دیتابیس سالم).
2. **چرخاندن کلیدها (S8):** ملیپیامک/کاوهنگار، زرینپال، Anthropic، HF، رمز Postgres/Redis، `bash sec.sh --rotate-secrets` (pepperها؛ همهی نشستها بسته میشود).
3. **بررسی:** `docker compose ... logs api | grep -E "login_success|otp_verify_failed|access_denied|rate_limited"` و `admin_audit_logs` در دیتابیس.
4. **اطلاع:** کاربران متأثر را از طریق پیامک/اعلان مطلع کن؛ اگر داده شخصی لو رفته مرجع قانونی مربوطه را خبر کن.
5. **ریشهیابی و اصلاح:** در `findings.md` ثبت، بستن، تست، سپس `docker compose ... up -d --build`.
6. **برگشت:** `bash sec.sh --rollback` آخرین بکاپ پچ امنیتی را برمیگرداند.
''')
if not os.path.exists('docs/security/findings.md'):
    wr('docs/security/findings.md','''# findings.md (H17) — '''+today+'''
| # | شدت | وضعیت | شرح | اقدام |
|---|---|---|---|---|
| F1 | High | **بسته شد با sec.sh** | فایلهای .env/بکاپ/اسکریپت از وب قابل دانلود بودند (پیش از پچ) | Caddy 404 + .dockerignore + چرخش کلیدها |
| F2 | Medium | باز | «حذف حساب» (D11) پیادهسازی نشده | endpoint حذف + ابطال نشستها + حذف فایلها |
| F3 | Medium | باز | 2FA برای ادمین (A15): فقط OTP پیامکی | افزودن TOTP برای نقش admin |
| F4 | Medium | باز | رمزنگاری در حالت سکون/TLS داخلی DB/Redis (D6/D7) | رمزنگاری دیسک سرور؛ TLS بین کانتینرها در صورت جدا شدن میزبان |
| F5 | Medium | تأیید نشده | `npm audit` (H9) و gitleaks (S7) اجرا نشدهاند (نیاز به اینترنت/git) | `cd backend && npm audit --omit=dev` ؛ `gitleaks detect --redact` |
| F6 | Low | باز | بکاپ رمزشدهی خودکار دیتابیس + تست restore (D12/R7) | pg_dump زمانبندیشده + age/gpg + تست ماهانه |
''')
print('✔ docs/security/incident.md, findings.md')
PY

echo "━━ ۶) بررسی تنظیمات پروداکشن (بدون چاپ رمز) ━━"
ev(){ grep -m1 "^$1=" backend/.env | cut -d= -f2- || true; }
[ "$(ev NODE_ENV)" = production ] || echo "⚠ NODE_ENV=$(ev NODE_ENV) — برای سرور واقعی باید production باشد (S17)"
[ -z "$(ev DEV_OTP_CODE)" ] || echo "🚨 DEV_OTP_CODE خالی نیست — هر کسی با این کد وارد میشود (S17)"
[ "$(ev PAYMENT_SANDBOX)" != true ] || echo "⚠ PAYMENT_SANDBOX=true — پرداخت واقعی نیست (S17/D5)"
[ "$(ev COOKIE_SECURE)" = true ] || echo "⚠ COOKIE_SECURE باید true باشد (A6)"
case "$(ev ALLOWED_ORIGINS)" in *'*'*|*localhost*|*127.0.0.1*) echo "⚠ ALLOWED_ORIGINS شامل localhost/* است (H8)";; esac
if [ "$ROTATE" = 1 ]; then
  rnd(){ python3 -c 'import secrets;print(secrets.token_urlsafe(48))'; }
  for k in OTP_PEPPER SESSION_PEPPER; do v="$(rnd)"
    if grep -q "^$k=" backend/.env; then sed -i "s|^$k=.*|$k=$v|" backend/.env; else printf '\n%s=%s\n' "$k" "$v" >> backend/.env; fi; done
  echo "✔ OTP_PEPPER و SESSION_PEPPER چرخانده شد (همهی کاربران یکبار دوباره وارد میشوند)"
  echo "⚠ دستی بچرخان: کلید ملیپیامک/کاوهنگار، ZARINPAL_MERCHANT_ID(در صورت لو رفتن)، ANTHROPIC_API_KEY، HF_TOKEN، رمز Postgres/Redis (طبق docs/security/incident.md)"
fi
chmod 600 backend/.env

if [ "$REBUILD" = 1 ]; then
  echo "━━ ۷) اعتبارسنجی Caddyfile، دیپلوی، سلامت ━━"
  docker run --rm -e SITE_ADDRESS="${SITE:-:80}" -v "$R/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
    || fail_rollback "Caddyfile نامعتبر است"
  echo "✔ Caddyfile معتبر"
  deploy || fail_rollback "docker compose up ناموفق بود"
  healthy || fail_rollback "API بعد از ۹۰ ثانیه سالم نشد"
  echo "✔ API سالم است"
  sleep 3
  read -r hc _ <<<"$(probe /)"; [ "$hc" = 200 ] || fail_rollback "صفحهی اصلی کد $hc داد"
  HDR="$(curl -sSkI --max-time 8 $RES "$BASE/" 2>/dev/null | tr 'A-Z' 'a-z')"
  for h in content-security-policy strict-transport-security x-content-type-options; do
    if [[ "$BASE" == https* ]] || [ "$h" != strict-transport-security ]; then
      printf '%s' "$HDR" | grep -q "^$h:" && echo "  ✔ $h" || echo "  ⚠ هدر $h دیده نشد"; fi; done
  read -r mc _ <<<"$(probe /api/v1/auth/me)"; [ "$mc" = 401 ] && echo "  ✔ /auth/me بدون نشست ⇒ 401" || echo "  ⚠ /auth/me کد $mc داد (انتظار 401)"
  AFTER="$(exposed)"; NA="$(printf '%s' "$AFTER" | grep -c . || true)"
  if [ "${NA:-0}" -gt 0 ]; then echo "🚨 هنوز $NA فایل قابل دانلود است:"; printf '%s\n' "$AFTER" | head -8 | sed 's/^/   /'; else echo "✔ هیچ فایل حساسی دیگر از بیرون قابل دانلود نیست"; fi
else
  echo "ℹ ری‌بیلد انجام نشد. برای اعمال: $C up -d --build"
fi

CHANGED=0; for f in $FILES; do if [ -f "$f" ] && ! cmp -s "$f" "$BK/$f" 2>/dev/null; then CHANGED=1; fi; done
if [ "$CHANGED" = 0 ]; then rm -rf "$BK"; echo "ℹ این اجرا تغییری در فایلها نداشت (قبلاً پچ شده)؛ بکاپ تکراری حذف شد — برگشت همچنان به بکاپ اولین اجرا انجام میشود"; fi
echo
echo "━━ پایان ━━ بکاپ: $BK   |  برگشت: bash sec.sh --rollback"
echo "گزارش یافتهها: docs/security/findings.md | سطح حمله: docs/security/attack-surface.md"
echo "پیشنهاد: bash sec.sh --host-cookie (A6، همه یکبار لاگین مجدد)  و  --rotate-secrets اگر قبل از پچ فایل .env دانلودشدنی بود"
EOF_SEC_1
cat > "$T/sec-plus.sh" <<'EOF_SEC_2'
#!/usr/bin/env bash
# CarMaa — افزونهی امنیتی (Security Kit: بقیهی چکلیست) — بعد از sec.sh اجرا کن. idempotent، با بکاپ و برگشت خودکار
#   bash sec-plus.sh [--admin-mfa +98912XXXXXXX] [--admin-mfa-off] [--admin-ip 1.2.3.4[,5.6.7.8]|off] [--no-dbrole] [--no-backup] [--no-fix-deps] [--no-rebuild]
#   برگشت: bash sec-plus.sh --rollback
set -euo pipefail
ROLLBACK=0; MFA_PHONE=""; MFA_OFF=0; ADMIN_IP=""; DBROLE=1; BACKUP=0; FIXDEPS=1; REBUILD=1
while [ $# -gt 0 ]; do case "$1" in
  --rollback) ROLLBACK=1;; --no-dbrole) DBROLE=0;; --no-backup) BACKUP=0;; --legacy-backup) BACKUP=1;; --no-fix-deps) FIXDEPS=0;; --no-rebuild) REBUILD=0;;
  --admin-mfa) shift; MFA_PHONE="${1:-}"; [[ "$MFA_PHONE" =~ ^\+[1-9][0-9]{7,14}$ ]] || { echo "❌ شماره را با فرمت +98912... بده"; exit 2; };;
  --admin-mfa-off) MFA_OFF=1;;
  --admin-ip) shift; ADMIN_IP="${1:-}"; [ -n "$ADMIN_IP" ] || { echo "❌ IP لازم است (یا off)"; exit 2; };;
  *) echo "❌ گزینهی ناشناخته: $1"; exit 2;; esac; shift; done
R="$(pwd)"
for f in docker-compose.prod.yml deploy/Caddyfile backend/src/app.js backend/.env index.html backend/src/routes/auth.js backend/src/routes/admin.js backend/src/routes/account.js; do
  [ -f "$f" ] || { echo "❌ $f پیدا نشد — داخل پوشهی سایت اجرا کن"; exit 1; }; done
grep -q 'SEC-PATCH' backend/src/middleware/security.js || { echo "❌ اول sec.sh را اجرا کن"; exit 1; }
command -v python3 >/dev/null || { echo "❌ python3 نصب نیست"; exit 1; }
TS="$(date +%Y%m%d-%H%M%S)"; PRIV="$(dirname "$R")/carmaa-private"; BK="$PRIV/sec2-backup-$TS"
FILES="deploy/Caddyfile docker-compose.prod.yml backend/Dockerfile backend/package-lock.json backend/src/config.js backend/src/middleware/security.js backend/src/routes/auth.js backend/src/routes/admin.js backend/src/routes/account.js js/00-api-client.js index.html index_offline.html admin.html backend/.env"
C="docker compose -f docker-compose.prod.yml --env-file backend/.env"
HAVE_DOCKER=0; command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1 && HAVE_DOCKER=1
[ "$REBUILD" = 1 ] && [ "$HAVE_DOCKER" = 0 ] && { echo "⚠ docker پیدا نشد؛ فقط فایلها تغییر میکنند"; REBUILD=0; }
mkdir -p "$PRIV"; chmod 700 "$PRIV"
backup(){ mkdir -p "$BK"; chmod 700 "$BK"; for f in $FILES; do if [ -f "$f" ]; then mkdir -p "$BK/$(dirname "$f")"; cp -p "$f" "$BK/$f"; fi; done; return 0; }
restore(){ for f in $FILES; do if [ -f "$1/$f" ]; then cp -p "$1/$f" "$f"; fi; done; return 0; }
deploy(){ $C up -d --build --remove-orphans; }
healthy(){ for i in $(seq 1 30); do $C exec -T api node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 && return 0; sleep 3; done; return 1; }
fail_rollback(){ echo "❌ $1 — برگشت خودکار"; restore "$BK"; [ -f backend/package-lock.json ] && [ ! -f "$BK/backend/package-lock.json" ] && rm -f backend/package-lock.json; if [ "$REBUILD" = 1 ]; then deploy || true; fi; echo "↩ برگشت انجام شد ($BK)"; exit 1; }
if [ "$ROLLBACK" = 1 ]; then
  L="$(ls -dt "$PRIV"/sec2-backup-* 2>/dev/null | head -1 || true)"; [ -n "$L" ] || { echo "❌ بکاپی پیدا نشد"; exit 1; }
  restore "$L"; [ -f "$L/backend/package-lock.json" ] || rm -f backend/package-lock.json
  echo "✔ فایلها از $L برگشت (migration و کاربر دیتابیس افزودنی هستند و باقی میمانند)"; if [ "$REBUILD" = 1 ]; then deploy; fi; exit 0
fi
ev(){ grep -m1 "^$1=" backend/.env | cut -d= -f2- || true; }
setev(){ if grep -q "^$1=" backend/.env; then sed -i "s|^$1=.*|$1=$2|" backend/.env; else printf '\n%s=%s\n' "$1" "$2" >> backend/.env; fi; }
rnd(){ python3 -c 'import secrets;print(secrets.token_urlsafe(48))'; }
SITE="$(ev SITE_ADDRESS)"
case "$SITE" in ""|:*) BASE="http://127.0.0.1"; RES="";; *) BASE="https://$SITE"; RES="--resolve $SITE:443:127.0.0.1";; esac
probe(){ curl -sSk -o /dev/null -w '%{http_code}' --max-time 8 $RES "$BASE$1" 2>/dev/null || echo 000; }

echo "━━ ۱) بکاپ ━━"; backup; echo "✔ $BK"

echo "━━ ۲) کلیدهای جدید (.env) ━━"
[ -n "$(ev TOTP_ENC_KEY)" ] || { setev TOTP_ENC_KEY "$(rnd)"; echo "✔ TOTP_ENC_KEY ساخته شد"; }
[ -n "$(ev ADMIN_MFA)" ] || setev ADMIN_MFA off
[ -z "$MFA_PHONE" ] || { setev ADMIN_MFA on; echo "✔ ADMIN_MFA=on (ورود به پنل مدیریت فقط با کد برنامه احراز هویت)"; }
[ "$MFA_OFF" = 0 ] || { setev ADMIN_MFA off; echo "✔ ADMIN_MFA=off"; }
if [ "$DBROLE" = 1 ]; then [ -n "$(ev APP_DB_PASSWORD)" ] || { setev APP_DB_PASSWORD "$(rnd)"; echo "✔ APP_DB_PASSWORD ساخته شد (کاربر محدود دیتابیس)"; }; fi
chmod 600 backend/.env

echo "━━ ۳) migration، ماژول TOTP، حذف حساب، 2FA ادمین، کاربر محدود DB، compose ━━"
export ADMIN_IP DBROLE
python3 - "$R" <<'PY' || fail_rollback "پچ کد ناموفق بود"
import os,re,sys
os.chdir(sys.argv[1]); E=os.environ
def rd(p): return open(p,encoding='utf-8').read()
def wr(p,s): open(p,'w',encoding='utf-8').write(s)
def die(m): print('❌',m); sys.exit(1)
def sub(p,old,new,mark,count=1):
    s=rd(p)
    if mark in s: print('•',p,'— از قبل پچ شده'); return
    if s.count(old)!=count: die(f'{p}: نقطهی اتصال پیدا نشد (تعداد={s.count(old)}): {old[:70]!r}')
    wr(p,s.replace(old,new)); print('✔',p)
# ---- migration
mg='backend/migrations/022_staff_mfa.sql'
if not os.path.exists(mg):
    wr(mg,"""-- SEC2-PATCH (A15): TOTP for staff + per-session MFA mark
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_counter bigint;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;
"""); print('✔',mg)
# ---- totp.js
tp='backend/src/totp.js'
if not os.path.exists(tp):
    wr(tp,r"""// SEC2-PATCH (A15): RFC 6238 TOTP (SHA-1, 6 digits, 30 s) with no extra dependency
import crypto from 'node:crypto';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str) {
  let bits = 0, val = 0; const out = [];
  for (const c of String(str).toUpperCase().replace(/=+$/, '')) { const i = B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totpAt(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
// returns the matched counter (for replay protection) or null
export function verifyTotp(secret, code, now = Date.now()) {
  const c0 = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const expected = Buffer.from(totpAt(secret, c0 + d)); const given = Buffer.from(String(code));
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return c0 + d;
  }
  return null;
}
function key() {
  const k = process.env.TOTP_ENC_KEY || '';
  if (k.length < 32) throw new Error('TOTP_ENC_KEY is not configured');
  return crypto.createHash('sha256').update(k).digest();
}
export function encryptSecret(buf) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
export function decryptSecret(s) {
  const raw = Buffer.from(String(s).replace(/^v1:/, ''), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}
"""); print('✔',tp)
# ---- security.js: staffMfa
sc='backend/src/middleware/security.js'; s=rd(sc)
if 'export async function staffMfa' not in s:
    wr(sc,s.rstrip('\n')+"""

// SEC2-PATCH (A15): staff must pass TOTP once per session when ADMIN_MFA=on
export async function staffMfa(req, res, next) {
  try {
    if (process.env.ADMIN_MFA !== 'on' || !['admin', 'moderator'].includes(req.auth?.role)) return next();
    const { rows } = await pool.query('SELECT s.mfa_verified_at, u.totp_enabled_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1', [req.auth.sessionId]);
    const r = rows[0];
    if (!r?.totp_enabled_at) return res.status(403).json({ error: { code: 'MFA_SETUP_REQUIRED', message: 'احراز هویت دومرحله‌ای برای حساب مدیریتی فعال نشده است؛ از مدیر سرور بخواهید.' } });
    if (!r.mfa_verified_at) return res.status(403).json({ error: { code: 'MFA_REQUIRED', message: 'کد ۶ رقمی برنامه احراز هویت را وارد کنید.' } });
    return next();
  } catch (error) { return next(error); }
}
"""); print('✔',sc,'(staffMfa)')
# ---- admin.js
ad='backend/src/routes/admin.js'
sub(ad,"import { authRequired, requireRole, requirePerm, PERMISSIONS } from '../middleware/security.js';","import { authRequired, requireRole, requirePerm, PERMISSIONS, staffMfa } from '../middleware/security.js';",'staffMfa }')
sub(ad,"router.use(authRequired, requireRole('moderator','admin'));","router.use(authRequired, requireRole('moderator','admin'), staffMfa);",'requireRole(\'moderator\',\'admin\'), staffMfa')
# ---- auth.js: /totp/verify
au='backend/src/routes/auth.js'
sub(au,"import { sendOtpSms } from '../services/sms.js';","import { sendOtpSms } from '../services/sms.js';\nimport { verifyTotp, decryptSecret } from '../totp.js';",'verifyTotp, decryptSecret')
sub(au,"export const MAX_HANDLE_CHANGES = 2;","""// SEC2-PATCH (A15): تأیید کد TOTP برای نشست ادمین/ناظر
const totpLimit = createRateLimiter({ name: 'totp-verify', windowSeconds: 900, max: 10, key: (req) => req.auth?.userId || req.ip });
router.post('/totp/verify', authRequired, totpLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ code: z.string().regex(/^\\d{6}$/) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_TOTP', message: 'کد ۶ رقمی معتبر نیست.' } });
    const { rows } = await pool.query('SELECT totp_secret_enc, totp_last_counter FROM users WHERE id=$1 AND totp_enabled_at IS NOT NULL', [req.auth.userId]);
    if (!rows[0]) return res.status(403).json({ error: { code: 'MFA_SETUP_REQUIRED', message: 'احراز هویت دومرحله‌ای برای این حساب فعال نیست.' } });
    const counter = verifyTotp(decryptSecret(rows[0].totp_secret_enc), parsed.data.code);
    const fresh = counter !== null && (rows[0].totp_last_counter === null || BigInt(rows[0].totp_last_counter) < BigInt(counter));
    if (!fresh) { req.log?.warn({ event: 'totp_failed', userId: req.auth.userId }, 'TOTP rejected'); return res.status(401).json({ error: { code: 'INVALID_TOTP', message: 'کد نادرست یا استفاده‌شده است.' } }); }
    await pool.query('UPDATE users SET totp_last_counter=$2 WHERE id=$1', [req.auth.userId, counter]);
    await pool.query('UPDATE sessions SET mfa_verified_at=now() WHERE id=$1', [req.auth.sessionId]);
    req.log?.info({ event: 'totp_ok', userId: req.auth.userId }, 'TOTP verified');
    res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true });
  } catch (error) { next(error); }
});

export const MAX_HANDLE_CHANGES = 2;""",'totp/verify')
# ---- account.js: حذف حساب
ac='backend/src/routes/account.js'
sub(ac,"import { validateUuidParam } from '../validation.js';","import { validateUuidParam } from '../validation.js';\nimport { config } from '../config.js';\nimport { removeMedia } from '../services/media.js';",'removeMedia }')
sub(ac,"export default router;","""// SEC2-PATCH (D11): حذف حساب end-to-end (داده شخصی پاک، پرداختها برای قانون حسابداری بینام میمانند)
const deleteLimit = createRateLimiter({ name: 'account-delete', windowSeconds: 3600, max: 3, key: (req) => req.auth?.userId || req.ip });
router.delete('/me', deleteLimit, async (req, res, next) => {
  try {
    if (!z.object({ confirm: z.literal('DELETE') }).strict().safeParse(req.body).success) return res.status(400).json({ error: { code: 'CONFIRM_REQUIRED', message: 'برای حذف حساب باید تأیید ارسال شود.' } });
    if (['admin', 'moderator'].includes(req.auth.role)) return res.status(403).json({ error: { code: 'STAFF_CANNOT_SELF_DELETE', message: 'حساب مدیریتی را ابتدا از نقش مدیریتی خارج کنید.' } });
    const fresh = await pool.query("SELECT 1 FROM sessions WHERE id=$1 AND created_at > now() - interval '15 minutes'", [req.auth.sessionId]);
    if (!fresh.rowCount) return res.status(403).json({ error: { code: 'REAUTH_REQUIRED', message: 'برای حذف حساب دوباره با کد پیامکی وارد شوید و بلافاصله اقدام کنید.' } });
    const userId = req.auth.userId, keys = [], failed = [];
    await transaction(async (client) => {
      const step = async (name, sql) => { await client.query('SAVEPOINT s'); try { await client.query(sql, [userId]); await client.query('RELEASE SAVEPOINT s'); } catch { await client.query('ROLLBACK TO SAVEPOINT s'); failed.push(name); } };
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      for (const k of (await client.query('SELECT object_key FROM images WHERE owner_id=$1', [userId])).rows) keys.push(k.object_key);
      await step('auth_otps', 'DELETE FROM auth_otps WHERE phone_e164=(SELECT phone_e164 FROM users WHERE id=$1)');
      await step('listing_images', 'DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE owner_id=$1)');
      await step('listing_private', 'DELETE FROM listing_private_details WHERE owner_id=$1');
      await step('listings', "UPDATE listings SET status='archived',showroom_id=NULL,updated_at=now() WHERE owner_id=$1");
      await step('showroom', 'DELETE FROM showrooms WHERE owner_id=$1');
      await step('messages', 'UPDATE messages SET deleted_at=now() WHERE sender_id=$1 AND deleted_at IS NULL');
      for (const [n, sql] of [['favorites','DELETE FROM listing_favorites WHERE user_id=$1'],['saved_searches','DELETE FROM saved_searches WHERE user_id=$1'],['notifications','DELETE FROM notifications WHERE user_id=$1'],
        ['follows','DELETE FROM follows WHERE follower_id=$1 OR followed_user_id=$1'],['reads','DELETE FROM conversation_reads WHERE user_id=$1'],['blocks','DELETE FROM user_blocks WHERE blocker_id=$1 OR blocked_id=$1'],
        ['msg_likes','DELETE FROM message_likes WHERE user_id=$1'],['news_likes','DELETE FROM news_likes WHERE user_id=$1'],['news_comments','DELETE FROM news_comments WHERE user_id=$1'],
        ['story_seen','DELETE FROM story_seen WHERE user_id=$1'],['story_views','DELETE FROM story_views WHERE viewer_id=$1'],['sms_notifications','DELETE FROM sms_notifications WHERE user_id=$1'],
        ['story_hides','DELETE FROM story_hides WHERE owner_id=$1 OR hidden_user_id=$1'],['clears','DELETE FROM conversation_clears WHERE user_id=$1'],['post_likes','DELETE FROM social_post_likes WHERE user_id=$1'],
        ['post_comments','DELETE FROM social_post_comments WHERE owner_id=$1'],['posts','DELETE FROM social_posts WHERE owner_id=$1'],['stories','DELETE FROM stories WHERE owner_id=$1'],
        ['tickets','DELETE FROM support_tickets WHERE user_id=$1'],['reviews','DELETE FROM showroom_reviews WHERE reviewer_id=$1'],['offers','DELETE FROM listing_offers WHERE buyer_id=$1'],['reports','DELETE FROM reports WHERE reporter_id=$1'],
        ['images','DELETE FROM images WHERE owner_id=$1']]) await step(n, sql);
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
      await client.query(`UPDATE users SET status='deleted',deleted_at=now(),phone_e164='+99'||lpad((floor(random()*1e12))::bigint::text,12,'0'),display_name='',nickname=NULL,username=NULL,email=NULL,avatar_url=NULL,banner_url=NULL,sms_notify=false,totp_secret_enc=NULL,totp_enabled_at=NULL,updated_at=now() WHERE id=$1`, [userId]);
    });
    for (const k of keys) await removeMedia(k);
    req.log?.info({ event: 'account_deleted', userId, skipped: failed }, 'Account deleted');
    res.clearCookie(config.COOKIE_NAME, { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });
    res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true });
  } catch (error) { next(error); }
});

export default router;""",'account_deleted')
# ---- config.js: کاربر محدود دیتابیس برای api
if E.get('DBROLE')=='1':
    sub('backend/src/config.js',"rawEnv.DATABASE_URL = `postgres://carmaa:${encodeURIComponent(rawEnv.POSTGRES_PASSWORD)}@${rawEnv.DB_HOST}:5432/carmaa`;",
"""// SEC2-PATCH (S17): api uses a least-privilege role (APP_DB_USER is set only on the api service); migrate keeps the owner
  const dbUser = rawEnv.APP_DB_USER && rawEnv.APP_DB_PASSWORD ? rawEnv.APP_DB_USER : 'carmaa';
  const dbPass = dbUser === 'carmaa' ? rawEnv.POSTGRES_PASSWORD : rawEnv.APP_DB_PASSWORD;
  rawEnv.DATABASE_URL = `postgres://${dbUser}:${encodeURIComponent(dbPass)}@${rawEnv.DB_HOST}:5432/carmaa`;""",'SEC2-PATCH (S17)')
# ---- compose: healthcheck api + APP_DB_USER
cp='docker-compose.prod.yml'; s=rd(cp)
if 'SEC2-PATCH' not in s:
    L=s.split('\n'); out=[]; insvc=None
    for l in L:
        m=re.match(r'^  (\w+):\s*$',l)
        if m: insvc=m.group(1)
        out.append(l)
        if insvc=='api' and re.match(r'^      MEDIA_ROOT: ',l) and E.get('DBROLE')=='1': out.append('      APP_DB_USER: carmaa_app  # SEC2-PATCH (S17)')
        if insvc=='api' and l.strip()=='no-new-privileges:true': pass
    s='\n'.join(out)
    if 'healthcheck:' not in s.split('  migrate:')[0].split('  api:')[1]:
        s=re.sub(r'(\n    read_only: true\n)',r'''\n    healthcheck:  # SEC2-PATCH (R8)
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s\1''',s,count=1)
    wr(cp,s); print('✔ docker-compose.prod.yml (healthcheck + کاربر محدود)')
# ---- فرانت: پنجرهی کد 2FA در api-client
ap='js/00-api-client.js'
sub(ap,"    if (!response.ok) {\n      const e = new Error(data?.error?.message","""    if (!response.ok && data?.error?.code === 'MFA_REQUIRED' && !opts._mfa) { // SEC2-PATCH (A15)
      const code = window.prompt('کد ۶ رقمی برنامه احراز هویت (Google Authenticator) را وارد کنید');
      if (code) { await request('/auth/totp/verify', { method: 'POST', body: JSON.stringify({ code: String(code).trim() }) }); return request(path, { ...opts, _mfa: true }); }
    }
    if (!response.ok) {
      const e = new Error(data?.error?.message""",'SEC2-PATCH (A15)')
for h in ('index.html','index_offline.html','admin.html'):
    if not os.path.exists(h): continue
    s=rd(h); s=re.sub(r'(js/00-api-client\.js\?v=)([^"\']*?)(-sec2)?(["\'])',lambda m:m.group(1)+m.group(2)+'-sec2'+m.group(4),s); wr(h,s)
# ---- محدودیت IP ادمین در Caddy (اختیاری)
ip=E.get('ADMIN_IP','')
if ip:
    cf='deploy/Caddyfile'; s=rd(cf)
    s=re.sub(r'\t# SEC2-ADMIN-IP begin.*?# SEC2-ADMIN-IP end\n','',s,flags=re.S)
    if ip!='off':
        ips=' '.join(x.strip() for x in ip.split(',') if re.fullmatch(r'[0-9a-fA-F:./]+',x.strip()))
        if not ips: die('IP نامعتبر')
        blk=f"\t# SEC2-ADMIN-IP begin\n\t@adminblock {{\n\t\tpath /admin.html /admin.js /admin.css /js/admin-panel.js /api/v1/admin /api/v1/admin/*\n\t\tnot remote_ip {ips}\n\t}}\n\thandle @adminblock {{\n\t\trespond \"Not Found\" 404\n\t}}\n\t# SEC2-ADMIN-IP end\n"
        s=s.replace('\thandle /api/v1/live {',blk+'\thandle /api/v1/live {',1)
        print('✔ پنل ادمین فقط از IP:',ips)
    else: print('✔ محدودیت IP ادمین برداشته شد')
    wr(cf,s)
# ---- Dockerfile: npm ci در صورت وجود lockfile
df='backend/Dockerfile'; s=rd(df)
if os.path.exists('backend/package-lock.json') and 'npm install --omit=dev' in s:
    wr(df,s.replace('npm install --omit=dev','npm ci --omit=dev')); print('✔ Dockerfile: npm ci (نصب از lockfile)')
PY

echo "━━ ۴) lockfile + npm audit (H9/R10) ━━"
AUDIT="نامشخص"
if [ "$HAVE_DOCKER" = 1 ]; then
  nrun(){ docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$R/backend:/w" -w /w node:22-alpine "$@"; }
  if [ ! -f backend/package-lock.json ]; then nrun npm install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null 2>&1 && echo "✔ package-lock.json ساخته شد" || echo "⚠ ساخت lockfile ناموفق (اینترنت؟)"; fi
  if [ -f backend/package-lock.json ]; then
    sed -i 's/npm install --omit=dev/npm ci --omit=dev/' backend/Dockerfile
    cnt(){ { nrun npm audit --omit=dev --json 2>/dev/null || true; } | python3 -c "import sys,json
try:
  v=json.load(sys.stdin)['metadata']['vulnerabilities']; print(v.get('high',0)+v.get('critical',0))
except Exception: print(-1)"; }
    N="$(cnt || echo -1)"
    if [ "$N" -gt 0 ] && [ "$FIXDEPS" = 1 ]; then echo "⚠ $N آسیبپذیری High/Critical؛ npm audit fix (بدون --force)"; nrun npm audit fix --omit=dev --package-lock-only --ignore-scripts >/dev/null 2>&1 || true; N="$(cnt || echo -1)"; fi
    if [ "$N" = 0 ]; then AUDIT="۰ High/Critical"; echo "✔ npm audit: صفر آسیبپذیری High/Critical"; elif [ "$N" -gt 0 ]; then AUDIT="$N High/Critical باز"; echo "🚨 npm audit: $N مورد High/Critical باقی ماند — دستی: cd backend && npm audit --omit=dev"; else echo "⚠ npm audit اجرا نشد (اینترنت؟)"; fi
  fi
else echo "ℹ docker نیست؛ رد شد"; fi

echo "━━ ۵) اسکن رمز در فایلهای سایت (بدون چاپ مقدار) ━━"
mkdir -p docs/security
SCANN="$(python3 - <<'PY'
import os,re,datetime
pats={'AWS key':r'AKIA[0-9A-Z]{16}','sk- key':r'\bsk-[A-Za-z0-9_-]{20,}','HF token':r'\bhf_[A-Za-z0-9]{30,}','private key':r'-----BEGIN [A-Z ]*PRIVATE KEY-----','generic secret':r'(?i)(api[_-]?key|secret|passwd|password|token)\s*[:=]\s*[\'"][A-Za-z0-9_\-+/=]{20,}[\'"]'}
skip_dir={'node_modules','.git','vendor','_bak','_backup','backup-'}
hits=[]
for root,dirs,files in os.walk('.'):
    dirs[:]=[d for d in dirs if not any(d.startswith(s) or d==s for s in skip_dir)]
    for f in files:
        if re.search(r'\.(bak|pre-rollback|png|jpe?g|webp|svg|ico|woff2?|mp4|zip|gz)',f) or f in('.env','.env.example','package-lock.json'): continue
        p=os.path.join(root,f)
        try: txt=open(p,encoding='utf-8',errors='ignore').read()
        except Exception: continue
        for i,l in enumerate(txt.split('\n'),1):
            if len(l)>2000: continue
            for n,r in pats.items():
                if re.search(r,l): hits.append((p[2:],i,n))
out='# secret-scan.md (S1/S3/S7 — '+datetime.date.today().isoformat()+')\nفقط مسیر و شماره خط؛ مقدارها چاپ نمیشوند. هر مورد را دستی بازبینی کن (ممکن است false-positive باشد).\n\n'
out+=('| فایل | خط | نوع |\n|---|---|---|\n'+'\n'.join(f'| {a} | {b} | {c} |' for a,b,c in hits)) if hits else 'هیچ موردی پیدا نشد.\n'
open('docs/security/secret-scan.md','w',encoding='utf-8').write(out+'\n')
print(len(hits))
PY
)"
if [ "$SCANN" = 0 ]; then echo "✔ هیچ رمز/کلیدی در کد پیدا نشد"; else echo "⚠ $SCANN مورد مشکوک — docs/security/secret-scan.md (بازبینی دستی)"; fi

echo "━━ ۶) اسکریپتهای بکاپ رمزشده + تست restore (D12/R7) ━━"
cat > "$PRIV/db-backup.sh" <<BKS
#!/usr/bin/env bash
set -euo pipefail
cd "$R"; KEY="$PRIV/backup.key"; OUT="$PRIV/db-backups"; mkdir -p "\$OUT"; chmod 700 "\$OUT"
[ -f "\$KEY" ] || { umask 077; python3 -c 'import secrets;print(secrets.token_urlsafe(48))' > "\$KEY"; }
F="\$OUT/carmaa-\$(date +%Y%m%d-%H%M%S).sql.gz.enc"
$C exec -T db pg_dump -U carmaa -d carmaa --no-owner | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:"\$KEY" -out "\$F"
[ "\$(wc -c < "\$F")" -gt 1024 ] || { rm -f "\$F"; echo "backup too small"; exit 1; }
chmod 600 "\$F"; find "\$OUT" -name 'carmaa-*.enc' -mtime +14 -delete; echo "ok \$F"
BKS
cat > "$PRIV/db-restore-test.sh" <<RTS
#!/usr/bin/env bash
set -euo pipefail
KEY="$PRIV/backup.key"; F="\$(ls -t "$PRIV"/db-backups/carmaa-*.enc | head -1)"; N=carmaa-restore-test
docker rm -f \$N >/dev/null 2>&1 || true
docker run -d --name \$N -e POSTGRES_PASSWORD=t -e POSTGRES_USER=carmaa -e POSTGRES_DB=carmaa postgres:17-alpine >/dev/null
trap 'docker rm -f \$N >/dev/null 2>&1 || true' EXIT
for i in \$(seq 1 40); do docker exec \$N pg_isready -U carmaa -d carmaa >/dev/null 2>&1 && break; sleep 1; done
sleep 2
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:"\$KEY" -in "\$F" | gunzip | docker exec -i \$N psql -q -U carmaa -d carmaa -v ON_ERROR_STOP=0 >/dev/null 2>&1 || true
T="\$(docker exec \$N psql -U carmaa -d carmaa -Atc "select count(*) from information_schema.tables where table_schema='public'")"
U="\$(docker exec \$N psql -U carmaa -d carmaa -Atc "select count(*) from users" 2>/dev/null || echo -1)"
echo "restore-test tables=\$T users=\$U file=\$F"; [ "\$T" -ge 10 ] && [ "\$U" -ge 0 ]
RTS
chmod 700 "$PRIV/db-backup.sh" "$PRIV/db-restore-test.sh"
BACKUP_STATE="خاموش"
if [ -f "$PRIV/backup.env" ] && grep -q '^RESTORE_TEST_RESULT=OK' "$PRIV/backup-status.txt" 2>/dev/null; then BACKUP_STATE="فعال + restore تست‌شده (carmaa-backup.sh)"
elif [ -f "$PRIV/backup.env" ]; then BACKUP_STATE="فعال (carmaa-backup.sh)"; else echo "ℹ بکاپ: bash carmaa-backup.sh install (سیستم restic؛ جایگزین بکاپ قدیمی openssl)"; fi
if [ "$BACKUP" = 1 ] && [ "$HAVE_DOCKER" = 1 ] && command -v openssl >/dev/null; then
  if "$PRIV/db-backup.sh" >"$PRIV/backup.log" 2>&1; then echo "✔ بکاپ رمزشده ساخته شد"; BACKUP_STATE="فعال"
    if "$PRIV/db-restore-test.sh" 2>&1 | tail -1; then echo "✔ تست restore موفق"; BACKUP_STATE="فعال + restore تستشده"; else echo "⚠ تست restore ناموفق — $PRIV/db-restore-test.sh را دستی اجرا کن"; fi
    if command -v crontab >/dev/null; then ( crontab -l 2>/dev/null | grep -v 'carmaa-private/db-'; echo "17 3 * * * $PRIV/db-backup.sh >> $PRIV/backup.log 2>&1"; echo "10 4 * * 0 $PRIV/db-restore-test.sh >> $PRIV/backup.log 2>&1" ) | crontab - && echo "✔ cron: بکاپ روزانه ۰۳:۱۷ و تست restore هفتگی"
    else echo "ℹ crontab نیست؛ دستی زمانبندی کن: $PRIV/db-backup.sh"; fi
    echo "🔑 فایل $PRIV/backup.key را جایی امن کپی کن؛ بدون آن بکاپها بازشدنی نیستند."
  else echo "⚠ بکاپ ناموفق: $(tail -2 "$PRIV/backup.log")"; fi
fi

if [ "$REBUILD" = 1 ]; then
  echo "━━ ۷) کاربر محدود دیتابیس، اعتبارسنجی Caddy، دیپلوی، سلامت ━━"
  if [ "$DBROLE" = 1 ]; then
    $C up -d db >/dev/null 2>&1 || true
    for i in $(seq 1 30); do $C exec -T db pg_isready -U carmaa -d carmaa >/dev/null 2>&1 && break; sleep 2; done
    APPPW="$(ev APP_DB_PASSWORD)"
    $C exec -T db psql -U carmaa -d carmaa -v ON_ERROR_STOP=1 -v pw="$APPPW" >/dev/null <<'SQL' || fail_rollback "ساخت کاربر محدود دیتابیس ناموفق بود"
SELECT format('CREATE ROLE carmaa_app LOGIN PASSWORD %L', :'pw') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='carmaa_app') \gexec
SELECT format('ALTER ROLE carmaa_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'pw') \gexec
GRANT CONNECT ON DATABASE carmaa TO carmaa_app;
GRANT USAGE ON SCHEMA public TO carmaa_app;
REVOKE CREATE ON SCHEMA public FROM carmaa_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO carmaa_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO carmaa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE carmaa IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO carmaa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE carmaa IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO carmaa_app;
SQL
    echo "✔ کاربر carmaa_app (فقط SELECT/INSERT/UPDATE/DELETE) ساخته شد"
  fi
  SITEV="${SITE:-:80}"
  docker run --rm -e SITE_ADDRESS="$SITEV" -v "$R/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || fail_rollback "Caddyfile نامعتبر است"
  deploy || fail_rollback "docker compose up ناموفق بود"
  healthy || fail_rollback "API بعد از ۹۰ ثانیه سالم نشد"
  echo "✔ API سالم است (با کاربر محدود دیتابیس)"
  [ "$(probe /)" = 200 ] || fail_rollback "صفحهی اصلی باز نمیشود"
  [ "$(probe /api/v1/auth/me)" = 401 ] && echo "  ✔ /auth/me بدون نشست ⇒ 401"
  [ "$(probe /api/v1/admin/listings)" = 401 ] && echo "  ✔ /admin بدون نشست ⇒ 401" || echo "  ℹ /admin کد $(probe /api/v1/admin/listings) داد (با محدودیت IP، 404 طبیعی است)"
  if [ -n "$MFA_PHONE" ]; then
    echo "━━ ۸) فعالسازی 2FA برای $MFA_PHONE ━━"
    OUT="$($C exec -T -e MFA_PHONE="$MFA_PHONE" api node --input-type=module -e '
import { pool } from "/app/src/db.js"; import { base32Encode, encryptSecret } from "/app/src/totp.js"; import crypto from "node:crypto";
const { rows } = await pool.query("SELECT id FROM users WHERE phone_e164=$1 AND role IN ($2,$3)", [process.env.MFA_PHONE, "admin", "moderator"]);
if (!rows[0]) { console.log("NOUSER"); process.exit(2); }
const s = crypto.randomBytes(20);
await pool.query("UPDATE users SET totp_secret_enc=$2,totp_enabled_at=now(),totp_last_counter=NULL WHERE id=$1", [rows[0].id, encryptSecret(s)]);
await pool.query("UPDATE sessions SET mfa_verified_at=NULL WHERE user_id=$1", [rows[0].id]);
console.log("SECRET=" + base32Encode(s)); process.exit(0);' 2>&1 || true)"
    if printf '%s' "$OUT" | grep -q '^SECRET='; then SEC="$(printf '%s' "$OUT" | grep '^SECRET=' | cut -d= -f2)"
      echo "✔ 2FA فعال شد. در Google Authenticator/Authy → «Enter a setup key» (نوع Time-based):"
      echo "   کلید:  $SEC"
      echo "   یا لینک: otpauth://totp/CarMaa:$MFA_PHONE?secret=$SEC&issuer=CarMaa"
      echo "   ⚠ این کلید را فقط یکبار نشان میدهد؛ در password manager ذخیره کن. ورود بعدی به پنل، کد ۶ رقمی میخواهد."
    elif printf '%s' "$OUT" | grep -q NOUSER; then echo "❌ کاربر ادمین/ناظر با این شماره پیدا نشد (اول یکبار با آن شماره وارد سایت شو و نقش مدیر بگیر)"
    else echo "❌ فعالسازی 2FA ناموفق"; fi
  fi
else echo "ℹ ری‌بیلد انجام نشد: $C up -d --build"; fi

DATE="$(date +%F)"
python3 - "$DATE" "$AUDIT" "$BACKUP_STATE" "$(ev ADMIN_MFA)" "$DBROLE" "$(ev NODE_ENV)" "$(ev PAYMENT_SANDBOX)" "$(ev COOKIE_NAME)" "$ADMIN_IP" <<'PY'
import sys,os
date,audit,backup,mfa,dbrole,nodeenv,sandbox,cname,adminip=sys.argv[1:10]
G,B,N='✅','❌','➖'
have=lambda p:os.path.exists(p)
secscan=open('docs/security/secret-scan.md',encoding='utf-8').read() if have('docs/security/secret-scan.md') else ''
R=[
('S1','بدون رمز در کد',G if 'هیچ موردی' in secscan else B,'docs/security/secret-scan.md','مشکوکها را بازبینی کن'),
('S2','.env در gitignore',G,'.gitignore + .dockerignore (sec.sh)','—'),
('S3','رمز در فرانتاند نیست',G if 'هیچ موردی' in secscan else B,'secret-scan.md؛ فرانت فقط /api/v1 را صدا میزند','—'),
('S4','کلید جدا برای dev/prod',B,'تأیید نشده (سرور)','NODE_ENV='+(nodeenv or '?')+' ؛ کلیدهای prod فقط روی سرور'),
('S5','کلیدها least-privilege/سقف هزینه',B,'در پنل ارائهدهندگان (ملیپیامک/Anthropic/HF)','دستی'),
('S6','فراخوانی کلیدها در بکاند',G,'backend/src/services/{sms,payments,news-ingest}.js','—'),
('S7','gitleaks',G if 'هیچ موردی' in secscan else B,'اسکن داخلی secret-scan.md (پوشه git ندارد)','gitleaks روی ریپو'),
('S8','کلید لوگرفته چرخیده',B,'به نتیجهی بررسی افشا در sec.sh بستگی دارد','--rotate-secrets'),
('S9','S10 رمز در چت / password manager',B,'غیرقابل بررسی خودکار','دستی'),
('S11','هش رمز',N,'ورود فقط با OTP؛ ستون password در users نیست','—'),
('S12','سیاست رمز',N,'بدون رمز عبور','—'),
('S13','توکنهای تصادفی',G,'crypto.randomBytes/randomInt (util.js, auth.js)','—'),
('S14','HTTPS + HSTS',G,'Caddy + helmet max-age=15552000 (sec.sh)','—'),
('S15','کوئری پارامتری',G,'همهی routeها $n؛ interpolationها فقط ستونهای whitelist','—'),
('S16','اعتبارسنجی zod/allowlist',G,'listings.js editable map + zod strict()','—'),
('S17','debug خاموش/کاربر DB محدود',G if (dbrole=='1' and nodeenv=='production' and sandbox!='true') else B,f'NODE_ENV={nodeenv}, PAYMENT_SANDBOX={sandbox}, کاربر carmaa_app={"فعال" if dbrole=="1" else "غیرفعال"}','NODE_ENV=production و sandbox=false'),
('A1','بدون enumeration',G,'otp/request همیشه 202 عمومی (auth.js)','—'),
('A2','Rate limit',G,'otp-ip 10/15m, verify-ip 30/15m, verify-phone 10/h, cooldown 5/h','—'),
('A3','Lockout',G,'۵ تلاش اشتباه ⇒ OTP مصرف میشود + محدودیت ساعتی (auth.js)','—'),
('A4','breached password',N,'بدون رمز عبور','—'),
('A5','لاگ شکست ورود',G,'events otp_verify_failed/login_success/access_denied (sec.sh)','—'),
('A6','کوکی',G if cname.startswith('__Host-') else B,'HttpOnly+Secure+SameSite=Strict؛ پیشوند __Host-: '+('فعال' if cname.startswith('__Host-') else 'غیرفعال'),'--host-cookie (sec.sh)'),
('A7','نشست تصادفی/بدون localStorage',G,'توکن ۳۲ بایت، digest در DB؛ فرانت توکن ذخیره نمیکند','—'),
('A8','چرخش نشست',G,'هر ورود نشست جدید میسازد','—'),
('A9','Idle/Absolute + re-auth',G,'sec.sh (idle/absolute)؛ حذف حساب نشست ≤۱۵ دقیقه میخواهد','—'),
('A10','Logout سمت سرور',G,'POST /auth/logout revoked_at + clearCookie','—'),
('A11','Logout POST + CSRF + no-store',G,'csrfOriginGuard + Cache-Control no-store','—'),
('A12','خروج از همهی دستگاهها',G,'POST /auth/logout-all + حذف حساب','—'),
('A13','Reset token',N,'ورود OTP؛ ریست رمز ندارد','—'),
('A14','تأیید ایمیل/re-auth',N,'بدون ایمیل؛ re-auth برای حذف حساب','—'),
('A15','2FA ادمین',G if mfa=='on' else B,'ADMIN_MFA='+(mfa or 'off'),'bash sec-plus.sh --admin-mfa +98...'),
('A16','Authorization/CSRF',G,'authRequired + owner_id در همهی routeهای نمونه (listings/payments/messages/account)','—'),
('A17','Social login',N,'پیادهسازی نشده','—'),
('A-T','۸ تست auth.md',B,'اجرا نشده','دستی روی staging'),
('D1','data-inventory',G,'docs/security/data-inventory.md','بازبینی دستی'),
('D2','فیلد بیدلیل',B,'نیاز به تصمیم صاحب سایت','data-inventory'),
('D4','کارت/CVV',G,'payment_orders فقط authority/ref_id؛ درگاه زرینپال','—'),
('D5','تأیید پرداخت',G,'verify با amount+authority؛ transaction FOR UPDATE؛ idempotency','—'),
('D6','TLS داخلی',N,'DB/Redis روی شبکهی private کامپوز، بدون port منتشرشده','TLS در صورت جدا شدن میزبان'),
('D7','Encryption at rest',B,'رمزنگاری دیسک سرور تأیید نشد؛ TOTP با AES-GCM رمز میشود','LUKS/دیسک رمزشده'),
('D8','فقط فیلد لازم',G,'safeUser + ستونهای صریح در SELECTها','—'),
('D9','PII در لاگ',G,'pino redact cookie/authorization؛ شماره در لاگ نیست','—'),
('D10','حذف خودکار',G,'sweep در server.js + سقف لاگ داکر','—'),
('D11','حذف حساب',G,'DELETE /api/v1/account/me (account.js)','دکمهی UI'),
('D12','بکاپ رمزشده',G if ('restore' in backup or 'restic' in backup) else B,'بکاپ: '+backup,'—'),
('D13','داده به سرویس ثالث',G,'فقط پیامک/پرداخت؛ AI فقط متن خبر','—'),
('D14','دادهی prod در dev',B,'تأیید نشده','دستی'),
('D15','Privacy policy',B,'تأیید نشده','دستی'),
('D16','incident.md',G,'docs/security/incident.md','—'),
('H2','attack-surface',G,'docs/security/attack-surface.md','—'),
('H3','IDOR',G,'owner_id/participant در SQL؛ route نمونهها بررسی شد','—'),
('H4','Injection',G,'بدون string-concat کاربر؛ ILIKE escape','—'),
('H5','XSS/CSP',G,'CSP + escHtml در فرانت (نمونهبرداری)','اسکن کامل DOM'),
('H6','CSRF',G,'SameSite=Strict + Origin guard','—'),
('H7','SSRF',G,'news.js allowlist https + redirect manual','—'),
('H8','هدرها/CORS',G,'Caddy+helmet؛ CORS allowlist','—'),
('H9','npm audit',G if audit.startswith('۰') else B,'نتیجه: '+audit,'—'),
('H10','آپلود',G,'magic-bytes + sharp re-encode + UUID + سقف','—'),
('H11','خطا بدون stack',G,'error handler عمومی (app.js)','—'),
('H12','Rate limit پرهزینه',G,'otp/upload/payment/chat-media limiters','—'),
('H13','لاگ رویداد امنیتی',G,'rate_limited/bad_origin/access_denied/login_*','هشدار (alert) تنظیم نشده'),
('H14','webhook/lockfile',G if have('backend/package-lock.json') else B,'package-lock.json + npm ci','—'),
('H15','LLM',G,'AI فقط روی متن عمومی خبر؛ ابزار به کاربر داده نمیشود','—'),
('H17','findings',G,'findings.md','F2,F3 با این اسکریپت بسته شد'),
('H20','XXE/deserialization',B,'RSS parser بررسی نشد','بررسی news-ingest'),
('R1','tag/rollback',B,'پوشهی git ندارد؛ بکاپ sec-backup دارد','git tag'),
('R2','env روی میزبان',G,'backend/.env فقط روی سرور','—'),
('R3','HTTPS',G,'Caddy خودکار','—'),
('R4','DB عمومی نیست',G,'db/redis بدون ports','—'),
('R5','پنل ادمین',G if (mfa=='on') else B,'2FA: '+mfa+(' / IP: '+adminip if adminip else ''),'--admin-ip'),
('R6','داده تست/seed',B,'00-demo-showrooms.js (دمو) در فرانت','حذف قبل از لانچ'),
('R7','بکاپ+restore',G if ('restore' in backup or 'restic' in backup) else B,backup,'—'),
('R8','مانیتورینگ',B,'healthcheck+restart هست؛ alert خارجی نیست','Uptime Kuma/Telegram'),
('R9','هدرها روی URL زنده',B,'در sec.sh چک شد؛ دستی: curl -sI https://دامنه','—'),
('R10','npm ci',G if have('backend/package-lock.json') else B,'Dockerfile','—'),
('R11','H مجدد',B,'پس از هر تغییر','—'),
('R12','rollback',G,'sec.sh --rollback و sec-plus.sh --rollback','—'),
]
blk=[r for r in R if r[0] in ('S1','S2','S3','S7','S11','S14','S15','S17','A3','A6','A10','A13','A16','D4','D9','H3','H4','H8','H9','H17')]
bad=[r for r in blk if r[2]==B]
out=f"# release-report-{date}.md\n\n**{'منتشر نکن' if bad else 'می‌شه منتشر کرد'}** — بلاکرهای ناموفق: {', '.join(r[0] for r in bad) or 'ندارد'}\n\n| # | مورد | وضعیت | شاهد | کار لازم |\n|---|---|---|---|---|\n"
out+='\n'.join(f'| {a} | {b} | {c} | {d} | {e} |' for a,b,c,d,e in R)+'\n\nنکته: ❌ یعنی «تأیید نشده/باز»؛ هیچ ✅ بر پایهی فرض نیست.\n'
open(f'docs/security/release-report-{date}.md','w',encoding='utf-8').write(out)
print('گزارش:',f'docs/security/release-report-{date}.md','| ❌ بلاکر:',', '.join(r[0] for r in bad) or 'ندارد')
PY
CHANGED=0; for f in $FILES; do if [ -f "$f" ] && ! cmp -s "$f" "$BK/$f" 2>/dev/null; then CHANGED=1; fi; done
if [ "$CHANGED" = 0 ]; then rm -rf "$BK"; echo "ℹ تغییری در فایلها نبود؛ بکاپ تکراری حذف شد (برگشت به بکاپ اولین اجرا)"; fi
echo
echo "━━ پایان ━━ بکاپ: $BK | برگشت: bash sec-plus.sh --rollback"
echo "بعدش: bash sec-plus.sh --admin-mfa +98912XXXXXXX   (2FA ادمین)   |   --admin-ip IP_خودت (اختیاری)"
EOF_SEC_2
A1=(); A2=(); HC=1; RB=0
while [ $# -gt 0 ]; do case "$1" in
  --rotate-secrets|--no-vendor) A1+=("$1");;
  --no-host-cookie) HC=0;;
  --no-rebuild) A1+=("$1"); A2+=("$1");;
  --rollback) RB=1;;
  --admin-mfa|--admin-ip) A2+=("$1" "${2:-}"); shift;;
  --admin-mfa-off|--no-backup|--legacy-backup|--no-dbrole|--no-fix-deps) A2+=("$1");;
  *) echo "❌ گزینهی ناشناخته: $1"; exit 2;; esac; shift; done
if [ "$RB" = 1 ]; then
  bash "$T/sec-plus.sh" --rollback "${A2[@]}" || true
  bash "$T/sec.sh" --rollback "${A1[@]}"; exit 0
fi
[ "$HC" = 1 ] && A1+=(--host-cookie)
echo "════ مرحله ۱/۲: پچ پایه ════"
bash "$T/sec.sh" "${A1[@]}"
echo "════ مرحله ۲/۲: افزونه ════"
bash "$T/sec-plus.sh" "${A2[@]}"
echo "✔ تمام شد. گزارش: docs/security/release-report-*.md"
