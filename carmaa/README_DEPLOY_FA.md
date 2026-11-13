# دیپلوی CarMaa روی سرور (یک دستور)

```bash
unzip CarMaa_Deploy.zip && cd carma_merge
bash deploy.sh                      # تست روی IP سرور — ورود با هر شماره + کد 123456
bash deploy.sh --domain site.ir     # HTTPS خودکار (دامنه باید A-record به IP سرور داشته باشد)
bash deploy.sh --domain site.ir --production   # حالت واقعی؛ اول KAVENEGAR_* و ZARINPAL_* را در backend/.env پر کن
```
دستورهای کمکی: `bash deploy.sh logs | status | restart | down | admin +989xxxxxxxxx`
اجرای دوباره‌ی deploy.sh امن است (رمزها دوباره ساخته نمی‌شوند و دیتابیس پاک نمی‌شود).

### رفع خطای DNS در Docker Hub
اسکریپت `deploy.sh` قبل از ساخت کانتینرها دسترسی DNS به `registry-1.docker.io` را بررسی می‌کند. اگر DNS معمول سرور پاسخ ندهد، در صورت پشتیبانی Ubuntu از `systemd-resolved`، DNS جایگزین را به‌صورت runtime امتحان می‌کند و ساخت را تا ۳ بار با فاصله‌ی افزایشی تکرار می‌کند. این کار volume دیتابیس را حذف نمی‌کند و فایل `/etc/resolv.conf` را بازنویسی نمی‌کند.

اگر پس از این تلاش‌ها هنوز DNS یا HTTPS خروجی به Docker Hub در شبکه‌ی ارائه‌دهنده مسدود باشد، باید مشکل شبکه/DNS خود سرور رفع شود؛ هیچ تغییر داخل فایل پروژه‌ای نمی‌تواند قطعی شبکه‌ی بیرونی را تضمینی دور بزند.
