#!/usr/bin/env bash
# Moves the brand rail under the search panel and the stories rail below it. Needs home-v2 patch applied first.
# usage: bash patch-home-order.sh [root]     rollback: bash patch-home-order.sh --rollback [root]
set -euo pipefail
MODE=apply; [ "${1:-}" = "--rollback" ] && { MODE=rollback; shift; }
ROOT="$(cd "${1:-.}" && pwd)"; JS="$ROOT/js/35-home-dashboard.js"; HTML="$ROOT/index.html"
[ -f "$JS" ] || { echo "js/35-home-dashboard.js not found in $ROOT"; exit 1; }
if [ "$MODE" = rollback ]; then
  B="$(ls -dt "$ROOT"/_bak_homeorder_* 2>/dev/null | head -1)"; [ -n "$B" ] || { echo "no backup"; exit 1; }
  cp "$B/35-home-dashboard.js" "$JS"; echo "rolled back from $B"; exit 0
fi
grep -q 'CM-FX' "$JS" || { echo "apply patch-home-v2.sh first"; exit 1; }
grep -q 'CM-ORDER' "$JS" && { echo "already applied"; exit 0; }
TS="$(date +%Y%m%d-%H%M%S)"; B="$ROOT/_bak_homeorder_$TS"; mkdir -p "$B"; cp "$JS" "$B/"
python3 - "$JS" "$HTML" "$TS" <<'PY'
import sys,re
js_p,html_p,ts=sys.argv[1:4]
s=open(js_p,encoding='utf-8').read()
a="      br.before(h);\n    }\n"
if s.count(a)!=1: sys.exit("anchor not found, nothing changed")
add=a+'''    /* CM-ORDER: برندها زیر پنل یابنده، ریل استوری‌ها پایین‌تر */
    (function () {
      const ts = page.querySelector(".cm-ts"), bh = page.querySelector(".cm-br-head"), b5 = page.querySelector(".cm-br5");
      if (ts && bh && b5) ts.before(bh, b5);
    })();
'''
open(js_p,'w',encoding='utf-8').write(s.replace(a,add))
h=open(html_p,encoding='utf-8').read()
h=re.sub(r'(js/35-home-dashboard\.js\?v=)([^"]*?)(-ho\w*)?"',lambda m:m.group(1)+m.group(2)+'-ho'+ts.replace('-','')+'"',h)
open(html_p,'w',encoding='utf-8').write(h)
PY
echo "done. backup: $B — hard-refresh the browser."
