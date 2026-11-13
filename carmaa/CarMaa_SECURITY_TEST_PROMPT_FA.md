# پرامپت جامع ممیزی امنیتی CarMaa

این پرامپت را به عامل کدنویسی/امنیتی دارای دسترسی به کل مخزن بدهید. آن را فقط برای سامانه‌ای اجرا کنید که مالک آن هستید یا مجوز کتبی تست آن را دارید. اجرای آزمون‌های فعال باید روی **staging ایزوله** با داده‌های ساختگی انجام شود؛ روی production، کاربران واقعی یا درگاه/شماره‌های واقعی تست مخرب انجام نشود.

---

## نقش و هدف

تو مهندس ارشد Product Security، AppSec و تست نفوذ مجاز هستی. سورس کامل CarMaa، یک مارکت‌پلیس فارسی خودرو با فرانت‌اند HTML/CSS/JavaScript، API مبتنی بر Node.js/Express، PostgreSQL، Redis، احراز هویت OTP پیامکی، پنل مدیریت، نمایشگاه‌ها، آگهی‌ها، تصاویر، پیشنهاد قیمت، پیام‌رسانی، اعلان، پرسش‌وپاسخ و پرداخت را بررسی می‌کنی.

هدف فقط پیدا کردن الگوی مشکوک نیست: هر یافته را با شواهد غیرمخرب بازتولید کن، علت ریشه‌ای را پیدا کن، اصلاح واقعی را در کد اعمال کن، regression test اضافه کن، تمام تست‌های مرتبط را اجرا کن و اثربخشی اصلاح را دوباره تأیید کن. هیچ‌وقت ادعا نکن «کاملاً امن» یا «بدون هیچ آسیب‌پذیری» است؛ دقیقاً بگو چه چیزهایی با چه ابزار و نسخه‌ای آزمایش شده و چه چیزهایی قابل‌آزمایش نبوده‌اند.

## قواعد توقف و ایمنی

1. قبل از شروع، scope، base URLهای staging، حساب‌های آزمایشی A/B، نقش‌های moderator/admin، دامنه‌های مجاز، محدودیت نرخ، بازهٔ زمانی و روش پاک‌سازی داده را در یک فایل `security/scope.md` ثبت کن. اگر scope و مجوز مشخص نیست، فقط تحلیل استاتیک انجام بده و هیچ درخواست فعال شبکه‌ای نفرست.
2. از دادهٔ ساختگی استفاده کن؛ اطلاعات شخصی، session cookie، OTP، API key، پیام خصوصی یا محتوای واقعی را در گزارش چاپ نکن. هر token یا secret یافت‌شده را redact کن و محل/روش تعویض آن را بگو.
3. آزمون DoS، flood، SMS bombing، آزمون حجیم پرداخت، حذف انبوه، brute-force گسترده، exploit persistence یا دسترسی به سرویس/دامنهٔ ثالث ممنوع است. برای rate limit فقط تعداد درخواست محدود و مورد توافق در staging بفرست.
4. تست هر پرداخت باید sandbox/mock باشد. هیچ مبلغ واقعی منتقل نکن. هیچ OTP واقعی به شماره‌های غیرآزمایشی ارسال نکن.
5. قبل از تغییر schema یا داده، backup staging بگیر و برای هر migration امکان rollback/restore را مستند کن. اگر تست خطر اختلال دارد، متوقف شو و ریسک را گزارش کن.
6. ابزارها و نسخه‌های استفاده‌شده، فرمان‌ها، scope و زمان اجرا را ثبت کن. هر جا dependency، database، provider key یا staging در دسترس نبود، نتیجه را «تست‌نشده» ثبت کن، نه «موفق».

## استانداردها و مرجع‌ها

از نسخه‌های پایدار/فعلی این مراجع در زمان اجرا استفاده کن و شمارهٔ نسخه را در گزارش ثبت کن:

- OWASP Top 10 2025: https://owasp.org/www-project-top-ten/
- OWASP API Security Top 10 2023: https://api-security.owasp.org/editions/2023/en/0x11-t10/
- OWASP ASVS 5.0: https://owasp.org/projects/asvs
- OWASP Web Security Testing Guide: https://owasp.org/projects/web-security-testing-guide/ و https://wstg.owasp.org/stable/
- در صورت ارتباط، راهنمای OWASP Cheat Sheets، CWE، CVSS 4.0، و مستندات رسمی Node/Express/PostgreSQL/Redis/Provider.

## وضعیت پایهٔ همین snapshot
در این snapshot، بک‌اند و bridge اولیهٔ آگهی در پوشهٔ `backend/`، `js/41-api-bootstrap.js` و `js/42-api-marketplace-bridge.js` هستند. ابتدا `security/scope.md`، `security/threat-model.md`، `security/findings.md` و `security/remediation-plan.md` را بخوان؛ آنها وضعیت پایه و قسمت‌های هنوز مهاجرت‌نیافته را ثبت کرده‌اند. فهرست آگهی فرانت‌اند فعلاً فقط ۵۰ نتیجهٔ اول را sync می‌کند و همهٔ تجربه‌های localStorage به API متصل نشده‌اند؛ اینها را پنهان یا completed اعلام نکن.

## مرحلهٔ ۱ — شناخت کامل سطح حمله و نقشهٔ صفحه‌به‌صفحه

1. همهٔ فایل‌ها، packageها، scriptهای HTML، routeها، endpointها، middlewareها، migrationها، jobها، وابستگی‌های خارجی، build/deploy config و فایل‌های قدیمی/backup را فهرست کن.
2. همهٔ صفحه‌ها و جریان‌های UI را استخراج کن: صفحهٔ اصلی و جستجو، فیلتر، لیست/جزئیات آگهی، ثبت/ویرایش/حذف آگهی، حساب کاربری، ورود/OTP، نمایشگاه‌ها و پروفایل آن‌ها، علاقه‌مندی‌ها، پیشنهاد قیمت، پیام‌ها و مسدودسازی، اعلان‌ها، خدمات پولی، callback پرداخت، آپلود عکس، Q&A، گزارش تخلف، پنل مدیر و هر مسیر پنهان.
3. برای هر صفحه/جریان، ورودی‌ها، endpointهای فراخوانی‌شده، دادهٔ ذخیره‌شده، اعتماد به localStorage/sessionStorage/cookie، وضعیت مهمان/کاربر/مدیر و اثر جانبی را ثبت کن.
4. نمودار trust boundary/data flow و فهرست دارایی‌های حساس بساز: شماره تلفن، session، پیام‌ها، پیشنهادهای قیمت، حداقل قیمت محرمانه، مالکیت آگهی، مدارک/پروفایل، تصاویر، سفارش/پرداخت، گزارش تخلف، نقش مدیر و secrets.
5. route inventory بساز و مشخص کن هر مسیر باید public، authenticated، owner-only، conversation-member-only، moderator یا admin باشد. endpoint ناشناخته/نسخهٔ قدیمی/غیرفعال یا endpointی که مستند نیست را بی‌صاحب رها نکن.

## مرحلهٔ ۲ — بررسی کد و وابستگی‌ها

- تمام ورودی‌ها، استفاده از SQL و JSON، قالب خروجی، تبدیل HTML، DOM injection، `innerHTML`, `eval`, اجرای shell، deserialization، prototype pollution، path construction و مصرف URL/redirect را بررسی کن.
- secret scanning انجام بده: API key، credential، رمز ثابت، signing secret، private key، کلید در سورس یا history، `.env`، source map، فایل backup و bundle. هیچ secret را دوباره داخل گزارش چاپ نکن.
- روی lockfile تکیه کن، lockfile قابل‌بازتولید بساز، نسخهٔ runtime و پکیج‌ها را قفل کن، license/SBOM و dependency audit را تولید کن و advisoryهای معتبر روز را با false positive بررسی کن.
- SAST/taint analysis اجرا کن؛ حداقل ابزارهای مناسب زبان را انتخاب کن. خروجی ابزار خام را بدون triage به‌عنوان باگ قطعی معرفی نکن.
- تنظیمات Docker و CI/CD، دسترسی فایل‌ها، user غیر root، `read_only`, capabilities، secrets، network، healthcheck، ports، TLS termination، reverse proxy، database exposure، Redis auth، backup encryption و log redaction را بررسی کن.

## مرحلهٔ ۳ — احراز هویت، OTP و نشست

با دو حساب آزمایشی:

- OTP ثابت/قابل حدس، کد تصادفی ضعیف، OTP افشاشده در body/URL/log، OTP تکراری، انقضای ۵ دقیقه، replay، چند OTP هم‌زمان، race condition، تعداد تلاش، درخواست مجدد، محدودیت IP/شماره، account enumeration و سوءاستفادهٔ اقتصادی از SMS را بررسی کن.
- درخواست‌های موازی و چند instance را با تعداد کم در staging آزمایش کن؛ rate limit نباید بین workerها دور زده شود و در production نباید با قطعی Redis به allow-all برگردد.
- بررسی کن OTP فقط با provider واقعی ارسال شود، شکست provider challenge را باطل کند، و کد هرگز در پاسخ API برنگردد.
- session fixation، cookie flagها، `HttpOnly`, `Secure`, `SameSite`, expiry، logout/revocation، وضعیت user suspended/deleted، user-agent/IP handling، token entropy و نگه‌داری فقط digest توکن در DB را آزمایش کن.
- CSRF روی عملیات cookie-based، Origin/Referer validation، CORS، credentialed cross-origin، preflight، subdomain و redirect را بررسی کن.

## مرحلهٔ ۴ — مجوزها و جلوگیری از نشت داده (اولویت بحرانی)

برای هر endpoint هر سه حالت anonymous، کاربر A و کاربر B را مقایسه کن؛ سپس moderator و admin را نیز بیازمای:

- BOLA/IDOR: با تغییر UUID/ID آگهی، تصویر، گفتگو، پیام، سفارش، پیشنهاد، نمایشگاه، اعلان، report، سؤال و پاسخ، دادهٔ کاربر دیگر را نخوان/ویرایش/حذف نکن.
- BFLA: کاربر معمولی نتواند endpointهای مدیریت، audit، تعلیق، approve/reject/publish یا تغییر role را فراخوانی کند. moderator نباید به عملیات admin-only دسترسی داشته باشد.
- BOPLA/Mass Assignment: فیلدهایی مثل `owner_id`, `role`, `status`, `verified_at`, `price`, `amount`, `paid`, `minimum_offer_toman`, `expires_at`, `urgent_until`, `published_at`, `created_at` و `deleted_at` را در request دستکاری کن؛ فقط allow-list معتبر باید پذیرفته شود.
- پاسخ عمومی نباید شمارهٔ شخصی، private notes، حداقل پیشنهاد، شناسهٔ نشست، provider authority، data داخلی گزارش، یا metadata حساس را برگرداند.
- مالک باید فقط آگهی/عکس/پروفایل/نمایشگاه خودش را ویرایش کند. تصاویر آپلودشدهٔ کاربر دیگر نباید به آگهی او متصل شوند.
- پیام فقط برای اعضای آن گفتگو قابل خواندن باشد؛ ارسال پیام بعد از block، گفتگو با خود، خواندن نشان‌ها و دستکاری sender/conversation ID بررسی شود.
- حداقل پیشنهاد قیمت را فقط سرور مقایسه کند؛ مقدار خصوصی نباید به خریدار بازگردد. آزمون‌ها نباید مقدار واقعی خصوصی را در report ثبت کنند.

برای هر شکست، regression test قطعی با وضعیت مورد انتظار 401/403/404 و بدون نشت داده اضافه کن؛ از پاسخ 404 برای اشیای غیرمجاز در جایی که به جلوگیری از enumeration نیاز است استفاده کن.

## مرحلهٔ ۵ — آگهی‌ها، نمایشگاه‌ها و workflow کسب‌وکار

- publish فقط پس از تأیید لازم؛ ویرایش محتوای آگهی تأییدشده باید policy بررسی مجدد را رعایت کند.
- بررسی قیمت منفی، اعداد بسیار بزرگ، overflow در ریال/تومان، سال/کارکرد ناسازگار، فیلد خالی، payload اضافی، پارامتر تکراری، Unicode و ورودی فارسی/عربی.
- قیمت توافقی، تاریخچهٔ قیمت، حذف/بایگانی، تمدید، تغییر مالکیت و اتصال آگهی به نمایشگاه را بررسی کن.
- ثبت نمایشگاه تکراری، slug collision، عوض کردن نمایشگاه دیگر، دستکاری وضعیت approved/verified و انتشار اطلاعات غیرعمومی را بررسی کن.
- favorite/follow/review idempotency و race condition؛ review تکراری؛ ذخیرهٔ جستجو و محدودیت تعداد آن‌ها را بررسی کن.
- همهٔ queryها باید پارامتری باشند؛ sort/limit/offset و `ILIKE` باید allow-list یا escape مناسب داشته باشند.

## مرحلهٔ ۶ — پرداخت و خدمات پولی

فقط در sandbox یا mock:

- مبلغ، currency unit (تومان/ریال)، service key، مدت سرویس و مالک آگهی فقط از کاتالوگ سرور تعیین شوند، نه از browser.
- callback جعلی، status جعلی، authority متفاوت، order ID متفاوت، amount mismatch، ref ID خالی، provider timeout، کد خطای provider، retry، replay و callback هم‌زمان را بررسی کن.
- verify باید با provider و مبلغ دقیق سفارش انجام شود؛ موفقیت از redirect/status مرورگر به‌تنهایی کافی نیست.
- callback تکراری نباید نردبان/فوری/تمدید یا تراکنش مالی را دو بار اعمال کند. از row lock/transaction و idempotency درست استفاده شود.
- کاربر نباید سفارش کاربر دیگر را ببیند یا پرداخت را برای آگهی دیگر redirect کند.
- سفارش در وضعیت pending/expired/failed باید policy دقیق داشته باشد؛ قطع ارتباط درگاه باعث فعال‌سازی سرویس نشود.
- هیچ تستی را به درگاه production نفرست. برای تست منفی از mock transport یا merchant sandbox استفاده کن.

## مرحلهٔ ۷ — آپلود و رسانه

- فقط MIME/فایل واقعیِ مجاز؛ آزمایش فایل HTML/SVG، extension double، نام فایل traversal، payload/polyglot، فایل خالی، corrupt image، EXIF/location، تصویر عظیم، ابعاد مخرب، decode bomb و چند فایل/part بیش از limit.
- مطمئن شو نام کلید توسط سرور ساخته می‌شود، مسیر فایل از ورودی کاربر استفاده نمی‌کند، تصویر بازپردازش و metadata حساس حذف می‌شود و فایل executable نیست.
- دسترسی به media URL، حدس/افشای object key، policy bucket، cache، CORS/CORP و حذف تصویر بلااستفاده را بررسی کن. عکس آگهی عمومی را از اسناد خصوصی جدا نگه دار.

## مرحلهٔ ۸ — آسیب‌پذیری‌های رایج وب/API

با payloadهای غیرمخرب و کنترل‌شده: SQLi، XSS reflected/stored/DOM، CSRF، SSRF، open redirect، path traversal، file inclusion، command injection، template injection، prototype pollution، header injection، cache poisoning، HTTP request smuggling در صورت scope زیرساخت، insecure deserialization، weak cryptography، predictable IDs/tokens، cache-control افشاگر، clickjacking، CORS misconfiguration و verbose errors را بررسی کن.

در SSRF، هر URL قابل‌ورود از کاربر را بررسی کن: فقط allow-list host و scheme، جلوگیری از localhost/private/link-local/metadata address، DNS rebinding، redirectهای چندمرحله‌ای و timeout. اگر برنامه URL دلخواه fetch نمی‌کند، این مورد را «سطح حملهٔ مشاهده‌نشده» ثبت کن، نه اینکه بی‌دلیل قابلیت SSRF بسازی.

## مرحلهٔ ۹ — محدودیت منابع، ضداسپم و تاب‌آوری

در محدودهٔ کم و توافق‌شده روی staging، rate limit پیام، گزارش، آگهی، تصویر، OTP و checkout را آزمایش کن. queryهای کند/بزرگ، pagination، upload memory، concurrent requests و قطع/بازگشت PostgreSQL/Redis/provider را بررسی کن. از فشار حجیم یا مختل‌کردن سرویس خودداری کن. در production failure باید به‌صورت fail-closed برای مسیرهای حساس باشد و خطا باعث نشت stack/SQL/secret نشود.

## مرحلهٔ ۱۰ — ابزارهای آزمون

نسخه‌ها و تنظیمات ابزار را ثبت کن و به تناسب محیط انتخاب کن:

- Unit/integration: `node:test` یا test runner پروژه، Supertest و database/containerهای جداگانه.
- Dependency/SBOM: `npm audit`, OSV-Scanner و ابزار تولید SBOM مناسب lockfile.
- Secret scan: Gitleaks یا TruffleHog روی working tree/history مجاز.
- SAST: Semgrep/CodeQL یا ابزار مناسب JS/Node.
- DAST: OWASP ZAP در حالت baseline یا passive روی staging و سپس آزمون‌های active محدود با تأیید صریح.
- TLS/headers: ابزار مناسب روی دامنهٔ staging، بدون تست حملهٔ حجیم.
- Nuclei یا مشابه فقط با templateهای غیرمخرب و `rate-limit` پایین؛ هر template و scope قبل از اجرا بررسی شود.

هیچ ابزاری به‌تنهایی پوشش کامل ندارد؛ false positiveها triage، false negativeها محدودیت scope مستند شوند.

## مرحلهٔ ۱۱ — رفع ایرادها و معیار بستن یافته

برای هر یافته:

1. شناسه، عنوان، severity (CVSS 4.0 همراه با دلیل)، endpoint/فایل و precondition.
2. اثر واقعی روی محرمانگی/یکپارچگی/دسترس‌پذیری و سناریوی کسب‌وکار CarMaa.
3. evidence کم‌خطر و گام‌های بازتولید؛ دادهٔ حساس را redacted کن.
4. علت ریشه‌ای و اصلاح حداقلی اما صحیح؛ هرگز فقط با مخفی‌کردن دکمه یا چک سمت کلاینت حل نکن.
5. regression test که قبل از اصلاح fail و پس از اصلاح pass می‌شود.
6. تست‌های مربوط و کل suite را دوباره اجرا کن؛ نتیجه و hash/commit اصلاح را ثبت کن.
7. severity را فقط با evidence تغییر بده؛ unresolved و not-tested را روشن اعلام کن.

اولویت رفع: Critical/High پیش از انتشار؛ سپس Medium؛ Low/Informational نیز با مالک و موعد مشخص ثبت شوند. هر migration باید backup/rollback plan داشته باشد.

## مرحلهٔ ۱۲ — اجرای امن smoke test و تأیید migration

- قبل از smoke test، `backend/test/staging-smoke.sh` را بخوان و مطمئن شو target دقیقاً همان staging مجاز است. این اسکریپت فقط درخواست‌های GET محدود می‌فرستد و جایگزین آزمون فعال نیست.
- ابتدا dependencyها را با lockfile قابل‌بازتولید نصب کن؛ migrationها را روی یک دیتابیس تازه و یک دیتابیس دارای backup آزمایش کن. مطمئن شو `001_initial.sql` خودش BEGIN/COMMIT ندارد و اجرایندهٔ migration ساخت schema و ثبت `schema_migrations` را در یک تراکنش انجام می‌دهد.
- migration را با دو process هم‌زمان اجرا کن تا advisory lock و idempotency بررسی شوند. سپس failure عمدی کنترل‌شده روی دیتابیس آزمایشی اجرا کن و اطمینان حاصل کن migration نصفه ثبت نمی‌شود.
- تست‌های موجود را با `npm test` و `npm run check` اجرا و نتیجهٔ آنها را از integration/DAST جداگانه گزارش کن.

## خروجی‌های لازم

ایجاد کن و تحویل بده:

- `security/scope.md` و inventory همهٔ pageها/APIها.
- `security/threat-model.md` و access-control matrix.
- `security/findings.md` شامل همهٔ یافته‌ها با severity/evidence/fix/status.
- `security/remediation-plan.md` مرتب‌شده بر اساس ریسک و وابستگی.
- regression tests و اصلاحات کد.
- گزارش ابزارها و نسخه‌ها، dependency audit/SBOM، summary از SAST/DAST، و نتایج retest.
- دستور دقیق اجرای تست‌ها و همهٔ محدودیت‌های پوشش.

در انتها خروجی را با این دسته‌بندی جمع‌بندی کن: **تأییدشده و رفع‌شده / باز و مسدودکنندهٔ انتشار / نیازمند پیکربندی زیرساخت / آزمون‌نشده به علت محدودیت محیط**. از عبارات «بدون نقص»، «۱۰۰٪ امن» یا «تمام حملات غیرممکن‌اند» استفاده نکن.

---
