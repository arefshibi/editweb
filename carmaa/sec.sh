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
HAVE_DOCKER=0; command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && HAVE_DOCKER=1
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
