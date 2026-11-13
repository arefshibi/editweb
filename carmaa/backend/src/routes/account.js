import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { parsePositiveInt } from '../util.js';
import { validateUuidParam } from '../validation.js';
import { config } from '../config.js';
import { removeMedia } from '../services/media.js';
const router = Router();
router.param('id', validateUuidParam);
const writeLimit = createRateLimiter({name:'account-write',windowSeconds:60,max:20,key:(req)=>req.auth?.userId||req.ip});
router.use(authRequired);
router.get('/favorites', async (req,res,next)=>{
  try{
    const {rows}=await pool.query(`SELECT l.id,l.title,l.make,l.model,l.year,l.city,l.price_toman,l.created_at,
      (SELECT i.public_url FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=l.id ORDER BY li.position LIMIT 1) AS photo
      FROM listing_favorites f JOIN listings l ON l.id=f.listing_id WHERE f.user_id=$1 AND l.status='published' ORDER BY f.created_at DESC LIMIT 200`,[req.auth.userId]);
    res.json({items:rows});
  }catch(error){next(error);}
});
router.get('/saved-searches', async (req,res,next)=>{
  try{const {rows}=await pool.query('SELECT id,label,filters,notify_price_changes,created_at FROM saved_searches WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5',[req.auth.userId]);res.json({items:rows});}
  catch(error){next(error);}
});
router.post('/saved-searches', writeLimit, async (req,res,next)=>{
  try{
    const parsed=z.object({label:z.string().trim().max(120).optional().default(''),filters:z.record(z.string(),z.unknown()).refine(o=>JSON.stringify(o).length<=4000),notifyPriceChanges:z.boolean().optional().default(true)}).strict().safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:{code:'INVALID_SEARCH',message:'جستجوی ذخیره‌شده معتبر نیست.'}});
    const savedSearch=await transaction(async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[`saved-search:${req.auth.userId}`]);
      const count=await client.query('SELECT count(*)::int AS n FROM saved_searches WHERE user_id=$1',[req.auth.userId]);
      if(count.rows[0].n>=5)throw Object.assign(new Error('حداکثر پنج جستجوی ذخیره‌شده مجاز است.'),{status:409,code:'SEARCH_LIMIT'});
      const {rows}=await client.query('INSERT INTO saved_searches(user_id,label,filters,notify_price_changes) VALUES($1,$2,$3,$4) RETURNING id,label,filters,notify_price_changes,created_at',[req.auth.userId,parsed.data.label,parsed.data.filters,parsed.data.notifyPriceChanges]);
      return rows[0];
    });
    res.status(201).json({savedSearch});
  }catch(error){next(error);}
});
router.delete('/saved-searches/:id', writeLimit, async (req,res,next)=>{
  try{const {rowCount}=await pool.query('DELETE FROM saved_searches WHERE id=$1 AND user_id=$2',[req.params.id,req.auth.userId]);if(!rowCount)return res.status(404).json({error:{code:'NOT_FOUND',message:'جستجو پیدا نشد.'}});res.status(204).end();}
  catch(error){next(error);}
});
router.get('/offers/incoming', async (req,res,next)=>{
  try{
    const size=parsePositiveInt(req.query.limit,50,100);
    const {rows}=await pool.query(`SELECT o.id,o.listing_id,o.buyer_id,o.amount_toman,o.message,o.status,o.created_at,COALESCE(NULLIF(u.nickname,''),u.display_name) AS buyer_name,l.title AS listing_title
      FROM listing_offers o JOIN listings l ON l.id=o.listing_id JOIN users u ON u.id=o.buyer_id WHERE l.owner_id=$1 ORDER BY o.created_at DESC LIMIT ${size}`,[req.auth.userId]);
    res.json({items:rows});
  }catch(error){next(error);}
});
router.patch('/offers/:id', writeLimit, async (req,res,next)=>{
  try{
    const parsed=z.object({status:z.enum(['accepted','declined','withdrawn'])}).strict().safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:{code:'INVALID_OFFER_STATUS',message:'وضعیت پیشنهاد معتبر نیست.'}});
    const {rows}=await pool.query(`UPDATE listing_offers o SET status=$2,updated_at=now() WHERE o.id=$1 AND
      (( $2='withdrawn' AND o.buyer_id=$3) OR ($2 IN ('accepted','declined') AND EXISTS(SELECT 1 FROM listings l WHERE l.id=o.listing_id AND l.owner_id=$3)))
      AND o.status='pending' RETURNING o.id,o.status,o.listing_id,o.buyer_id`,[req.params.id,parsed.data.status,req.auth.userId]);
    if(!rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'پیشنهاد پیدا نشد یا امکان تغییر آن را ندارید.'}});
    const recipient=parsed.data.status==='withdrawn' ? (await pool.query('SELECT owner_id FROM listings WHERE id=$1',[rows[0].listing_id])).rows[0]?.owner_id : rows[0].buyer_id;
    if(recipient)await pool.query("INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'offer','وضعیت پیشنهاد تغییر کرد',$2,$3)",[recipient,`وضعیت پیشنهاد شما: ${parsed.data.status}`,{offerId:rows[0].id,listingId:rows[0].listing_id,status:parsed.data.status}]);
    res.json({offer:rows[0]});
  }catch(error){next(error);}
});
// SEC2-PATCH (D11): حذف حساب end-to-end (داده شخصی پاک، پرداختها برای قانون حسابداری بینام میمانند)
const deleteLimit = createRateLimiter({ name: 'account-delete', windowSeconds: 3600, max: 3, key: (req) => req.auth?.userId || req.ip });
router.delete('/me', deleteLimit, async (req, res, next) => {
  try {
    if (!z.object({ confirm: z.literal('DELETE') }).strict().safeParse(req.body).success) return res.status(400).json({ error: { code: 'CONFIRM_REQUIRED', message: 'برای حذف حساب باید تأیید ارسال شود.' } });
    if (['admin', 'moderator'].includes(req.auth.role)) return res.status(403).json({ error: { code: 'STAFF_CANNOT_SELF_DELETE', message: 'حساب مدیریتی را ابتدا از نقش مدیریتی خارج کنید.' } });
    const fresh = await pool.query("SELECT 1 FROM sessions WHERE id=$1 AND created_at > now() - interval '15 minutes'", [req.auth.sessionId]);
    if (!fresh.rowCount) return res.status(403).json({ error: { code: 'REAUTH_REQUIRED', message: 'برای حذف حساب دوباره با کد پیامکی وارد شوید و بلافاصله اقدام کنید.' } });
    const userId = req.auth.userId, keys = [], failed = [];
    await transaction(async (client) => {
      const step = async (name, sql) => { await client.query('SAVEPOINT s'); try { await client.query(sql, [userId]); await client.query('RELEASE SAVEPOINT s'); } catch { await client.query('ROLLBACK TO SAVEPOINT s'); failed.push(name); } };
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      for (const k of (await client.query('SELECT object_key FROM images WHERE owner_id=$1', [userId])).rows) keys.push(k.object_key);
      await step('auth_otps', 'DELETE FROM auth_otps WHERE phone_e164=(SELECT phone_e164 FROM users WHERE id=$1)');
      await step('listing_images', 'DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE owner_id=$1)');
      await step('listing_private', 'DELETE FROM listing_private_details WHERE owner_id=$1');
      await step('listings', "UPDATE listings SET status='archived',showroom_id=NULL,updated_at=now() WHERE owner_id=$1");
      await step('showroom', 'DELETE FROM showrooms WHERE owner_id=$1');
      await step('messages', 'UPDATE messages SET deleted_at=now() WHERE sender_id=$1 AND deleted_at IS NULL');
      for (const [n, sql] of [['favorites','DELETE FROM listing_favorites WHERE user_id=$1'],['saved_searches','DELETE FROM saved_searches WHERE user_id=$1'],['notifications','DELETE FROM notifications WHERE user_id=$1'],
        ['follows','DELETE FROM follows WHERE follower_id=$1 OR followed_user_id=$1'],['reads','DELETE FROM conversation_reads WHERE user_id=$1'],['blocks','DELETE FROM user_blocks WHERE blocker_id=$1 OR blocked_id=$1'],
        ['msg_likes','DELETE FROM message_likes WHERE user_id=$1'],['news_likes','DELETE FROM news_likes WHERE user_id=$1'],['news_comments','DELETE FROM news_comments WHERE user_id=$1'],
        ['story_seen','DELETE FROM story_seen WHERE user_id=$1'],['story_views','DELETE FROM story_views WHERE viewer_id=$1'],['sms_notifications','DELETE FROM sms_notifications WHERE user_id=$1'],
        ['story_hides','DELETE FROM story_hides WHERE owner_id=$1 OR hidden_user_id=$1'],['clears','DELETE FROM conversation_clears WHERE user_id=$1'],['post_likes','DELETE FROM social_post_likes WHERE user_id=$1'],
        ['post_comments','DELETE FROM social_post_comments WHERE owner_id=$1'],['posts','DELETE FROM social_posts WHERE owner_id=$1'],['stories','DELETE FROM stories WHERE owner_id=$1'],
        ['tickets','DELETE FROM support_tickets WHERE user_id=$1'],['reviews','DELETE FROM showroom_reviews WHERE reviewer_id=$1'],['offers','DELETE FROM listing_offers WHERE buyer_id=$1'],['reports','DELETE FROM reports WHERE reporter_id=$1'],
        ['images','DELETE FROM images WHERE owner_id=$1']]) await step(n, sql);
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
      await client.query(`UPDATE users SET status='deleted',deleted_at=now(),phone_e164='+99'||lpad((floor(random()*1e12))::bigint::text,12,'0'),display_name='',nickname=NULL,username=NULL,email=NULL,avatar_url=NULL,banner_url=NULL,sms_notify=false,totp_secret_enc=NULL,totp_enabled_at=NULL,updated_at=now() WHERE id=$1`, [userId]);
    });
    for (const k of keys) await removeMedia(k);
    req.log?.info({ event: 'account_deleted', userId, skipped: failed }, 'Account deleted');
    res.clearCookie(config.COOKIE_NAME, { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });
    res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true });
  } catch (error) { next(error); }
});

export default router;
