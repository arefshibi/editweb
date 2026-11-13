-- دسترسی‌های جزئی مدیران + دعوت مدیر با شماره + بنرهای صفحه اصلی
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS admin_invites (
  phone_e164 text PRIMARY KEY CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role user_role NOT NULL DEFAULT 'moderator',
  permissions text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  action varchar(30) NOT NULL DEFAULT 'none' CHECK (action IN ('none','goSell','browseDealers','goListings','goNews','url')),
  link_url varchar(500),
  alt varchar(160) NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS home_banners_pos_idx ON home_banners(position, created_at);

-- بنرهای پیش‌فرض فعلی سایت (فقط اگر جدول خالی است)
INSERT INTO home_banners(image_url, action, alt, position)
SELECT v.url, v.action, v.alt, v.pos FROM (VALUES
  ('assets/home-banner-1-newspaper.webp','goSell','هزینه ثبت آگهی رایگان شد',0),
  ('assets/home-banner-4-top-showroom.webp?v=2','browseDealers','نمایشگاه برتر شهرت شو',1),
  ('assets/home-banner-2-khuzestan.webp','goListings','خوزستان کف دستته',2),
  ('assets/home-banner-3-direct.webp','goListings','بدون واسطه انجامش بده',3)
) AS v(url,action,alt,pos)
WHERE NOT EXISTS (SELECT 1 FROM home_banners);
