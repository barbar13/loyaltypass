# Fidelyzio — Project Notes for Claude Code

## Architecture
- **Backend**: Node.js + Express, served from `src/index.js`
- **Frontend**: React SPA (Vite) at `scanner/` — built to `scanner/dist/` and served as static files
- **Public pages**: Plain HTML in `public/` (card, home, enroll, admin, etc.)
- **Database**: PostgreSQL (production via Render) or SQLite (local dev, auto-detected by absence of `DATABASE_URL`)

## Known Limitations

### PostgreSQL SSL — `rejectUnauthorized: false`
`src/database.js` uses `ssl: { rejectUnauthorized: false }` for the PostgreSQL connection.
This is intentional and required by Render's free PostgreSQL tier, which uses self-signed certificates.
Render manages network-level isolation (the database is not publicly exposed), so the MitM risk is
acceptable in this hosting context. **Do not change this to `true`** without also providing a trusted
CA certificate (`ssl: { rejectUnauthorized: true, ca: fs.readFileSync('ca-cert.pem') }`).

## Security Architecture
- **JWT auth**: `src/middleware/auth.js` — validates JWT and checks `password_changed_at` to
  invalidate tokens after a password change. Requires `JWT_SECRET` env var (no fallback in prod).
- **Admin page**: `/admin` is protected server-side by a cookie (`admin_tok`) derived from `ADMIN_PASSWORD`.
  Session lasts 8 hours. Login at `/admin-login`, logout at `/admin-logout`.
- **Rate limiting**: `express-rate-limit` — 10 req/15min on auth routes, 30/15min on enrollment, 120/min general.
- **Input validation**: `logo_url` must be `http(s)://...`, `color` must be a 6-digit hex `#rrggbb`.

## Environment Variables Required in Production
```
JWT_SECRET=<long random string>
ADMIN_PASSWORD=<strong password>
DATABASE_URL=<postgresql connection string>
BASE_URL=https://fidelyzio.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```
