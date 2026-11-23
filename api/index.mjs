import app from '../worker/index.js';
import { BlobBucket } from '../lib/blob-bucket.mjs';
import { isOwner, ownerChallenge } from '../lib/owner-auth.mjs';
import { handleUpload } from '@vercel/blob/client';

export function createHandler({ bucket = new BlobBucket(), env = process.env } = {}) {
  return async function fetch(request) {
    const path = new URL(request.url).pathname;
    const owner = isOwner(request, env);
    if ((path === '/admin' || path === '/admin/' || path === '/admin.html' || path.startsWith('/api/admin/')) && !owner) return ownerChallenge();
    if (path === '/api/admin/upload' && request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('x-portfolio-request') !== '1') {
        return Response.json({ error: 'Please upload from the admin page.' }, { status: 403 });
      }
      try {
        const body = await request.json();
        const result = await handleUpload({ request, body, token: env.BLOB_READ_WRITE_TOKEN,
          onBeforeGenerateToken: async pathname => {
            if (!owner || !/^uploads\/[a-f0-9-]{36}\/(file|preview)$/.test(pathname)) throw new Error('Invalid upload destination.');
            return { allowedContentTypes: pathname.endsWith('/preview') ? ['image/jpeg', 'image/png', 'image/webp'] : ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
              maximumSizeInBytes: (pathname.endsWith('/preview') ? 2 : 10) * 1024 * 1024,
              addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 10 * 60 * 1000,
              ttlDays: 1 };
          }
        });
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
      } catch { return Response.json({ error: 'The upload could not be started.' }, { status: 400 }); }
    }
    return app.fetch(request, { BUCKET: bucket, OWNER_AUTHENTICATED: owner, PORTFOLIO_ADMIN_EMAIL: env.PORTFOLIO_ADMIN_EMAIL,
      LOCAL_PREVIEW: env.LOCAL_PREVIEW });
  };
}

export default { fetch: createHandler() };
