// Bundle text and local images into one dependency-free Worker.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
const assetFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/script.js": ["script.js", "text/javascript; charset=utf-8"],
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
  "/favicon.ico": ["favicon.ico", "image/x-icon", "base64"],
  "/favicon-16.png": ["favicon-16.png", "image/png", "base64"],
  "/favicon-32.png": ["favicon-32.png", "image/png", "base64"],
  "/apple-touch-icon.png": ["apple-touch-icon.png", "image/png", "base64"],
  "/apple-touch-icon-precomposed.png": ["apple-touch-icon.png", "image/png", "base64"],
  "/icon-192.png": ["icon-192.png", "image/png", "base64"],
  "/icon-512.png": ["icon-512.png", "image/png", "base64"],
  "/site.webmanifest": ["site.webmanifest", "application/manifest+json; charset=utf-8"],
  "/images/anton-social-cover.jpg": ["images/anton-social-cover.jpg", "image/jpeg", "base64"],
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
  "/images/anton-early-hockey-extended.jpg": ["images/anton-early-hockey-extended.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-portrait.jpg": ["images/anton-hockey-portrait.jpg", "image/jpeg", "base64"],
  "/images/anton-itmo-hockey.jpg": ["images/anton-itmo-hockey.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-action.jpg": ["images/anton-hockey-action.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-action-clean.jpg": ["images/anton-hockey-action-clean.jpg", "image/jpeg", "base64"],
  "/images/anton-hockey-portrait-clean.jpg": ["images/anton-hockey-portrait-clean.jpg", "image/jpeg", "base64"],
  "/images/anton-studying.jpg": ["images/anton-studying.jpg", "image/jpeg", "base64"],
  "/images/anton-robotics.jpg": ["images/anton-robotics.jpg", "image/jpeg", "base64"],
  "/images/anton-training.jpg": ["images/anton-training.jpg", "image/jpeg", "base64"],
  "/fonts/inter-variable.woff2": ["fonts/inter-variable.woff2", "font/woff2", "base64"],
  "/fonts/caveat-semibold.ttf": ["fonts/caveat-semibold.ttf", "font/ttf", "base64"]
};
const assets = {};
const { build } = await import('esbuild');
const adminBundle = await build({ entryPoints: ['public/admin.js'], bundle: true, minify: true, write: false, platform: 'browser', format: 'iife', target: ['safari16', 'chrome100'] });
for (const [route, [file, type, encoding = "utf8"]] of Object.entries(assetFiles)) {
  const contents = file === "admin.js" ? Buffer.from(adminBundle.outputFiles[0].contents) : await readFile(new URL("../public/" + file, import.meta.url));
  assets[route] = { body: contents.toString(encoding), type, encoding };
}
// Fingerprint icons too: browsers often keep tab icons independently of page caching.
for (const route of ["/", "/admin"]) {
  assets[route].body = assets[route].body.replace(/(href|src)="(\/[^"?]+\.(?:css|js|svg|png|ico|webmanifest))"/g, (match, attribute, path) => {
    if (!assets[path]) return match;
    const revision = createHash("sha256").update(assets[path].body).digest("hex").slice(0, 12);
    return `${attribute}="${path}?v=${revision}"`;
  });
}
const output = new URL('../dist/static/', import.meta.url);
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [route, asset] of Object.entries(assets)) {
  if (route === '/' || route === '/admin') continue;
  const destination = new URL('.' + route, output);
  await mkdir(new URL('.', destination), { recursive: true });
  await writeFile(destination, Buffer.from(asset.body, asset.encoding));
}
await writeFile(new URL('../worker/assets.js', import.meta.url), 'export const ASSETS = ' + JSON.stringify(assets) + ';\n');
console.log(`Built ${Object.keys(assets).length} assets for Vercel.`);
