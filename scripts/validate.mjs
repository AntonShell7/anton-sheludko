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
assert.ok(html.includes('class="certificate-grid"'), "Empty collection should show labelled document placeholders");
assert.ok(!html.includes("unsplash.com"), "Stock photos should be replaced by placeholders");
for (const file of ["atmosphere-placeholder.svg", "project-placeholder.svg", "portrait-placeholder.svg", "ice-placeholder.svg"]) {
  const image = await worker.fetch(new Request("https://portfolio.example.test/images/" + file), {});
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/svg+xml");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), await readFile(new URL("../public/images/" + file, import.meta.url)));
}
for (const file of ["inter-variable.woff2"]) {
  const font = await worker.fetch(new Request("https://portfolio.example.test/fonts/" + file), {});
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.deepEqual(Buffer.from(await font.arrayBuffer()), await readFile(new URL("../public/fonts/" + file, import.meta.url)));
}
console.log("Deployable Worker validated; placeholders, local fonts, personal content, and separate admin are correct.");
