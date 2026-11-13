#!/usr/bin/env bash
# Carma home v2 patch — usage: bash patch-home-v2.sh [/path/to/site/root]   (rollback: bash patch-home-v2.sh --rollback [root])
set -euo pipefail
MODE=apply; [ "${1:-}" = "--rollback" ] && { MODE=rollback; shift; }
ROOT="$(cd "${1:-.}" && pwd)"
JS="$ROOT/js/35-home-dashboard.js"; HTML="$ROOT/index.html"; CSS="$ROOT/home-v2.css"
[ -f "$JS" ] && [ -f "$HTML" ] || { echo "index.html / js/35-home-dashboard.js not found in $ROOT"; exit 1; }
if [ "$MODE" = rollback ]; then
  B="$(ls -dt "$ROOT"/_bak_homev2_* 2>/dev/null | head -1)"; [ -n "$B" ] || { echo "no backup"; exit 1; }
  cp "$B/35-home-dashboard.js" "$JS"; cp "$B/index.html" "$HTML"; rm -f "$CSS"; echo "rolled back from $B"; exit 0
fi
TS="$(date +%Y%m%d-%H%M%S)"; B="$ROOT/_bak_homev2_$TS"
if grep -q 'CM-FX' "$JS"; then B="$(ls -dt "$ROOT"/_bak_homev2_* 2>/dev/null | head -1 || true)"; echo "already patched; keeping original backup"
else mkdir -p "$B"; cp "$JS" "$B/"; cp "$HTML" "$B/"; fi

cat > "$CSS" <<'CM_CSS_EOF'
/* CM-HOME-V2 — بازطراحی یکپارچه‌ی صفحه‌ی اصلی («پنل یابنده» + ریتم ثابت بخش‌ها).
   این فایل آخرین استایل بارگذاری‌شده است؛ برای برگشت کافی است لینکش را از index.html بردارید. */
.cm-home-page{--v2-red:#e5484d;--v2-red-d:#c8141f;--v2-line:rgba(255,255,255,.08);--v2-g:16px}

/* ───────── ۱) پنل یابنده: جستجو + نوع بدنه در یک قاب ───────── */
.cm-home-page .cm-fx{position:relative;margin:6px var(--v2-g) 0;padding:12px 12px 12px;border-radius:26px;
  background:linear-gradient(180deg,#18191c 0%,#0f1012 100%);border:1px solid var(--v2-line);
  box-shadow:0 18px 36px -22px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden}
.cm-home-page .cm-fx::before{content:"";position:absolute;top:0;left:50%;width:42%;height:2px;margin-left:-21%;border-radius:0 0 3px 3px;
  background:linear-gradient(90deg,transparent,var(--v2-red),transparent);box-shadow:0 0 16px 1px rgba(229,72,77,.65)}
.cm-home-page .cm-fx .cm-home-search-wrap{display:block!important;padding:0!important;margin:0!important}
.cm-home-page .cm-fx .cm-home-search{width:100%!important;margin:0!important;min-height:50px!important;border-radius:16px;background:#070708;border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 2px 8px rgba(0,0,0,.6)}
.cm-home-page .cm-fx .cm-home-search-icon{color:var(--v2-red)}
.cm-home-page .cm-fx .cm-qf{display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 4*8px)/4.6);gap:8px;overflow-x:auto;
  margin:12px -12px 0;padding:0 12px 2px;scroll-snap-type:x proximity;scroll-padding-inline:12px;scrollbar-width:none;direction:rtl}
.cm-home-page .cm-fx .cm-qf::-webkit-scrollbar{display:none}
.cm-home-page .cm-fx .cm-qf-chip{height:auto;min-height:64px;padding:10px 4px 9px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;
  scroll-snap-align:start;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);color:#d9dce3;font-size:11.5px;font-weight:700;line-height:1.2;white-space:nowrap;
  transition:transform .15s ease,background .2s ease,border-color .2s ease,color .2s ease}
.cm-home-page .cm-fx .cm-qf-ic{width:44px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.92}
.cm-home-page .cm-fx .cm-qf-ic circle{fill:#1b1c1f}
html.theme-light .cm-home-page .cm-fx .cm-qf-ic circle{fill:#f3f4f6}
.cm-home-page .cm-fx .cm-qf-chip:active{transform:scale(.95);border-color:rgba(229,72,77,.7);background:rgba(229,72,77,.12);color:#fff}
@media (hover:hover){.cm-home-page .cm-fx .cm-qf-chip:hover{border-color:rgba(229,72,77,.5);color:#fff}}
html.theme-light .cm-home-page .cm-fx{background:#fff;border-color:rgba(0,0,0,.08);box-shadow:0 14px 30px -18px rgba(20,30,45,.25)}
html.theme-light .cm-home-page .cm-fx .cm-home-search{background:#f3f4f6;box-shadow:none;border-color:rgba(0,0,0,.06)}
html.theme-light .cm-home-page .cm-fx .cm-qf-chip{background:#f3f4f6;border-color:rgba(0,0,0,.05);color:#23262b}

/* ───────── ۲) استوری‌ها: فشرده و هم‌تراز ───────── */
.cm-home-page .cm-ts{margin:16px 0 0}
.cm-home-page .cm-ts-rail{gap:12px;margin-inline:0;padding:4px var(--v2-g) 6px;scroll-padding-inline:var(--v2-g)}
.cm-home-page .cm-ts-item{width:66px}
.cm-home-page .cm-ts-ring{width:62px;height:62px}
.cm-home-page .cm-ts-name{margin-top:7px;max-width:66px;font-size:11px}
.cm-home-page .cm-ts .cm-ts-kind{margin-top:0;font-size:10px;max-width:66px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ───────── ۳) برندها: ریل تمام‌عرض بدون قاب اضافه ───────── */
.cm-home-page .cm-br-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px var(--v2-g) 10px}
.cm-home-page .cm-br5{margin:0}
.cm-home-page .cm-br5-box{background:none;border:0;box-shadow:none;border-radius:0;overflow:visible}
.cm-home-page .cm-br5-box::before,.cm-home-page .cm-br5-box::after{display:none}
.cm-home-page .cm-br5-rail{gap:10px;padding:2px var(--v2-g) 6px;scroll-padding-inline:var(--v2-g);-webkit-mask-image:none;mask-image:none}
.cm-home-page .cm-br5-tile{width:68px;height:68px;border-radius:20px;background:#121315;border:1px solid var(--v2-line);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.cm-home-page .cm-br5-tile::after{display:none}
.cm-home-page .cm-br5-logo{height:42px;margin-top:0}
.cm-home-page .cm-br5-logo img{max-width:44px;max-height:34px}
.cm-home-page .cm-br5-wm{font-size:11px}
.cm-home-page .cm-br5-tile:active{background:rgba(229,72,77,.14);border-color:rgba(229,72,77,.6)}
.cm-home-page .cm-br5-all,.cm-home-page .cm-br5-hint{display:none}
html.theme-light .cm-home-page .cm-br5-tile{background:#fff;border-color:rgba(0,0,0,.08)}

/* ───────── ۴) عنوان بخش‌ها: یک زبان واحد (نوار قرمز «چراغ ترمز») ───────── */
.cm-home-page .cm-lt-head,.cm-home-page .cm-lay-head,.cm-home-page .cm-br-head{margin-bottom:12px}
.cm-home-page .cm-lt-head h2,.cm-home-page .cm-br-head h2,.cm-home-page .cm-lay-head h2{display:flex;align-items:center;gap:10px;margin:0;font-size:20px;line-height:1.35;font-weight:800;letter-spacing:0;color:#f5f5f7}
.cm-home-page .cm-lt-head h2::before,.cm-home-page .cm-br-head h2::before,.cm-home-page .cm-lay-head h2::before{content:"";display:block!important;flex:0 0 auto;width:4px;height:20px;border-radius:3px;background:var(--v2-red);box-shadow:0 0 12px rgba(229,72,77,.7)}
.cm-home-page .cm-lay-head--showrooms{align-items:center}
html.theme-light .cm-home-page .cm-lt-head h2,html.theme-light .cm-home-page .cm-br-head h2,html.theme-light .cm-home-page .cm-lay-head h2{color:#0e0e0e}

/* ───────── ۵) آگهی‌های جدید: کارت «بلیت» با خط‌چین جاده ───────── */
.cm-home-page .cm-lt-sec{margin-top:24px}
.cm-home-page .cm-lt-wrap{margin-inline:calc(var(--v2-g) * -1)}
.cm-home-page .cm-lt-rail{padding:2px var(--v2-g) 10px;scroll-padding-inline:var(--v2-g);scroll-snap-type:x mandatory;gap:12px}
.cm-home-page .cm-lt-rail .cm-lt-card{flex:0 0 clamp(188px,54vw,228px)!important;border-radius:22px!important;background:#101113!important;box-shadow:inset 0 0 0 1px var(--v2-line)!important;scroll-snap-align:start}
.cm-home-page .cm-lt-card .cm-lt-photo{aspect-ratio:1/.86}
.cm-home-page .cm-lt-card .cm-lt-body{padding:12px 14px 14px!important;gap:2px}
.cm-home-page .cm-lt-card .cm-lt-price{margin-top:9px;padding-top:10px;border-top:1.5px dashed rgba(255,255,255,.14);justify-content:space-between;flex-direction:row-reverse}
.cm-home-page .cm-lt-card .cm-lt-price b{font-size:15.5px;font-weight:800;color:#fff}
.cm-home-page .cm-lt-card .cm-lt-price small{font-size:11.5px;color:var(--v2-red)}
.cm-home-page .cm-home-empty-latest{margin-inline:var(--v2-g)}
html.theme-light .cm-home-page .cm-lt-rail .cm-lt-card{background:#fff!important}
html.theme-light .cm-home-page .cm-lt-card .cm-lt-price b{color:#0e0e0e}

/* ───────── ۶) ریتم عمودی بخش‌ها ───────── */
.cm-home-page .cm-hb{margin:6px var(--v2-g) 0;padding:0}
.cm-home-page .cm-lt-promo{margin-top:22px}
.cm-home-page .cm-lay-section--showrooms{margin-top:30px!important}
.cm-home-page .cm-lay-section--news{margin-top:30px}
CM_CSS_EOF

NEWBLOCK="$(mktemp)"
cat > "$NEWBLOCK" <<'CM_JS_EOF'
    const sw = page.querySelector(".cm-home-search-wrap");
    if (sw && !page.querySelector(".cm-qf")) {
      /* CM-FX: جستجو + نوع بدنه در یک پنل واحد («پنل یابنده») */
      const ico = {
        "سدان": '<path d="M3 17V14.5C3 13.5 3.8 12.8 5 12.6L12 11.2L16.5 7.4C17 7 17.6 6.8 18.3 6.8H28C28.8 6.8 29.5 7.1 30 7.7L33.2 11.4L41 12.8C43 13.2 45 14 45 15.4V17"/>',
        "شاسی‌بلند": '<path d="M3 17V13C3 12 3.6 11.3 4.6 11.1L10 10L13 6.8C13.4 6.4 14 6.2 14.6 6.2H33C33.8 6.2 34.5 6.5 35 7.1L37.6 10.6L42 11.4C43.8 11.7 45 12.4 45 13.6V17"/>',
        "هاچ‌بک": '<path d="M3 17V14C3 13 3.8 12.2 4.8 12L11 10.6L15 7.2C15.5 6.8 16.1 6.6 16.8 6.6H30C31 6.6 31.6 7 32.2 7.8L35 11.6L41.6 12.5C43.6 12.8 45 13.8 45 15.4V17"/>',
        "وانت": '<path d="M3 17V14C3 13.2 3.6 12.5 4.4 12.3L10 11L14 7C14.4 6.6 14.9 6.4 15.5 6.4H43.5C44.4 6.4 45 7 45 7.9V17"/><path d="M26 6.4V11.4H45"/>',
        "کوپه": '<path d="M3 17V14.6C3 13.6 3.8 12.9 4.8 12.7L13 11.4L19 7.6C19.6 7.2 20.2 7 21 7H27C28 7 28.8 7.4 29.4 8.1L33 11.6L41.2 12.7C43.4 13 45 13.8 45 15.4V17"/>',
        "مینی‌ون": '<path d="M3 17V10.6C3 9.4 3.7 8.6 4.8 8.4L12 7C12.5 6.9 13 6.8 13.6 6.8H35C36 6.8 36.8 7.2 37.4 8L41 12.4L43 12.9C44.2 13.2 45 14 45 15V17"/>'
      };
      const items = ["سدان", "شاسی‌بلند", "هاچ‌بک", "وانت", "کوپه", "مینی‌ون"];
      const qf = document.createElement("div");
      qf.className = "cm-qf"; qf.setAttribute("role", "group"); qf.setAttribute("aria-label", "میانبر نوع بدنه");
      qf.innerHTML = items.map((v) => `<button type="button" class="cm-qf-chip" data-qf="${v}"><svg class="cm-qf-ic" viewBox="0 0 48 24" aria-hidden="true">${ico[v] || ""}<circle cx="12" cy="17.5" r="3"/><circle cx="36" cy="17.5" r="3"/></svg><span>${v}</span></button>`).join("");
      const fx = document.createElement("section");
      fx.className = "cm-fx"; fx.setAttribute("aria-label", "یافتن خودرو");
      sw.before(fx); fx.append(sw, qf);
      qf.addEventListener("click", (e) => {
        const b = e.target.closest("[data-qf]"); if (!b) return;
        if (typeof navigateTo !== "function") return;
        navigateTo({ page: "listings", brand: "all" }, {
          menuOpen: false, selectedBrand: null, sort: "newest", filterOpenKey: null, sortOpen: false, toolFiltersOpen: false, visibleCount: 12, listingsLoadingMore: false,
          filters: { model: null, city: null, color: null, condition: null, year: null, priceMin: null, priceMax: null, transmission: null, bodyStyle: b.getAttribute("data-qf") }
        });
      });
    }
    /* عنوان بخش «برندها» تا ریل برندها هم مثل بقیه‌ی بخش‌ها سلسله‌مراتب داشته باشد */
    const br = page.querySelector(".cm-br5");
    if (br && !page.querySelector(".cm-br-head")) {
      const h = document.createElement("div");
      h.className = "cm-br-head";
      h.innerHTML = '<h2>برندها</h2><button type="button" class="cm-lt-all" data-action="openBrandSheet">همه برندها <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>';
      br.before(h);
    }
  })();
CM_JS_EOF

python3 - "$JS" "$HTML" "$NEWBLOCK" "$TS" <<'CM_PY_EOF'
import sys,re
js_p,html_p,blk_p,ts=sys.argv[1:5]
js=open(js_p,encoding='utf-8').read(); blk=open(blk_p,encoding='utf-8').read()
start='    const sw = page.querySelector(".cm-home-search-wrap");\n    if (sw && !page.querySelector(".cm-qf")) {'
end='  /* CM-HOME-CLEAN:END */'
if 'CM-FX' in js:
    print('JS already patched, skipping')
else:
    a=js.find(start); b=js.find(end)
    if a<0 or b<a: sys.exit('JS anchor not found — file differs from expected version, nothing changed')
    open(js_p,'w',encoding='utf-8').write(js[:a]+blk+js[b:])
    print('JS patched')
h=open(html_p,encoding='utf-8').read()
if 'home-v2.css' not in h:
    m=re.search(r'[ \t]*<link rel="stylesheet" href="home-clean\.css[^>]*>',h)
    if not m: sys.exit('home-clean.css link not found in index.html')
    h=h[:m.end()]+'\n      <link rel="stylesheet" href="home-v2.css?v='+ts+'" />'+h[m.end():]
else:
    h=re.sub(r'home-v2\.css\?v=[^"]*','home-v2.css?v='+ts,h)
h=re.sub(r'(js/35-home-dashboard\.js\?v=)([^"]*?)(-hv2\w*)?"',lambda m:m.group(1)+m.group(2)+'-hv2'+ts.replace('-','')+'"',h)
open(html_p,'w',encoding='utf-8').write(h); print('index.html patched')
CM_PY_EOF
rm -f "$NEWBLOCK"
echo "done. backup: $B  — hard-refresh the browser (and clear service-worker cache if any)."
