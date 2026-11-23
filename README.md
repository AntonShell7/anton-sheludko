# Anton Sheludko — Vercel portfolio

Production: https://anton-sheludko37.vercel.app

The portfolio retains the original design, photographs, Inter typography, signature branding and award gallery. Public visitors do not need an account.

## Hosting

- Vercel project: `prj_RYpvPy12xAeSBKzW2LRTw9rCHz6u`
- Team: `team_bIAQFfYLkb0k8XBRqjTr7i8Q`
- Node.js 24; static assets plus one Web-standard Node Function.
- Private Vercel Blob store: `store_LfKwCskbXkbsrvPa`, Frankfurt.
- Required server environment: `BLOB_READ_WRITE_TOKEN`, `PORTFOLIO_ADMIN_EMAIL`, `PORTFOLIO_ADMIN_KEY_SHA256`.

## Owner access

Open `/admin` and use the credentials in the separately delivered local `portfolio-admin-access.txt`. The browser uses HTTPS Basic authentication with a randomly generated 256-bit owner key. Only its SHA-256 digest is stored in the project environment. Never commit the credentials or share them with visitors. Incoming Sites identity headers are ignored.

All edit, upload and deletion routes require owner authentication and same-origin requests. Draft documents and previews remain private. The public gallery renders on the server and exposes only published records. Original files remain byte-identical to the source documents.

Uploads go directly to a private staging Blob with a one-day expiry (up to 10 MB for originals and 2 MB for previews). The server validates the actual bytes, copies them to permanent storage, commits the record and removes staging files. Do not make the Blob store public.

## Development and checks

```sh
npm ci
npm run build
npm test
npm run dev
```

The local preview uses disk-backed test storage, independent of production. Local preview enables owner access only on the loopback development server. Set `PORTFOLIO_LOCAL_ADMIN=0` to test anonymous access.

The original Sites deployment remains unchanged as a fallback. It is a separate copy; future content edits should be made in the Vercel admin. The migration script copies the five published records and verifies all original and preview checksums. Backup files under `work/migration-backup` are local only and excluded from Git/deployments.
