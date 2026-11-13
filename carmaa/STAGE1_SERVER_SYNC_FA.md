# انتقال داده‌های لوکال به سرور — مرحله ۱ (بک‌اند + راهنمای انتقال دیتابیس)

## چه چیزی در مرحله ۱ ساخته شد
| مورد | قبلاً | حالا (سمت سرور) |
|---|---|---|
| لایک خبر | localStorage (`carma_news_social_v1`) | `POST /api/v1/news/:newsId/like` (toggle) |
| کامنت و پاسخ به کامنت | localStorage | `POST /api/v1/news/:newsId/comments` (متن ۱ تا ۵۰۰ نویسه، `parentId` اختیاری) |
| لایک کامنت | localStorage | `POST /api/v1/news/comments/:commentId/like` |
| حذف کامنت | نبود | `DELETE /api/v1/news/comments/:commentId` (صاحب کامنت یا مدیر/ناظر) |
| خواندن همه | localStorage | `GET /api/v1/news/social?ids=n1,n2,...` (عمومی؛ `liked` فقط برای کاربر واردشده) |
| هشتگ نمایشگاه | localStorage (`mr_dealer_tags_v1`) | ستون `showrooms.tags`؛ در `POST /showrooms` و `PATCH /showrooms/mine` با فیلد `tags` (حداکثر ۱۰ مورد، ۲۴ نویسه) و در خروجی لیست/جزئیات/mine |

- جدول‌ها و ستون جدید: `backend/migrations/012_news_social_showroom_tags.sql` (idempotent؛ `deploy.sh` خودش اجرا می‌کند).
- متدهای کلاینت: `CARMA_API.news.{social,toggleLike,comment,deleteComment,toggleCommentLike}` در `js/00-api-client.js`.
- هنوز **به UI وصل نشده**؛ تا مرحله ۲ رفتار سایت برای کاربر عوض نمی‌شود (لایک/کامنت همچنان محلی است).
- تست: فقط بررسی نحوی (`node --check`) انجام شد. `npm test` و اجرای migration روی Postgres واقعی در این محیط ممکن نبود؛ حتماً روی سرور تست شود.

## دیپلوی مرحله ۱ روی سرور
```bash
cd /root/carmaa && cp backend/.env /root/env.bak         # بکاپ .env
# فایل‌های جدید را روی پوشه‌ی پروژه (بدون دست‌زدن به backend/.env) کپی کن، بعد:
bash deploy.sh                                            # migration 012 خودکار اجرا می‌شود
bash deploy.sh logs                                       # باید "Applied migration: 012_..." ببینی
curl -s "http://IP-سرور/api/v1/news/social?ids=n1" | head -c 300   # انتظار: {"items":{"n1":{"likes":0,...}}}
```

## انتقال دیتابیس لوکال به سرور (دستی؛ من به هیچ‌کدام دسترسی ندارم)
> هشدار: این کار روی دیتابیس زنده است. اول بکاپ کامل از سرور بگیر.

**۱) بکاپ کامل سرور (روی سرور):**
```bash
cd /root/carmaa
docker compose -f docker-compose.prod.yml --env-file backend/.env exec -T db pg_dump -U carmaa -d carmaa -Fc > /root/server_before_$(date +%F).dump
```

**۲) لوکال را هم به آخرین نسخه‌ی schema برسان** (تا ستون‌ها یکی باشند): در پوشه‌ی `backend` لوکال `npm run migrate`.

**۳) خروجی «فقط داده» از لوکال** (بدون نشست‌ها/OTP/جدول migration، و با رد کردن ردیف‌های تکراری):
```bash
pg_dump -U carmaa -d carmaa --data-only --column-inserts --on-conflict-do-nothing \
  --exclude-table=sessions --exclude-table=otp_codes --exclude-table=schema_migrations \
  > local_data.sql
```
اگر دیتابیس لوکال داخل داکر است: `docker compose exec -T db pg_dump ...` با همان گزینه‌ها. اسم دقیق جدول‌های نشست/OTP را با `\dt` چک کن؛ اگر اسم‌شان فرق دارد `--exclude-table` را اصلاح کن.

**۴) آپلود و ورود به سرور:**
```bash
scp local_data.sql root@IP-سرور:/root/
docker compose -f docker-compose.prod.yml --env-file backend/.env exec -T db psql -U carmaa -d carmaa -v ON_ERROR_STOP=1 < /root/local_data.sql
```
- `ON_ERROR_STOP=1` یعنی با اولین خطا متوقف می‌شود؛ اگر خطای کلید خارجی (foreign key) دیدی، یعنی ترتیب/وابستگی داده‌ها مشکل دارد: دیتابیس را از بکاپ مرحله ۱ برگردان و برایم خطا را بفرست.
- کاربران لوکال و سرور اگر شماره تلفن یکسان ولی شناسه‌ی (UUID) متفاوت داشته باشند، با هم تداخل می‌کنند؛ در این حالت قبل از انتقال به من بگو.

**۵) عکس‌ها (فایل‌های آپلودی) جدا از دیتابیس‌اند** و باید جدا منتقل شوند:
```bash
# لوکال: اسم volume را با `docker volume ls` پیدا کن (معمولاً carma_carmaa_media)
docker run --rm -v carma_carmaa_media:/m -v "$PWD":/b alpine tar czf /b/media.tgz -C /m .
scp media.tgz root@IP-سرور:/root/
# سرور:
docker run --rm -v carma_carmaa_media:/m -v /root:/b alpine tar xzf /b/media.tgz -C /m
```

**۶) بعد از انتقال:** `bash deploy.sh restart` و چک کن آگهی‌ها/عکس‌ها/نمایشگاه‌ها درست دیده می‌شوند.

## نقشه‌ی راه مرحله ۲ (فرانت‌اند)
1. **`js/45-news.js` — لایک خبر:** در حالت سرور (`window.CARMA_API?.enabled`) کلیک لایک `news.toggleLike` را صدا بزند (optimistic + برگشت در خطا)؛ شمارنده‌ی کل لایک از سرور نمایش داده شود (الان فقط `1` یا خالی است).
2. **کامنت‌ها:** ارسال با `news.comment` (شناسه‌ی کامنت از سرور جایگزین `k` محلی شود)، پاسخ با `parentId`، لایک کامنت با `news.toggleCommentLike`، افزودن دکمه‌ی حذف برای کامنت خود کاربر.
3. **خواندن:** یک `syncSocial()` که با `news.social(ids)` کش محلی (`readSoc`) را از سرور پر کند، موقع ورود به صفحه‌ی اخبار/خانه و بعد از ورود کاربر؛ و `refreshSocial` را صدا بزند. لایک کامنت باید از `liked/likes` سرور بیاید (الان از آرایه‌ی `l` با `myId()` محلی است).
4. **`js/36-profile-page.js` — هشتگ نمایشگاه:** `setDealerTags` در حالت سرور از `showrooms.update({tags})` استفاده کند و `dealerTags` از فیلد `tags` پاسخ سرور بخواند؛ فرم ویرایش نمایشگاه (`15-pages-account.js`/`42-api-marketplace-bridge.js`) `tags` را در payload بفرستد.
5. **مهاجرت یک‌باره‌ی داده‌ی مرورگر:** در اولین ورود، لایک/کامنت/هشتگ‌های موجود در localStorage همان کاربر یک‌بار به سرور فرستاده شود (با پرچم `mr_social_migrated_v1`) و بعد کش پاک شود.
6. **ماندهٔ جزئی (اختیاری):** `carmaa_showroom_rank_history_v1` (تاریخچه‌ی رتبه) بهتر است از سرور محاسبه شود؛ جدا از این دو مورد و در صورت نیاز در مرحله ۳.
7. **تست و تحویل:** `node --check` همه‌ی JS، تست دو حساب روی سرور (لایک/کامنت/حذف/پاسخ)، و zip نهایی.

## نکات امنیتی که رعایت شد
نرخ‌محدودسازی (۲۰ نوشتن/دقیقه/کاربر)، اعتبارسنجی با zod، ضد کامنت تکراری ۲ دقیقه‌ای، حذف نرم، پرس‌وجوی پارامتری، و پاسخ‌های `no-store`. شناسه‌ی خبر فعلاً فقط با الگو (`[A-Za-z0-9_-]` تا ۶۴ نویسه) اعتبارسنجی می‌شود چون فهرست اخبار سمت فرانت ثابت است؛ اگر بعداً اخبار از سرور آمد، بهتر است فهرست مجاز هم سمت سرور اعمال شود.
