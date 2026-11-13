# تحویل مرحله‌ای امنیت و بک‌اند CarMaa

## چه چیزی در این snapshot تحویل شده؟
- سرویس API در `backend/` با schema و migrationهای PostgreSQL، Redis برای rate limit، احراز هویت OTP، نقش‌های مدیریتی، آگهی، تصاویر، نمایشگاه، پیام‌رسانی، اعلان، گزارش، پرسش‌وپاسخ و مسیر پرداخت.
- اتصال اولیهٔ OTP/session، messaging adapter، checkout خدمات پولی و ایجاد/ویرایش آگهی همراه آپلود تصویر به API.
- اصلاح تراکنش migration اولیه؛ migration runner تراکنش ساخت schema و ثبت نسخه را یکپارچه مدیریت می‌کند.
- تایمر تأیید خودکار آگهی فقط در حالت محلی/غیر API باقی می‌ماند و در حالت server-backed اجرا نمی‌شود.
- حذف دلیل رد آگهی از خروجی عمومی، فیلتر آگهی‌های منقضی، نگهداری حداقل پیشنهاد به‌عنوان دادهٔ خصوصی، کنترل مالکیت تصاویر و فیلتر schemeهای ناامن تصاویر.
- ۲۵ تست محلی و اسکریپت smoke test فقط‌خواندنی برای staging.
- مستندات `security/`: scope، مدل تهدید، موجودی صفحه/API، دفتر یافته‌ها، برنامهٔ اصلاحات و گزارش تست.

## تأییدهای قابل‌گزارش
- `npm test`: ۲۵ پاس، صفر شکست.
- `npm run check`: موفق.
- `node --check` برای فایل‌های جاوااسکریپت فرانت‌اند: موفق.
- `bash -n backend/test/staging-smoke.sh`: موفق.
- `unzip -t` روی بستهٔ نهایی: باید در زمان تحویل تأیید شود.

این تست‌ها مخلوطی از unit test، بررسی قرارداد سورس و آزمون VM هستند؛ معادل تست HTTP integration، تست نفوذ شبکه‌ای یا گواهی امنیت نیستند.

## موانع انتشار عمومی
1. برخی صفحه‌ها/جریان‌های قدیمی هنوز localStorage را مصرف می‌کنند: علاقه‌مندی، بخشی از پروفایل/نمایشگاه، پرسش‌وپاسخ، گزارش/تاریخچهٔ قیمت و پیشنهاد قیمت؛ نقشهٔ دقیق در `security/page-api-inventory.md` است.
2. bridge صفحهٔ اصلی فقط ۵۰ آگهی اول را بارگذاری می‌کند؛ pagination/filter سمت سرور کامل متصل نشده و deep-link آگهی بیرون batch باید تکمیل شود.
3. `npm install` در این محیط به دلیل نبود اینترنت/cache ناموفق بود؛ بنابراین lockfile ساخته نشده، dependency audit و SBOM قابل‌اعتماد تولید نشده و Docker build اجرا نشده است.
4. migration روی PostgreSQL واقعی، rate-limit با Redis واقعی، پیامک کاوه‌نگار و درگاه زرین‌پال sandbox، browser E2E، SAST/DAST و pentest زنده اجرا نشده‌اند.
5. تمام sinkهای HTML/URL در کل فرانت‌اند باید بازبینی شوند؛ اصلاحات XSS فعلی به معنی ممیزی کامل تمام قالب‌های قدیمی نیست.

## ترتیب پیشنهادی کار بعدی
1. نصب dependencyها در CI متصل به registry و تولید/تعهد `package-lock.json`؛ سپس `npm ci`, `npm audit` و SBOM.
2. اجرای Docker/PostgreSQL/Redis روی یک محیط ایزوله و اعمال migrationها فقط با `npm run migrate`.
3. اجرای `bash backend/test/staging-smoke.sh` محلی؛ سپس روی staging HTTPS مجاز.
4. تکمیل اتصال صفحه‌ها بر اساس inventory و نوشتن browser E2E برای هر workflow.
5. اجرای آزمون دسترسی با دو حساب و roleهای moderator/admin، و DAST/SAST با دادهٔ ساختگی؛ رفع همهٔ Critical/High و retest مستقل.
6. فقط پس از backup/restore drill، HTTPS/proxy/secrets واقعی و تأیید providerها تصمیم انتشار گرفته شود.

## راه مهم migration
فایل‌های migration نباید دستی اجرا شوند. `001_initial.sql` عمداً `BEGIN`/`COMMIT` سطح فایل ندارد؛ اجراکنندهٔ `backend/src/migrate.js` کل هر migration را همراه ثبت نام آن در `schema_migrations` داخل یک تراکنش قرار می‌دهد.
