#!/usr/bin/env node
const base = process.env.BASE_URL ?? 'http://localhost:3000';
let cookie = '';
async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`${path}: ${body.error?.code ?? response.status}`);
  return body.data;
}
const forum = await call('/api/v1/posts');
if (!Array.isArray(forum.posts)) throw new Error('posts response shape invalid');
const title = `smoke-${Date.now()}`;
const post = await call('/api/v1/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ boardSlug: 'tucao', title, body: 'smoke test body', tags: [], identity: 'anonymous' }) });
const replies = await Promise.all(Array.from({ length: 3 }, (_, index) => call(`/api/v1/posts/${post.id}/replies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: `smoke reply ${index}`, identity: 'anonymous' }) })));
const floors = replies.map((reply) => reply.floorNo).filter((floor) => floor > 0);
if (floors.length !== 3 || new Set(floors).size !== floors.length || floors.some((floor) => floor < 2)) throw new Error('reply floor allocation invalid');
const nested = await call(`/api/v1/posts/${post.id}/replies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'smoke nested reply', quoteReplyId: replies[0].id, identity: 'anonymous' }) });
if (nested.floorNo !== 0) throw new Error('nested reply consumed a floor');
await call(`/api/v1/history/${post.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxReadFloor: 1, anchorReplyId: null }) });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const intent = await call('/api/v1/media/upload-intents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentType: 'image/png', size: png.byteLength }) });
const uploaded = await call(intent.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/png', 'content-length': String(png.byteLength) }, body: png });
if (uploaded.status !== 'uploaded') throw new Error('media upload state invalid');
const completed = await call(intent.completeUrl, { method: 'POST' });
if (completed.status !== 'ready' || !completed.url) throw new Error('media completion invalid');
const phrase = await call('/api/v1/anon/recovery', { method: 'POST' });
if (!phrase.phrase || phrase.phrase.split(' ').length !== 6) throw new Error('recovery phrase invalid');
const passkeyOptions = await call('/api/v1/anon/passkey/auth/options', { method: 'POST' });
if (!passkeyOptions.challengeId || !passkeyOptions.challenge) throw new Error('passkey challenge invalid');
let adminCookie = '';
async function adminCall(path, options = {}) {
  const headers = new Headers(options.headers);
  if (adminCookie) headers.set('cookie', adminCookie);
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) adminCookie = setCookie.split(';')[0];
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`${path}: ${body.error?.code ?? response.status}`);
  return body.data;
}
await adminCall('/api/v1/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
await adminCall('/api/v1/admin/site-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '无名岛', shortName: '无名岛', description: 'smoke', primaryColor: '#d9ff57' }) });
const audits = await adminCall('/api/v1/admin/audit?limit=10');
if (!audits.some((entry) => entry.action === 'site-settings.update')) throw new Error('audit entry missing');
console.log(`smoke ok: ${post.id}`);
