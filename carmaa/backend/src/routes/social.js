import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, authOptional, createRateLimiter } from '../middleware/security.js';
import { validateUuidParam } from '../validation.js';

const router = Router();
router.param('id', validateUuidParam);
const writeLimit = createRateLimiter({ name:'social-write', windowSeconds:60, max:30, key:(req)=>req.auth?.userId || req.ip });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = (v) => crypto.createHash('sha256').update(String(v)).digest();

const PUBLIC_USER_SQL = `SELECT u.id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS display_name,u.username,u.avatar_url,u.banner_url,u.created_at,
      (SELECT count(*)::int FROM listings l WHERE l.owner_id=u.id AND l.status='published' AND l.expires_at>now()) AS listing_count,
      (SELECT count(*)::int FROM follows f WHERE f.followed_user_id=u.id) AS follower_count,
      (SELECT count(*)::int FROM follows f WHERE f.follower_id=u.id AND f.followed_user_id IS NOT NULL) AS following_count
      FROM users u WHERE u.status='active' AND u.deleted_at IS NULL AND `;

// GET /social/users/by-username/User-48213  -> same payload as /users/:id (case-insensitive).  Used by the address /account/<username>.
router.get('/users/by-username/:username', async (req,res,next)=>{
  try {
    const name=String(req.params.username||'').trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9][a-z0-9_.-]{1,30}$/.test(name)) return res.status(404).json({error:{code:'NOT_FOUND',message:'کاربر پیدا نشد.'}});
    const {rows}=await pool.query(PUBLIC_USER_SQL+'lower(u.username)=$1',[name]);
    if(!rows[0]) return res.status(404).json({error:{code:'NOT_FOUND',message:'کاربر پیدا نشد.'}});
    res.json({user:rows[0]});
  } catch(e){next(e);}
});

router.get('/users/:id', async (req,res,next)=>{
  try {
    const {rows}=await pool.query(`SELECT u.id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS display_name,u.username,u.avatar_url,u.banner_url,u.created_at,
      (SELECT count(*)::int FROM listings l WHERE l.owner_id=u.id AND l.status='published' AND l.expires_at>now()) AS listing_count,
      (SELECT count(*)::int FROM follows f WHERE f.followed_user_id=u.id) AS follower_count,
      (SELECT count(*)::int FROM follows f WHERE f.follower_id=u.id AND f.followed_user_id IS NOT NULL) AS following_count
      FROM users u WHERE u.id=$1 AND u.status='active' AND u.deleted_at IS NULL`,[req.params.id]);
    if(!rows[0]) return res.status(404).json({error:{code:'NOT_FOUND',message:'کاربر پیدا نشد.'}});
    res.json({user:rows[0]});
  } catch(e){next(e);}
});
router.get('/users/:id/follow-status', authRequired, async(req,res,next)=>{
  try { const {rows}=await pool.query('SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND followed_user_id=$2) AS following',( [req.auth.userId,req.params.id] ));res.json({following:rows[0]?.following===true}); }catch(e){next(e);}
});
router.get('/users/:id/followers', async(req,res,next)=>{
  try { const {rows}=await pool.query(`SELECT u.id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS display_name,u.username,u.avatar_url,f.created_at FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.followed_user_id=$1 AND u.status='active' AND u.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 200`,[req.params.id]);res.json({items:rows}); }catch(e){next(e);}
});
router.get('/users/:id/following', async(req,res,next)=>{
  try { const {rows}=await pool.query(`SELECT u.id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS display_name,u.username,u.avatar_url,f.created_at FROM follows f JOIN users u ON u.id=f.followed_user_id WHERE f.follower_id=$1 AND u.status='active' AND u.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 200`,[req.params.id]);res.json({items:rows}); }catch(e){next(e);}
});
router.post('/users/:id/follow', authRequired, writeLimit, async(req,res,next)=>{
  try {
    if(req.params.id===req.auth.userId) return res.status(400).json({error:{code:'SELF_FOLLOW',message:'نمی‌توانید حساب خودتان را دنبال کنید.'}});
    const result=await transaction(async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`user-follow:${req.auth.userId}:${req.params.id}`]);
      const target=await client.query("SELECT id FROM users WHERE id=$1 AND status='active' AND deleted_at IS NULL FOR SHARE",[req.params.id]);
      if(!target.rows[0]) throw Object.assign(new Error('کاربر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      const removed=await client.query('DELETE FROM follows WHERE follower_id=$1 AND followed_user_id=$2 RETURNING follower_id',[req.auth.userId,req.params.id]);
      if(removed.rowCount) return false;
      const inserted=await client.query('INSERT INTO follows(follower_id,followed_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING follower_id',[req.auth.userId,req.params.id]);
      if (inserted.rowCount) await client.query("INSERT INTO notifications(user_id,type,title,body,data) SELECT $1::uuid,'follow','دنبال‌کنندهٔ جدید','یک کاربر شما را دنبال کرد.',$2::jsonb WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id=$1::uuid AND type='follow' AND data->>'followerId'=$3 AND created_at > now()-interval '1 day')",[req.params.id,{followerId:req.auth.userId},req.auth.userId]);
      return inserted.rowCount > 0;
    });
    const {rows}=await pool.query('SELECT count(*)::int AS count FROM follows WHERE followed_user_id=$1',[req.params.id]);
    res.json({following:result,followerCount:rows[0].count});
  }catch(e){next(e);}
});
router.get('/stories/mine', authRequired, async(req,res,next)=>{
  try { const {rows}=await pool.query(`SELECT s.id,s.owner_id,s.listing_id,s.caption,s.created_at,s.expires_at,i.public_url AS media_url,COALESCE(NULLIF(u.nickname,''),u.display_name) AS owner_name,u.username,u.avatar_url,(SELECT count(*)::int FROM story_views v WHERE v.story_id=s.id) AS view_count FROM stories s JOIN images i ON i.id=s.image_id JOIN users u ON u.id=s.owner_id WHERE s.owner_id=$1 AND s.expires_at>now() ORDER BY s.created_at DESC LIMIT 10`,[req.auth.userId]);res.json({items:rows}); }catch(e){next(e);}
});
// Suggested active users (Instagram-style): ranked on every call from live activity signals.
router.get('/stories/suggested', authOptional, async(req,res,next)=>{
  try {
    res.set('Cache-Control','private, no-store');
    const me=req.auth?.userId||null;
    if(!me)return res.json({items:[]});
    const {rows}=await pool.query(`
      WITH cand AS (
        SELECT s.owner_id,max(s.created_at) AS last_story,count(*)::int AS story_count
        FROM stories s JOIN users u ON u.id=s.owner_id
        WHERE s.expires_at>now() AND s.owner_id<>$1::uuid AND u.status='active' AND u.deleted_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1::uuid AND f.followed_user_id=s.owner_id)
          AND NOT EXISTS(SELECT 1 FROM story_hides h WHERE h.owner_id=s.owner_id AND h.hidden_user_id=$1::uuid)
          AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1::uuid AND b.blocked_id=s.owner_id) OR (b.blocker_id=s.owner_id AND b.blocked_id=$1::uuid))
        GROUP BY s.owner_id
      ), sig AS (
        SELECT c.owner_id,c.last_story,c.story_count,
          COALESCE((SELECT EXTRACT(EPOCH FROM (now()-max(se.last_seen_at)))/3600.0 FROM sessions se WHERE se.user_id=c.owner_id AND se.revoked_at IS NULL),9999) AS idle_h,
          (SELECT count(*)::int FROM listings l WHERE l.owner_id=c.owner_id AND l.status='published' AND COALESCE(l.published_at,l.created_at)>now()-interval '7 days') AS new_listings,
          (SELECT count(*)::int FROM story_views v JOIN stories s2 ON s2.id=v.story_id WHERE s2.owner_id=c.owner_id AND v.viewed_at>now()-interval '24 hours') AS recent_views,
          (SELECT count(*)::int FROM messages m WHERE m.sender_id=c.owner_id AND m.created_at>now()-interval '24 hours') AS recent_msgs,
          (SELECT count(*)::int FROM follows f2 WHERE f2.followed_user_id=c.owner_id) AS followers
        FROM cand c
      ), scored AS (
        SELECT sig.*,
          ( CASE WHEN idle_h<1 THEN 5 WHEN idle_h<6 THEN 4 WHEN idle_h<24 THEN 3 WHEN idle_h<72 THEN 1.5 WHEN idle_h<168 THEN 0.5 ELSE 0 END
            + LEAST(new_listings,3)*1.5 + ln(1+recent_views)*1.2 + ln(1+recent_msgs)*0.8 + ln(1+followers)*0.7
            + LEAST(story_count,3)*0.5
            + GREATEST(0, 3 - EXTRACT(EPOCH FROM (now()-last_story))/3600.0/8.0) )::float8 AS score
        FROM sig
      ), top AS (SELECT * FROM scored ORDER BY score DESC, last_story DESC LIMIT 15)
      SELECT s.id,s.owner_id,s.listing_id,s.caption,s.created_at,s.expires_at,i.public_url AS media_url,
        COALESCE(NULLIF(u.nickname,''),u.display_name) AS owner_name,u.username,u.avatar_url,
        0::int AS view_count,
        EXISTS(SELECT 1 FROM story_seen ss WHERE ss.story_id=s.id AND ss.user_id=$1::uuid) AS seen,
        true AS suggested,round(t.score::numeric,2)::float8 AS score,
        CASE WHEN t.idle_h<1 THEN 'الان فعاله' WHEN t.new_listings>0 THEN 'آگهی جدید گذاشته' WHEN t.recent_views>=5 THEN 'استوری‌هاش پربازدیده' WHEN t.idle_h<24 THEN 'امروز فعال بوده' ELSE 'کاربر فعال' END AS reason
      FROM top t JOIN stories s ON s.owner_id=t.owner_id AND s.expires_at>now()
      JOIN images i ON i.id=s.image_id JOIN users u ON u.id=s.owner_id
      ORDER BY t.score DESC,s.created_at ASC LIMIT 60`,[me]);
    res.json({items:rows});
  }catch(e){next(e);}
});
router.get('/stories', authOptional, async(req,res,next)=>{
  try {
    const ownerId=typeof req.query.owner_id==='string'&&UUID.test(req.query.owner_id)?req.query.owner_id:null;
    const values=[req.auth?.userId||null];let where='s.expires_at>now()';if(ownerId){values.push(ownerId);where+=` AND s.owner_id=$${values.length}`;}
    const {rows}=await pool.query(`SELECT s.id,s.owner_id,s.listing_id,s.caption,s.created_at,s.expires_at,i.public_url AS media_url,COALESCE(NULLIF(u.nickname,''),u.display_name) AS owner_name,u.username,u.avatar_url,
      0::int AS view_count,
      ($1::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM story_seen ss WHERE ss.story_id=s.id AND ss.user_id=$1::uuid)) AS seen
      FROM stories s JOIN images i ON i.id=s.image_id JOIN users u ON u.id=s.owner_id WHERE ${where} AND NOT ($1::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM story_hides h WHERE h.owner_id=s.owner_id AND h.hidden_user_id=$1::uuid)) AND u.status='active' AND u.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT 300`,values);
    res.json({items:rows});
  }catch(e){next(e);}
});
router.post('/stories', authRequired, writeLimit, async(req,res,next)=>{
  try {
    const parsed=z.object({imageId:z.string().uuid(),caption:z.string().trim().max(200).optional().default(''),listingId:z.string().trim().min(1).max(100).nullable().optional()}).strict().safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:{code:'INVALID_STORY',message:'اطلاعات استوری معتبر نیست.'}});
    const s=parsed.data;
    const story=await transaction(async(client)=>{
      const img=await client.query('SELECT id FROM images WHERE id=$1 AND owner_id=$2',[s.imageId,req.auth.userId]);if(!img.rows[0])throw Object.assign(new Error('تصویر متعلق به این حساب نیست.'),{status:400,code:'INVALID_IMAGE'});
      if(s.listingId){const l=await client.query("SELECT id FROM listings WHERE id=$1 AND owner_id=$2 AND status IN ('published','pending')",[s.listingId,req.auth.userId]);if(!l.rows[0])throw Object.assign(new Error('آگهی پیوست‌شده معتبر نیست.'),{status:400,code:'INVALID_LISTING'});}
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`story-limit:${req.auth.userId}`]);const n=await client.query('SELECT count(*)::int AS n FROM stories WHERE owner_id=$1 AND expires_at>now()',[req.auth.userId]);if(n.rows[0].n>=10)throw Object.assign(new Error('حداکثر ۱۰ استوری فعال مجاز است.'),{status:409,code:'STORY_LIMIT'});
      const {rows}=await client.query(`INSERT INTO stories(owner_id,image_id,listing_id,caption) VALUES($1,$2,$3,$4) RETURNING id,owner_id,listing_id,caption,created_at,expires_at`,[req.auth.userId,s.imageId,s.listingId||null,s.caption]);return rows[0];
    });
    res.status(201).json({story});
  }catch(e){next(e);}
});
// Only the owner of an active story may see the viewer list.
router.get('/stories/:id/viewers', authRequired, async(req,res,next)=>{
  try {
    const {rows:storyRows}=await pool.query(
      'SELECT id FROM stories WHERE id=$1 AND owner_id=$2 AND expires_at>now()',
      [req.params.id,req.auth.userId]
    );
    if(!storyRows[0]) return res.status(404).json({error:{code:'NOT_FOUND',message:'استوری پیدا نشد یا اجازه مشاهده بازدیدکنندگان آن را ندارید.'}});
    const [viewersResult,countsResult]=await Promise.all([
      pool.query(`SELECT COALESCE(NULLIF(u.nickname,''),u.display_name) AS display_name,
          u.id,u.username,u.avatar_url,v.viewed_at,
          EXISTS(SELECT 1 FROM story_hides h WHERE h.owner_id=$2 AND h.hidden_user_id=u.id) AS hidden
        FROM story_views v
        JOIN users u ON u.id=v.viewer_id
        WHERE v.story_id=$1 AND u.status='active' AND u.deleted_at IS NULL
        ORDER BY v.viewed_at DESC LIMIT 200`,[req.params.id,req.auth.userId]),
      pool.query(`SELECT count(*)::int AS total,
          count(*) FILTER (WHERE viewer_id IS NULL)::int AS guest_count
        FROM story_views WHERE story_id=$1`,[req.params.id])
    ]);
    res.set('Cache-Control','private, no-store');
    res.json({
      total:Number(countsResult.rows[0]?.total||0),
      guestCount:Number(countsResult.rows[0]?.guest_count||0),
      items:viewersResult.rows.map(v=>({
        displayName:v.display_name||v.username||'کاربر',
        id:v.id,username:v.username||'',avatarUrl:v.avatar_url||'',viewedAt:v.viewed_at,hidden:!!v.hidden
      }))
    });
  }catch(e){next(e);}
});

// Owner hides all of their stories from one user (Instagram "hide story from").
router.post('/story-hides', authRequired, writeLimit, async(req,res,next)=>{
  try {
    const uid=String(req.body?.userId||'');
    if(!UUID.test(uid))return res.status(400).json({error:{code:'BAD_REQUEST',message:'شناسه کاربر نامعتبر است.'}});
    if(uid===req.auth.userId)return res.status(400).json({error:{code:'BAD_REQUEST',message:'نمی‌توانی استوری را از خودت پنهان کنی.'}});
    await pool.query('INSERT INTO story_hides(owner_id,hidden_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.auth.userId,uid]);
    res.json({hidden:true});
  }catch(e){next(e);}
});
router.delete('/story-hides/:uid', authRequired, writeLimit, async(req,res,next)=>{
  try {
    if(!UUID.test(req.params.uid))return res.status(400).json({error:{code:'BAD_REQUEST',message:'شناسه کاربر نامعتبر است.'}});
    await pool.query('DELETE FROM story_hides WHERE owner_id=$1 AND hidden_user_id=$2',[req.auth.userId,req.params.uid]);
    res.json({hidden:false});
  }catch(e){next(e);}
});

router.post('/stories/:id/view', authOptional, writeLimit, async(req,res,next)=>{
  try {
    const {rows}=await pool.query('SELECT id,owner_id FROM stories WHERE id=$1 AND expires_at>now()',[req.params.id]);if(!rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'استوری پیدا نشد یا منقضی شده است.'}});
    if(req.auth?.userId && req.auth.userId===rows[0].owner_id)return res.json({counted:false});
    if(req.auth?.userId){const h=await pool.query('SELECT 1 FROM story_hides WHERE owner_id=$1 AND hidden_user_id=$2',[rows[0].owner_id,req.auth.userId]);if(h.rowCount)return res.status(404).json({error:{code:'NOT_FOUND',message:'استوری پیدا نشد یا منقضی شده است.'}});}
    const device=typeof req.body?.deviceId==='string'?req.body.deviceId.slice(0,128):'';
    if(req.auth?.userId)await pool.query('INSERT INTO story_views(story_id,viewer_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.auth.userId]);
    else if(device)await pool.query('INSERT INTO story_views(story_id,device_digest) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,digest(device)]);
    else return res.status(400).json({error:{code:'VIEWER_REQUIRED',message:'شناسه بازدیدکننده لازم است.'}});
    const count=await pool.query('SELECT count(*)::int AS n FROM story_views WHERE story_id=$1',[req.params.id]);res.json({counted:true,viewCount:count.rows[0].n});
  }catch(e){next(e);}
});
router.post('/stories/:id/seen', authRequired, writeLimit, async(req,res,next)=>{
  try {
    const {rows}=await pool.query('SELECT id FROM stories WHERE id=$1 AND expires_at>now()',[req.params.id]);if(!rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'استوری پیدا نشد یا منقضی شده است.'}});
    await pool.query('INSERT INTO story_seen(story_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.auth.userId]);
    res.json({seen:true});
  }catch(e){next(e);}
});
router.delete('/stories/:id', authRequired, writeLimit, async(req,res,next)=>{
  try{const {rowCount}=await pool.query('DELETE FROM stories WHERE id=$1 AND owner_id=$2',[req.params.id,req.auth.userId]);if(!rowCount)return res.status(404).json({error:{code:'NOT_FOUND',message:'استوری پیدا نشد.'}});res.status(204).end();}catch(e){next(e);}
});
// -------------------- social feed posts --------------------
const postInput = z.object({
  body: z.string().trim().max(2200).optional().default(''),
  imageId: z.string().uuid().nullable().optional().default(null),
}).strict();

router.get('/posts', authOptional, async (req, res, next) => {
  try {
    const me = req.auth?.userId || null;
    const scope = String(req.query.scope || 'all') === 'following' ? 'following' : 'all';
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
    res.set('Cache-Control', 'private, no-store');
    const { rows } = await pool.query(`
      SELECT p.id,p.owner_id,p.body,p.created_at,p.updated_at,
        i.public_url AS image_url,
        COALESCE(NULLIF(u.nickname,''),u.display_name,u.username,'کاربر') AS owner_name,
        u.username,u.avatar_url,
        (SELECT count(*)::int FROM social_post_likes pl WHERE pl.post_id=p.id) AS like_count,
        (SELECT count(*)::int FROM social_post_comments pc WHERE pc.post_id=p.id AND pc.deleted_at IS NULL) AS comment_count,
        ($1::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM social_post_likes pl WHERE pl.post_id=p.id AND pl.user_id=$1::uuid)) AS is_liked,
        ($1::uuid IS NOT NULL AND p.owner_id=$1::uuid) AS is_owner
      FROM social_posts p
      JOIN users u ON u.id=p.owner_id
      LEFT JOIN images i ON i.id=p.image_id
      WHERE p.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL
        AND ($1::uuid IS NULL OR NOT EXISTS(
          SELECT 1 FROM user_blocks b WHERE
            (b.blocker_id=$1::uuid AND b.blocked_id=p.owner_id) OR
            (b.blocker_id=p.owner_id AND b.blocked_id=$1::uuid)
        ))
        AND ($2::text <> 'following' OR ($1::uuid IS NOT NULL AND EXISTS(
          SELECT 1 FROM follows f WHERE f.follower_id=$1::uuid AND f.followed_user_id=p.owner_id
        )))
      ORDER BY p.created_at DESC,p.id DESC
      LIMIT $3`, [me, scope, limit]);
    res.json({ items: rows });
  } catch (e) { next(e); }
});

router.post('/posts', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = postInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_POST', message: 'متن یا تصویر پست معتبر نیست.' } });
    const body = parsed.data.body;
    const imageId = parsed.data.imageId;
    if (!body && !imageId) return res.status(400).json({ error: { code: 'EMPTY_POST', message: 'برای انتشار، متن یا تصویر اضافه کنید.' } });
    const created = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`social-post-create:${req.auth.userId}`]);
      const count = await client.query("SELECT count(*)::int AS n FROM social_posts WHERE owner_id=$1 AND created_at>now()-interval '1 hour' AND deleted_at IS NULL", [req.auth.userId]);
      if (Number(count.rows[0]?.n || 0) >= 10) throw Object.assign(new Error('در هر ساعت حداکثر ۱۰ پست می‌توانید منتشر کنید.'), { status: 429, code: 'POST_RATE_LIMIT' });
      if (imageId) {
        const image = await client.query('SELECT id FROM images WHERE id=$1 AND owner_id=$2', [imageId, req.auth.userId]);
        if (!image.rows[0]) throw Object.assign(new Error('تصویر متعلق به این حساب نیست یا پیدا نشد.'), { status: 400, code: 'INVALID_IMAGE' });
      }
      const { rows } = await client.query(
        'INSERT INTO social_posts(owner_id,image_id,body) VALUES($1,$2,$3) RETURNING id,owner_id,body,created_at,updated_at,image_id',
        [req.auth.userId, imageId, body]
      );
      return rows[0];
    });
    const { rows } = await pool.query(`
      SELECT p.id,p.owner_id,p.body,p.created_at,p.updated_at,i.public_url AS image_url,
        COALESCE(NULLIF(u.nickname,''),u.display_name,u.username,'کاربر') AS owner_name,u.username,u.avatar_url,
        0::int AS like_count,0::int AS comment_count,false AS is_liked,true AS is_owner
      FROM social_posts p JOIN users u ON u.id=p.owner_id LEFT JOIN images i ON i.id=p.image_id
      WHERE p.id=$1`, [created.id]);
    res.status(201).json({ post: rows[0] });
  } catch (e) { next(e); }
});

router.post('/posts/:id/like', authRequired, writeLimit, async (req, res, next) => {
  try {
    const liked = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`social-post-like:${req.params.id}:${req.auth.userId}`]);
      const post = await client.query('SELECT id FROM social_posts WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
      if (!post.rows[0]) throw Object.assign(new Error('پست پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      const removed = await client.query('DELETE FROM social_post_likes WHERE post_id=$1 AND user_id=$2 RETURNING post_id', [req.params.id, req.auth.userId]);
      if (removed.rowCount) return false;
      await client.query('INSERT INTO social_post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.auth.userId]);
      return true;
    });
    const total = await pool.query('SELECT count(*)::int AS n FROM social_post_likes WHERE post_id=$1', [req.params.id]);
    res.json({ liked, likeCount: Number(total.rows[0]?.n || 0) });
  } catch (e) { next(e); }
});

router.get('/posts/:id/comments', authOptional, async (req, res, next) => {
  try {
    const post = await pool.query('SELECT id FROM social_posts WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'پست پیدا نشد.' } });
    const { rows } = await pool.query(`
      SELECT c.id,c.post_id,c.owner_id,c.body,c.created_at,
        COALESCE(NULLIF(u.nickname,''),u.display_name,u.username,'کاربر') AS owner_name,
        u.username,u.avatar_url,($1::uuid IS NOT NULL AND c.owner_id=$1::uuid) AS is_owner
      FROM social_post_comments c JOIN users u ON u.id=c.owner_id
      WHERE c.post_id=$2 AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL
      ORDER BY c.created_at DESC LIMIT 80`, [req.auth?.userId || null, req.params.id]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ items: rows });
  } catch (e) { next(e); }
});

router.post('/posts/:id/comments', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ body: z.string().trim().min(1).max(800) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_COMMENT', message: 'متن دیدگاه باید بین ۱ تا ۸۰۰ نویسه باشد.' } });
    const { rows: postRows } = await pool.query('SELECT id,owner_id FROM social_posts WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
    if (!postRows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'پست پیدا نشد.' } });
    if (postRows[0].owner_id !== req.auth.userId) {
      const blocked = await pool.query(`SELECT 1 FROM user_blocks WHERE
        (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1`, [req.auth.userId, postRows[0].owner_id]);
      if (blocked.rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'پست پیدا نشد.' } });
    }
    const { rows } = await pool.query(`
      INSERT INTO social_post_comments(post_id,owner_id,body) VALUES($1,$2,$3)
      RETURNING id,post_id,owner_id,body,created_at`, [req.params.id, req.auth.userId, parsed.data.body]);
    const c = rows[0];
    const { rows: authorRows } = await pool.query(`SELECT COALESCE(NULLIF(nickname,''),display_name,username,'کاربر') AS owner_name,username,avatar_url FROM users WHERE id=$1`, [req.auth.userId]);
    res.status(201).json({ comment: { ...c, ...authorRows[0], is_owner: true } });
  } catch (e) { next(e); }
});

router.delete('/posts/:id', authRequired, writeLimit, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('UPDATE social_posts SET deleted_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL', [req.params.id, req.auth.userId]);
    if (!rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'پست پیدا نشد یا اجازه حذف آن را ندارید.' } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/listings/:id/stats',authRequired,async(req,res,next)=>{
  try{
    const owner=await pool.query('SELECT id,view_count FROM listings WHERE id=$1 AND owner_id=$2',[req.params.id,req.auth.userId]);if(!owner.rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'آگهی پیدا نشد.'}});
    const days=Math.max(1,Math.min(90,Number.parseInt(String(req.query.days||'7'),10)||7));
    const {rows}=await pool.query(`SELECT date_trunc('day',created_at)::date AS day,event_type,count(*)::int AS count FROM listing_interaction_events WHERE listing_id=$1 AND created_at>=now()-($2::int * interval '1 day') GROUP BY 1,2 ORDER BY 1`,[req.params.id,days]);
    const totals=await pool.query(`SELECT event_type,count(*)::int AS count FROM listing_interaction_events WHERE listing_id=$1 AND created_at>=now()-($2::int * interval '1 day') GROUP BY event_type`,[req.params.id,days]);
    res.json({listingId:req.params.id,days,views:Number(owner.rows[0].view_count||0),totals:Object.fromEntries(totals.rows.map(r=>[r.event_type,r.count])),series:rows});
  }catch(e){next(e);}
});
router.post('/listings/:id/events',authOptional,writeLimit,async(req,res,next)=>{
  try{
    const parsed=z.object({type:z.enum(['view','contact_click','share','favorite'])}).strict().safeParse(req.body);if(!parsed.success)return res.status(400).json({error:{code:'INVALID_EVENT',message:'نوع رویداد معتبر نیست.'}});
    const listing=await pool.query("SELECT id,owner_id FROM listings WHERE id=$1 AND status='published' AND expires_at>now()",[req.params.id]);if(!listing.rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'آگهی پیدا نشد.'}});
    if(req.auth?.userId===listing.rows[0].owner_id)return res.json({recorded:false});
    if(parsed.data.type==='view') { await pool.query('UPDATE listings SET view_count=view_count+1 WHERE id=$1',[req.params.id]); }
    const device=String(req.headers['x-request-id']||req.ip||'').slice(0,256);
    await pool.query('INSERT INTO listing_interaction_events(listing_id,actor_id,device_digest,event_type) VALUES($1,$2,$3,$4)',[req.params.id,req.auth?.userId||null,req.auth?.userId?null:digest(device),parsed.data.type]);res.status(202).json({recorded:true});
  }catch(e){next(e);}
});
export default router;
