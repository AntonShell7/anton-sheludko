import { get, put, list, del } from '@vercel/blob';

// The portfolio keeps the same record format while moving from R2 to private Blob.
export class BlobBucket {
  constructor(token = process.env.BLOB_READ_WRITE_TOKEN) { this.token = token; }
  async get(key) {
    const result = await get(key, { access: 'private', token: this.token, useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const response = new Response(result.stream);
    return { body: response.body, size: result.blob.size,
      json: () => response.json(), text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
  }
  async put(key, value, options = {}) {
    return put(key, value, { access: 'private', token: this.token, addRandomSuffix: false,
      allowOverwrite: true, contentType: options.httpMetadata?.contentType, cacheControlMaxAge: 60 });
  }
  async list({ prefix, limit = 250, cursor } = {}) {
    const result = await list({ prefix, limit, cursor, token: this.token });
    return { objects: result.blobs.map(blob => ({ key: blob.pathname })), truncated: result.hasMore, cursor: result.cursor };
  }
  async delete(keys) { if (Array.isArray(keys) && !keys.length) return; await del(keys, { token: this.token }); }
}
