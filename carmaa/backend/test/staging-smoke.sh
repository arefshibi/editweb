#!/usr/bin/env bash
# Read-only smoke checks for a privately authorized CarMaa staging deployment.
# It does not request OTPs, create records, upload files, or invoke payment routes.
set -Eeuo pipefail

BASE="${CARMA_STAGING_BASE_URL:-http://127.0.0.1:3000}"
ALLOW_REMOTE="${CARMA_ALLOW_REMOTE_STAGING:-0}"
BASE="${BASE%/}"

node - "$BASE" "$ALLOW_REMOTE" <<'NODE'
const u = new URL(process.argv[2]);
const allowRemote = process.argv[3] === '1';
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only HTTP(S) staging URLs are accepted.');
if (!loopback && (u.protocol !== 'https:' || !allowRemote)) {
  throw new Error('Remote targets require HTTPS and CARMA_ALLOW_REMOTE_STAGING=1. Use only an authorized staging environment, never production.');
}
if (u.username || u.password || u.search || u.hash) throw new Error('Do not put credentials, query strings, or fragments in the base URL.');
NODE

command -v curl >/dev/null || { echo 'curl is required.' >&2; exit 2; }
failures=0
check_status() {
  local method="$1" path="$2" expected="$3" actual
  actual="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 -X "$method" "$BASE$path" || true)"
  if [[ "$actual" == "$expected" ]]; then
    printf 'PASS %-7s %-42s => %s\n' "$method" "$path" "$actual"
  else
    printf 'FAIL %-7s %-42s expected %s got %s\n' "$method" "$path" "$expected" "${actual:-network-error}"
    failures=$((failures + 1))
  fi
}

check_status GET /health/live 200
check_status GET /health/ready 200
check_status GET /api/v1/listings?page=1\&page_size=1 200
check_status GET /api/v1/listings/mine 401
check_status GET /api/v1/account/favorites 401
check_status GET /api/v1/admin/overview 401
check_status GET /api/v1/listings/not-a-uuid 400

if (( failures )); then
  printf '\n%d smoke check(s) failed. This is not a full security test.\n' "$failures" >&2
  exit 1
fi
printf '\nAll read-only staging smoke checks passed. This is not a penetration test.\n'
