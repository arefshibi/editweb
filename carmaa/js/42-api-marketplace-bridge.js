/* Server-authoritative listing DTO and photo synchronization bridge. */
(function () {
  const api = window.CARMA_API;
  if (!api?.enabled) return;

  const ownImageCache = { map: null, at: 0 };
  const faNumber = (value) => Number(value || 0).toLocaleString('fa-IR');
  const safeTime = (value) => { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : Date.now(); };
  function safePublicImageUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return false;
    try {
      const parsed = new URL(value, window.location.origin);
      if (parsed.username || parsed.password) return false;
      return parsed.origin === window.location.origin || parsed.protocol === 'https:';
    } catch { return false; }
  }
  const normalizePhotoRows = (photos) => (Array.isArray(photos) ? photos : []).map((p) => typeof p === 'string' ? p : p?.url).filter(safePublicImageUrl);

  function uiStatus(value) {
    const status = String(value || 'pending');
    if (status === 'published') return 'listed';
    if (status === 'archived') return 'removed';
    return status;
  }

  function rowToCard(row) {
    const m = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const photos = normalizePhotoRows(row?.photos);
    const negotiable = row?.price_negotiable === true;
    const price = row?.price_toman == null ? null : Number(row.price_toman);
    const mileage = row?.mileage_km == null ? null : Number(row.mileage_km);
    const mileageType = ['used', 'zero', 'presale'].includes(m.mileageType) ? m.mileageType : (mileage == null ? 'zero' : 'used');
    let miles = mileageType === 'presale' ? `حواله${m.deliveryTime ? ` · ${m.deliveryTime}` : ''}` : mileageType === 'zero' ? 'صفر کیلومتر' : `${faNumber(mileage)} کیلومتر`;
    return {
      id: String(row.id), brand: String(row.make || ''), title: String(row.title || ''),
      price: negotiable || price == null ? 'توافقی' : `${faNumber(price)} تومان`, priceAmount: price,
      negotiable, miles, phone: '', color: String(row.color || ''), trim: String(row.trim || ''),
      engineType: String(m.engineType || ''), fuelType: String(row.fuel_type || ''), transmission: String(row.transmission || ''),
      adTitle: String(m.adTitle || ''), interiorColor: String(m.interiorColor || ''), driveTrain: String(m.driveTrain || ''), cylinders: String(m.cylinders || ''),
      engineVolume: String(m.engineVolume || ''), mileageType, deliveryTime: String(m.deliveryTime || ''),
      documentType: String(m.documentType || ''), powerOfAttorneyStatus: String(m.powerOfAttorneyStatus || ''),
      insuranceStatus: String(m.insuranceStatus || ''), privateSeller: !row.showroom_id,
      city: String(row.city || ''), region: String(m.region || ''),
      mapPos: null, // Exact coordinates are intentionally never returned to buyers.
      description: String(row.description || ''), photos, paintedParts: Array.isArray(m.paintedParts) ? m.paintedParts : [],
      bodyConditionRating: Number.isFinite(Number(m.bodyConditionRating)) ? Number(m.bodyConditionRating) : null,
      tradeIn: m.tradeIn === true, acceptsOffers: m.acceptsOffers === true,
      minimumOfferToman: row.minimum_offer_toman == null ? null : Number(row.minimum_offer_toman),
      status: uiStatus(row.status), showroomId: row.showroom_id || null, sellerType: row.showroom_id ? 'dealer' : 'personal', sellerId: row.showroom_id || row.owner_id || null, sellerUserId: row.owner_id || null, sellerName: String(row.seller_name || ''),
      showroomName: String(row.showroom_name || ''), showroomSlug: String(row.showroom_slug || ''),
      createdAt: safeTime(row.created_at), updatedAt: safeTime(row.updated_at),
      viewCount: Number(row.view_count || 0), promoted: false,
      _source: 'api',
    };
  }

  async function ownImagesByUrl() {
    if (ownImageCache.map && Date.now() - ownImageCache.at < 20_000) return ownImageCache.map;
    const result = await api.uploads.mine();
    const map = new Map();
    for (const img of (result?.items || [])) {
      if (img?.id && img?.public_url) map.set(String(img.public_url), String(img.id));
    }
    ownImageCache.map = map; ownImageCache.at = Date.now();
    return map;
  }

  async function uploadOrReusePhotos(photos) {
    const own = await ownImagesByUrl();
    const list = (Array.isArray(photos) ? photos : []).filter(Boolean).slice(0, 12);
    const results = new Array(list.length);
    // Validate everything first, so a bad photo fails before anything is uploaded.
    list.forEach((source) => {
      if (typeof source !== 'string' || source.length > 12 * 1024 * 1024) throw new Error('یکی از تصاویر آگهی معتبر نیست. دوباره آن را انتخاب کنید.');
      if (!source.startsWith('data:image/') && !own.get(source)) throw new Error('برای حفظ امنیت، فقط تصاویر آپلودشده در حساب خودتان قابل استفاده‌اند. تصویر را دوباره انتخاب کنید.');
    });
    const one = async (source, index) => {
      if (source.startsWith('data:image/')) {
        let blob;
        try { blob = await (await fetch(source)).blob(); } catch { throw new Error('خواندن یکی از تصاویر ممکن نشد.'); }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size < 1 || blob.size > 6 * 1024 * 1024) throw new Error('هر تصویر باید JPEG، PNG یا WebP و حداکثر ۶ مگابایت باشد.');
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const file = new File([blob], `vehicle-photo.${ext}`, { type: blob.type });
        const saved = await api.uploads.image(file);
        const img = saved?.image;
        if (!img?.id || !img?.public_url) throw new Error('سرور تصویر را به‌درستی ثبت نکرد.');
        if (ownImageCache.map) ownImageCache.map.set(String(img.public_url), String(img.id));
        results[index] = { id: String(img.id), url: String(img.public_url) };
      } else {
        results[index] = { id: own.get(source), url: source };
      }
    };
    // Up to 3 uploads at once (one-by-one made 8-12 photos very slow); the order of photos is kept.
    let next = 0, failure = null;
    const worker = async () => {
      while (!failure && next < list.length) {
        const index = next++;
        try { await one(list[index], index); } catch (error) { failure = failure || error; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
    if (failure) throw failure;
    return { ids: results.map((r) => r.id), urls: results.map((r) => r.url) };
  }

  function payloadFrom(draft, form, photoIds, minimumOfferToman) {
    const f = form || {};
    const photos = draft?.photos || f.photos || [];
    const title = String(draft?.title || '').trim();
    const year = Number(f.year || (title.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/) || [])[0]);
    const mileageType = ['used', 'zero', 'presale'].includes(f.mileageType) ? f.mileageType : 'used';
    const mileageRaw = String(f.miles ?? '').replace(/[^0-9]/g, '');
    const metadata = {
      adTitle: String(draft?.adTitle ?? f.adTitle ?? '').trim().slice(0, 80),
      engineType: String(f.engineType || ''), interiorColor: String(f.interiorColor || ''), driveTrain: String(f.driveTrain || ''),
      cylinders: String(f.cylinders || ''), engineVolume: String(f.engineVolume || ''), mileageType,
      deliveryTime: String(f.deliveryTime || ''), documentType: String(f.documentType || ''),
      powerOfAttorneyStatus: String(f.powerOfAttorneyStatus || ''), insuranceStatus: String(f.insuranceStatus || ''),
      region: String(f.region || ''), bodyConditionRating: Number.isFinite(f.bodyConditionRating) ? f.bodyConditionRating : null,
      paintedParts: Array.isArray(f.damagedParts) ? f.damagedParts.filter((x) => x && typeof x.key === 'string' && typeof x.status === 'string').slice(0,80) : [],
      tradeIn: f.tradeIn === true, acceptsOffers: f.acceptsOffers === true,
    };
    const amount = draft?.priceAmount == null || draft?.negotiable ? null : Number(draft.priceAmount);
    const result = {
      title, make: String(draft?.brand || f.brand || '').trim(), model: String(f.model || '').trim(), trim: String(draft?.trim || f.trim || ''),
      year, mileageKm: mileageType === 'used' && mileageRaw ? Number(mileageRaw) : null, bodyType: '',
      fuelType: String(f.fuelType || ''), transmission: String(f.transmission || ''), color: String(draft?.color || f.color || ''),
      conditionNote: '', description: String(draft?.description || f.description || '').trim(), city: String(draft?.city || f.city || '').trim(),
      priceToman: amount, priceNegotiable: draft?.negotiable === true || f.negotiable === true,
      photoIds, minimumOfferToman: f.acceptsOffers === true && minimumOfferToman != null && String(minimumOfferToman).trim() !== '' ? Number(String(minimumOfferToman).replace(/[^0-9]/g,'')) : null,
      metadata,
    };
    // Prevent accidental browser-provided fields from reaching a strict API schema.
    return result;
  }

  async function saveListing({ editId, draft, form, minPrice, acceptsOffers, idempotencyKey }) {
    const photos = Array.isArray(draft?.photos) ? draft.photos : (Array.isArray(form?.photos) ? form.photos : []);
    const uploaded = await uploadOrReusePhotos(photos);
    const formForPayload = { ...(form || {}), photos, acceptsOffers: acceptsOffers === true || form?.acceptsOffers === true };
    const payload = payloadFrom({ ...draft, photos }, formForPayload, uploaded.ids, minPrice);
    // A browser-only ID or sample seed must never be treated as a server listing ID.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(editId || ''));
    let result;
    if (editId) {
      if (!isUuid) throw new Error('این آگهی نسخهٔ محلی است و از سرور نیامده؛ برای جلوگیری از تغییر اطلاعات اشتباه، اول آگهی‌های سرور را تازه‌سازی کنید.');
      result = await api.listings.update(editId, payload);
    } else result = await api.listings.create(payload, idempotencyKey);
    const row = result?.listing;
    if (!row?.id) throw new Error('سرور آگهی را ذخیره کرد اما پاسخ قابل‌تأیید نبود. صفحه را تازه‌سازی و وضعیت آگهی‌های خود را بررسی کنید.');
    row.photos = uploaded.urls.map((url, index) => ({ id: uploaded.ids[index], url }));
    // The authenticated API response is authoritative; carry the private threshold only into this owner's UI DTO.
    row.minimum_offer_toman = acceptsOffers && minPrice != null && String(minPrice).trim() !== '' ? Number(String(minPrice).replace(/[^0-9]/g,'')) : null;
    row.status = String(row.status || 'pending');
    const card = rowToCard(row);
    return { card, status: card.status };
  }

  async function syncPublicListings() {
    try {
      const result = await api.listings.list({ page: '1', page_size: '50' });
      if (!Array.isArray(result?.items)) throw new Error('Unexpected listing response');
      if (typeof LISTINGS !== 'undefined' && Array.isArray(LISTINGS)) {
        LISTINGS.splice(0, LISTINGS.length, ...result.items.filter((row) => !window.CARMA_PENDING_DELETES?.has(String(row?.id))).map(rowToCard));
      }
      window.CARMA_SERVER_INVENTORY_LOADED = true;
      try { window.CARMA_DEMO && window.CARMA_DEMO.apply(); } catch (_) {}
      return true;
    } catch (error) {
      // A failed REFRESH must not wipe what is already on screen (it used to empty every list on one network
      // hiccup); only the very first load clears the built-in sample data.
      const alreadyLoaded = window.CARMA_SERVER_INVENTORY_LOADED === true;
      window.CARMA_SERVER_INVENTORY_LOADED = alreadyLoaded;
      if (!alreadyLoaded && window.CARMA_API_STRICT_MODE && typeof LISTINGS !== 'undefined' && Array.isArray(LISTINGS)) LISTINGS.splice(0, LISTINGS.length);
      try { window.CARMA_DEMO && window.CARMA_DEMO.apply(); } catch (_) {}
      console.warn('CarMaa public listings unavailable; demo data are not shown in strict mode.');
      return false;
    }
  }

  async function syncFavorites() {
    if (!window.CARMA_AUTH_USER) return false;
    try {
      const result = await api.account.favorites();
      const ids = (result?.items || []).map((row) => String(row.id)).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      if (typeof state !== 'undefined') state = { ...state, likedIds: ids };
      return true;
    } catch { return false; }
  }

  async function toggleFavorite(id) {
    if (!window.CARMA_AUTH_USER) throw new Error('برای ذخیرهٔ آگهی ابتدا وارد حساب کاربری شوید.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''))) throw new Error('این آگهی از سرور دریافت نشده است؛ ذخیره‌سازی آن ممکن نیست.');
    const result = await api.listings.favorite(id);
    const likedIds = Array.isArray(state?.likedIds) ? state.likedIds.filter((x) => String(x) !== String(id)) : [];
    if (result?.favorite === true) likedIds.push(String(id));
    else if (result?.favorite !== false) throw new Error('پاسخ سرور برای ذخیرهٔ آگهی معتبر نیست.');
    state = { ...state, likedIds };
    return result.favorite;
  }

  async function syncMyListings() {
    if (!window.CARMA_AUTH_USER) return false;
    try {
      const result = await api.listings.mine();
      const mapped = (result?.items || []).filter((row) => !window.CARMA_PENDING_DELETES?.has(String(row?.id))).map((row) => {
        const card = rowToCard(row);
        return { id: card.id, listing: card, status: card.status, why: row.rejection_reason || '', createdAt: card.createdAt, readyAt: card.createdAt };
      });
      if (typeof state !== 'undefined') state = { ...state, myListings: mapped };
      return true;
    } catch { return false; }
  }

  window.CARMA_MARKETPLACE = Object.freeze({ rowToCard, saveListing, syncPublicListings, syncMyListings, syncFavorites, toggleFavorite });
})();
