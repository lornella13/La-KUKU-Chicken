# Admin dashboard — setup and security notes

This is the operational guide for the La Kuku Chicken admin area. Read the
**Security** section before going live; several items there are not optional and
cannot be automated.

---

## 1. What you need

- A free (or paid) project at [supabase.com](https://supabase.com)
- Node 18+ (this repo is developed against Node 24)
- The project URL and **publishable** key from Dashboard → Project Settings → API

---

## 2. Run the public website as it is today

The public site works with **no Supabase configuration at all**. Without it, the
catalogue falls back to the existing `src/data/products.js` data so the shop
keeps selling online.

```bash
npm install
npm run dev
```

If you ever see "Showing our standard price list." on the products section, the
database is not connected.

---

## 3. Create the database schema

Run these files in order in Dashboard → **SQL Editor → New query**. They are
plain SQL and can also be applied with the Supabase CLI (`supabase db push`).

| Order | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/0001_core_schema.sql` | tables, constraints, triggers |
| 2 | `supabase/migrations/0002_row_level_security.sql` | RLS policies + `public_products` view |
| 3 | `supabase/migrations/0003_product_image_storage.sql` | image bucket + storage policies |
| 4 | `supabase/migrations/0004_audit_logging.sql` | `audit_logs` + audit triggers |
| 5 | `supabase/migrations/0005_product_variants.sql` | size-variant columns + partial unique index |
| — | `supabase/migrations/0006_first_admin.sql` | **manual** — see step 5 |

Run them in that order: 0005 recreates the `public_products` view, and 0004
creates `audit_logs`.

### Verify RLS is on

Dashboard → Table Editor. Each of `products`, `promotions`,
`promotion_products`, `admin_profiles`, `audit_logs` must show **RLS enabled**.

---

## 4. Migrate the existing products

The 15 existing products (18 sizes) are copied from `src/data/products.js` —
nothing is invented. The script reads back what it wrote and diffs it against
the source, and **exits non-zero if anything is missing or different**, so it is
safe to run twice.

```bash
# One-time, on your machine only:
export SUPABASE_URL=https://your-project-ref.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npm run migrate:products
```

> **The service-role key bypasses Row Level Security.** It is needed only because
> a migration is not a staff user. Keep it in your shell or in `.env.local`
> (git-ignored) — never in a `VITE_*` variable, never in `src/`, never in
> `public/`, never in a commit. The website itself only ever uses the
> publishable key.

Expected output ends with:

```
Verification passed: every product in products.js is present and identical.
Distinct products (cards): 15
```

---

## 5. Create the first administrator

1. Dashboard → **Authentication → Users → Add user**. Use a real inbox you
   control. Set a strong, unique password — it is hashed by Supabase Auth and is
   never stored by this application.
2. Copy the user's **User UID**.
3. Open `supabase/migrations/0006_first_admin.sql`, uncomment the insert, paste
   the UID, and run it:

```sql
insert into public.admin_profiles (user_id, role)
values ('PASTE-YOUR-USER-UID-HERE', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

There is deliberately **no UI to grant roles** and no insert policy on
`admin_profiles` for ordinary users, so nobody can promote themselves.

To add more staff, repeat with their UID. Use `'manager'` for a day-to-day
operator who may change products and promotions but cannot delete them.

---

## 6. Configure the frontend

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env.local` is git-ignored. Restart `npm run dev` — Vite only reads env vars at
startup.

The app refuses to initialise the Supabase client if
`VITE_SUPABASE_PUBLISHABLE_KEY` looks like a service-role key, and says so
rather than silently shipping a key that bypasses RLS.

---

## 7. Commands

| Command | What it does |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | dev server, hot reload |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve `dist/` locally (test the PWA/build) |
| `npm run verify` | 34 offline security + logic checks (no database needed) |
| `npm run migrate:products` | one-time catalogue import (needs service-role key) |

There is **no** lint or typecheck script in this project; it is plain JSX. The
build is the closest thing to a compile-time gate.

---

## 8. Required environment variables

| Variable | Where | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | frontend (public) | for admin + live prices | safe to expose |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend (public) | for admin + live prices | safe **by design**; RLS is the real gate |
| `SUPABASE_URL` | migration script only | one-time | not `VITE_`-prefixed, so never bundled |
| `SUPABASE_SERVICE_ROLE_KEY` | migration script only | one-time | bypasses RLS — keep off the frontend and out of git |

No credentials are stored in this repository.

---

## 9. Security model in one paragraph

The browser holds the Supabase **publishable** key. That key is not a secret —
Supabase publishes it by design — and it grants the `anon` role only what Row
Level Security allows. Every sensitive action is refused by Postgres: anonymous
and authenticated-non-staff users have **no** insert, update or delete policy on
`products`, `promotions`, `promotion_products`, or `admin_profiles`, and no
write policy at all on `storage.objects`. The React route guard is only a
usability feature; deleting it would not grant anyone a single extra permission.

---

## 10. Manual security tests (REQUIRED before going live)

**Already verified.** The schema and its policies were executed against a real
PostgreSQL 14 instance and 62 assertions pass — constraints, promotion
integrity, price arithmetic, promotion expiry by database clock, disabled-product
visibility, RLS for anonymous / customer / staff roles, access revocation,
audit logging and bucket configuration. Reproduce with:

```bash
psql -h /tmp -p 55432 -U tester -d lakuku -f supabase/tests/security_tests.sql
```

See `supabase/tests/README.md`. `npm run verify` adds 34 further offline checks.

**Still unverified** — these need a live Supabase project, because they depend on
Supabase Auth, Storage and the network, and **no project existed while this was
written**. Work through the list below before going live.

### A. Authentication

- [ ] Visit `/admin` signed out → redirected to `/admin/login`
- [ ] Sign in with a wrong password → generic "Email or password is incorrect."
- [ ] Sign in with a **valid non-admin** account → "This account does not have administrator access", and the session is ended
- [ ] Sign in as admin → dashboard loads
- [ ] Sign out → session terminated; `/admin` redirects to the login page again
- [ ] Paste an expired/garbage token into the session → the app shows the login page rather than crashing

### B. Live integration

- [ ] Public site shows database prices, not the static list ("Showing our standard price list." must disappear)
- [ ] Change a price in the admin → the public price updates after a refresh
- [ ] A promotion shows the struck-through original price, the badge, and the discounted price
- [ ] Set a promotion's `end_date` to yesterday → it stops applying with no code change and no redeploy
- [ ] A disabled product disappears from the public site and its WhatsApp button is replaced
- [ ] Product image upload works end to end and the image renders
- [ ] WhatsApp links open with the current name and displayed price

### C. Uploads (live Storage)

- [ ] Upload a 6 MB image → rejected
- [ ] Rename a `.php`/`.html` file to `.png` → rejected by the magic-byte sniff
- [ ] Upload an SVG → rejected
- [ ] A file named `../../evil.png` → stored as a generated `products/<uuid>/<uuid>.png`
- [ ] Signed out, an upload to `product-images` is refused

### D. Headers (after deploying)

```bash
curl -I https://your-site.example | grep -iE 'content-security|x-frame|nosniff|referrer|permissions|strict-transport'
```

- [ ] `Content-Security-Policy` includes `frame-ancestors 'none'`
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `X-Frame-Options: DENY` present
- [ ] The CSP does not break the site in production (check the console while browsing)

---

## 11. Known limitations — read this honestly

These are real and are **not** fixed by the code in this repo.

1. **Never run against a real Supabase project.** The schema has been executed
   and tested on a plain PostgreSQL 14 instance (62/62 assertions), but it has
   never run on Supabase itself. Supabase provides `auth`, `storage` and its
   default privileges; `supabase/tests/local_stub.sql` imitates them, but
   differences are possible. Apply the migrations, then work through section 10.
2. **`security_invoker` requires PostgreSQL 15+.** Supabase runs 15/17 so this is
   fine there, but it is why the view statement fails on a local PG14 — see
   `supabase/tests/README.md`.
3. **Rate limiting relies on Supabase Auth.** There is no custom login endpoint,
   so brute-force protection comes from Supabase's own limits — which are
   per-project and not configurable from this codebase. Consider enabling
   CAPTCHA in Dashboard → Authentication → Providers. Do not add a bespoke login
   form to "improve" this; that would be strictly worse.
3. **No MFA enforcement.** Available in Supabase Auth, not required by this app.
   Strongly recommended for admins.
4. **Email confirmation is not enforced by this app.** If you create a user
   without confirming their email, that account can still sign in — though it
   still needs an `admin_profiles` row to reach anything.
5. **`X-Frame-Options` / CSP depend on the host.** They are configured in
   `public/_headers` (Netlify, Cloudflare Pages) and `vercel.json` (Vercel).
   **GitHub Pages ignores both**, so deploying there ships without them. Use a
   host that supports custom headers, or add them at your CDN.
6. **The publishable key is public.** This is by design and is safe only while
   the RLS policies in `0002` are in place. If you ever add a table, enable RLS
   on it before giving it a policy, and never add `USING (true)` to a write.
7. **Storage orphan files.** Replacing an image always creates a new object; old
   ones are cleaned up manually in the Supabase dashboard. This is deliberate,
   so a mistaken replacement is recoverable.
8. **The service-role key bypasses RLS.** Anything running with it can do
   anything. Treat the machine holding `.env.local` as a sensitive asset.
9. **No automated browser tests.** `npm run verify` covers pure logic and static
   analysis only; section 10 is manual by design.
10. **The static catalogue is still in the repo.** It is the intentional fallback
    that keeps the site up when Supabase is unreachable. It will drift from the
    database over time — treat the database as truth and the file as a spare.

---

## 12. File map

```
src/lib/env.js              env validation + service-role key guard
src/lib/supabase.js         the single client (anon/publishable only)
src/lib/pricing.js          money + promotion arithmetic (mirrors the SQL)
src/lib/validation.js       client-side input validation
src/lib/groupProducts.js    rebuilds 15 cards from database rows
src/lib/productsRepo.js     all reads, with static fallback
src/lib/imageUpload.js      magic-byte sniffing + generated object names
src/admin/                  the admin area (all guarded, own CSS)
supabase/migrations/        schema, RLS, storage, audit, variants
scripts/migrate-products.mjs one-time import with verification
scripts/verify.mjs          offline test suite
public/_headers             security headers (Netlify / Cloudflare)
vercel.json                 security headers (Vercel)
```