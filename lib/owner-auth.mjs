import { createHash, timingSafeEqual } from 'node:crypto';

// A high-entropy owner key is generated locally; only its digest is configured on Vercel.
// No platform identity headers supplied by visitors are trusted.
export function isOwner(request, env = process.env) {
  if (!/^[a-f0-9]{64}$/.test(env.PORTFOLIO_ADMIN_KEY_SHA256 || '')) return false;
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Basic ') || authorization.length > 1000) return false;
  const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon < 0 || decoded.slice(0, colon).toLowerCase() !== env.PORTFOLIO_ADMIN_EMAIL?.toLowerCase()) return false;
  const supplied = createHash('sha256').update(decoded.slice(colon + 1)).digest();
  return timingSafeEqual(supplied, Buffer.from(env.PORTFOLIO_ADMIN_KEY_SHA256, 'hex'));
}

export function ownerChallenge() {
  return Response.json({ error: 'Sign in with your portfolio owner credentials.' }, {
    status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Anton portfolio admin", charset="UTF-8"',
      'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}
