// Small disk-backed R2 substitute for local development and tests only.
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
export class LocalBucket {
  constructor(directory) { this.directory = directory; }
  location(key, suffix) { return join(this.directory, Buffer.from(key).toString("base64url") + suffix); }
  async put(key, value, options = {}) {
    await mkdir(this.directory, { recursive: true });
    const bytes = Buffer.from(typeof value === "string" ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : value);
    const metadata = { key, size: bytes.length, etag: createHash("sha256").update(bytes).digest("hex"), httpMetadata: options.httpMetadata || {} };
    await writeFile(this.location(key, ".body"), bytes);
    await writeFile(this.location(key, ".meta.json"), JSON.stringify(metadata));
    return metadata;
  }
  async get(key) {
    try {
      const metadata = JSON.parse(await readFile(this.location(key, ".meta.json"), "utf8"));
      const bytes = await readFile(this.location(key, ".body"));
      return { ...metadata, body: bytes, text: async () => bytes.toString(), json: async () => JSON.parse(bytes.toString()), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  async list({ prefix = "", limit = 1000, cursor = "0" } = {}) {
    await mkdir(this.directory, { recursive: true });
    const entries = await readdir(this.directory);
    const metadata = await Promise.all(entries.filter(name => name.endsWith(".meta.json")).map(async name => JSON.parse(await readFile(join(this.directory, name), "utf8"))));
    const all = metadata.filter(item => item.key.startsWith(prefix)).sort((a, b) => a.key.localeCompare(b.key));
    const start = Number(cursor);
    const objects = all.slice(start, start + limit);
    return { objects, truncated: start + limit < all.length, cursor: String(start + limit) };
  }
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      await rm(this.location(key, ".meta.json"), { force: true });
      await rm(this.location(key, ".body"), { force: true });
    }
  }
}
