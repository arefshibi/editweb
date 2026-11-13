#!/bin/bash
# CarMaa — بازطراحی مینیمال کارت‌های «جدیدترین آگهی‌ها» صفحه اصلی (سبک iOS)
# استفاده: داخل پوشه‌ی پروژه (کنار index.html):   bash carma-lt-cards.sh
#   بدون بیلد مجدد داکر:  bash carma-lt-cards.sh --no-deploy
# چندبار اجرا امنه و قبل از تغییر بکاپ (.bak-lt3-…) می‌گیره.
set -e
DEPLOY=1; R="$PWD"
for a in "$@"; do case "$a" in --no-deploy) DEPLOY=0;; *) R="$a";; esac; done
[ -f "$R/index.html" ] || { [ -f "$R/carmaa/index.html" ] && R="$R/carmaa"; }
for f in index.html latest-rail.css js/35-home-dashboard.js; do
  [ -f "$R/$f" ] || { echo "❌ $f پیدا نشد — اسکریپت رو داخل پوشه‌ی پروژه اجرا کن"; exit 1; }
done
command -v python3 >/dev/null || { echo "❌ python3 نصب نیست"; exit 1; }

set +e
python3 - "$R" <<'PY'
import os, re, sys, shutil, time
R = sys.argv[1]
P = lambda *a: os.path.join(R, *a)
TS = time.strftime("%Y%m%d-%H%M%S"); TAG = "lt3"

CSS = r'''/* CM-LT2:START — کارت‌های مینیمال سبک iOS */
.cm-home-page .cm-lt-head{margin:0 0 12px}
.cm-home-page .cm-lt-head h2{font-size:22px;font-weight:700;letter-spacing:0;color:#f5f5f7}
.cm-home-page .cm-lt-head h2::before{display:none}
.cm-home-page .cm-lt-all{font-size:14px;font-weight:500;color:#f08a24;gap:2px}
.cm-home-page .cm-lt-all svg{width:15px;height:15px;stroke:currentColor;stroke-width:2.2}
.cm-home-page .cm-lt-rail{gap:12px;padding:2px 2px 8px;align-items:flex-start}
.cm-home-page .cm-lt-rail .cm-lt-card{flex:0 0 clamp(200px,58vw,236px)!important;width:auto;padding:0!important;background:#1c1c1e!important;background-image:none!important;border:0!important;border-radius:24px!important;overflow:hidden!important;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.09)!important;color:#f5f5f7;transform:none;transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.cm-home-page .cm-lt-rail .cm-lt-card:active{transform:scale(.975)}
.cm-home-page .cm-lt-card .cm-lt-photo{aspect-ratio:4/3;border-radius:0!important;background:#2c2c2e;overflow:hidden;box-shadow:none;clip-path:none}
.cm-home-page .cm-lt-card .cm-lt-photo::after,.cm-home-page .cm-lt-card .cm-lt-photo::before{display:none!important}
.cm-lt-photo>img{transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.cm-home-page .cm-lt-card .cm-lt-heart{top:10px;left:10px;width:30px;height:30px;border-radius:50%;background:rgba(28,28,30,.42);-webkit-backdrop-filter:blur(14px) saturate(1.6);backdrop-filter:blur(14px) saturate(1.6)}
.cm-lt-heart svg{width:16px;height:16px;stroke-width:2;filter:none}
.cm-lt-photo>.cm-lt-badge.cm-lt-badge{position:absolute;inset:10px 10px auto auto;width:auto;height:24px;z-index:2;display:inline-flex;align-items:center;padding:0 10px;border-radius:12px;font-size:11.5px;font-weight:600;color:#fff;background:rgba(240,138,36,.9)}
.cm-home-page .cm-lt-card .cm-lt-body{padding:12px 14px 14px!important;margin:0!important;gap:3px;background:transparent!important;text-align:right}
.cm-home-page .cm-lt-card .cm-lt-title{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:#f5f5f7}
.cm-home-page .cm-lt-card .cm-lt-sub{margin:0;font-size:13px;line-height:1.5;min-height:1.5em;color:rgba(235,235,245,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-home-page .cm-lt-card .cm-lt-price{margin-top:6px;gap:4px;font-size:15px;font-weight:600;color:#f5f5f7}
.cm-lt-price b{font-weight:600}
.cm-lt-price small{font-size:12.5px;font-weight:500;color:rgba(235,235,245,.6)}
.cm-lt-nav{top:70px;width:34px;height:34px;background:rgba(44,44,46,.78);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 2px 10px rgba(0,0,0,.35)}
@media (hover:hover){.cm-lt-card:hover .cm-lt-photo>img{transform:scale(1.04)}}
@media (min-width:768px){.cm-home-page .cm-lt-rail .cm-lt-card{flex-basis:248px!important}.cm-home-page .cm-lt-rail{gap:16px}.cm-lt-nav{top:90px}}
@media (prefers-reduced-motion:reduce){.cm-lt-card,.cm-lt-photo>img{transition:none}.cm-lt-card:hover .cm-lt-photo>img{transform:none}}
/* CM-LT2:END */'''

rd = lambda f: open(P(f), encoding="utf-8").read()
def wr(f, s):
    shutil.copy2(P(f), P(f) + ".bak-lt3-" + TS)
    with open(P(f), "w", encoding="utf-8", newline="") as h: h.write(s)

js = rd("js/35-home-dashboard.js")
if "cm-lt-sub" not in js:
    m = list(re.finditer(r'return `<article class="cm-lt-card".*?</article>`;', js, re.S))
    if len(m) != 1:
        sys.exit("❌ js/35-home-dashboard.js: قالب cmLtCard دقیقاً یک بار پیدا نشد — چیزی تغییر نکرد")
    NEW = r'''return `<article class="cm-lt-card" data-action="goVehicle" data-id="${esc(l.id)}">
    <div class="cm-lt-photo">${photo}${urgent ? '<span class="cm-lt-badge">فوری</span>' : ""}<button type="button" class="cm-lt-heart${liked ? " is-on" : ""}" data-action="toggleLike" data-id="${esc(l.id)}" aria-label="ذخیره آگهی"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button></div>
    <div class="cm-lt-body">
      <h3 class="cm-lt-title" dir="auto">${esc(title)}</h3>
      <p class="cm-lt-sub">${[city ? esc(city) : "", km != null ? cmLtFa(km.toLocaleString("en-US")) + " کیلومتر" : ""].filter(Boolean).join(" · ")}</p>
      <div class="cm-lt-price">${priceHtml}</div>
    </div>
  </article>`;'''
    js2 = js[:m[0].start()] + NEW + js[m[0].end():]
else:
    js2 = js

css = rd("latest-rail.css")
blk = re.compile(r'/\* CM-LT2:START.*?CM-LT2:END \*/', re.S)
css2 = blk.sub(lambda x: CSS, css) if blk.search(css) else css.rstrip("\n") + "\n\n" + CSS + "\n"

def bump(s):
    s = re.sub(r'(latest-rail\.css\?v=)[^"\'&\s]*', r'\g<1>' + TAG, s)
    def j(m):
        v = m.group(2)
        return m.group(1) + (v if re.search(r'(^|-)%s$' % TAG, v) else v + "-" + TAG)
    return re.sub(r'(35-home-dashboard\.js\?v=)([^"\'&\s]*)', j, s)

changed = []
if js2 != js: wr("js/35-home-dashboard.js", js2); changed.append("js/35-home-dashboard.js")
if css2 != css: wr("latest-rail.css", css2); changed.append("latest-rail.css")
for f in ("index.html", "index_offline.html"):
    if os.path.isfile(P(f)):
        s = rd(f); s2 = bump(s)
        if s2 != s: wr(f, s2); changed.append(f)
print("✅ تغییر کرد: " + (", ".join(changed) if changed else "هیچ‌چیز (از قبل اعمال شده بود)"))
sys.exit(0 if changed else 3)
PY
RC=$?
set -e
[ $RC -eq 3 ] && { echo "ℹ️  از قبل اعمال شده."; exit 0; }
[ $RC -ne 0 ] && exit $RC

if [ "$DEPLOY" = "1" ] && [ -f "$R/docker-compose.prod.yml" ] && command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  echo ">> بیلد مجدد سرویس وب (فایل‌های استاتیک داخل ایمیج هستن)..."
  cd "$R"
  ENVF=""; [ -f backend/.env ] && ENVF="--env-file backend/.env"
  docker compose -f docker-compose.prod.yml $ENVF up -d --build --no-deps web && echo "✅ سایت آپدیت شد." \
    || echo "⚠️ بیلد داکر خطا داد؛ فایل‌ها پچ شدن ولی دستی اجرا کن: bash deploy.sh"
else
  echo "ℹ️  بیلد داکر انجام نشد. اگه سایت از داخل داکر سرو می‌شه اجرا کن: bash deploy.sh  (یا فقط کش مرورگر رو رفرش کن)"
fi
