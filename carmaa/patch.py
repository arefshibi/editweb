#!/usr/bin/env python3
# CarMaa — بازطراحی کارت «عنوان و قیمت» صفحه‌ی آگهی + دایره‌ی پروفایل فروشنده با برچسب «فروشنده»
import os, re, sys, time, shutil

R = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
if not os.path.isfile(os.path.join(R, "index.html")) and os.path.isfile(os.path.join(R, "carmaa", "index.html")):
    R = os.path.join(R, "carmaa")
P = lambda *a: os.path.join(R, *a)
JS = "js/13-pages-home-listings-vehicle.js"
CSS = "vehicle-detail-v2.css"
for f in ("index.html", JS, CSS):
    if not os.path.isfile(P(f)):
        sys.exit("❌ %s پیدا نشد — اسکریپت رو داخل پوشه‌ی پروژه (کنار index.html) اجرا کن" % f)
rd = lambda f: open(P(f), encoding="utf-8").read()
def wr(f, s):
    with open(P(f), "w", encoding="utf-8", newline="") as fh:
        fh.write(s)
TS = time.strftime("%Y%m%d-%H%M%S")
VER = "pc2-" + TS
bak = lambda f: shutil.copy2(P(f), P(f) + ".bak-pc2-" + TS)

# ───────────── 1) جاوااسکریپت: دایره‌ی فروشنده (عکس کاربر یا نمایشگاه + برچسب «فروشنده») ─────────────
NEW_JS = r"""function renderSellerAvatarMarkup(listing) {
    const s = listingSeller(listing);
    const isDealer = s.type === "dealer";
    const kind = isDealer ? "dealer" : "personal";
    // عکس پروفایل: نمایشگاه (اگر آگهی داخل نمایشگاه ثبت شده) یا حساب شخصی کاربر؛ در حالت سرور از پروفایل عمومی
    let avatarUrl = sellerAvatarFor(kind, s.id);
    if (!avatarUrl && s.id) { try { const pr = sellerProfileById(s.id, kind); avatarUrl = (pr && (pr.logo || pr.avatar)) || ""; } catch (_) {} }
    const name = String(s.name || (isDealer ? "نمایشگاه" : "فروشنده")).trim();
    const fallback = isDealer
      ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5 5.6 5h12.8L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12.6V20h13v-7.4M10 20v-4.5h4V20"/></svg>'
      : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.6-3.7 3.4-5.6 7.2-5.6s6.6 1.9 7.2 5.6"/></svg>';
    const circle = avatarUrl ? `<img src="${escHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" />` : fallback;
    const inner = `<span class="cm-sa-circle">${circle}</span><span class="cm-sa-cap">فروشنده</span>`;
    const cls = `cm-seller-ava ${isDealer ? "is-dealer" : "is-personal"}`;
    if (!s.id) return `<span class="${cls}" aria-hidden="true">${inner}</span>`;
    const label = isDealer ? `مشاهده آگهی‌های ${name}` : "مشاهده صفحه فروشنده";
    return `<button type="button" class="${cls}" data-action="goSeller"${isDealer ? "" : ' data-seller-kind="personal"'} data-seller-id="${escHtml(s.id)}" aria-label="${escHtml(label)}">${inner}</button>`;
  }
"""

# ───────────── 2) CSS: چیدمان تازه‌ی کارت ─────────────
CSS_START = "/* >>> CM-PRICE-CARD-V2 START */"
CSS_END = "/* <<< CM-PRICE-CARD-V2 END */"
NEW_CSS = CSS_START + r"""
/* کارت عنوان و قیمت — چیدمان مرتب: [پروفایل فروشنده | عنوان + شهر] ← خط ← [برچسب قیمت | وضعیت] ← قیمت ← مشخصات */
html body .vehicle-demo-layout .price-card{padding:18px 16px 16px;border-radius:26px}

/* ردیف بالا (آگهی ویژه) فقط وقتی چیزی دارد جا می‌گیرد */
html body .vehicle-demo-layout .price-card .listing-topline{display:flex;justify-content:flex-start;margin:0 0 12px}
html body .vehicle-demo-layout .price-card .listing-topline:not(:has(> :not([hidden]))){display:none}
html body .vehicle-demo-layout .price-card .listing-topline .tag.featured{font-size:11.5px;padding:5px 11px;border-radius:999px;gap:5px}

/* سربرگ: دایره‌ی فروشنده سمت راست، عنوان و شهر کنار آن */
html body .vehicle-demo-layout .price-card .price-heading.has-seller-ava{
  position:static;display:grid;grid-template-columns:64px minmax(0,1fr);
  grid-template-areas:"ava title" "ava sub";column-gap:14px;row-gap:6px;align-items:center;
  padding:0;margin:0;min-height:0}
html body .vehicle-demo-layout .price-card .price-heading.has-seller-ava .cm-seller-ava{grid-area:ava}
html body .vehicle-demo-layout .price-card .price-heading.has-seller-ava h1{grid-area:title;align-self:end;margin:0;
  font-size:20px;line-height:1.5;font-weight:800;text-align:right;overflow-wrap:anywhere}
html body .vehicle-demo-layout .price-card .price-heading.has-seller-ava .ad-title-line{grid-area:title}
html body .vehicle-demo-layout .price-card .price-heading.has-seller-ava .heading-sub{grid-area:sub;align-self:start;margin:0;
  font-size:11.5px;gap:4px 7px;flex-wrap:wrap;text-align:right}
html body .vehicle-demo-layout .price-card .price-heading .heading-sub .icon{width:14px;height:14px;flex:none}

/* دایره‌ی پروفایل + «فروشنده» زیرش */
html body .vehicle-demo-layout .cm-seller-ava{
  position:static;inset:auto;width:64px;height:auto;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;
  display:flex;flex-direction:column;align-items:center;gap:6px;color:inherit;font:inherit;line-height:1;overflow:visible;
  cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:center;transition:none}
html body .vehicle-demo-layout span.cm-seller-ava{cursor:default}
html body .vehicle-demo-layout .cm-seller-ava .cm-sa-circle{
  width:60px;height:60px;box-sizing:border-box;border-radius:50%;overflow:hidden;display:grid;place-items:center;
  background:linear-gradient(150deg,#2b2c31,#17181b);color:#c9cbd2;
  border:1.5px solid rgba(255,255,255,.2);box-shadow:0 0 0 3px rgba(255,255,255,.045),0 8px 16px rgba(0,0,0,.38);
  transition:transform .14s ease}
html body .vehicle-demo-layout button.cm-seller-ava:active .cm-sa-circle{transform:scale(.93)}
html body .vehicle-demo-layout .cm-seller-ava .cm-sa-circle img{width:100%;height:100%;object-fit:cover;display:block}
html body .vehicle-demo-layout .cm-seller-ava .cm-sa-cap{font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
html.theme-light body .vehicle-demo-layout .cm-seller-ava .cm-sa-circle{
  background:linear-gradient(150deg,#f4f5f7,#e6e8ec);color:#5b5e67;border-color:rgba(0,0,0,.14);
  box-shadow:0 0 0 3px rgba(0,0,0,.035),0 8px 16px rgba(20,24,35,.12)}

/* بخش قیمت: خط جداکننده، بالا برچسب و وضعیت، پایین عدد */
html body .vehicle-demo-layout .price-card .price-label-row{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin:16px 0 0;padding-top:14px;border-top:1px solid var(--line)}
html body .vehicle-demo-layout .price-card .price-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--text-2);min-width:0}
html body .vehicle-demo-layout .price-card .price-kicker .icon{width:14px;height:14px;flex:none}
html body .vehicle-demo-layout .price-card .negotiable{
  display:inline-flex;align-items:center;gap:6px;flex:none;white-space:nowrap;
  padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;
  border:1px solid var(--line-strong);background:rgba(255,255,255,.04)}
html.theme-light body .vehicle-demo-layout .price-card .negotiable{background:rgba(0,0,0,.035)}
html body .vehicle-demo-layout .price-card .price-line{
  display:flex;flex-wrap:wrap;align-items:baseline;justify-content:flex-start;gap:2px 10px;margin:10px 0 0;padding:0}
html body .vehicle-demo-layout .price-card .price-number{font-size:clamp(38px,11.5vw,52px);line-height:1.1;font-weight:900;letter-spacing:-1px}
html body .vehicle-demo-layout .price-card .price-unit,
html.theme-light body .vehicle-demo-layout .price-card .price-unit{font-size:clamp(16px,4.6vw,20px);font-weight:800;line-height:1.2}
html body .vehicle-demo-layout .price-card .price-hint{margin-top:8px;font-size:11.5px;line-height:1.9;color:var(--muted)}
html body .vehicle-demo-layout .price-card .thin-rule{margin:14px 0}
@media (min-width:1024px){html body .vehicle-demo-layout .price-card .price-number{font-size:clamp(44px,3.8vw,54px)}}
""" + CSS_END + "\n"

# ───────────── اعمال ─────────────
changed = []

# JS
s = rd(JS)
if "cm-sa-circle" in s:
    print("• JS از قبل پچ شده")
else:
    s2, n = re.subn(r"function renderSellerAvatarMarkup\(listing\) \{.*?\n  \}\n", lambda m: NEW_JS, s, count=1, flags=re.S)
    if n != 1:
        sys.exit("❌ تابع renderSellerAvatarMarkup داخل %s پیدا نشد" % JS)
    bak(JS); wr(JS, s2); changed.append(JS)

# CSS
c = rd(CSS)
if CSS_START in c:
    c2 = re.sub(re.escape(CSS_START) + r".*?" + re.escape(CSS_END) + r"\n?", lambda m: NEW_CSS, c, count=1, flags=re.S)
else:
    c2 = re.sub(r"/\* cm-seller-ava — .*?html\.theme-light \.vehicle-demo-layout \.cm-seller-ava\{[^}]*\}\n?", "", c, count=1, flags=re.S)
    c2 = c2.rstrip("\n") + "\n\n" + NEW_CSS
if c2 != c:
    bak(CSS); wr(CSS, c2); changed.append(CSS)

# کش‌شکن در index.html و index_offline.html
for h in ("index.html", "index_offline.html"):
    if not os.path.isfile(P(h)):
        continue
    t = rd(h)
    t2 = re.sub(r'(vehicle-detail-v2\.css\?v=)[^"\']*', lambda m: m.group(1) + VER, t)
    t2 = re.sub(r'(13-pages-home-listings-vehicle\.js\?v=)[^"\']*', lambda m: m.group(1) + VER, t2)
    if t2 != t:
        bak(h); wr(h, t2); changed.append(h)

if changed:
    print("✅ انجام شد:", ", ".join(changed))
    print("   نسخه‌ی پشتیبان کنار هر فایل: .bak-pc2-" + TS)
    print("   حالا صفحه رو رفرش کن (در گوشی یک‌بار Hard refresh).")
else:
    print("• چیزی برای تغییر نبود (قبلاً اعمال شده).")
