# گزارش اجرای تست — CarMaa

## محیط
- Node.js: نسخهٔ runtime موجود در workspace (Node 22+ لازم است؛ خروجی کامل `node --version` هنگام deploy ذخیره شود).
- PostgreSQL، Redis و Docker executable در محیط ساخت در دسترس نبودند.
- npm dependency install در این محیط با timeout مواجه شده بود؛ package lock ساخته/تأیید نشده است.
- هیچ base URL staging از مالک دریافت نشده؛ تست شبکه‌ای اجرا نشده است.

## فرمان‌های اجراشده
```bash
cd backend
npm test
npm run check
cd ..
find js -maxdepth 1 -name '*.js' -print0 | xargs -0 -n1 node --check
bash -n backend/test/staging-smoke.sh
unzip -t ../CarMaa_secure_backend_v2.zip  # پس از ساخت بسته
```

## نتیجهٔ محلی
- Node test runner: **25 passed, 0 failed**.
- `npm run check`: موفق (syntax check سورس/تست‌های بک‌اند).
- `node --check` فایل‌های top-level `js/*.js`: موفق.
- `bash -n` اسکریپت smoke test: موفق.
- تست‌های migration transaction و غیرمجاز بودن تأیید خودکار در حالت API افزوده شده‌اند.

## Smoke test staging
اسکریپت `backend/test/staging-smoke.sh` فقط GET می‌زند: health/readiness، فهرست عمومی، مسیرهای خصوصی بدون session که باید 401 بدهند و UUID نامعتبر که باید 400 بدهد. به‌طور پیش‌فرض فقط localhost را می‌پذیرد. برای staging راه دور باید HTTPS و `CARMA_ALLOW_REMOTE_STAGING=1` صریحاً تنظیم شوند. اسکریپت OTP ارسال نمی‌کند، رکورد ایجاد/حذف نمی‌کند و پرداخت نمی‌سازد. این اسکریپت در workspace اجرا نشده، چون API و سرویس‌های پشتیبان بالا نبودند.

## خارج از پوشش تا الآن
- integration/e2e با Express و PostgreSQL/Redis واقعی؛ migrate/rollback و concurrency چند replica.
- پیامک کاوه‌نگار و زرین‌پال sandbox؛ callback واقعی/تکراری و بازیابی خطای provider.
- dependency audit، OSV/SBOM، secret scanning، SAST و DAST.
- تست دسترسی چندحسابی BOLA/BFLA، تست مرورگر واقعی و pentest زنده.
