/* Server-authoritative adapters for the legacy Q&A store and account helpers. */
(function () {
  const api = window.CARMA_API;
  if (!api?.enabled) return;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const time = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : Date.now(); };
  const me = () => String(window.CARMA_AUTH_USER?.id || '');
  const qmap = q => ({ id:String(q.id), title:String(q.title||''), body:String(q.body||''), category:String(q.category||'other'), brand:String(q.brand||''), model:String(q.model||''), year:String(q.vehicle_year||''), authorId:String(q.author_id||''), authorName:String(q.author_name||'کاربر'), isSample:false, createdAt:time(q.created_at), updatedAt:time(q.updated_at), views:Number(q.view_count||0), answerCount:Number(q.answer_count||0), helpfulCount:0, imageId:q.image_id||null, imageUrl:q.image_url||null, isOwner:!!me() && String(q.author_id||'')===me(), acceptedAnswerId:null, tags:Array.isArray(q.tags)?q.tags:[] });
  const amap = (a,qid) => ({ id:String(a.id), questionId:String(a.question_id||qid), body:String(a.body||''), authorId:String(a.author_id||''), authorName:String(a.author_name||'کاربر'), createdAt:time(a.created_at), helpful:Number(a.helpful_count||0), isAccepted:a.is_accepted===true, isMine:!!me()&&String(a.author_id||'')===me(), isSample:false, voted:false });
  const QA = window.MARQUE_QA;
  if (QA?.store) {
    const store=QA.store;
    store.isValidQuestionId=id=>UUID.test(String(id||''));
    store.getImageUrl=async id=>{ const u=window.CARMA_QA_IMAGE_URLS?.[String(id||'')]; if(typeof u!=='string')return null; try{const p=new URL(u,location.origin);return p.origin===location.origin||p.protocol==='https:'?p.href:null;}catch{return null;} };
    store.listQuestions=async opts=>{ const o=opts||{},p={page:'1',page_size:'50'};if(o.q)p.q=String(o.q).slice(0,120);if(o.category&&o.category!=='all')p.category=String(o.category).slice(0,40);const r=await api.qa.list(p),a=(r.items||[]).map(qmap);window.CARMA_QA_IMAGE_URLS=window.CARMA_QA_IMAGE_URLS||{};a.forEach(q=>{if(q.imageId&&q.imageUrl)window.CARMA_QA_IMAGE_URLS[q.imageId]=q.imageUrl;});a.sort(o.sort==='answers'?(x,y)=>y.answerCount-x.answerCount||y.createdAt-x.createdAt:o.sort==='views'?(x,y)=>y.views-x.views||y.createdAt-x.createdAt:(x,y)=>y.createdAt-x.createdAt);return a;};
    store.getStats=()=>api.qa.stats();
    store.getQuestion=async id=>{if(!UUID.test(String(id||'')))return null;const r=await api.qa.get(id),q=qmap(r.question||{});q.acceptedAnswerId=(r.answers||[]).find(a=>a.is_accepted)?.id||null;if(q.imageId&&q.imageUrl){window.CARMA_QA_IMAGE_URLS=window.CARMA_QA_IMAGE_URLS||{};window.CARMA_QA_IMAGE_URLS[q.imageId]=q.imageUrl;}return q;};
    store.listAnswers=async id=>{if(!UUID.test(String(id||'')))return [];const r=await api.qa.get(id);return(r.answers||[]).map(a=>amap(a,id));};
    store.createQuestion=async i=>{if(!window.CARMA_AUTH_USER)throw{code:'unauthenticated',message:'برای ثبت سؤال ابتدا وارد حساب کاربری شوید.'};i=i||{};let imageId=null;if(i.imageDataUrl){const blob=await(await fetch(i.imageDataUrl)).blob(),file=new File([blob],'qa-image',{type:blob.type||'image/jpeg'}),u=await api.uploads.image(file);imageId=u?.image?.id||null;if(!imageId)throw{code:'image-upload-failed',message:'آپلود تصویر تأیید نشد.'};window.CARMA_QA_IMAGE_URLS=window.CARMA_QA_IMAGE_URLS||{};window.CARMA_QA_IMAGE_URLS[imageId]=u.image.public_url;}const r=await api.qa.create({title:String(i.title||'').trim(),body:String(i.body||'').trim(),category:String(i.category||'other'),brand:String(i.brand||'').trim(),model:String(i.model||'').trim(),year:String(i.year||''),tags:[],imageId});const detail=await api.qa.get(r?.question?.id);const q=qmap(detail.question||r.question||{});if(imageId){q.imageId=imageId;q.imageUrl=window.CARMA_QA_IMAGE_URLS[imageId];}return q;};
    store.addAnswer=async i=>{if(!window.CARMA_AUTH_USER)throw{code:'unauthenticated',message:'برای پاسخ‌دادن ابتدا وارد حساب کاربری شوید.'};if(!UUID.test(String(i?.questionId||'')))throw{code:'not-found',message:'سؤال معتبر نیست.'};const r=await api.qa.answer(i.questionId,String(i.body||'').trim());const d=await api.qa.get(i.questionId),a=(d.answers||[]).find(x=>x.id===r.answer?.id)||r.answer;return amap(a,i.questionId);};
    store.voteHelpful=async id=>{if(!window.CARMA_AUTH_USER)throw{code:'unauthenticated',message:'برای رأی‌دادن ابتدا وارد حساب کاربری شوید.'};if(!UUID.test(String(id||'')))throw{code:'not-found',message:'پاسخ معتبر نیست.'};const r=await api.qa.vote(id);return{changed:r.changed===true,answer:{id,helpful:Number(r.helpful||0),voted:true}};};
    store.acceptAnswer=async(qid,aid)=>{if(!window.CARMA_AUTH_USER)throw{code:'unauthenticated',message:'برای انتخاب پاسخ ابتدا وارد حساب کاربری شوید.'};await api.qa.accept(qid,aid);return store.getQuestion(qid);};
    store.listMine=async()=>{if(!window.CARMA_AUTH_USER)return[];const r=await api.qa.mine(),a=(r.items||[]).map(qmap);window.CARMA_QA_IMAGE_URLS=window.CARMA_QA_IMAGE_URLS||{};a.forEach(q=>{if(q.imageId&&q.imageUrl)window.CARMA_QA_IMAGE_URLS[q.imageId]=q.imageUrl;});return a;};
    store.recordView=async id=>{if(!UUID.test(String(id||'')))return null;const r=await api.qa.view(id);return Number(r.views||0);};
    store.findSimilar=async(title,limit=3)=>(await store.listQuestions({q:title})).slice(0,limit);
    store.findRelated=async(id,limit=4)=>{const q=await store.getQuestion(id);return q?(await store.listQuestions({category:q.category})).filter(x=>x.id!==id).slice(0,limit):[];};
    const listServerNotes=async()=>{if(!window.CARMA_AUTH_USER)return[];const r=await api.notifications.list({limit:'100',type:'qa'});return(r.items||[]).map(n=>({id:String(n.id),userId:me(),type:String(n.type||'system'),questionId:String(n.data?.questionId||''),answerId:String(n.data?.answerId||''),title:String(n.title||''),body:String(n.body||''),createdAt:time(n.created_at),read:!!n.read_at,data:n.data||{},serverBacked:true}));};
    store.listNotifications=listServerNotes;store.unreadCount=async()=>{if(!window.CARMA_AUTH_USER)return 0;const r=await api.notifications.list({limit:'1',type:'qa'});return Number(r.unreadCount||0);};
    store.markNotificationsRead=async ids=>{if(!window.CARMA_AUTH_USER)return 0;if(ids==='all')await api.notifications.readAll('qa');else await Promise.all((Array.isArray(ids)?ids:[]).map(id=>api.notifications.read(id)));return store.unreadCount();};
    store.clearNotifications=async()=>{if(!window.CARMA_AUTH_USER)return 0;await api.notifications.clear('qa');return 0;};
  }
  window.CARMA_SERVER_ACCOUNT=Object.freeze({
    async refreshProfile(){const r=await api.auth.me();window.CARMA_AUTH_USER=r.user;return r.user;},
    async saveProfile(payload){const r=await api.account.updateProfile(payload);window.CARMA_AUTH_USER=r.user||window.CARMA_AUTH_USER;return r;},
    async listSavedSearches(){return(await api.account.savedSearches()).items||[];},
    saveSearch(payload){return api.account.saveSearch(payload);},deleteSearch(id){return api.account.removeSavedSearch(id);},
    listNotifications(){return api.notifications.list();},markNotificationRead(id){return api.notifications.read(id);},markAllNotificationsRead(){return api.notifications.readAll();}
  });
})();
