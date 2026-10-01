# La Kuku Chicken — React PWA scaffold

Vite + React site for La Kuku Chicken (Rubaga, Kampala), installable as a
Progressive Web App: works offline for previously visited pages, has a home
screen icon, and prompts eligible visitors to install it.

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

Output goes to `dist/` — deploy that folder to Netlify, Vercel, GitHub Pages, etc.
**The service worker only registers in production builds** (`npm run build` /
`npm run preview`), not in `npm run dev` — this avoids it caching over Vite's
dev server and hiding your live changes. Always test install/offline behavior
against a built version.

PWAs also require **HTTPS** in production (localhost is exempt for testing).
Netlify, Vercel, and GitHub Pages all serve over HTTPS by default.

## Structure

```
public/
  manifest.webmanifest   # app name, icons, theme color, start URL, shortcuts
  sw.js                   # service worker: offline caching + fallback page
  offline.html            # shown when a page isn't cached and there's no network
  icons/                  # generated app icons (192/512, maskable, apple-touch, favicon)
src/
  data/products.js     # all prices, contact info, location info — edit here first
  components/
    Navbar.jsx          # sticky nav: Our Story / Products / Locations / Contact
    Hero.jsx             # hero with the "price tag" signature element
    Story.jsx            # story section, 3 placeholder cards
    Products.jsx         # renders chickenProducts + sausageProducts from data file
    Locations.jsx        # address, hours, delivery note, map placeholder
    Contact.jsx           # WhatsApp/call/email links + controlled inquiry form
    Footer.jsx
    WhatsAppFloat.jsx     # floating WhatsApp button
    InstallPrompt.jsx     # "Add to home screen" banner (Android/desktop + iOS hint)
    OfflineBanner.jsx     # small toast when the connection drops/returns
  App.jsx
  index.css              # all styling — design tokens live in :root
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

## Extending

- Add more branches: duplicate the `.loc-card` block/data in `Locations.jsx`
  and `locationInfo` in the data file, or turn `locationInfo` into an array.
- Add more products: just add entries to `chickenProducts` /
  `sausageProducts` in `src/data/products.js` — the grid renders automatically.
