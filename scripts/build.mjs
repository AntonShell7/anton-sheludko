// Bundle text and local images into one dependency-free Worker.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
const assetFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/script.js": ["script.js", "text/javascript; charset=utf-8"],
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
  "/admin": ["admin.html", "text/html; charset=utf-8"],
  "/admin.css": ["admin.css", "text/css; charset=utf-8"],
  "/admin-base.css": ["admin-base.css", "text/css; charset=utf-8"],
  "/admin.js": ["admin.js", "text/javascript; charset=utf-8"],
  "/images/atmosphere-placeholder.svg": ["images/atmosphere-placeholder.svg", "image/svg+xml"],
  "/images/project-placeholder.svg": ["images/project-placeholder.svg", "image/svg+xml"],
  "/images/portrait-placeholder.svg": ["images/portrait-placeholder.svg", "image/svg+xml"],
  "/images/ice-placeholder.svg": ["images/ice-placeholder.svg", "image/svg+xml"],
  "/images/anton-autograph.png": ["images/anton-autograph.png", "image/png", "base64"],
  "/images/anton-sunset.jpg": ["images/anton-sunset.jpg", "image/jpeg", "base64"],
  "/images/anton-off-duty.jpg": ["images/anton-off-duty.jpg", "image/jpeg", "base64"],
  "/images/anton-new-chapter.jpg": ["images/anton-new-chapter.jpg", "image/jpeg", "base64"],
  "/images/anton-early-hockey.jpg": ["images/anton-early-hockey.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-portrait.jpg": ["images/anton-hockey-portrait.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-action.jpg": ["images/anton-hockey-action.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-action-clean.jpg": ["images/anton-hockey-action-clean.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-portrait-clean.jpg": ["images/anton-hockey-portrait-clean.jpg", "image/jpeg", "base64"],
  "/images/anton-studying.jpg": ["images/anton-studying.jpg", "image/jpeg", "base64"],
  "/images/anton-robotics.jpg": ["images/anton-robotics.jpg", "image/jpeg", "base64"],
  "/images/anton-training.jpg": ["images/anton-training.jpg", "image/jpeg", "base64"],
  "/fonts/inter-variable.woff2": ["fonts/inter-variable.woff2", "font/woff2", "base64"]
};
const assets = {};
for (const [route, [file, type, encoding = "utf8"]] of Object.entries(assetFiles)) {
  const contents = await readFile(new URL("../public/" + file, import.meta.url));
  assets[route] = { body: contents.toString(encoding), type, encoding };
}
// Give changed styles and scripts a new URL so existing previews load the current version.
for (const route of ["/", "/admin"]) {
  assets[route].body = assets[route].body.replace(/(href|src)="(\/[^"?]+\.(?:css|js))"/g, (match, attribute, path) => {
    if (!assets[path]) return match;
    const revision = createHash("sha256").update(assets[path].body).digest("hex").slice(0, 12);
    return `${attribute}="${path}?v=${revision}"`;
  });
}
const manifest = await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8");
const config = JSON.parse(manifest);
if (!config.project_id || config.r2 !== "BUCKET" || config.static) throw new Error("Invalid Worker hosting configuration");
const assetSource = "export const ASSETS = " + JSON.stringify(assets) + ";\n";
await writeFile(new URL("../worker/assets.js", import.meta.url), assetSource);
const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
const bundled = source.replace('import { ASSETS } from "./assets.js";', () => assetSource.replace("export const", "const"));
const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(new URL("server/", output), { recursive: true });
await mkdir(new URL(".openai/", output), { recursive: true });
await writeFile(new URL("server/index.js", output), bundled);
await writeFile(new URL(".openai/hosting.json", output), manifest);
const module = await import("data:text/javascript;base64," + Buffer.from(bundled).toString("base64"));
if (typeof module.default?.fetch !== "function") throw new Error("Worker fetch export is missing");
console.log(`Built ${Object.keys(assets).length} assets into a ${Buffer.byteLength(bundled)}-byte Worker.`);
