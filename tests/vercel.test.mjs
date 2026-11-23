import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler } from '../api/index.mjs';
import { LocalBucket } from '../scripts/local-bucket.mjs';

const origin = 'https://portfolio.example.test';
const key = 'local-test-credential-only';
const env = { PORTFOLIO_ADMIN_EMAIL: 'owner@example.test', PORTFOLIO_ADMIN_KEY_SHA256: createHash('sha256').update(key).digest('hex') };
const auth = { authorization: 'Basic ' + Buffer.from('owner@example.test:' + key).toString('base64') };
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-vercel-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bucket = new LocalBucket(directory);
  const handler = createHandler({ bucket, env });
  return { bucket, call: (path, options) => handler(new Request(origin + path, options)) };
}

test('public page is anonymous; every owner route requires the secret and ignores platform header spoofing', async t => {
  const { call } = await setup(t);
  assert.equal((await call('/')).status, 200);
  for (const path of ['/admin', '/admin/', '/admin.html', '/api/admin/achievements', '/api/admin/upload']) {
    const anonymous = await call(path);
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get('www-authenticate'), /^Basic/);
    assert.equal((await call(path, { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.PORTFOLIO_ADMIN_EMAIL } })).status, 401);
  }
  assert.equal((await call('/admin', { headers: auth })).status, 200);
  assert.equal((await call('/api/admin/achievements', { headers: auth })).status, 200);
  assert.equal((await call('/admin', { headers: { authorization: 'Basic ' + Buffer.from('owner@example.test:wrong').toString('base64') } })).status, 401);
});

test('large direct uploads become private documents, persist, publish and clean up', async t => {
  const { bucket, call } = await setup(t);
  const staging = 'uploads/' + randomUUID() + '/file';
  const bytes = Buffer.alloc(6 * 1024 * 1024, 32); bytes.write('%PDF-1.4\n');
  await bucket.put(staging, bytes);
  const form = new FormData();
  for (const [name, value] of Object.entries({ title: 'Private upload check', category: 'Certificate', year: '2026', fileUploadKey: staging, fileUploadName: 'large.pdf' })) form.set(name, value);
  const headers = { ...auth, origin, 'x-portfolio-request': '1' };
  const created = await call('/api/admin/achievements', { method: 'POST', headers, body: form });
  assert.equal(created.status, 201);
  const record = (await created.json()).achievement;
  assert.equal(record.file.size, bytes.length);
  assert.equal(await bucket.get(staging), null);
  assert.equal((await call(record.file.url)).status, 404);
  assert.deepEqual(Buffer.from(await (await call(record.file.url, { headers: auth })).arrayBuffer()), bytes);
  assert.equal((await (await call('/api/achievements')).json()).achievements.length, 0);
  form.delete('fileUploadKey'); form.delete('fileUploadName'); form.set('updatedAt', record.updatedAt); form.set('published', 'on');
  assert.equal((await call('/api/admin/achievements/' + record.id, { method: 'PUT', headers, body: form })).status, 200);
  assert.equal((await call(record.file.url)).status, 200);
  assert.equal((await call('/api/admin/achievements/' + record.id, { method: 'DELETE', headers })).status, 200);
  assert.equal((await bucket.list()).objects.length, 0);
});

test('direct upload references cannot select existing records or unrelated files', async t => {
  const { call } = await setup(t);
  const form = new FormData();
  for (const [name, value] of Object.entries({ title: 'Check', category: 'Award', year: '2026', fileUploadKey: 'achievements/records/private.json' })) form.set(name, value);
  assert.equal((await call('/api/admin/achievements', { method: 'POST', headers: { ...auth, origin, 'x-portfolio-request': '1' }, body: form })).status, 400);
  assert.equal((await call('/api/admin/upload', { method: 'POST', headers: { ...auth, origin: 'https://evil.test' }, body: '{}' })).status, 403);
});
