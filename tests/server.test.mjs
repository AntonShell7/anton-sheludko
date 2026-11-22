import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../worker/index.js";
import { LocalBucket } from "../scripts/local-bucket.mjs";

const origin = "https://portfolio.example.test";
const admin = { "oai-authenticated-user-id": "verified-owner-id", "oai-authenticated-user-email": "owner@example.test" };
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), "anton-portfolio-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, env: { BUCKET: new LocalBucket(directory), PORTFOLIO_ADMIN_EMAIL: "owner@example.test" } };
}
function form(values = {}, file) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Test mathematics certificate", year: "2026", category: "Certificate", ...values })) data.set(key, String(value));
  if (file) data.set("file", file);
  return data;
}
function call(env, route, options = {}) { return worker.fetch(new Request(origin + route, options), env); }
function write(env, route, method, data, headers = {}) {
  return call(env, route, { method, headers: { ...admin, origin, "x-portfolio-request": "1", ...headers }, ...(data ? { body: data } : {}) });
}
const api = "/api/admin/achievements";

test("admin pages and data require the verified owner identity", async t => {
  const { env } = await setup(t);
  const redirect = await call(env, "/admin");
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), origin + "/signin-with-chatgpt?return_to=%2Fadmin");
  assert.equal((await call(env, api)).status, 401);
  assert.equal((await call(env, api, { headers: { "oai-authenticated-user-email": admin["oai-authenticated-user-email"] } })).status, 401);
  assert.equal((await call(env, api, { headers: { ...admin, "oai-authenticated-user-email": "other@example.test" } })).status, 403);
  assert.equal((await call(env, api, { headers: admin })).status, 200);
  assert.equal((await call({ ...env, PORTFOLIO_ADMIN_EMAIL: "" }, api, { headers: admin })).status, 403);
});

test("writes reject foreign origins and requests without the custom form header", async t => {
  const { env } = await setup(t);
  assert.equal((await write(env, api, "POST", form(), { origin: "https://another.example.test" })).status, 403);
  assert.equal((await write(env, api, "POST", form(), { "x-portfolio-request": "" })).status, 403);
  assert.equal((await call(env, api, { method: "POST", body: form(), headers: { origin, "x-portfolio-request": "1" } })).status, 401);
  assert.equal((await env.BUCKET.list()).objects.length, 0);
});

test("drafts, attachments, publication, reload persistence, editing, and deletion", async t => {
  const { env, directory } = await setup(t);
  assert.match(await (await call(env, "/")).text(), /class="certificate-grid"/);
  const document = new File(["%PDF-1.4\nTest-only certificate\n%%EOF"], "test-certificate.pdf", { type: "application/pdf" });
  const created = await write(env, api, "POST", form({ title: '<img src=x onerror="alert(1)"> $&', description: "First line\nSecond line", proofUrl: "https://example.test/result" }, document));
  assert.equal(created.status, 201);
  const initial = (await created.json()).achievement;
  assert.equal(initial.published, false);
  assert.equal((await (await call(env, "/api/achievements")).json()).achievements.length, 0);
  assert.equal((await call(env, initial.file.url)).status, 404);
  const privateFile = await call(env, initial.file.url, { headers: admin });
  assert.equal(privateFile.status, 200);
  assert.match(privateFile.headers.get("content-disposition"), /^attachment;/);
  assert.match(await privateFile.text(), /^%PDF/);
  const restarted = { ...env, BUCKET: new LocalBucket(directory) };
  assert.equal((await (await call(restarted, api, { headers: admin })).json()).achievements.length, 1);
  const published = await write(restarted, api + "/" + initial.id, "PUT", form({ title: initial.title, description: initial.description, published: "on", updatedAt: initial.updatedAt }));
  assert.equal(published.status, 200);
  const current = (await published.json()).achievement;
  assert.equal((await (await call(env, "/api/achievements")).json()).achievements.length, 1);
  assert.equal((await call(env, initial.file.url)).status, 200);
  const html = await (await call(env, "/")).text();
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(html.includes('$&amp;'), "Replacement-like text must render literally");
  assert.ok(!html.includes('class="certificate-grid"'), "Published entries replace the empty document slots");
  assert.equal((await write(env, api + "/" + initial.id, "PUT", form({ updatedAt: "old-version" }))).status, 409);
  const removedFile = await write(env, api + "/" + initial.id, "PUT", form({ updatedAt: current.updatedAt, removeFile: "on" }));
  assert.equal(removedFile.status, 200);
  assert.equal((await removedFile.json()).achievement.file, null);
  assert.equal((await env.BUCKET.list({ prefix: "achievements/files/" })).objects.length, 0);
  assert.equal((await write(env, api + "/" + initial.id, "DELETE")).status, 200);
  assert.equal((await env.BUCKET.list()).objects.length, 0);
  assert.match(await (await call(env, "/")).text(), /class="certificate-grid"/);
});

test("attachment replacement and record deletion clean up uploaded files", async t => {
  const { env } = await setup(t);
  const first = new File(["%PDF-1.4 first"], "first.pdf", { type: "application/pdf" });
  const initial = (await (await write(env, api, "POST", form({}, first))).json()).achievement;
  const second = new File(["%PDF-1.4 second"], "second.pdf", { type: "application/pdf" });
  const edited = await write(env, api + "/" + initial.id, "PUT", form({ updatedAt: initial.updatedAt }, second));
  assert.equal(edited.status, 200);
  assert.equal((await env.BUCKET.list({ prefix: "achievements/files/" })).objects.length, 1);
  assert.match(await (await call(env, initial.file.url, { headers: admin })).text(), /second/);
  await write(env, api + "/" + initial.id, "DELETE");
  assert.equal((await env.BUCKET.list()).objects.length, 0);
});

test("invalid fields, active URLs, HTML disguised as a certificate, and oversized files are rejected", async t => {
  const { env } = await setup(t);
  assert.equal((await write(env, api, "POST", form({ title: " " }))).status, 400);
  assert.equal((await write(env, api, "POST", form({ year: "twenty" }))).status, 400);
  assert.equal((await write(env, api, "POST", form({ proofUrl: "javascript:alert(1)" }))).status, 400);
  assert.equal((await write(env, api, "POST", form({ category: "Invented category" }))).status, 400);
  const disguised = new File(["<html><script>alert(1)</script></html>"], "award.pdf", { type: "application/pdf" });
  assert.equal((await write(env, api, "POST", form({}, disguised))).status, 415);
  const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
  assert.equal((await write(env, api, "POST", form({}, oversized))).status, 413);
  assert.equal((await env.BUCKET.list()).objects.length, 0);
});

test("document previews follow publication, persist, and cannot outlive their document", async t => {
  const { env, directory } = await setup(t);
  const pdf = new File(["%PDF-1.4 certificate"], "award.pdf", { type: "application/pdf" });
  const png = new File([new Uint8Array([137,80,78,71,13,10,26,10,0])], "preview.png", { type: "image/png" });
  const data = form({}, pdf);
  data.set("preview", png);
  const created = await write(env, api, "POST", data);
  assert.equal(created.status, 201);
  const first = (await created.json()).achievement;
  assert.ok(first.preview.url.startsWith("/previews/"));
  assert.equal(first.preview.key, undefined);
  assert.equal((await call(env, first.preview.url)).status, 404);
  assert.equal((await call(env, first.preview.url, { headers: admin })).status, 200);
  const restarted = { ...env, BUCKET: new LocalBucket(directory) };
  const publish = await write(restarted, api + "/" + first.id, "PUT", form({ updatedAt: first.updatedAt, published: "on" }));
  const published = (await publish.json()).achievement;
  assert.equal(published.preview.url, first.preview.url);
  const image = await call(restarted, published.preview.url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.match(image.headers.get("content-disposition"), /^inline;/);
  const html = await (await call(env, "/")).text();
  assert.ok(html.includes(`data-certificate-preview="${published.preview.url}"`));
  assert.ok(html.includes(`href="${published.file.url}"`));
  const replacement = await write(env, api + "/" + first.id, "PUT", form({ updatedAt: published.updatedAt }, pdf));
  const replaced = (await replacement.json()).achievement;
  assert.equal(replaced.preview, null);
  assert.equal((await call(env, first.preview.url, { headers: admin })).status, 404);
  assert.equal((await env.BUCKET.list({ prefix: "achievements/files/" })).objects.length, 1);
  const addPreview = form({ updatedAt: replaced.updatedAt });
  addPreview.set("preview", png);
  assert.equal((await write(env, api + "/" + first.id, "PUT", addPreview)).status, 200);
  assert.equal((await env.BUCKET.list({ prefix: "achievements/files/" })).objects.length, 2);
  await write(env, api + "/" + first.id, "DELETE");
  assert.equal((await env.BUCKET.list()).objects.length, 0);
});

test("invalid previews are rejected before storing either attachment", async t => {
  const { env } = await setup(t);
  const pdf = new File(["%PDF-1.4 certificate"], "award.pdf", { type: "application/pdf" });
  const wrongType = form({}, pdf);
  wrongType.set("preview", pdf);
  assert.equal((await write(env, api, "POST", wrongType)).status, 415);
  const oversized = form({}, pdf);
  oversized.set("preview", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "preview.png", { type: "image/png" }));
  assert.equal((await write(env, api, "POST", oversized)).status, 413);
  const orphan = form();
  orphan.set("preview", new File([new Uint8Array([137,80,78,71,13,10,26,10,0])], "preview.png", { type: "image/png" }));
  assert.equal((await write(env, api, "POST", orphan)).status, 400);
  assert.equal((await env.BUCKET.list()).objects.length, 0);
});

test("storage failures are visible and do not erase the public portfolio", async () => {
  assert.equal((await call({}, "/api/achievements")).status, 503);
  const page = await call({}, "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Achievements are temporarily unavailable/);
});

test("HEAD checks return the same page status and headers without a body", async t => {
  const { env } = await setup(t);
  const result = await call(env, "/", { method: "HEAD" });
  assert.equal(result.status, 200);
  assert.match(result.headers.get("content-type"), /text\/html/);
  assert.equal(await result.text(), "");
  assert.equal((await call(env, "/admin", { method: "HEAD" })).status, 302);
});
