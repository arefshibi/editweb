#!/usr/bin/env bash
# Puts the stories rail between the search bar and the body-type chips (sedan / hatchback / ...).
# Works on the original design, and also after patch-stories-down.sh. usage: bash patch-stories-up.sh [root]   rollback: --rollback [root]
set -euo pipefail
MODE=apply; [ "${1:-}" = "--rollback" ] && { MODE=rollback; shift; }
ROOT="$(cd "${1:-.}" && pwd)"; JS="$ROOT/js/35-home-dashboard.js"; HTML="$ROOT/index.html"
[ -f "$JS" ] || { echo "js/35-home-dashboard.js not found in $ROOT"; exit 1; }
if [ "$MODE" = rollback ]; then
  B="$(ls -dt "$ROOT"/_bak_storiesup_* 2>/dev/null | head -1)"; [ -n "$B" ] || { echo "no backup"; exit 1; }
  cp "$B/35-home-dashboard.js" "$JS"; cp "$B/index.html" "$HTML"; echo "rolled back from $B"; exit 0
fi
grep -q 'CM-ORDER3' "$JS" && { echo "already applied"; exit 0; }
TS="$(date +%Y%m%d-%H%M%S)"; B="$ROOT/_bak_storiesup_$TS"; mkdir -p "$B"; cp "$JS" "$HTML" "$B/"
python3 - "$JS" "$HTML" "$TS" <<'PY'
import sys,re
js_p,html_p,ts=sys.argv[1:4]
s=open(js_p,encoding='utf-8').read()
a="  /* CM-HOME-CLEAN:END */"
if s.count(a)!=1: sys.exit("anchor not found, nothing changed")
add='''  /* CM-ORDER3: ریل استوری‌ها بالای چیپ‌های نوع بدنه (سدان، هاچ‌بک، ...) */
  (function () {
    const ts = page.querySelector(".cm-ts"), qf = page.querySelector(".cm-qf");
    if (!ts || !qf) return;
    const anchor = qf.closest(".cm-fx") || qf;
    anchor.before(ts);
    ts.style.margin = "4px 0 0";
  })();
'''
open(js_p,'w',encoding='utf-8').write(s.replace(a,add+a))
h=open(html_p,encoding='utf-8').read()
h=re.sub(r'(js/35-home-dashboard\.js\?v=)([^"]*?)(-su\w*)?"',lambda m:m.group(1)+m.group(2)+'-su'+ts.replace('-','')+'"',h)
open(html_p,'w',encoding='utf-8').write(h)
PY
echo "done. backup: $B — hard-refresh the browser, then docker cp the files again (see before)."
