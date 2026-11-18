import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"));
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
assert.equal(typeof worker.fetch, "function");
assert.equal(manifest.r2, "BUCKET");
assert.ok(manifest.project_id && !manifest.static);
const emptyBucket = { list: async () => ({ objects: [], truncated: false }) };
const page = await worker.fetch(new Request("https://portfolio.example.test/"), { BUCKET: emptyBucket });
assert.equal(page.status, 200);
const html = await page.text();
assert.ok(html.includes("Anton Sheludko") && html.includes("https://eaglish.ru/"));
assert.ok(!html.includes("Temporary local QA check") && !html.includes("[Your Full Name]"));
assert.ok(html.includes("Achievements and certificates will be added here."));
assert.ok(!html.includes('href="/admin"'), "The public page must not link to the admin panel");
for (const file of ["hockey-match.jpg", "hockey-arena.jpg"]) {
  const image = await worker.fetch(new Request("https://portfolio.example.test/images/" + file), {});
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), await readFile(new URL("../public/images/" + file, import.meta.url)));
}
console.log("Deployable Worker validated; personal content, separate admin, and both image responses are correct.");
