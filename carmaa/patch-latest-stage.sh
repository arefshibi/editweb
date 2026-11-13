#!/usr/bin/env bash
# Makes the "latest listings" section a distinct highlighted stage. CSS only; works on any current layout.
# usage: bash patch-latest-stage.sh [root]     rollback: bash patch-latest-stage.sh --rollback [root]
set -euo pipefail
MODE=apply; [ "${1:-}" = "--rollback" ] && { MODE=rollback; shift; }
ROOT="$(cd "${1:-.}" && pwd)"; HTML="$ROOT/index.html"; CSS="$ROOT/latest-stage.css"
[ -f "$HTML" ] || { echo "index.html not found in $ROOT"; exit 1; }
if [ "$MODE" = rollback ]; then
  B="$(ls -dt "$ROOT"/_bak_lateststage_* 2>/dev/null | head -1)"; [ -n "$B" ] || { echo "no backup"; exit 1; }
  cp "$B/index.html" "$HTML"; rm -f "$CSS"; echo "rolled back from $B"; exit 0
fi
TS="$(date +%Y%m%d-%H%M%S)"
if ! grep -q 'latest-stage.css' "$HTML"; then B="$ROOT/_bak_lateststage_$TS"; mkdir -p "$B"; cp "$HTML" "$B/"; fi
cat > "$CSS" <<'CM_CSS_EOF'
/* CM-LT-STAGE — «جدیدترین آگهی‌ها» به‌صورت یک صحنه‌ی جدا و پررنگ */
.cm-home-page .cm-lt-sec{position:relative;margin:34px 0 30px;padding:26px 16px 20px;isolation:isolate;
  background:radial-gradient(90% 70% at 85% 0%,rgba(229,72,77,.26),transparent 62%),radial-gradient(60% 50% at 0% 100%,rgba(200,20,31,.14),transparent 70%),linear-gradient(180deg,#170a0c 0%,#0c0b0c 62%,rgba(12,11,12,0) 100%);
  border-top:1px solid rgba(229,72,77,.42)}
.cm-home-page .cm-lt-sec::before{content:"";position:absolute;z-index:-1;top:-1px;left:50%;width:46%;height:2px;margin-left:-23%;background:linear-gradient(90deg,transparent,#ff5a60,transparent);box-shadow:0 0 18px 2px rgba(255,70,80,.7)}
.cm-home-page .cm-lt-sec::after{content:"";position:absolute;z-index:-1;left:16px;right:16px;bottom:0;height:0;border-bottom:1.5px dashed rgba(255,255,255,.16)}
.cm-home-page .cm-lt-head{margin-bottom:16px}
.cm-home-page .cm-lt-head h2{font-size:25px;font-weight:900;letter-spacing:-.02em;gap:10px;color:#fff;text-shadow:0 2px 22px rgba(229,72,77,.45)}
.cm-home-page .cm-lt-head h2::after{content:"تازه";display:inline-flex;align-items:center;height:22px;padding:0 9px 0 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0;color:#fff;text-shadow:none;
  background:linear-gradient(135deg,#ff4a52,#c8141f);box-shadow:0 0 0 0 rgba(255,74,82,.65);animation:cmLtPulse 2s ease-out infinite}
@keyframes cmLtPulse{0%{box-shadow:0 0 0 0 rgba(255,74,82,.6)}70%,100%{box-shadow:0 0 0 9px rgba(255,74,82,0)}}
.cm-home-page .cm-lt-wrap{margin-inline:-16px}
.cm-home-page .cm-lt-rail{padding:4px 16px 14px;scroll-padding-inline:16px;gap:14px;scroll-snap-type:x mandatory}
.cm-home-page .cm-lt-rail .cm-lt-card{border-radius:24px!important;scroll-snap-align:start;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 22px 36px -22px rgba(229,72,77,.55)!important}
.cm-home-page .cm-lt-rail .cm-lt-card:first-child::after{content:"تازه‌ترین";position:absolute;z-index:3;top:10px;right:10px;height:24px;display:inline-flex;align-items:center;padding:0 10px;border-radius:12px;font-size:11.5px;font-weight:800;color:#fff;background:linear-gradient(135deg,#ff4a52,#c8141f);box-shadow:0 6px 14px -4px rgba(200,20,31,.8)}
.cm-home-page .cm-lt-rail .cm-lt-card:first-child .cm-lt-badge{top:40px!important}
.cm-home-page .cm-lt-card .cm-lt-price{margin-top:8px;padding-top:10px;border-top:1.5px dashed rgba(255,255,255,.15)}
.cm-home-page .cm-lt-card .cm-lt-price b{color:#fff}
.cm-home-page .cm-lt-card .cm-lt-price small{color:#ff6a70}
html.theme-light .cm-home-page .cm-lt-sec{background:radial-gradient(90% 70% at 85% 0%,rgba(229,72,77,.16),transparent 62%),linear-gradient(180deg,#fff1f1 0%,#fafafa 70%,rgba(250,250,250,0) 100%)}
html.theme-light .cm-home-page .cm-lt-head h2{color:#0e0e0e;text-shadow:none}
@media (prefers-reduced-motion:reduce){.cm-home-page .cm-lt-head h2::after{animation:none}}
CM_CSS_EOF
python3 - "$HTML" "$TS" <<'PY'
import sys,re
p,ts=sys.argv[1:3]
h=open(p,encoding='utf-8').read()
if 'latest-stage.css' in h:
    h=re.sub(r'latest-stage\.css\?v=[^"]*','latest-stage.css?v='+ts,h)
else:
    m=re.search(r'[ \t]*<link rel="stylesheet" href="home-clean\.css[^>]*>',h)
    if not m: sys.exit("home-clean.css link not found, nothing changed")
    h=h[:m.end()]+'\n      <link rel="stylesheet" href="latest-stage.css?v='+ts+'" />'+h[m.end():]
open(p,'w',encoding='utf-8').write(h)
PY
echo "done. now: docker cp index.html carma-web-1:/srv/index.html && docker cp latest-stage.css carma-web-1:/srv/latest-stage.css  (then hard-refresh)"
