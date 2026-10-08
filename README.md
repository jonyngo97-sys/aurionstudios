# AURION Studios

Responsive collection preview implemented from the supplied AURION design sheet. Plain HTML, CSS and JavaScript; no build or dependencies required.

## Local preview

Run `python3 -m http.server 8080` from this directory and open `http://localhost:8080`.

## Features

- Responsive homepage, Drop 001 details, lookbook lightbox and Instagram link
- Product modal, image selection, XS–XXL sizes and size guide
- Shopping bag persisted locally, item removal and subtotal
- Product search, accessible dialogs and mobile navigation

## Before commercial launch

Connect a real commerce service for inventory, orders, payments, taxes and shipping. Newsletter submission is deliberately unavailable until a provider is connected. Supply actual imprint, privacy policy, cancellation conditions and terms. Confirm price (€59.90), measurements and product specifications, which come from the reference. Replace the cropped reference artwork with original high-resolution product photography. Fonts currently load from Google Fonts; self-host if desired.

## Hosting

The site can be hosted by any static host. For GitHub Pages, enable **Settings → Pages → Deploy from a branch → main / (root)**. This repository does not itself enable hosting or a public checkout.

## Cloudflare backend and administration

Cloudflare Worker + SQLite-backed Durable Object stores the catalog and sessions persistently. Wrangler provisions the binding through the v1 migration. Cloudflare's connected build must deploy with `npx wrangler deploy`. Wrangler runs the static asset build automatically.

- `/admin.html`: login and product/drop/offer editor
- `/setup.html`: local password-to-secret helper; passwords are not transmitted
- `/api/public/catalog`: published products and active offers
- `/api/admin/*`: authenticated catalog API

In Cloudflare **aurionstudios → Settings → Variables and Secrets**, create Secret `ADMIN_PASSWORD_HASH` using `/setup.html`, then deploy. Optional `ADMIN_USERNAME` overrides `admin`. Never commit secrets or `.dev.vars`. HttpOnly/Secure/SameSite Strict sessions expire after eight hours; password rotation invalidates sessions. Login is limited to five attempts per IP per 15 minutes; writes require same-origin requests and CSRF. One admin account is supported.

Products/drops have draft/published states. Future launch dates keep drops and their products private. Offers target a product or drop with percent discount or fixed sale price and optional dates. Lowest active sale price wins. Money is integer euro cents. Removing a drop makes linked products drafts and removes offers. Revision checking rejects stale writes. Article images support drag-and-drop or file selection (JPG/PNG/WebP, originals up to 15 MB, up to 10 images). The browser converts to WebP and resizes to 1600 px; the authenticated backend accepts at most 2 MB per image and persists binary chunks in Durable Object storage. Public immutable image URLs use /api/media/<uuid>. Reorder images to choose a cover or remove their article association. Uploaded bytes are retained if an edit is cancelled or an image association is removed. Manual HTTPS addresses remain optional.

Cloudflare reads the live catalog; GitHub Pages remains a static preview. Checkout, orders, multiple staff accounts and newsletter delivery remain unimplemented. Run `npm test`; `npm run build` exports only public files.
