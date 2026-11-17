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
  const document = new File(["%PDF-1.4\nTest-only certificate\n%%EOF"], "test-certificate.pdf", { type: "application/pdf" });
  const created = await write(env, api, "POST", form({ title: '<img src=x onerror="alert(1)">', description: "First line\nSecond line", proofUrl: "https://example.test/result" }, document));
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
  assert.equal((await write(env, api + "/" + initial.id, "PUT", form({ updatedAt: "old-version" }))).status, 409);
  const removedFile = await write(env, api + "/" + initial.id, "PUT", form({ updatedAt: current.updatedAt, removeFile: "on" }));
  assert.equal(removedFile.status, 200);
  assert.equal((await removedFile.json()).achievement.file, null);
  assert.equal((await env.BUCKET.list({ prefix: "achievements/files/" })).objects.length, 0);
  assert.equal((await write(env, api + "/" + initial.id, "DELETE")).status, 200);
  assert.equal((await env.BUCKET.list()).objects.length, 0);
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
