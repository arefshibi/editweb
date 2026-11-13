# release-report-2026-11-08.md

**منتشر نکن** — بلاکرهای ناموفق: S17, H9

| # | مورد | وضعیت | شاهد | کار لازم |
|---|---|---|---|---|
| S1 | بدون رمز در کد | ✅ | docs/security/secret-scan.md | مشکوکها را بازبینی کن |
| S2 | .env در gitignore | ✅ | .gitignore + .dockerignore (sec.sh) | — |
| S3 | رمز در فرانتاند نیست | ✅ | secret-scan.md؛ فرانت فقط /api/v1 را صدا میزند | — |
| S4 | کلید جدا برای dev/prod | ❌ | تأیید نشده (سرور) | NODE_ENV=development ؛ کلیدهای prod فقط روی سرور |
| S5 | کلیدها least-privilege/سقف هزینه | ❌ | در پنل ارائهدهندگان (ملیپیامک/Anthropic/HF) | دستی |
| S6 | فراخوانی کلیدها در بکاند | ✅ | backend/src/services/{sms,payments,news-ingest}.js | — |
| S7 | gitleaks | ✅ | اسکن داخلی secret-scan.md (پوشه git ندارد) | gitleaks روی ریپو |
| S8 | کلید لوگرفته چرخیده | ❌ | به نتیجهی بررسی افشا در sec.sh بستگی دارد | --rotate-secrets |
| S9 | S10 رمز در چت / password manager | ❌ | غیرقابل بررسی خودکار | دستی |
| S11 | هش رمز | ➖ | ورود فقط با OTP؛ ستون password در users نیست | — |
| S12 | سیاست رمز | ➖ | بدون رمز عبور | — |
| S13 | توکنهای تصادفی | ✅ | crypto.randomBytes/randomInt (util.js, auth.js) | — |
| S14 | HTTPS + HSTS | ✅ | Caddy + helmet max-age=15552000 (sec.sh) | — |
| S15 | کوئری پارامتری | ✅ | همهی routeها $n؛ interpolationها فقط ستونهای whitelist | — |
| S16 | اعتبارسنجی zod/allowlist | ✅ | listings.js editable map + zod strict() | — |
| S17 | debug خاموش/کاربر DB محدود | ❌ | NODE_ENV=development, PAYMENT_SANDBOX=true, کاربر carmaa_app=فعال | NODE_ENV=production و sandbox=false |
| A1 | بدون enumeration | ✅ | otp/request همیشه 202 عمومی (auth.js) | — |
| A2 | Rate limit | ✅ | otp-ip 10/15m, verify-ip 30/15m, verify-phone 10/h, cooldown 5/h | — |
| A3 | Lockout | ✅ | ۵ تلاش اشتباه ⇒ OTP مصرف میشود + محدودیت ساعتی (auth.js) | — |
| A4 | breached password | ➖ | بدون رمز عبور | — |
| A5 | لاگ شکست ورود | ✅ | events otp_verify_failed/login_success/access_denied (sec.sh) | — |
| A6 | کوکی | ✅ | HttpOnly+Secure+SameSite=Strict؛ پیشوند __Host-: فعال | --host-cookie (sec.sh) |
| A7 | نشست تصادفی/بدون localStorage | ✅ | توکن ۳۲ بایت، digest در DB؛ فرانت توکن ذخیره نمیکند | — |
| A8 | چرخش نشست | ✅ | هر ورود نشست جدید میسازد | — |
| A9 | Idle/Absolute + re-auth | ✅ | sec.sh (idle/absolute)؛ حذف حساب نشست ≤۱۵ دقیقه میخواهد | — |
| A10 | Logout سمت سرور | ✅ | POST /auth/logout revoked_at + clearCookie | — |
| A11 | Logout POST + CSRF + no-store | ✅ | csrfOriginGuard + Cache-Control no-store | — |
| A12 | خروج از همهی دستگاهها | ✅ | POST /auth/logout-all + حذف حساب | — |
| A13 | Reset token | ➖ | ورود OTP؛ ریست رمز ندارد | — |
| A14 | تأیید ایمیل/re-auth | ➖ | بدون ایمیل؛ re-auth برای حذف حساب | — |
| A15 | 2FA ادمین | ❌ | ADMIN_MFA=off | bash sec-plus.sh --admin-mfa +98... |
| A16 | Authorization/CSRF | ✅ | authRequired + owner_id در همهی routeهای نمونه (listings/payments/messages/account) | — |
| A17 | Social login | ➖ | پیادهسازی نشده | — |
| A-T | ۸ تست auth.md | ❌ | اجرا نشده | دستی روی staging |
| D1 | data-inventory | ✅ | docs/security/data-inventory.md | بازبینی دستی |
| D2 | فیلد بیدلیل | ❌ | نیاز به تصمیم صاحب سایت | data-inventory |
| D4 | کارت/CVV | ✅ | payment_orders فقط authority/ref_id؛ درگاه زرینپال | — |
| D5 | تأیید پرداخت | ✅ | verify با amount+authority؛ transaction FOR UPDATE؛ idempotency | — |
| D6 | TLS داخلی | ➖ | DB/Redis روی شبکهی private کامپوز، بدون port منتشرشده | TLS در صورت جدا شدن میزبان |
| D7 | Encryption at rest | ❌ | رمزنگاری دیسک سرور تأیید نشد؛ TOTP با AES-GCM رمز میشود | LUKS/دیسک رمزشده |
| D8 | فقط فیلد لازم | ✅ | safeUser + ستونهای صریح در SELECTها | — |
| D9 | PII در لاگ | ✅ | pino redact cookie/authorization؛ شماره در لاگ نیست | — |
| D10 | حذف خودکار | ✅ | sweep در server.js + سقف لاگ داکر | — |
| D11 | حذف حساب | ✅ | DELETE /api/v1/account/me (account.js) | دکمهی UI |
| D12 | بکاپ رمزشده | ❌ | بکاپ: خاموش | — |
| D13 | داده به سرویس ثالث | ✅ | فقط پیامک/پرداخت؛ AI فقط متن خبر | — |
| D14 | دادهی prod در dev | ❌ | تأیید نشده | دستی |
| D15 | Privacy policy | ❌ | تأیید نشده | دستی |
| D16 | incident.md | ✅ | docs/security/incident.md | — |
| H2 | attack-surface | ✅ | docs/security/attack-surface.md | — |
| H3 | IDOR | ✅ | owner_id/participant در SQL؛ route نمونهها بررسی شد | — |
| H4 | Injection | ✅ | بدون string-concat کاربر؛ ILIKE escape | — |
| H5 | XSS/CSP | ✅ | CSP + escHtml در فرانت (نمونهبرداری) | اسکن کامل DOM |
| H6 | CSRF | ✅ | SameSite=Strict + Origin guard | — |
| H7 | SSRF | ✅ | news.js allowlist https + redirect manual | — |
| H8 | هدرها/CORS | ✅ | Caddy+helmet؛ CORS allowlist | — |
| H9 | npm audit | ❌ | نتیجه: نامشخص | — |
| H10 | آپلود | ✅ | magic-bytes + sharp re-encode + UUID + سقف | — |
| H11 | خطا بدون stack | ✅ | error handler عمومی (app.js) | — |
| H12 | Rate limit پرهزینه | ✅ | otp/upload/payment/chat-media limiters | — |
| H13 | لاگ رویداد امنیتی | ✅ | rate_limited/bad_origin/access_denied/login_* | هشدار (alert) تنظیم نشده |
| H14 | webhook/lockfile | ✅ | package-lock.json + npm ci | — |
| H15 | LLM | ✅ | AI فقط روی متن عمومی خبر؛ ابزار به کاربر داده نمیشود | — |
| H17 | findings | ✅ | findings.md | F2,F3 با این اسکریپت بسته شد |
| H20 | XXE/deserialization | ❌ | RSS parser بررسی نشد | بررسی news-ingest |
| R1 | tag/rollback | ❌ | پوشهی git ندارد؛ بکاپ sec-backup دارد | git tag |
| R2 | env روی میزبان | ✅ | backend/.env فقط روی سرور | — |
| R3 | HTTPS | ✅ | Caddy خودکار | — |
| R4 | DB عمومی نیست | ✅ | db/redis بدون ports | — |
| R5 | پنل ادمین | ❌ | 2FA: off | --admin-ip |
| R6 | داده تست/seed | ❌ | 00-demo-showrooms.js (دمو) در فرانت | حذف قبل از لانچ |
| R7 | بکاپ+restore | ❌ | خاموش | — |
| R8 | مانیتورینگ | ❌ | healthcheck+restart هست؛ alert خارجی نیست | Uptime Kuma/Telegram |
| R9 | هدرها روی URL زنده | ❌ | در sec.sh چک شد؛ دستی: curl -sI https://دامنه | — |
| R10 | npm ci | ✅ | Dockerfile | — |
| R11 | H مجدد | ❌ | پس از هر تغییر | — |
| R12 | rollback | ✅ | sec.sh --rollback و sec-plus.sh --rollback | — |

نکته: ❌ یعنی «تأیید نشده/باز»؛ هیچ ✅ بر پایهی فرض نیست.
