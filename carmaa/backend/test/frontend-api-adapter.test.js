import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, '../../js/43-api-ui-integration.js'), 'utf8');
const uid = '123e4567-e89b-42d3-a456-426614174000';
function setup(auth = true) {
  const calls=[];
  const question={id:uid,title:'عنوان پرسش آزمایشی',body:'متن پرسش آزمایشی برای تست',category:'technical',brand:'Toyota',model:'Corolla',vehicle_year:'1402',view_count:3,image_id:null,image_url:null,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-02T00:00:00Z',author_id:auth?'user-1':'user-2',author_name:'کاربر تست',answer_count:1,tags:[]};
  const answer={id:'223e4567-e89b-42d3-a456-426614174000',question_id:uid,body:'پاسخ آزمایشی معتبر',author_id:'user-2',author_name:'پاسخ‌دهنده',is_accepted:false,helpful_count:2,created_at:'2026-01-02T00:00:00Z'};
  const api={enabled:true, qa:{async list(p){calls.push(['list',p]);return{items:[question],total:1};},async stats(){return{total:1,byCategory:{technical:1}};},async get(id){calls.push(['get',id]);return{question,answers:[answer]};},async create(p){calls.push(['create',p]);return{question:{...question,...p,id:uid}};},async answer(id,body){calls.push(['answer',id,body]);return{answer:{...answer,question_id:id,body}};},async vote(id){calls.push(['vote',id]);return{changed:true,helpful:3};},async accept(q,a){calls.push(['accept',q,a]);return{answer:{id:a,is_accepted:true}};},async mine(){return{items:[question]};},async view(id){return{views:4};}},uploads:{async image(){return{image:{id:'323e4567-e89b-42d3-a456-426614174000',public_url:'/media/test.webp'}};}},auth:{async me(){return{user:{id:'user-1'}};}},account:{async updateProfile(p){return{user:{id:'user-1',...p}};},async savedSearches(){return{items:[]};},async saveSearch(p){return p;},async removeSavedSearch(){return{};}},notifications:{async list(){return{items:[]};},async read(id){return{id};},async readAll(){return{ok:true};}}};
  const store={};
  const window={CARMA_API:api,CARMA_AUTH_USER:auth?{id:'user-1',displayName:'کاربر تست'}:null,MARQUE_QA:{store}};
  const context={window,URL,location:{origin:'https://carmaa.example'},fetch:async()=>({blob:async()=>new Blob(['x'],{type:'image/jpeg'})}),File,Blob,console};
  vm.runInNewContext(source,context);
  return {window,store,calls};
}

test('Q&A adapter reads public questions from API and maps server UUID DTOs',async()=>{
  const {store,calls}=setup(); const list=await store.listQuestions({category:'technical'});
  assert.equal(list.length,1); assert.equal(list[0].id,uid); assert.equal(list[0].answerCount,1); assert.equal(calls[0][0],'list');
});
test('Q&A writes require an authenticated server session',async()=>{
  const {store,calls}=setup(false);
  await assert.rejects(()=>store.createQuestion({title:'عنوان پرسش معتبر',body:'متن پرسش معتبر و کافی برای ثبت',category:'technical'}),e=>e.code==='unauthenticated');
  assert.equal(calls.some(c=>c[0]==='create'),false);
});
test('Q&A answer, vote, accept and view use API endpoints',async()=>{
  const {store,calls}=setup();
  const answer=await store.addAnswer({questionId:uid,body:'پاسخ معتبر برای سوال'}); assert.equal(answer.questionId,uid);
  const vote=await store.voteHelpful(answer.id); assert.equal(vote.changed,true);
  const accepted=await store.acceptAnswer(uid,answer.id); assert.equal(accepted.id,uid);
  assert.equal(await store.recordView(uid),4);
  assert.deepEqual(calls.filter(c=>['answer','vote','accept'].includes(c[0])).map(c=>c[0]),['answer','vote','accept']);
});
test('profile and saved-search adapter exposes server-backed helpers',async()=>{
  const {window}=setup(); const profile=await window.CARMA_SERVER_ACCOUNT.refreshProfile(); assert.equal(profile.id,'user-1');
  const saved=await window.CARMA_SERVER_ACCOUNT.listSavedSearches(); assert.deepEqual(saved,[]);
});

test('social, story and listing analytics routes are exposed through the API client',()=>{
  const client=fs.readFileSync(path.resolve(here,'../../js/00-api-client.js'),'utf8');
  const social=fs.readFileSync(path.resolve(here,'../src/routes/social.js'),'utf8');
  const migration=fs.readFileSync(path.resolve(here,'../migrations/004_social_stories_listing_stats.sql'),'utf8');
  assert.match(client,/toggleUserFollow\(id\)/);
  assert.match(client,/createStory\(payload\)/);
  assert.match(client,/priceHistory\(id\)/);
  assert.match(social,/router\.post\('\/users\/:id\/follow'/);
  assert.match(social,/router\.get\('\/stories\/mine', authRequired/);
  assert.match(social,/router\.get\('\/listings\/:id\/stats',authRequired/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS story_views/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS listing_interaction_events/);
});

test('server-mode personal follow and story flows use server API instead of browser-only state',()=>{
  const profile=fs.readFileSync(path.resolve(here,'../../js/36-profile-page.js'),'utf8');
  const stories=fs.readFileSync(path.resolve(here,'../../js/27-stories.js'),'utf8');
  const stats=fs.readFileSync(path.resolve(here,'../../js/25-ad-stats.js'),'utf8');
  assert.match(profile,/social\.toggleUserFollow\(target\)/);
  assert.match(stories,/social\.createStory\(/);
  assert.match(stories,/social\.deleteStory\(/);
  assert.match(stories,/social\.viewStory\(/);
  assert.match(stats,/CARMA_AD_STATS_CACHE/);
});

test('story replies use authenticated server-backed direct conversations',()=>{
  const messages=fs.readFileSync(path.resolve(here,'../src/routes/messages.js'),'utf8');
  const migration=fs.readFileSync(path.resolve(here,'../migrations/005_direct_conversations.sql'),'utf8');
  const client=fs.readFileSync(path.resolve(here,'../../js/26-messaging.js'),'utf8');
  const stories=fs.readFileSync(path.resolve(here,'../../js/27-stories.js'),'utf8');
  assert.match(messages,/router\.post\('\/conversations\/direct'/);
  assert.match(messages,/LEFT JOIN listings l ON l\.id=c\.listing_id/);
  assert.match(migration,/ALTER COLUMN listing_id DROP NOT NULL/);
  assert.match(client,/async direct\(userId\)/);
  assert.match(client,/API\.direct\(targetId\)/);
  assert.match(stories,/await window\.MARQUE_CHAT\.replyToStory/);
});

test('strict API mode suppresses seeded demo stories and local-only personal follows',()=>{
  const stories=fs.readFileSync(path.resolve(here,'../../js/27-stories.js'),'utf8');
  const profile=fs.readFileSync(path.resolve(here,'../../js/36-profile-page.js'),'utf8');
  assert.match(stories,/readStories\(\)\.concat\(window\.CARMA_API\?\.enabled \? \[\] : seedStories\(\)\)/);
  assert.match(profile,/window\.CARMA_API\?\.enabled && !isServerShowroom && !isServerUser/);
});

test('server showroom ratings use the review API instead of local browser votes',()=>{
  const frontend=fs.readFileSync(path.resolve(here,'../../js/13-pages-home-listings-vehicle.js'),'utf8');
  const routes=fs.readFileSync(path.resolve(here,'../src/routes/showrooms.js'),'utf8');
  assert.match(frontend,/CARMA_API\.showrooms\.review\(id, \{ stars: ratingValue, body: "" \}\)/);
  assert.match(frontend,/CARMA_SERVER_SHOWROOMS.*review_count/s);
  assert.match(routes,/router\.post\('\/:id\/reviews', authRequired/);
});

test('accepting a server offer carries buyer UUID into direct chat connection',()=>{
  const frontend=fs.readFileSync(path.resolve(here,'../../js/37-notifications.js'),'utf8');
  const route=fs.readFileSync(path.resolve(here,'../src/routes/listings.js'),'utf8');
  const chat=fs.readFileSync(path.resolve(here,'../../js/26-messaging.js'),'utf8');
  assert.match(route,/buyerId: req\.auth\.userId/);
  assert.match(frontend,/connectWithBuyer\(\{listingId:d\.listingId,buyerId:d\.buyerId\}\)/);
  assert.match(chat,/async function connectWithBuyer/);
});


test('support contact form persists authenticated tickets and notifies administrators',()=>{
  const app=fs.readFileSync(path.resolve(here,'../src/app.js'),'utf8');
  const route=fs.readFileSync(path.resolve(here,'../src/routes/support.js'),'utf8');
  const migration=fs.readFileSync(path.resolve(here,'../migrations/006_support_tickets.sql'),'utf8');
  const client=fs.readFileSync(path.resolve(here,'../../js/00-api-client.js'),'utf8');
  const ui=fs.readFileSync(path.resolve(here,'../../js/08-auth-modal-toast.js'),'utf8');
  assert.match(app,/app\.use\('\/api\/v1\/support', supportRouter\)/);
  assert.match(route,/router\.post\('\/tickets', writeLimit/);
  assert.match(route,/role='admin'/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS support_tickets/);
  assert.match(client,/support: Object\.freeze/);
  assert.match(ui,/m\.type===\"supportTicket\"/);
});


test('chat photos, voice messages and story snapshots are validated and rendered',()=>{
  const messages=fs.readFileSync(path.resolve(here,'../src/routes/messages.js'),'utf8');
  const migration=fs.readFileSync(path.resolve(here,'../migrations/011_message_media.sql'),'utf8');
  const client=fs.readFileSync(path.resolve(here,'../../js/26-messaging.js'),'utf8');
  const stories=fs.readFileSync(path.resolve(here,'../../js/27-stories.js'),'utf8');
  assert.match(messages,/router\.post\('\/conversations\/:id\/media'/);
  assert.match(messages,/fileTypeFromBuffer/);
  assert.match(messages,/FROM stories s JOIN images i ON i\.id=s\.image_id WHERE s\.id=\$1 AND s\.owner_id=\$2 AND s\.expires_at>now\(\)/);
  assert.match(messages,/m\.kind='text'/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS story_ref jsonb/);
  assert.match(client,/async sendMedia\(id, media\)/);
  assert.match(client,/storyCardHTML\(m, mine\)/);
  assert.match(client,/data-action="chatMic"/);
  assert.match(stories,/360 \/ Math\.max\(im\.naturalWidth/);
});


test('account audit: suspended users are hidden, admin/follow/offer abuse guards, chat cache reset',()=>{
  const read=(p)=>fs.readFileSync(path.resolve(here,p),'utf8');
  const listings=read('../src/routes/listings.js'), qa=read('../src/routes/qa.js'), showrooms=read('../src/routes/showrooms.js');
  const admin=read('../src/routes/admin.js'), social=read('../src/routes/social.js'), messages=read('../src/routes/messages.js');
  const chat=read('../../js/26-messaging.js'), dropdown=read('../../js/17-chip-dropdown.js');
  assert.match(listings,/"u\.status='active'", 'u\.deleted_at IS NULL'/);
  assert.match(listings,/OFFER_PENDING/);
  assert.match(qa,/au\.status='active' AND au\.deleted_at IS NULL/);
  assert.match(showrooms,/s\.status='approved' AND u\.status='active' AND u\.deleted_at IS NULL/);
  assert.match(admin,/SELF_STATUS/);
  assert.match(admin,/ADMIN_PROTECTED/);
  assert.match(social,/NOT EXISTS \(SELECT 1 FROM notifications WHERE user_id=\$1::uuid AND type='follow'/);
  assert.match(messages,/router\.delete\('\/users\/:id\/block'/);
  assert.match(chat,/addEventListener\("carmaa:session-reset", resetChatSession\)/);
  assert.match(dropdown,/carmaa:session-reset/);
});

test('stage 3: rank history, join date and story-seen are server-side',()=>{
  const client=fs.readFileSync(path.resolve(here,'../../js/00-api-client.js'),'utf8');
  const showrooms=fs.readFileSync(path.resolve(here,'../src/routes/showrooms.js'),'utf8');
  const social=fs.readFileSync(path.resolve(here,'../src/routes/social.js'),'utf8');
  const migration=fs.readFileSync(path.resolve(here,'../migrations/013_rank_history_story_seen.sql'),'utf8');
  assert.match(client,/rankMovements\(\)/);
  assert.match(client,/markStorySeen\(id\)/);
  assert.match(showrooms,/router\.get\('\/rank-movements'/);
  assert.match(social,/router\.post\('\/stories\/:id\/seen', authRequired/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS showroom_rank_snapshots/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS story_seen/);
});

test('live updates: SSE route, LISTEN/NOTIFY triggers and browser client are wired',()=>{
  const live=fs.readFileSync(path.resolve(here,'../src/live.js'),'utf8');
  const app=fs.readFileSync(path.resolve(here,'../src/app.js'),'utf8');
  const server=fs.readFileSync(path.resolve(here,'../src/server.js'),'utf8');
  const migration=fs.readFileSync(path.resolve(here,'../migrations/014_live_updates.sql'),'utf8');
  const client=fs.readFileSync(path.resolve(here,'../../js/47-live.js'),'utf8');
  const html=fs.readFileSync(path.resolve(here,'../../index.html'),'utf8');
  assert.match(live,/LISTEN \$\{CHANNEL\}/);
  assert.match(live,/text\/event-stream/);
  assert.match(app,/app\.use\('\/api\/v1\/live', liveRouter\)/);
  assert.match(server,/startLive\(\)/);
  assert.match(migration,/pg_notify\('carmaa_live'/);
  assert.match(migration,/CREATE TRIGGER carmaa_live_notifications/);
  assert.match(client,/new EventSource\(url/);
  assert.match(html,/js\/47-live\.js/);
});
