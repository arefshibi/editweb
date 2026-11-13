# برنامهٔ اصلاحات CarMaa بر اساس ریسک

## اولویت P0 — قبل از انتشار عمومی
- [ ] اتصال کامل جریان‌های باقی‌ماندهٔ UI به API و حذف تصمیم‌گیری/منبع دادهٔ موازی در localStorage برای عملیات مالی و اطلاعات حساب.
- [ ] تست routeها و migration با PostgreSQL واقعی و Redis واقعی در محیط CI/staging؛ ایجاد lockfile قابل بازتولید.
- [ ] تست مالکیت با حداقل دو کاربر و نقش‌های moderator/admin برای همهٔ endpointها؛ ثبت evidence و retest.
- [ ] تست sandbox واقعی OTP/درگاه پرداخت، callbackهای تکراری/مبهم، مبلغ نامنطبق و timeout؛ بدون تراکنش production.
- [ ] بررسی تمام sinkهای HTML/attribute/URL در فرانت‌اند برای XSS ذخیره‌شده/DOM؛ فقط چند sink پرریسک قبلاً اصلاح شده‌اند، نه همهٔ UI.
- [ ] اجرای dependency audit، secret scan، SAST و DAST روی staging و بستن Critical/High.
- [ ] بررسی backup/restore، TLS، firewall، reverse proxy، log retention و alerting.

## اولویت P1 — پیش از rollout وسیع
- [ ] pagination و جست‌وجوی سمت سرور؛ نسخهٔ فعلی bridge فقط ۵۰ آگهی اول API را در فهرست فرانت‌اند بارگذاری می‌کند.
- [ ] resolve کردن deep link یک آگهی از طریق `GET /listings/:id` در صورتی که آگهی در batch اولیه نیست.
- [ ] مهاجرت علاقه‌مندی، پروفایل/اطلاعات نمایشگاه، Q&A، گزارش‌ها، تاریخچهٔ قیمت و پیشنهاد قیمت که بخشی از آنها در UI هنوز localStorage هستند.
- [ ] تست رقابت‌ها و idempotency برای follow/favorite/review/saved search، upload و عملیات مدیریتی.
- [ ] مانیتور کردن رفتار provider و تعریف runbook برای SMS/payment/Redis/Postgres outage.

## اولویت P2 — سخت‌سازی پیوسته
- [ ] تولید SBOM از lockfile، pin نسخه‌ها و برنامهٔ patch dependency.
- [ ] اسکن دوره‌ای secrets و images/container، سیاست کمینه‌سازی داده و retention، و تمرین پاسخ به رخداد.
- [ ] تست دسترس‌پذیری/کارایی/امنیت UI در مرورگر واقعی و مرور دستی تمام صفحه‌ها.

## معیار اتمام هر مورد
هر آیتم تنها پس از ثبت روش بازتولید، شواهد کم‌خطر، اصلاح root-cause، regression test و retest در محیط مشابه production بسته شود. وضعیت «تست‌نشده» نباید به «رفع‌شده» تبدیل شود.
