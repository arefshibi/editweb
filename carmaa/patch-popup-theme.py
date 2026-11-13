#!/usr/bin/env python3
import os, sys, shutil, re

R = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
if not os.path.isfile(os.path.join(R, "index.html")) and os.path.isfile(os.path.join(R, "carmaa", "index.html")):
    R = os.path.join(R, "carmaa")
P = lambda *a: os.path.join(R, *a)
F = "contact-bar.css"
if not os.path.isfile(P(F)):
    sys.exit("❌ %s پیدا نشد — اسکریپت رو داخل پوشه‌ی پروژه اجرا کن" % F)
css = open(P(F), encoding="utf-8").read()
if "CM-SPLIT-CTA3" in css:
    sys.exit("• از قبل پچ شده")
if "CM-SPLIT-CTA" not in css:
    sys.exit("❌ اول باید patch-split-cta.py اجرا شده باشه")

CSS3 = r'''
/* CM-SPLIT-CTA3 — هم‌رنگ‌سازی پاپ‌آپ‌ها با تم سایت: کارت مات #17181b + سبز فسفری #c6ff00 */
.cm-sheet-backdrop{background:rgba(0,0,0,.62)}
.cm-sheet-card{background:linear-gradient(145deg,#202124 0%,#17181b 52%,#101113 100%) !important;background-color:#17181b !important;border:1px solid rgba(255,255,255,.09);border-bottom:0;color:#e0e3e6;box-shadow:0 -14px 44px rgba(0,0,0,.6)}
.cm-sheet-handle{background:rgba(255,255,255,.2)}
.cm-sheet-title{color:#f1f2f4}
.cm-opt{background:#101113;border-color:rgba(255,255,255,.09)}
.cm-opt:active{background:#1b1c1f}
.cm-opt-ic{background:rgba(198,255,0,.12);color:#c6ff00}
.cm-opt-tx b{color:#f1f2f4}
.cm-opt-tx small,.cm-hint,.cm-cancel{color:rgba(255,255,255,.56)}
.cm-mode,.cm-kind{background:#101113;border-color:rgba(255,255,255,.09);color:rgba(255,255,255,.56)}
.cm-mode.is-on,.cm-kind.is-on{background:rgba(198,255,0,.10);border-color:#c6ff00;color:#fff}
.cm-mode.is-on svg{color:#c6ff00}
.cm-field{background:#101113;border-color:rgba(255,255,255,.09)}
.cm-field:focus-within{border-color:rgba(198,255,0,.6)}
.cm-field>span{color:rgba(255,255,255,.56)}
.cm-field>span i{color:#c6ff00}
.cm-field input,.cm-field textarea{color:#f1f2f4}
.cm-field input::placeholder,.cm-field textarea::placeholder{color:rgba(255,255,255,.28)}
.cm-actions button{background:#101113;border-color:rgba(255,255,255,.12);color:#e0e3e6}
.cm-actions button[type=submit]{background:#c6ff00;border-color:#c6ff00;color:#08090b}
.cm-offer-body .mr-inline-offer-result{padding:14px;border-radius:16px;background:#101113;border:1px solid rgba(198,255,0,.28)}
.cm-offer-body .mr-inline-offer-result strong{font-size:15px;color:#f1f2f4}
.cm-offer-body .mr-inline-offer-result p{font-size:12.5px;color:rgba(255,255,255,.56)}
.cm-offer-body .mr-inline-offer-result-icon{background:rgba(198,255,0,.14);color:#c6ff00}
'''
shutil.copyfile(P(F), P(F) + ".bak-theme")
open(P(F), "w", encoding="utf-8").write(css.rstrip("\n") + "\n" + CSS3)
for n in ("index.html", "index_offline.html"):
    if os.path.isfile(P(n)):
        t = open(P(n), encoding="utf-8").read()
        t = re.sub(r"contact-bar\.css\?v=[^\"']+", "contact-bar.css?v=10-theme", t)
        open(P(n), "w", encoding="utf-8").write(t)
print("✔ contact-bar.css\nتمام شد. Hard Refresh کن. بکاپ: contact-bar.css.bak-theme")
