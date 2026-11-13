#!/usr/bin/env bash
# CarMaa one-command deploy.
#   ./deploy.sh                         دامنه‌ی پیش‌فرض (carma-app.ir) با HTTPS خودکار (OTP ثابت 123456)
#   ./deploy.sh --ip                    تست روی IP سرور بدون HTTPS
#   ./deploy.sh --domain example.com    دامنه‌ی دیگر با HTTPS خودکار
#   ./deploy.sh --domain example.com --production   حالت واقعی (نیاز به کلید کاوه‌نگار/زرین‌پال در backend/.env)
#   ./deploy.sh admin +989121234567     ادمین کردن یک کاربر
#   ./deploy.sh logs | status | down | restart
set -euo pipefail
cd "$(dirname "$0")"
C="docker compose -f docker-compose.prod.yml --env-file backend/.env"

case "${1:-}" in
  logs)    exec $C logs -f --tail=100 "${2:-api}";;
  status)  exec $C ps;;
  down)    exec $C down;;
  restart) exec $C restart;;
  admin)   [ -n "${2:-}" ] || { echo "usage: ./deploy.sh admin +989xxxxxxxxx"; exit 2; }
           exec $C run --rm --no-deps api node src/scripts/promote-admin.js --phone="$2";;
esac

# پیش‌فرض‌ها (با متغیر محیطی هم قابل تغییرند): بدون هیچ آرگومان، روی دامنه‌ی پیش‌فرض بالا می‌آید.
DEFAULT_DOMAIN="${CARMA_DOMAIN:-carma-app.ir}"
DEFAULT_IP="${CARMA_IP:-194.146.69.93}"
DOMAIN=""; PROD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    --ip) DOMAIN=""; shift;;
    --production) PROD=1; shift;;
    *) echo "unknown arg: $1"; exit 2;;
  esac
done

command -v docker >/dev/null || { echo "docker not found"; exit 1; }
docker compose version >/dev/null || { echo "docker compose plugin not found"; exit 1; }
rnd() { openssl rand -hex 32; }

# Docker Hub errors such as "lookup registry-1.docker.io on 127.0.0.53:53: i/o timeout"
# are host DNS/network errors, not application build errors. Check DNS before touching
# the application containers, try a temporary systemd-resolved fallback, then retry builds.
registry_dns_ok() {
  getent ahostsv4 registry-1.docker.io >/dev/null 2>&1
}

ensure_registry_dns() {
  if registry_dns_ok; then return 0; fi

  echo ">> Docker Hub DNS lookup failed; trying fallback DNS servers..."
  if [ "$(id -u)" = 0 ] && command -v resolvectl >/dev/null 2>&1 && command -v ip >/dev/null 2>&1; then
    local iface
    iface="$(ip -4 route show default 2>/dev/null | awk 'NR==1 { for (i=1; i<=NF; i++) if ($i=="dev") { print $(i+1); exit } }')"
    if [ -n "$iface" ]; then
      # Runtime-only override; does not overwrite /etc/resolv.conf or other system files.
      resolvectl dns "$iface" 1.1.1.1 8.8.8.8 9.9.9.9 >/dev/null 2>&1 || true
      resolvectl domain "$iface" '~.' >/dev/null 2>&1 || true
      resolvectl flush-caches >/dev/null 2>&1 || true
    fi
  fi

  for attempt in 1 2 3 4 5 6; do
    if registry_dns_ok; then
      echo ">> Docker Hub DNS is responding."
      return 0
    fi
    sleep 2
  done

  echo "ERROR: this server still cannot resolve registry-1.docker.io."
  echo "Check outbound DNS/HTTPS and run: resolvectl status"
  echo "If the server network blocks public DNS or Docker Hub, its provider/network must be fixed; a project-file change cannot bypass that restriction."
  return 1
}

compose_up_retry() {
  local attempt=1 max_attempts=3
  while :; do
    if $C up -d --build "$@"; then return 0; fi
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "ERROR: Docker Compose failed after $max_attempts attempts."
      return 1
    fi
    echo ">> compose build failed (attempt $attempt/$max_attempts); checking DNS and retrying..."
    ensure_registry_dns || return 1
    sleep $((attempt * 5))
    attempt=$((attempt + 1))
  done
}

if [ -n "$DOMAIN" ]; then
  SITE_ADDRESS="$DOMAIN"; BASE="https://$DOMAIN"; SECURE=true
else
  IP="$DEFAULT_IP"
  SITE_ADDRESS=":80"; BASE="http://$IP"; SECURE=false
  [ "$PROD" = 1 ] && { echo "--production needs --domain (HTTPS is required)"; exit 1; }
fi

if [ ! -f backend/.env ]; then
  echo ">> creating backend/.env with fresh secrets"
  cp backend/.env.example backend/.env
fi
setenv() { # key value
  local k="$1" v="$2"
  if grep -q "^$k=" backend/.env; then
    sed -i "s|^$k=.*|$k=$(printf '%s' "$v" | sed 's/[|&\\]/\\&/g')|" backend/.env
  else echo "$k=$v" >> backend/.env; fi
}
getenv() { grep -m1 "^$1=" backend/.env | cut -d= -f2-; }
for k in POSTGRES_PASSWORD REDIS_PASSWORD OTP_PEPPER SESSION_PEPPER; do
  case "$(getenv $k)" in ""|replace-with*) setenv $k "$(rnd)";; esac
done
setenv CARMA_LAN_IP 127.0.0.1
setenv TRUST_PROXY 1
setenv PUBLIC_BASE_URL "$BASE"
setenv FRONTEND_URL "$BASE"
setenv ALLOWED_ORIGINS "$BASE"
setenv MEDIA_PUBLIC_BASE_URL "$BASE/media"
setenv PAYMENT_CALLBACK_BASE_URL "$BASE/api/v1/payments/zarinpal/callback"
setenv COOKIE_SECURE "$SECURE"
if [ "$PROD" = 1 ]; then
  setenv NODE_ENV production
  setenv DEV_OTP_CODE ""
  setenv PAYMENT_SANDBOX false
  if [ -z "$(getenv KAVENEGAR_API_KEY)" ]; then echo "!! KAVENEGAR_API_KEY is empty in backend/.env - SMS login will not work"; fi
else
  setenv NODE_ENV development
  setenv DEV_OTP_CODE ""
  setenv PAYMENT_SANDBOX true
fi
chmod 600 backend/.env
setenv SITE_ADDRESS "$SITE_ADDRESS"

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

echo ">> checking Docker Hub connection"
ensure_registry_dns || exit 1

echo ">> building & starting (first run takes a few minutes)"
# 1) دیتابیس و redis اول بالا می‌آیند تا رمز دیتابیس با backend/.env همگام شود.
#    (volume قدیمی دیتابیس رمز قبلی را نگه می‌دارد؛ بدون این مرحله migrate با «password authentication failed» می‌افتاد.)
compose_up_retry db redis
echo ">> waiting for database..."
for i in $(seq 1 40); do
  $C exec -T db pg_isready -U carmaa -d carmaa >/dev/null 2>&1 && break
  sleep 2
done
PGPW="$(getenv POSTGRES_PASSWORD)"
if [ -n "$PGPW" ]; then
  # اتصال از داخل کانتینر با سوکت محلی است (بدون رمز)؛ SQL از stdin می‌رود، نه خط فرمان.
  PGSQL="ALTER USER carmaa PASSWORD '$(printf '%s' "$PGPW" | sed "s/'/''/g")';"
  if printf '%s\n' "$PGSQL" | $C exec -T db psql -U carmaa -d carmaa -v ON_ERROR_STOP=1 >/dev/null; then
    echo ">> database password synced"
  else echo "!! could not sync database password (continuing)"; fi
fi
# 2) بقیه‌ی سرویس‌ها (migrate، api، web)
compose_up_retry --remove-orphans
echo ">> waiting for site..."
for i in $(seq 1 40); do
  if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1/" 2>/dev/null || curl -fsSk -o /dev/null --max-time 3 "https://127.0.0.1/" -H "Host: ${DOMAIN}" 2>/dev/null; then break; fi
  sleep 3
done
$C ps
echo ">> migrations:"; $C logs --tail=15 migrate 2>/dev/null || true
echo
echo "=============================================="
echo " Site:  $BASE"
[ "$PROD" = 1 ] || echo " Login: any phone number, OTP = 123456 (test mode)"
echo " Logs:  ./deploy.sh logs     Admin: ./deploy.sh admin +989xxxxxxxxx"
echo "=============================================="
