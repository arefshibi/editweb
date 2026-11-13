# موجودی صفحه‌ها، جریان‌ها و APIهای CarMaa

این فهرست از روی کد همین snapshot تهیه شده است؛ هنوز browser E2E یا runtime network test انجام نشده است. «Endpoint موجود» به معنای «UI کامل متصل است» نیست.

## صفحه‌ها/جریان‌های اصلی

| صفحه/جریان | سمت سرور | اتصال فعلی فرانت‌اند | ریسک/کار باقی‌مانده |
|---|---|---|---|
| صفحهٔ اصلی و کارت‌های تازه‌ترین آگهی | `GET /api/v1/listings?page=&page_size=` | bridge اولیه فهرست را از API می‌خواند | فعلاً فقط ۵۰ مورد اول؛ pagination/filter/sort کامل سمت سرور نیست. |
| جست‌وجو و فیلتر آگهی | فیلترهای city/make/model/year/price/q در `GET /listings` | جست‌وجوی UI بخشی محلی است | فیلترها باید به پارامترهای API متصل شوند و بازگشت صفحه/اسکرول بررسی شود. |
| صفحهٔ جزئیات خودرو | `GET /listings/:id` | مسیر‌یابی فعلاً به آرایهٔ در حافظه تکیه دارد | deep link به مورد بیرون ۵۰ نتیجه ممکن است پیدا نشود؛ fetch-by-ID باید اضافه شود. |
| ایجاد آگهی | `POST /listings`, `POST /uploads/images` | فرم فروش از bridge سرور استفاده می‌کند | runtime E2E و رفتار فرم خطا/بازگشت عکس‌ها هنوز لازم است. |
| ویرایش آگهی | `PATCH /listings/:id` | bridge دارد؛ ID باید UUID سرور باشد | بعضی آگهی‌های قدیمی local-only قابل ویرایش در server mode نیستند؛ مسیر مهاجرت لازم است. |
| حذف آگهی | `DELETE /listings/:id` | UI حذف فعلی هنوز مدل/undo محلی دارد | به API حذف/بایگانی و رفتار undo همگام با سرور وصل شود. |
| ورود و خروج | OTP request/verify, `/auth/me`, `/auth/logout` | client و session restore متصل‌اند | SMS واقعی، کوکی Secure در staging و آزمون session revocation هنوز لازم است. |
| پروفایل/آواتار | `PATCH /auth/profile`, image upload | مسیر UI و client هنوز کامل متصل نیستند | تمام فیلدهای پروفایل باید به API منتقل شوند؛ آپلود مجدد و مالکیت تست شود. |
| علاقه‌مندی‌ها | `GET /account/favorites`, `POST /listings/:id/favorite` | حالت `likedIds` همچنان محلی است | toggle، sync اولیه، remove، داده‌های بیرون صفحهٔ اول و چنددستگاهی به API وصل شوند. |
| آگهی‌های من | `GET /listings/mine` | sync خصوصی انجام می‌شود | صفحه‌بندی/بیش از ۱۰۰ مورد و تست مالکیت لازم است. |
| خدمات پولی و callback | checkout/order/callback API | checkout به API فرستاده می‌شود | زرین‌پال sandbox و return flow در مرورگر واقعی تست نشده؛ فقط آگهی موجود در DB قابل خرید است. |
| پیام‌رسانی | `/messages/conversations/*`, `/messages/users/:id/block` | تنظیم API adapter فعال شده | runtime e2e با دو حساب، مجوز عضویت، unread/read و reconnect لازم است. |
| اعلان‌ها | `/notifications` و read routes | client پایه دارد؛ UI قدیمی ممکن است از مدل محلی استفاده کند | یکپارچه‌سازی کامل و صحت خوانده/خوانده‌نشده بررسی شود. |
| نمایشگاه‌ها | فهرست، mine, create, patch, follow, review | UI فعلی هنوز بخش‌هایی از مدل نمایشگاهی محلی دارد | ساخت/ویرایش، لوگو/بنر، follow/review و moderation به API متصل شوند. |
| پیشنهاد قیمت | `POST /listings/:id/offers`, account incoming/update | بخش‌هایی از Trust UI هنوز localStorage هستند | همهٔ پیشنهادها و وضعیت قبول/رد باید API-backed شوند؛ حداقل پیشنهاد نباید عمومی شود. |
| تاریخچهٔ قیمت و گزارش تخلف | API/DB در بخشی از backend | تاریخچه و گزارش UI هنوز محلی‌اند | اتصال UI، ذخیرهٔ منبع حقیقت سمت سرور و permission test. |
| پرسش‌وپاسخ خودرو | `/qa/questions*` و answers | UI فعلی کامل مهاجرت نکرده | شناسهٔ آگهی/کاربر، پاسخ پذیرفته‌شده و moderation در API متصل شود. |
| پنل مدیریت | `/admin/*`, نقش admin/moderator | panel session/role را چک می‌کند | e2e نقش‌ها، audit trail و جداسازی moderator از admin ضروری است. |
| رسانه | upload/mine و `/media/*` | عکس‌های جدید آگهی از API upload می‌شوند | quota، حذف تصویر بلااستفاده، سیاست S3/CDN و تست corrupt image نیازمند runtime است. |

## نقشهٔ API موجود از روی route declaration

- **Auth:** `POST /auth/otp/request`, `POST /auth/otp/verify`, `GET /auth/me`, `POST /auth/logout`, `PATCH /auth/profile`.
- **Listings:** `GET /listings`, `GET /listings/mine`, `GET /listings/:id`, `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id`, `POST /listings/:id/favorite`, `POST /listings/:id/offers`, `GET /listings/:id/price-history`.
- **Showrooms:** `GET /showrooms`, `GET /showrooms/mine`, `POST /showrooms`, `PATCH /showrooms/mine`, `GET /showrooms/:slug`, `POST /showrooms/:id/follow`, `POST /showrooms/:id/reviews`.
- **Messages:** conversation list/create/detail, message list/send, mark read, block user.
- **Payments:** checkout, per-owner order read, Zarinpal callback.
- **Account:** favorites, saved searches, incoming offers and status changes.
- **Notifications:** list, mark all read, mark one read.
- **QA:** public questions, detail, create, answer and accept answer.
- **Reports:** create report for exactly one permitted resource.
- **Uploads:** upload image and current-user image list.
- **Admin:** overview, listings/showrooms review queues, reports, user status, audit logs.

`/health/live` and `/health/ready` are outside `/api/v1`.

## معیار بستن اتصال یک صفحه
1. صفحه در کاربر ناشناس، کاربر A، کاربر B، moderator و admin (هر جا مجاز) آزموده شود.
2. reload/tab/device دوم داده را از API دریافت کند، نه localStorage.
3. خطای API به موفقیت ظاهری یا بازگشت به دادهٔ نمایشی منجر نشود.
4. تمام mutationها روی سرور مالکیت، role، ورودی و rate limit را کنترل کنند.
5. regression test و browser e2e برای مسیر عادی و دسترسی ممنوع افزوده شود.

---

## به‌روزرسانی نسخهٔ v4 (۲۰ اکتبر ۲۰۲۶)

مواردی که در این دور به اتصال API اضافه شده‌اند:
- Q&A: فهرست/جست‌وجو/آمار، سؤال و تصویر، پاسخ، رأی مفید یکتا، انتخاب پاسخ و بازدید از طریق API. به migration شمارهٔ 003 نیاز دارد.
- پروفایل: نام نمایشی، ایمیل، نام کاربری یکتا، آواتار و بنر در endpoint پروفایل ذخیره می‌شوند؛ فایل تصویر باید از API آپلود شود.
- نمایشگاه: فهرست عمومی سرور، ساخت/ویرایش با city/slug، آپلود لوگو/بنر و دنبال‌کردن نمایشگاه به API متصل شده‌اند.
- اعلان‌ها: در حالت API فهرست سروری، خواندن، خواندن همه و پاک‌کردن از سرور است؛ قبول/رد پیشنهاد نیز endpoint سروری دارد.
- گزارش تخلف و پیشنهاد قیمت: برای آگهی UUID واقعی سرور به endpointهای سرور ارسال می‌شوند؛ دادهٔ محلی در حالت API موفقیت جعلی اعلام نمی‌کند.
- پیام‌رسانی از قبل از API با کوکی نشست استفاده می‌کرد و اکنون درخواست‌ها `no-store` و `redirect:error` دارند.

مواردی که همچنان نیازمند اتصال/تست هستند: دنبال‌کردن کاربران شخصی، برخی قابلیت‌های استوری و آمار، جریان کامل همهٔ فرم‌ها/نمایشگاه‌ها، مهاجرت داده‌های legacy، و تست‌های E2E مرورگر با PostgreSQL/Redis و درگاه sandbox. این فهرست، وضعیت سورس است و تأیید اجرای زنده محسوب نمی‌شود.


## تکمیل جریان‌های اجتماعی و آمار (نسخهٔ v5)
- دنبال‌کردن کاربران شخصی: `POST /api/v1/social/users/:id/follow`، فهرست دنبال‌کنندگان/دنبال‌شوندگان و وضعیت دنبال‌کردن؛ رویداد دنبال‌کننده به اعلان سروری متصل است.
- استوری‌ها: فهرست عمومی، انتشار تصویر آپلودشده، حذف فقط توسط مالک، ثبت بازدید یکتا و نمایش تعداد بازدید فقط در endpoint مالک. استوری‌های فعال ۲۴ ساعت عمر دارند و سقف هر کاربر ۱۰ مورد است.
- آمار آگهی: endpoint مالک‌محور `GET /api/v1/social/listings/:id/stats` و ثبت رویدادهای بازدید/تماس/نشان‌کردن؛ نمودار پنجرهٔ ۷/۳۰ روزه به آمار سرور وصل شده است.
- تاریخچه قیمت: دکمهٔ تاریخچه در صفحه آگهی‌های سروری، متصل به `GET /api/v1/listings/:id/price-history`.
- Migration جدید: `004_social_stories_listing_stats.sql`.

- پاسخ به استوری در حالت سرور: `POST /api/v1/messages/conversations/direct` برای ایجاد/بازیابی گفتگوی مستقیم و سپس ثبت پیام از API پیام‌رسان؛ استوری‌های نمایشی در حالت API سخت‌گیرانه مخفی هستند.

- امتیازدهی نمایشگاه: `POST /api/v1/showrooms/:id/reviews`؛ در حالت API دیگر رأی‌های محلی مرورگر به‌عنوان امتیاز واقعی نمایش داده نمی‌شوند.

- پشتیبانی: فرم `تماس با پشتیبانی` به `POST /api/v1/support/tickets` وصل است؛ درخواست‌ها ذخیره می‌شوند و به مدیران اعلان می‌رود. فهرست درخواست‌های خود کاربر از `GET /api/v1/support/tickets/mine` در دسترس است.
