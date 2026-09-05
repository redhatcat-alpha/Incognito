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
await call(`/api/v1/posts/${post.id}/replies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'smoke reply', identity: 'anonymous' }) });
await call(`/api/v1/history/${post.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxReadFloor: 1, anchorReplyId: null }) });
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
