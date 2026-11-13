#!/bin/bash
# CarMaa — تم کل سایت: مشکی + قرمز دارک (الهام‌گرفته از عکس ماشین قرمز)
# استفاده (داخل پوشه‌ی پروژه، کنار index.html):
#   bash carma-theme-redblack.sh              اعمال تم + بیلد مجدد داکر
#   bash carma-theme-redblack.sh --no-deploy  اعمال تم بدون بیلد داکر
#   bash carma-theme-redblack.sh --undo       برگردوندن همه‌چیز از بکاپ
# قبل از هر تغییر از همه‌ی فایل‌ها داخل پوشه‌ی _bak_redblack_<زمان> بکاپ گرفته می‌شه.
set -e
DEPLOY=1; UNDO=0; R="$PWD"
for a in "$@"; do case "$a" in --no-deploy) DEPLOY=0;; --undo) UNDO=1;; *) R="$a";; esac; done
[ -f "$R/index.html" ] || { [ -f "$R/carmaa/index.html" ] && R="$R/carmaa"; }
[ -f "$R/index.html" ] || { echo "❌ index.html پیدا نشد — اسکریپت رو داخل پوشه‌ی پروژه اجرا کن"; exit 1; }
command -v python3 >/dev/null || { echo "❌ python3 نصب نیست"; exit 1; }

set +e
UNDO=$UNDO python3 - "$R" <<'PY'
import os, re, sys, shutil, time, glob
R = sys.argv[1]; UNDO = os.environ.get("UNDO") == "1"
P = lambda *a: os.path.join(R, *a)
TS = time.strftime("%Y%m%d-%H%M%S"); TAG = "rb1"
MARK = P(".redblack-applied"); THEME = "theme-redblack.css"

if UNDO:
    dirs = sorted(glob.glob(P("_bak_redblack_*")))
    if not dirs: sys.exit("❌ بکاپی پیدا نشد")
    d = dirs[0] if os.path.isfile(MARK) is False else dirs[0]   # قدیمی‌ترین بکاپ = وضعیت اصلی
    n = 0
    for root, _, files in os.walk(d):
        for f in files:
            src = os.path.join(root, f); rel = os.path.relpath(src, d); shutil.copy2(src, P(rel)); n += 1
    for f in (THEME, ".redblack-applied"):
        if os.path.exists(P(f)): os.remove(P(f))
    print("✅ برگشت داده شد (%d فایل) از %s" % (n, os.path.basename(d))); sys.exit(0)

def neut_rgb(r, g, b):
    if max(r, g, b) > 100 or r < 3: return None
    v = r / 1.14                      # عکسِ تبدیل قدیمی: r=1.14v, g=.84v, b=.86v
    if not (r > g + 1 and abs(g - .84 * v) <= 2 and abs(b - .86 * v) <= 2): return None
    n = round(v * .55)
    return (n, n, n)
def neut_hex(m):
    h = m.group(1); t = neut_rgb(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return m.group(0) if t is None else "#%02x%02x%02x" % t
def neut_rgba(m):
    t = neut_rgb(int(m.group(2)), int(m.group(4)), int(m.group(6)))
    return m.group(0) if t is None else "%s%d%s%d%s%d" % (m.group(1), t[0], m.group(3), t[1], m.group(5), t[2])

def tint_rgb(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == 0 or mx > 72 or mx - mn > 22 or (r > g + 4 and r > b + 4): return None
    v = (r + g + b) / 3.0
    n = round(v * .55)
    return (n, n, n)

HEX = re.compile(r'#([0-9a-fA-F]{6})(?![0-9a-zA-Z_-])')
def hex_sub(m):
    h = m.group(1); r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    t = tint_rgb(r, g, b)
    return m.group(0) if t is None else "#%02x%02x%02x" % t
RGBA = re.compile(r'(rgba?\(\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(?!\d)')
def rgba_sub(m):
    r, g, b = int(m.group(2)), int(m.group(4)), int(m.group(6))
    t = tint_rgb(r, g, b)
    return m.group(0) if t is None else "%s%d%s%d%s%d" % (m.group(1), t[0], m.group(3), t[1], m.group(5), t[2])

RED, RED_LT = "#e5232f", "#ff4d57"
TXT_PROP = r'(?<![\w-])(?:color|stroke|fill|caret-color|outline-color|border-color|border-top-color|border-bottom-color|text-decoration-color)'
BLOCK = re.compile(r'\{[^{}]*\}')
LIME_BG = re.compile(r'background(?:-color)?\s*:[^;}]*#c6ff00|background(?:-color)?\s*:[^;}]*#f08a24', re.I)
DARKTXT = re.compile(r'(?<![\w-])(color|stroke|fill)(\s*:\s*)(#[0-9a-fA-F]{6}|#000|#111)(?![0-9a-zA-Z])')
def darkfix(m):
    h = m.group(3)[1:]
    h = h * 2 if len(h) == 3 else h
    return (m.group(1) + m.group(2) + "#fff") if max(int(h[i:i+2], 16) for i in (0, 2, 4)) <= 0x2a else m.group(0)
def block_fix(m):
    b = m.group(0)
    return DARKTXT.sub(darkfix, b) if LIME_BG.search(b) else b

def accent(s):
    s = BLOCK.sub(block_fix, s)
    s = s.replace("--tr-ink:#10130a", "--tr-ink:#fff")
    for old in ("c6ff00", "f08a24"):
        s = re.sub(r'(' + TXT_PROP + r'\s*:\s*)#' + old, lambda m: m.group(1) + RED_LT, s, flags=re.I)
        s = re.sub('#' + old, RED, s, flags=re.I)
    s = re.sub(r'#f4ffb0', '#ff9ea3', s, flags=re.I); s = re.sub(r'#7bd600', '#9e0f19', s, flags=re.I)
    s = re.sub(r'rgba\(\s*198\s*,\s*255\s*,\s*0\s*,', 'rgba(229,35,47,', s)
    s = re.sub(r'rgba\(\s*240\s*,\s*138\s*,\s*36\s*,', 'rgba(229,35,47,', s)
    return s

def transform(s):
    s = accent(s)
    s = HEX.sub(hex_sub, s)
    s = RGBA.sub(rgba_sub, s)
    return s

THEME_CSS = r'''/* CarMaa — تم مشکی + قرمز دارک */
:root{--cm-red:#e5232f;--cm-red-2:#ff4d57;--cm-red-deep:#8f0b16;--cm-accent:#e5232f}
html{accent-color:#e5232f}
::selection{background:rgba(229,35,47,.45);color:#fff}
/* پس‌زمینه‌ی صفحه: مشکی مایل به قرمز؛ کارت‌ها و باکس‌ها مشکی خنثی می‌مونن */
html:not(.theme-light):not(#x),html:not(.theme-light):not(#x) body:not(#y){background-color:#0b0506!important;--bg:#0b0506;--bg-2:#0b0506}
html:not(.theme-light):not(#x) body:not(#y){background-image:radial-gradient(130% 50% at 50% -8%,rgba(229,35,47,.24),transparent 64%),radial-gradient(90% 40% at 50% 112%,rgba(229,35,47,.12),transparent 70%)!important;background-repeat:no-repeat!important;background-attachment:fixed!important}
html:not(.theme-light):not(#x) body:not(#y) #appFrame,html:not(.theme-light):not(#x) body:not(#y) #appViewport,html:not(.theme-light):not(#x) body:not(#y) #pageContent,html:not(.theme-light):not(#x) body:not(#y) .cm-home-page,html:not(.theme-light):not(#x) body:not(#y) .cm-lh{background:transparent!important}
/* متن/آیکن روی سطوح قرمز: سفید */
html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock="sell"],
html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock="sell"].is-active{color:#fff!important}
html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock="sell"] svg,
html body:not(#x) #bottomDock#bottomDock.bottom-dock .dock-item[data-dock="sell"].is-active svg{stroke:#fff!important;color:#fff!important}
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-inner .detail-cta-price-value,
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-inner .detail-cta-price-unit,
html body [data-page="vehicle"].vehicle-detail-page .detail-cta-inner .detail-cta-phone{color:#fff!important}
html body #sellCityPicker .sell-trim-option.is-selected b::after{border-color:#fff!important}
.sell-center-circle.is-confirmed .leaflet-app-pin svg{color:#fff!important}
.cm-actions button[type=submit],.cm-cs-send,.cm-cs-meta em{color:#fff!important}
/* آیکن‌های رستری سبز (اپ‌آیکن در تور معرفی) → قرمز */
#mrTour .tr-appicon{filter:hue-rotate(-78deg) saturate(1.1)}
/* کارت‌های داشبورد آگهی‌ها: مشکی با لبه‌ی ظریف */
.cm-home-page .cm-lt-rail .cm-lt-card{box-shadow:inset 0 0 0 .5px rgba(255,255,255,.08)!important}
'''

# ---------- جمع‌آوری فایل‌ها ----------
targets = []
for pat in ("*.css", "js/*.js", "index.html", "index_offline.html", "manifest.json"):
    for f in glob.glob(P(pat)):
        rel = os.path.relpath(f, R)
        if ".bak" in rel or rel.startswith(("admin", THEME)): continue
        targets.append(rel)
targets = sorted(set(targets))

rd = lambda f: open(P(f), encoding="utf-8").read()
def wr(f, s):
    with open(P(f), "w", encoding="utf-8", newline="") as h: h.write(s)

bdir = P("_bak_redblack_" + TS)
def backup(rel):
    dst = os.path.join(bdir, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst): shutil.copy2(P(rel), dst)

changed = []
if not os.path.isfile(MARK):
    plan = {}
    for rel in targets:
        try: s = rd(rel)
        except Exception: continue
        s2 = transform(s)
        if s2 != s: plan[rel] = s2
    for rel, s2 in plan.items():
        backup(rel); wr(rel, s2); changed.append(rel)
    open(MARK, "w").write("v2")
elif open(MARK).read().strip() != "v2":
    # سایت قبلاً با نسخه‌ی قدیمی (سطوح مایل به قرمز) تم شده؛ سطوح رو مشکی خنثی کن
    for rel in targets:
        try: s = rd(rel)
        except Exception: continue
        s2 = RGBA.sub(neut_rgba, HEX.sub(neut_hex, s))
        if s2 != s: backup(rel); wr(rel, s2); changed.append(rel)
    open(MARK, "w").write("v2")
else:
    print("ℹ️  رنگ‌ها قبلاً جایگزین شدن؛ فقط فایل تم و نسخه‌ها به‌روز می‌شن (برای شروع از اول: --undo)")

# ---------- فایل تم نهایی + لینک + نسخه‌ی کش ----------
old = open(P(THEME), encoding="utf-8").read() if os.path.isfile(P(THEME)) else None
if old != THEME_CSS:
    open(P(THEME), "w", encoding="utf-8", newline="").write(THEME_CSS); changed.append(THEME)

REF = re.compile(r'((?:href|src)=")((?!https?:|//|data:)[^"?#]+\.(?:css|js))(\?v=([^"]*))?(")')
def bump(s):
    def f(m):
        path = m.group(2)
        if not os.path.isfile(P(path)) or path == THEME: return m.group(0)
        v = m.group(4) or ""
        nv = v if re.search(r'(^|-)%s$' % TAG, v) else ((v + "-" if v else "") + TAG)
        return m.group(1) + path + "?v=" + nv + m.group(5)
    s = REF.sub(f, s)
    link = '<link rel="stylesheet" href="%s?v=%s" />' % (THEME, TAG)
    if THEME not in s: s = s.replace("</head>", "    " + link + "\n  </head>", 1)
    return s
for f in ("index.html", "index_offline.html"):
    if os.path.isfile(P(f)):
        s = rd(f); s2 = bump(s)
        if s2 != s:
            if os.path.isdir(bdir) or True: backup(f)
            wr(f, s2)
            if f not in changed: changed.append(f)

print("✅ تغییر کرد: %d فایل (بکاپ در %s)" % (len(changed), os.path.basename(bdir)) if changed else "ℹ️  تغییری لازم نبود")
sys.exit(0 if changed else 3)
PY
RC=$?
set -e
[ $RC -eq 3 ] && { echo "ℹ️  از قبل اعمال شده."; exit 0; }
[ $RC -ne 0 ] && exit $RC
[ "$UNDO" = "1" ] && DEPLOY_AFTER=1 || DEPLOY_AFTER=1

if [ "$DEPLOY" = "1" ] && [ -f "$R/docker-compose.prod.yml" ] && command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  echo ">> بیلد مجدد سرویس وب (فایل‌های استاتیک داخل ایمیج هستن)..."
  cd "$R"
  ENVF=""; [ -f backend/.env ] && ENVF="--env-file backend/.env"
  docker compose -f docker-compose.prod.yml $ENVF up -d --build --no-deps web && echo "✅ سایت آپدیت شد." \
    || echo "⚠️ بیلد داکر خطا داد؛ فایل‌ها عوض شدن ولی دستی اجرا کن: bash deploy.sh"
else
  echo "ℹ️  بیلد داکر انجام نشد. اگه سایت از داخل داکر سرو می‌شه اجرا کن: bash deploy.sh  (یا فقط کش مرورگر رو رفرش کن)"
fi
