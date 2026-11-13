/* CarMaa API client. Browser sessions are HttpOnly cookies; never store session tokens in localStorage. */
(function () {
  const configuredBase = window.CARMA_API_BASE || '/api/v1';
  if (window.CARMA_API_STRICT_MODE === undefined) window.CARMA_API_STRICT_MODE = true;
  const base = String(configuredBase).replace(/\/$/, '');

  async function request(path, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    headers.set('Accept', 'application/json');
    if (opts.body && !(opts.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    let response;
    // Without a timeout a stalled connection made the app hang forever (e.g. on the last step of "post an ad").
    const { timeoutMs, ...fetchOpts } = opts;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000) : null;
    try {
      response = await fetch(base + path, { ...fetchOpts, headers, credentials: 'include', cache: 'no-store', redirect: 'error', ...(ctrl ? { signal: ctrl.signal } : {}) });
    } catch (error) {
      if (timer) clearTimeout(timer);
      if (error && error.name === 'AbortError') { const e = new Error('پاسخ سرور دیر شد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'); e.code = 'TIMEOUT'; throw e; }
      const e = new Error('اتصال امن به سرور برقرار نشد.'); e.code = 'NETWORK_ERROR'; throw e;
    }
    // (the timer keeps covering the body download below, then is cleared)
    let raw;
    try { raw = await response.text(); } catch (error) {
      const e = new Error('پاسخ سرور کامل دریافت نشد. دوباره تلاش کنید.'); e.code = 'TIMEOUT'; throw e;
    } finally { if (timer) clearTimeout(timer); }
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
    if (!response.ok && data?.error?.code === 'MFA_REQUIRED' && !opts._mfa) { // SEC2-PATCH (A15)
      const code = window.prompt('کد ۶ رقمی برنامه احراز هویت (Google Authenticator) را وارد کنید');
      if (code) { await request('/auth/totp/verify', { method: 'POST', body: JSON.stringify({ code: String(code).trim() }) }); return request(path, { ...opts, _mfa: true }); }
    }
    if (!response.ok) {
      const e = new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
      e.status = response.status; e.code = data?.error?.code || 'REQUEST_FAILED'; throw e;
    }
    return data;
  }

  window.CARMA_API = Object.freeze({
    enabled: true,
    base,
    request,
    auth: Object.freeze({
      requestOtp(phone) { return request('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) }); },
      verifyOtp(phone, code) { return request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }); },
      me() { return request('/auth/me'); },
      logout() { return request('/auth/logout', { method: 'POST', body: '{}' }); },
    }),
    listings: Object.freeze({
      list(params) {
        const query = new URLSearchParams(params || {});
        return request('/listings' + (query.size ? `?${query.toString()}` : ''));
      },
      mine() { return request('/listings/mine'); },
      create(payload, idempotencyKey) { return request('/listings', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 45000, ...(idempotencyKey ? { headers: { 'Idempotency-Key': String(idempotencyKey) } } : {}) }); },
      update(id, payload) { return request(`/listings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
      remove(id) { return request(`/listings/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
      favorite(id) { return request(`/listings/${encodeURIComponent(id)}/favorite`, { method: 'POST', body: '{}' }); },
      offer(id, amountToman, message) { return request(`/listings/${encodeURIComponent(id)}/offers`, { method: 'POST', body: JSON.stringify({ amountToman, message }) }); },
      priceHistory(id) { return request(`/listings/${encodeURIComponent(id)}/price-history`); },
      stats(id, days = 7) { return request(`/social/listings/${encodeURIComponent(id)}/stats?days=${encodeURIComponent(days)}`); },
      event(id, type) { return request(`/social/listings/${encodeURIComponent(id)}/events`, { method:'POST', body:JSON.stringify({type}) }); },
    }),
    uploads: Object.freeze({
      mine() { return request('/uploads/mine'); },
      async image(file) {
        const body = new FormData(); body.append('file', file, file.name || 'vehicle-photo');
        return request('/uploads/images', { method: 'POST', body, timeoutMs: 90000 });
      },
    }),
    showrooms: Object.freeze({
      list(params) { const q = new URLSearchParams(params || {}); return request('/showrooms' + (q.size ? `?${q.toString()}` : '')); },
      mine() { return request('/showrooms/mine'); },
      get(slug) { return request('/showrooms/' + encodeURIComponent(slug)); },
      create(payload) { return request('/showrooms', { method: 'POST', body: JSON.stringify(payload) }); },
      update(payload) { return request('/showrooms/mine', { method: 'PATCH', body: JSON.stringify(payload) }); },
      toggleFollow(id) { return request('/showrooms/' + encodeURIComponent(id) + '/follow', { method: 'POST', body: '{}' }); },
      followStatus(id) { return request('/showrooms/' + encodeURIComponent(id) + '/follow-status'); },
      rankMovements() { return request('/showrooms/rank-movements'); },
      review(id, payload) { return request('/showrooms/' + encodeURIComponent(id) + '/reviews', { method: 'POST', body: JSON.stringify(payload) }); },
    }),
    notifications: Object.freeze({
      list(params) { const q = new URLSearchParams(params || {}); return request('/notifications' + (q.size ? `?${q.toString()}` : '')); },
      read(id) { return request('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST', body: '{}' }); },
      readAll(type) { return request('/notifications/read-all', { method: 'POST', body: JSON.stringify(type ? { type } : {}) }); },
      clear(type) { const q = new URLSearchParams(); if (type) q.set('type', type); return request('/notifications' + (q.size ? `?${q.toString()}` : ''), { method: 'DELETE' }); },
    }),
    messages: Object.freeze({
      conversations(params) { const q = new URLSearchParams(params || {}); return request('/messages/conversations' + (q.size ? `?${q.toString()}` : '')); },
      conversation(id) { return request('/messages/conversations/' + encodeURIComponent(id)); },
      start(listingId) { return request('/messages/conversations', { method: 'POST', body: JSON.stringify({ listing_id: listingId }) }); },
      list(id, params) { const q = new URLSearchParams(params || {}); return request('/messages/conversations/' + encodeURIComponent(id) + '/messages' + (q.size ? `?${q.toString()}` : '')); },
      send(id, text) { return request('/messages/conversations/' + encodeURIComponent(id) + '/messages', { method: 'POST', body: JSON.stringify({ text }) }); },
      read(id) { return request('/messages/conversations/' + encodeURIComponent(id) + '/read', { method: 'POST', body: '{}' }); },
      block(userId) { return request('/messages/users/' + encodeURIComponent(userId) + '/block', { method: 'POST', body: '{}' }); },
    }),
    qa: Object.freeze({
      list(params) { const q = new URLSearchParams(params || {}); return request('/qa/questions' + (q.size ? `?${q.toString()}` : '')); },
      stats() { return request('/qa/questions/stats'); },
      get(id) { return request('/qa/questions/' + encodeURIComponent(id)); },
      create(payload) { return request('/qa/questions', { method: 'POST', body: JSON.stringify(payload) }); },
      answer(id, body) { return request('/qa/questions/' + encodeURIComponent(id) + '/answers', { method: 'POST', body: JSON.stringify({ body }) }); },
      accept(questionId, answerId) { return request('/qa/questions/' + encodeURIComponent(questionId) + '/answers/' + encodeURIComponent(answerId) + '/accept', { method: 'POST', body: '{}' }); },
      mine() { return request('/qa/questions/mine'); },
      vote(answerId) { return request('/qa/answers/' + encodeURIComponent(answerId) + '/vote', { method: 'POST', body: '{}' }); },
      view(questionId) { return request('/qa/questions/' + encodeURIComponent(questionId) + '/view', { method: 'POST', body: '{}' }); },
    }),
    social: Object.freeze({
      user(id) { return request(`/social/users/${encodeURIComponent(id)}`); },
      byUsername(name) { return request(`/social/users/by-username/${encodeURIComponent(String(name).replace(/^@/, ''))}`); },
      followers(id) { return request(`/social/users/${encodeURIComponent(id)}/followers`); },
      followStatus(id) { return request(`/social/users/${encodeURIComponent(id)}/follow-status`); },
      following(id) { return request(`/social/users/${encodeURIComponent(id)}/following`); },
      toggleUserFollow(id) { return request(`/social/users/${encodeURIComponent(id)}/follow`, {method:'POST',body:'{}'}); },
      stories(params) { const q=new URLSearchParams(params||{}); return request('/social/stories'+(q.size?'?'+q.toString():'')); },
      myStories() { return request('/social/stories/mine'); },
      storyViewers(id) { return request(`/social/stories/${encodeURIComponent(id)}/viewers`, { cache: 'no-store' }); },
      suggestedStories() { return request('/social/stories/suggested', { cache: 'no-store' }); },
      hideStoryFrom(userId) { return request('/social/story-hides',{method:'POST',body:JSON.stringify({userId})}); },
      unhideStoryFrom(userId) { return request(`/social/story-hides/${encodeURIComponent(userId)}`,{method:'DELETE'}); },
      createStory(payload) { return request('/social/stories',{method:'POST',body:JSON.stringify(payload)}); },
      viewStory(id,deviceId) { return request(`/social/stories/${encodeURIComponent(id)}/view`,{method:'POST',body:JSON.stringify({deviceId})}); },
      markStorySeen(id) { return request(`/social/stories/${encodeURIComponent(id)}/seen`,{method:'POST',body:'{}'}); },
            deleteStory(id) { return request(`/social/stories/${encodeURIComponent(id)}`,{method:'DELETE'}); },
      posts(params) { const q = new URLSearchParams(params || {}); return request('/social/posts' + (q.size ? `?${q.toString()}` : '')); },
      createPost(payload) { return request('/social/posts', { method: 'POST', body: JSON.stringify(payload) }); },
      togglePostLike(id) { return request(`/social/posts/${encodeURIComponent(id)}/like`, { method: 'POST', body: '{}' }); },
      postComments(id) { return request(`/social/posts/${encodeURIComponent(id)}/comments`); },
      createPostComment(id, body) { return request(`/social/posts/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }); },
      deletePost(id) { return request(`/social/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    }),
    news: Object.freeze({
      social(ids) { const q = new URLSearchParams({ ids: (Array.isArray(ids) ? ids : [ids]).join(',') }); return request('/news/social?' + q.toString()); },
      toggleLike(newsId) { return request(`/news/${encodeURIComponent(newsId)}/like`, { method: 'POST', body: '{}' }); },
      comment(newsId, text, parentId) { return request(`/news/${encodeURIComponent(newsId)}/comments`, { method: 'POST', body: JSON.stringify({ text, parentId: parentId || null }) }); },
      deleteComment(commentId) { return request(`/news/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }); },
      toggleCommentLike(commentId) { return request(`/news/comments/${encodeURIComponent(commentId)}/like`, { method: 'POST', body: '{}' }); },
    }),
    reports: Object.freeze({ create(payload) { return request('/reports', { method: 'POST', body: JSON.stringify(payload) }); } }),
    support: Object.freeze({ create(payload) { return request('/support/tickets', { method: 'POST', body: JSON.stringify(payload) }); }, mine() { return request('/support/tickets/mine'); } }),
    account: Object.freeze({
      favorites() { return request('/account/favorites'); },
      updateProfile(payload) { return request('/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) }); },
      savedSearches() { return request('/account/saved-searches'); },
      saveSearch(payload) { return request('/account/saved-searches', { method: 'POST', body: JSON.stringify(payload) }); },
      removeSavedSearch(id) { return request(`/account/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
      incomingOffers(params) { const q = new URLSearchParams(params || {}); return request('/account/offers/incoming' + (q.size ? `?${q.toString()}` : '')); },
      updateOffer(id, status) { return request('/account/offers/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ status }) }); },
    }),
    payments: Object.freeze({ checkout(listingId, serviceKey, idempotencyKey) {
      return request('/payments/checkout', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ listingId, serviceKey, idempotencyKey }) });
    } }),
  });

  // Messaging switches to the cookie-backed API. The access token remains server-side.
  window.MARQUE_CHAT_CONFIG = { mode: 'api', baseURL: base, getAccessToken: async () => '' };
})();
