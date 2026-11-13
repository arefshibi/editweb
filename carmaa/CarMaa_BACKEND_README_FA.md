# بک‌اند CarMaa — راه‌اندازی و اتصال

این پوشه یک سرویس API مستقل برای نسخهٔ فعلی CarMaa است. پشتهٔ اجرا: Node.js 22، Express، PostgreSQL، Redis و ذخیره‌سازی تصویر محلی یا S3-compatible. شناسهٔ نشست در کوکی `HttpOnly` است؛ توکن نشست نباید در `localStorage` قرار بگیرد. شماره و آگهی به‌تنهایی مجوز دسترسی ایجاد نمی‌کنند و هر endpoint باید سمت سرور مالکیت/نقش را بررسی کند.

> **محدودیت مهم:** این خروجی یک پایهٔ بک‌اند جدی و قابل اجراست، اما در این محیط نتوانستم وابستگی‌های npm را نصب یا PostgreSQL/Redis/Docker را اجرا کنم؛ بنابراین فقط تست‌های واحد مستقل و بررسی نحوی اجرا شده‌اند. تست اتصال واقعی، تست نفوذ زنده، و تأیید کلیدهای ارائه‌دهندگان هنوز انجام نشده‌اند. فعلاً بخشی از رابط قدیمی CarMaa هنوز داده‌ها را از `localStorage` می‌خواند؛ در پایان این راهنما قسمت‌های متصل‌شده و باقی‌مانده آمده‌اند.

## ۱. فایل‌های اصلی

- `src/routes/`: مسیرهای API برای احراز هویت، آگهی، نمایشگاه، پیام‌ها، پیشنهادها، اعلان‌ها، پرسش‌وپاسخ، پرداخت، آپلود، گزارش و مدیریت.
- `migrations/001_initial.sql`: ساختار داده و محدودیت‌های دیتابیس.
- `src/middleware/security.js`: کنترل نشست، نقش، محدودسازی درخواست و کنترل Origin.
- `src/services/`: اتصال پیامک کاوه‌نگار، تأیید پرداخت زرین‌پال و ذخیره‌سازی رسانه.
- `docker-compose.yml`: اجرای محلی API، PostgreSQL و Redis با پورت دیتابیس/Redis منتشرنشده.
- `test/security-core.test.js`: ۲۵ تست محلی پایه/قرارداد سورس.
- `test/staging-smoke.sh`: smoke test شبکه‌ای محدود و فقط‌خواندنی؛ پیش‌فرض localhost.
- `../SECURITY_AUDIT_FA.md`: گزارش وضعیت آزمون‌ها و موانع انتشار.
- `../SECURITY_TEST_PROMPT_FA.md`: پرامپت ممیزی امنیتی مجاز و مرحله‌به‌مرحله.

## ۲. راه‌اندازی محلی با Docker Compose

نیازمندی‌ها: Docker Engine با Compose، Node.js 22 برای تست‌های محلی، و اینترنت خروجی برای نصب وابستگی‌ها.

۱. از داخل پوشهٔ `backend` فایل محیطی بسازید:

```bash
cp .env.example .env
```

۲. در `.env` حداقل این مقادیر را با مقادیر تصادفی و **متفاوت** عوض کنید:

```bash
openssl rand -hex 32
```

چهار مقدار جدا و مستقل تولید کنید. قالب hex از کاراکترهای ویژه‌ای که URL دیتابیس را خراب می‌کنند جلوگیری می‌کند؛ برای هر یک از `POSTGRES_PASSWORD`، `REDIS_PASSWORD`، `OTP_PEPPER` و `SESSION_PEPPER` فرمان را جداگانه اجرا کنید. دو pepper آخر باید از منبع تصادفی قوی و دست‌کم ۳۲ بایت باشند. هیچ‌کدام را در Git، فرانت‌اند، گزارش‌ها یا چت عمومی قرار ندهید.

۳. برای ارسال پیامک، `KAVENEGAR_API_KEY` را تنظیم کنید. در توسعه اگر کلید تنظیم نباشد، endpoint درخواست OTP با خطای 503 بسته می‌ماند؛ کد ثابت یا OTP نمایشی وجود ندارد. برای پرداخت محلی می‌توان `PAYMENT_SANDBOX=true` را نگه داشت، اما `ZARINPAL_MERCHANT_ID` لازم است تا درخواست واقعی در sandbox ساخته شود.

۴. سرویس‌ها را اجرا کنید:

```bash
docker compose up --build -d
docker compose exec api node src/migrate.js
curl -fsS http://127.0.0.1:3000/health/ready
```

API فقط روی `127.0.0.1:3000` میزبان در دسترس است؛ PostgreSQL و Redis پورت عمومی میزبان ندارند. اگر Docker در محیط شما در دسترس نیست، `npm install` را در پوشهٔ `backend` اجرا کنید، PostgreSQL و Redis امن فراهم کنید و `DATABASE_URL` و `REDIS_URL` را در `.env` وارد کنید.

## ۳. اتصال فرانت‌اند

پیش‌فرض `js/00-api-client.js` مسیر `/api/v1` است. برای محیط واقعی، توصیه می‌شود reverse proxy، فرانت‌اند و API را روی یک origin عمومی و HTTPS ارائه کند و مسیرهای `/api/` و `/media/` را به سرویس بک‌اند هدایت کند. API نباید مستقیماً با پورت عمومی اینترنت منتشر شود.

فرانت‌اند در این نسخه برای OTP، بازیابی نشست، خروج، پیام‌رسانی از طریق API، شروع checkout خدمات پولی و پنل مدیریت به بک‌اند متصل شده است. **اما مهاجرت کامل تمام قابلیت‌های رابط قدیمی انجام نشده است**: ساخت/ویرایش آگهی در همهٔ فرم‌های فعلی، کارت‌های صفحهٔ اصلی، علاقه‌مندی‌های قدیمی، پروفایل/اطلاعات نمایشگاه قدیمی و Q&A قدیمی هنوز به‌طور کامل از مدل `localStorage` به endpointهای دیتابیس منتقل نشده‌اند. در نتیجه داده‌های آزمایشی قبلی خودکار به دیتابیس وارد نمی‌شوند؛ قبل از انتشار باید مهاجرت داده و اتصال UI برای این قابلیت‌ها انجام و تست شود. خدمات پولی برای آگهی‌ای که در دیتابیس سرور وجود ندارد عمداً فعال نمی‌شود.

اگر API روی دامنهٔ جدا قرار می‌گیرد، ابتدا CORS، کوکی‌ها، HTTPS و SameSite را به‌صورت staging بررسی کنید و قبل از همهٔ اسکریپت‌ها `window.CARMA_API_BASE` را با آدرس کامل API تنظیم کنید. راه امن‌تر همچنان same-origin/reverse proxy است.

## ۴. تنظیمات production

- `NODE_ENV=production`
- `PUBLIC_BASE_URL`، `FRONTEND_URL`، `PAYMENT_CALLBACK_BASE_URL`، `MEDIA_PUBLIC_BASE_URL` و تمام `ALLOWED_ORIGINS` باید HTTPS واقعی باشند؛ آدرس localhost مجاز نیست.
- `COOKIE_SECURE=true`؛ یک origin محدود و دقیق وارد `ALLOWED_ORIGINS` کنید، نه `*`.
- `KAVENEGAR_API_KEY` و `ZARINPAL_MERCHANT_ID` را از secret manager یا محیط امن ارائه دهید.
- درگاه را فقط پس از تست کامل با sandbox روی `PAYMENT_SANDBOX=false` ببرید. هیچ پارامتر مرورگر به‌تنهایی پرداخت را موفق نمی‌کند؛ سرور باید authority و مبلغ را با ارائه‌دهنده تأیید کند.
- برای اولین بار `TRUST_PROXY=1` را فقط وقتی بگذارید که دقیقاً یک reverse proxy مورد اعتماد دارید و آن proxy هدرهای IP را بازنویسی می‌کند. در غیر این صورت جعل IP و محدودسازی نادرست ممکن است رخ دهد.
- در deployment واقعی، TLS، firewall، backup رمزگذاری‌شده، restore drill، patching منظم، نگه‌داری لاگ‌ها، هشدارهای 5xx/429 و روند پاسخ به رخداد را خارج از این کد هم تنظیم کنید.
- اگر S3-compatible استفاده می‌شود، دسترسی bucket را محدود کنید و فقط تصاویر عمومی آگهی را public/CDN کنید. فایل‌های خصوصی را در bucket عمومی قرار ندهید.
- محدودیت‌های منابع CPU/RAM، فضای دیسک و تعداد درخواست در reverse proxy را هم تنظیم کنید.

## ۵. ایجاد مدیر اصلی

ابتدا با یک شماره‌ای که پیامک واقعی دریافت می‌کند وارد شوید. سپس شمارهٔ همان حساب را از محیط امن به دستور زیر بدهید:

```bash
docker compose exec api node src/scripts/promote-admin.js --phone=+989xxxxxxxxx
```

دستور فقط کاربر فعال موجود را ارتقا می‌دهد و رویداد را در `admin_audit_logs` ثبت می‌کند. حساب مدیر یا رمز/OTP پیش‌فرض ساخته نمی‌شود. پس از ارتقای اولیه، حساب مدیر را با MFA/OTP واقعی محافظت، دسترسی آن را محدود و لاگ مدیریتی را پایش کنید. ارتقای نقش نباید از API عمومی قابل انجام باشد.

## ۶. endpointهای مهم

تمام مسیرهای زیر زیرپایهٔ `/api/v1` هستند؛ مگر مواردی که با auth مشخص شده‌اند.

| بخش | مسیرها |
|---|---|
| سلامت | `GET /health/live`، `GET /health/ready` |
| احراز هویت | `POST /auth/otp/request`، `POST /auth/otp/verify`، `GET /auth/me`، `POST /auth/logout`، `PATCH /auth/profile` |
| آگهی | `GET /listings`، `GET /listings/:id`، `GET /listings/mine`، `POST /listings`، `PATCH /listings/:id`، `DELETE /listings/:id`، `POST /listings/:id/favorite`، `POST /listings/:id/offers`، `GET /listings/:id/price-history` |
| نمایشگاه | `GET /showrooms`، `GET /showrooms/:slug`، `GET /showrooms/mine`، `POST /showrooms`، `PATCH /showrooms/mine`، `POST /showrooms/:id/follow`، `POST /showrooms/:id/reviews` |
| پیام‌رسانی | `GET /messages/conversations`، `POST /messages/conversations`، `GET /messages/conversations/:id`، `GET /messages/conversations/:id/messages`، `POST /messages/conversations/:id/messages`، `POST /messages/conversations/:id/read`، `POST /messages/users/:id/block` |
| پرداخت | `POST /payments/checkout`، `GET /payments/orders/:id` و callback ارائه‌دهنده |
| رسانه | `POST /uploads/images`، `GET /uploads/mine` |
| اعلان | `GET /notifications`، `POST /notifications/read-all`، `POST /notifications/:id/read` |
| حساب | `GET /account/favorites`، مدیریت `/account/saved-searches`، `GET /account/offers/incoming`، `PATCH /account/offers/:id` |
| پرسش‌وپاسخ | `/qa/questions`، `/qa/questions/:id` و مسیرهای پاسخ/پذیرش پاسخ |
| گزارش | `POST /reports` |
| مدیریت (نقش moderator/admin) | `/admin/overview`، بررسی آگهی/نمایشگاه، صف گزارش‌ها؛ گزارش ممیزی و تعلیق کاربر فقط برای admin |

## ۷. Smoke test فقط‌خواندنی در staging

پس از اجرای سرویس‌ها و اعمال migration، می‌توان smoke test را از همین پوشه اجرا کرد:

```bash
bash test/staging-smoke.sh
```

این اسکریپت به‌صورت پیش‌فرض فقط `http://127.0.0.1:3000` را می‌پذیرد. برای staging دوردست، تنها پس از ثبت مجوز و استفاده از HTTPS:

```bash
CARMA_STAGING_BASE_URL=https://staging.example.invalid CARMA_ALLOW_REMOTE_STAGING=1 bash test/staging-smoke.sh
```

نمونه‌دامنهٔ بالا باید با آدرس واقعی staging خودتان جایگزین شود. اسکریپت هیچ OTP، آگهی، پیام یا پرداختی نمی‌سازد؛ این فقط smoke test اولیه است، نه pentest.

## ۸. آزمون‌ها

```bash
npm test
npm run check
```

تست‌های فعلی شامل ۲۵ تست محلی‌اند: هش OTP و نشست، نرمال‌سازی شماره، نبود دورزدن کد ثابت، callback پرداخت، atomic rate limit، قراردادهای کنترل دسترسی/حریم خصوصی، migration transaction، رفتار DTO عکس و جلوگیری از موفقیت سمت کلاینت را بررسی می‌کنند. این مجموعه ترکیبی از unit test و source-contract/static tests است. این‌ها **جایگزین** تست route، تست دیتابیس، تست پرداخت sandbox، تست DAST یا تست نفوذ دستی نیستند. قبل از انتشار باید در staging تازه، نصب dependency، migration، تست مجوزدهی با دو کاربر، تست پیامک/درگاه، audit وابستگی‌ها، SAST/DAST و restore دیتابیس اجرا شوند.
