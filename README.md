# La Kuku Chicken — React PWA

Vite + React site for La Kuku Chicken (Rubaga, Kampala), installable as a
Progressive Web App: works offline for previously visited pages, has a home
screen icon, and prompts eligible visitors to install it.

Products, prices and promotions are served from **Supabase** when it is
configured, and fall back to the built-in catalogue in `src/data/products.js`
when it is not — so the shop keeps selling online either way. Staff manage the
catalogue from an authenticated admin area at `/admin`.

**Setting up the admin area, the database, and the security model: see
[`ADMIN_SETUP.md`](./ADMIN_SETUP.md).**

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

Build for production:

```bash
npm run build
npm run preview   # serve the built dist/ locally to test PWA install + offline
```

Test and maintenance commands:

```bash
npm run verify             # 32 offline security + logic checks (no database needed)
npm run migrate:products   # one-time catalogue import (needs the service-role key)
```

The database security suite is SQL and lives in `supabase/tests/` — see
`supabase/tests/README.md`.

Output goes to `dist/` — deploy that folder to Netlify, Vercel, GitHub Pages, etc.
**The service worker only registers in production builds** (`npm run build` /
`npm run preview`), not in `npm run dev` — this avoids it caching over Vite's
dev server and hiding your live changes. Always test install/offline behavior
against a built version.

PWAs also require **HTTPS** in production (localhost is exempt for testing).
Netlify, Vercel, and GitHub Pages all serve over HTTPS by default.

> **Deploy note:** security headers (CSP, `X-Frame-Options`, `nosniff`) are
> configured in `public/_headers` and `vercel.json`. **GitHub Pages ignores
> both**, so deploying there ships without them. Use a host that supports custom
> headers.

The admin area needs a SPA rewrite so deep links like `/admin/promotions` serve
`index.html`. Netlify, Vercel and Cloudflare Pages do this automatically;
another host needs an explicit rewrite rule.

## Structure

```
public/
  manifest.webmanifest   # app name, icons, theme color, start URL, shortcuts
  sw.js                   # service worker: offline caching + fallback page
  offline.html            # shown when a page isn't cached and there's no network
  icons/                  # generated app icons (192/512, maskable, apple-touch, favicon)
src/
  data/products.js     # fallback catalogue + contact/location info. Prices are
                       # normally changed in the admin dashboard, NOT here.
  lib/
    supabase.js        # the single Supabase client (publishable key only)
    env.js             # env validation + refuses a service-role key
    productsRepo.js    # all reads, with static fallback when offline
    pricing.js         # money + promotion arithmetic (mirrors the SQL)
    groupProducts.js   # rebuilds the 15 cards from database rows
    validation.js      # input validation (mirrored by DB CHECK constraints)
    imageUpload.js     # magic-byte sniffing + generated storage names
  admin/               # the /admin area: auth, guard, products, promotions,
                       # settings. Own CSS; cannot affect the public design.
  components/
    PublicSite.jsx     # the public page (unchanged component tree)
    Navbar.jsx         # sticky nav: Our Story / Products / Locations / Contact
    Hero.jsx           # hero with the "price tag" signature element
    Story.jsx          # story section, 3 placeholder cards
    Products.jsx       # product grid — reads from the database, falls back
                       # to the data file when Supabase is unavailable
    Locations.jsx      # address, hours, delivery note, map placeholder
    Contact.jsx        # WhatsApp/call/email links + controlled inquiry form
    Footer.jsx
    WhatsAppFloat.jsx  # floating WhatsApp button
    InstallPrompt.jsx  # "Add to home screen" banner (Android/desktop + iOS hint)
    OfflineBanner.jsx  # small toast when the connection drops/returns
  App.jsx              # router root: "/" is the site, "/admin/*" is the admin
  index.css            # all public styling — design tokens live in :root
supabase/
  migrations/          # schema, RLS, storage, audit, variants (apply in order)
  tests/               # 62 SQL security assertions + how to run them
scripts/
  migrate-products.mjs # one-time import with verification
  verify.mjs           # offline test suite (`npm run verify`)
```

## PWA behavior

- **Installable** — `manifest.webmanifest` makes the site installable on
  Android, desktop Chrome/Edge, and (via Share → Add to Home Screen) iOS.
  `InstallPrompt.jsx` shows a custom "Install" banner when the browser fires
  `beforeinstallprompt`, and a manual instruction banner on iOS Safari, which
  doesn't support that event.
- **Offline support** — `sw.js` caches the app shell on first load, then
  caches pages and static assets as they're visited (network-first for pages,
  cache-first for JS/CSS/images). If a page was never visited and the network
  is down, it falls back to `offline.html`.
- **Icons** — generated in the brand palette (red/gold/cream drumstick mark)
  at the required sizes, including maskable variants for adaptive icon
  shapes on Android. Regenerate them anytime with `python3 gen_icons.py` if
  you tweak the design (requires Pillow: `pip install pillow`).
- **Cache busting** — bump `CACHE_VERSION` at the top of `public/sw.js` when
  you ship a release you want existing visitors to pick up immediately.

## Things still marked `[placeholder]`

- Real founding story copy (`Story.jsx`)
- Opening hours, delivery zones (`data/products.js` → `locationInfo`)
- Email address (`data/products.js` → `contactInfo.email`)
- Embedded Google Map (`Locations.jsx` — swap the `.map-frame` div for an
  `<iframe>` embed once you have the shop's map link)
- The inquiry form currently just shows an alert on submit — wire
  `handleSubmit` in `Contact.jsx` to a real backend, form service (e.g.
  Formspree), or build a `wa.me` link from the form fields.

## Adding or changing products

**With Supabase configured:** sign in at `/admin/login` and add or edit products
there. Prices, availability, descriptions, images and promotions are all
database-driven — no code change and no redeploy is needed for a price change.

**Without Supabase:** add entries to `chickenProducts` / `sausageProducts` in
`src/data/products.js`, which the grid renders automatically. This is now only
the fallback path; the database is the source of truth.

To branch for more locations: duplicate the `.loc-card` block/data in
`Locations.jsx` and `locationInfo` in the data file, or turn `locationInfo` into
an array.
