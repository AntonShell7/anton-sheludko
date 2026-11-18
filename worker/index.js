import { ASSETS } from "./assets.js";

const RECORD_PREFIX = "achievements/records/";
const FILE_PREFIX = "achievements/files/";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
const CATEGORIES = new Set(["Award", "Olympiad", "Competition", "Certificate", "Other"]);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function response(body, status = 200, type = "application/json; charset=utf-8", extra = {}) {
  return new Response(body, { status, headers: {
    "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin", ...extra
  }});
}
function json(value, status = 200) { return response(JSON.stringify(value), status); }
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function isAdmin(request, env) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  // Sites supplies these verified headers. A browser-provided password is never used.
  return Boolean(userId && email && env.PORTFOLIO_ADMIN_EMAIL && email === env.PORTFOLIO_ADMIN_EMAIL.trim().toLowerCase());
}
function requireAdmin(request, env) {
  if (!isAdmin(request, env)) throw new HttpError(request.headers.get("oai-authenticated-user-id") ? 403 : 401, "Sign in with the portfolio owner's account to manage achievements.");
}
function requireSameOrigin(request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("x-portfolio-request") !== "1") {
    throw new HttpError(403, "This request must come from the portfolio admin page.");
  }
}
function bucket(env) {
  if (!env.BUCKET) throw new HttpError(503, "Achievement storage is not configured yet.");
  return env.BUCKET;
}
async function readRecord(env, id) {
  const object = await bucket(env).get(RECORD_PREFIX + id + ".json");
  return object ? object.json() : null;
}
async function readRecords(env) {
  const records = [];
  let cursor;
  do {
    const page = await bucket(env).list({ prefix: RECORD_PREFIX, limit: 250, ...(cursor ? { cursor } : {}) });
    const items = await Promise.all(page.objects.map(async object => {
      const data = await bucket(env).get(object.key);
      return data ? data.json() : null;
    }));
    records.push(...items.filter(Boolean));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return records.sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
}
function publicRecord(record) {
  const { id, title, year, category, organizer, description, proofUrl, published, createdAt, updatedAt } = record;
  return { id, title, year, category, organizer, description, proofUrl, published, createdAt, updatedAt,
    file: record.file ? { name: record.file.name, type: record.file.type, size: record.file.size, url: "/files/" + id } : null
  };
}
function renderAchievements(records) {
  if (!records.length) return '<p class="empty-note">Achievements and certificates will be added here.</p>';
  return '<ol class="milestone-list">' + records.map(record => {
    const file = record.file ? `<a class="achievement-file" href="/files/${record.id}" target="_blank" rel="noopener noreferrer">${record.file.type === "application/pdf" ? "Download certificate (PDF)" : "View certificate"} <span aria-hidden="true">↗</span></a>` : "";
    const proof = record.proofUrl ? `<a class="achievement-file" href="${escapeHTML(record.proofUrl)}" target="_blank" rel="noopener noreferrer">View source <span aria-hidden="true">↗</span></a>` : "";
    return `<li><span class="timeline-year">${record.year}</span><div><h3>${escapeHTML(record.title)}</h3><span class="entry-note">${escapeHTML(record.category)}${record.organizer ? " · " + escapeHTML(record.organizer) : ""}</span>${record.description ? `<p class="achievement-description">${escapeHTML(record.description)}</p>` : ""}<div class="achievement-files">${file}${proof}</div></div></li>`;
  }).join("") + "</ol>";
}
async function limitedForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;")) throw new HttpError(415, "Please use the achievement form.");
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new HttpError(413, "Choose a file smaller than 10 MB.");
  if (!request.body) throw new HttpError(400, "The form is empty.");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_REQUEST_BYTES) { await reader.cancel(); throw new HttpError(413, "Choose a file smaller than 10 MB."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(bytes, { headers: { "content-type": contentType } }).formData(); }
  catch { throw new HttpError(400, "The uploaded form could not be read. Please try again."); }
}
function textField(form, name, max, required = false) {
  const value = form.get(name) ?? "";
  if (typeof value !== "string") throw new HttpError(400, "Invalid " + name + ".");
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new HttpError(400, "Please check the " + name + " field.");
  return text;
}
function validateFields(form) {
  const title = textField(form, "title", 160, true);
  const rawYear = textField(form, "year", 4, true);
  const year = Number(rawYear);
  if (!/^\d{4}$/.test(rawYear) || year < 1900 || year > 2100) throw new HttpError(400, "Enter a valid four-digit year.");
  const category = textField(form, "category", 30, true);
  if (!CATEGORIES.has(category)) throw new HttpError(400, "Choose an achievement category.");
  const organizer = textField(form, "organizer", 160);
  const description = textField(form, "description", 1500);
  let proofUrl = textField(form, "proofUrl", 1500);
  if (proofUrl) {
    try {
      const url = new URL(proofUrl);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error();
      proofUrl = url.href;
    } catch { throw new HttpError(400, "The source link must start with https:// or http://."); }
  }
  return { title, year, category, organizer, description, proofUrl, published: form.get("published") === "on" };
}
async function validateFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "Choose a file smaller than 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let type;
  let extension;
  const start = new TextDecoder().decode(bytes.slice(0, 12));
  if (start.startsWith("%PDF-")) { type = "application/pdf"; extension = ".pdf"; }
  else if ([137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) { type = "image/png"; extension = ".png"; }
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { type = "image/jpeg"; extension = ".jpg"; }
  else if (start.startsWith("RIFF") && start.slice(8, 12) === "WEBP") { type = "image/webp"; extension = ".webp"; }
  else throw new HttpError(415, "Upload a PDF, JPG, PNG, or WebP file.");
  const name = (file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").replace(/\.[^.]*$/, "").slice(0, 140) || "certificate") + extension;
  return { bytes, type, name, size: file.size };
}
async function saveAchievement(request, env, id) {
  const existing = id ? await readRecord(env, id) : null;
  if (id && !existing) throw new HttpError(404, "This achievement no longer exists.");
  const form = await limitedForm(request);
  const fields = validateFields(form);
  if (existing && textField(form, "updatedAt", 50, true) !== existing.updatedAt) throw new HttpError(409, "This achievement changed in another tab. Reload it before saving.");
  const recordId = id || crypto.randomUUID();
  const now = new Date().toISOString();
  const record = { ...fields, id: recordId, createdAt: existing?.createdAt || now, updatedAt: now, file: existing?.file || null };
  const upload = form.get("file");
  let newKey;
  if (upload && typeof upload !== "string" && upload.size > 0) {
    const file = await validateFile(upload);
    newKey = FILE_PREFIX + recordId + "/" + crypto.randomUUID();
    await bucket(env).put(newKey, file.bytes, { httpMetadata: { contentType: file.type } });
    record.file = { key: newKey, name: file.name, type: file.type, size: file.size };
  } else if (form.get("removeFile") === "on") record.file = null;
  try { await bucket(env).put(RECORD_PREFIX + recordId + ".json", JSON.stringify(record), { httpMetadata: { contentType: "application/json" } }); }
  catch (error) { if (newKey) await bucket(env).delete(newKey); throw error; }
  if (existing?.file && existing.file.key !== record.file?.key) {
    // The saved record already references the new file. An old orphan must not undo the save.
    try { await bucket(env).delete(existing.file.key); } catch { console.warn("Old attachment cleanup failed."); }
  }
  return json({ achievement: publicRecord(record) }, id ? 200 : 201);
}
async function serveFile(request, env, id) {
  const record = await readRecord(env, id);
  if (!record?.file || (!record.published && !isAdmin(request, env))) throw new HttpError(404, "File not found.");
  const object = await bucket(env).get(record.file.key);
  if (!object) throw new HttpError(404, "File not found.");
  const encoded = encodeURIComponent(record.file.name).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16));
  return response(object.body, 200, record.file.type, {
    "Content-Disposition": (record.file.type === "application/pdf" ? "attachment" : "inline") + "; filename*=UTF-8''" + encoded,
    "Content-Security-Policy": "default-src 'none'; sandbox"
  });
}
function htmlResponse(html, status = 200) {
  return response(html, status, "text/html; charset=utf-8", {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"
  });
}

const app = {
  async fetch(request, env) {
    if (request.method === "HEAD") {
      const result = await app.fetch(new Request(request.url, { headers: request.headers, method: "GET" }), env);
      return new Response(null, { status: result.status, headers: result.headers });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      if (path === "/api/session" && method === "GET") return json({ isAdmin: isAdmin(request, env), localPreview: env.LOCAL_PREVIEW === "1" });
      if (path === "/api/achievements" && method === "GET") return json({ achievements: (await readRecords(env)).filter(record => record.published).map(publicRecord) });
      const adminRoute = path.match(/^\/api\/admin\/achievements(?:\/([a-f0-9-]{36}))?$/);
      if (adminRoute) {
        requireAdmin(request, env);
        const id = adminRoute[1];
        if (method === "GET" && !id) return json({ achievements: (await readRecords(env)).map(publicRecord) });
        requireSameOrigin(request);
        if (method === "POST" && !id) return await saveAchievement(request, env);
        if (method === "PUT" && id) return await saveAchievement(request, env, id);
        if (method === "DELETE" && id) {
          const record = await readRecord(env, id);
          if (!record) throw new HttpError(404, "This achievement no longer exists.");
          await bucket(env).delete([RECORD_PREFIX + id + ".json", ...(record.file ? [record.file.key] : [])]);
          return json({ deleted: true });
        }
        throw new HttpError(405, "Method not allowed.");
      }
      const fileRoute = path.match(/^\/files\/([a-f0-9-]{36})$/);
      if (fileRoute && method === "GET") return await serveFile(request, env, fileRoute[1]);
      if ((path === "/admin" || path === "/admin/") && method === "GET") {
        if (!request.headers.get("oai-authenticated-user-id")) return Response.redirect(url.origin + "/signin-with-chatgpt?return_to=%2Fadmin", 302);
        requireAdmin(request, env);
        return htmlResponse(ASSETS["/admin"].body);
      }
      if ((path === "/" || path === "/index.html") && method === "GET") {
        let achievements;
        try { achievements = renderAchievements((await readRecords(env)).filter(record => record.published)); }
        catch { achievements = '<p class="empty-note">Achievements are temporarily unavailable. Please check back later.</p>'; }
        return htmlResponse(ASSETS["/"].body.replace(/<!-- ACHIEVEMENTS_START -->[\s\S]*?<!-- ACHIEVEMENTS_END -->/, achievements));
      }
      const asset = ASSETS[path];
      if (asset && path !== "/admin" && method === "GET") {
        const body = asset.encoding === "base64"
          ? Uint8Array.from(atob(asset.body), character => character.charCodeAt(0))
          : asset.body;
        return response(body, 200, asset.type);
      }
      if (path.startsWith("/api/") || path.startsWith("/files/")) throw new HttpError(404, "Not found.");
      return htmlResponse('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found</title><link rel="stylesheet" href="/styles.css"><main class="container hero"><h1>Page not found.</h1><p><a href="/">Return to Anton’s portfolio →</a></p></main></html>', 404);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error("Portfolio request failed.");
      return json({ error: error instanceof HttpError ? error.message : "Something went wrong. Please try again." }, error.status || 500);
    }
  }
};
export default app;
