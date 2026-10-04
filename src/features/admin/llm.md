# src/features/admin/

## Purpose

The staff-facing half of the product: a sign-in gate, a payment-link builder and the product catalogue,
served on `admin.platinumwheels.ca` with prefix-less URLs (D115). It exists because the shop's selling flow ends off-platform
— inquiry, phone call, human quote — and the one step that has to come back on-platform is taking the
money. Delete this folder and the owner has no way to raise a payment link, and the storefront's
quote-first model terminates in a phone call with nothing to send.

Since D99–D108 it is backed by real payments: the builder writes a `payment_links` row through
`src/features/payments/` and hands back the customer's `pay.platinumwheels.ca/pay/<token>` URL, and the
links list shows which links were paid (D106). Sign-in is still one shared account, hardened by D95
rather than replaced by an auth system. Since D105b the folder also holds the product admin's server side
(gated reads and Server Actions), and since D116–D118 its screens, photo upload (R2 since D126b) and the admin home.

## Owns

- [`host-routing.ts`](host-routing.ts) — which host serves the admin and at what paths (D115), and `/pay`
  (D105). A pure function with no imports, so it is testable without Next; `src/proxy.ts` is its only
  caller. On an admin host every path is rewritten into `src/app/admin/`; `/admin/**` is a 404 everywhere.
  `ADMIN_HOST`, `DEV_ADMIN_HOST` and `PAY_HOST` are duplicated as literals in the proxy's `matcher` and
  `next.config.ts` (and `PAY_HOST` in `src/features/payments/config.ts`). Change them together.
- [`types.ts`](types.ts) — the contract. Route map, field names, form-state unions, validation ceilings.
  Written by the coordinator before any implementation file (D25). Both actions and both forms code
  against it; nothing here invents a field name.
- [`session.ts`](session.ts) — the gate (D95). scrypt credential check, the signed `__Host-` session
  cookie, `requireAdminSession()` for pages (returns the CSRF token), `requireAdminAction()` for Server
  Actions, `assertSameOriginRequest()`, `logAdminAuthEvent()`. **Read the block at the top before
  touching anything auth-shaped.**
- [`auth-actions.ts`](auth-actions.ts) — `"use server"`. `signIn` (origin check, validates, opens a
  session, logs, redirects) and `signOut` (`requireAdminAction()`, then clears the cookie).
- [`payment-link-actions.ts`](payment-link-actions.ts) — `"use server"`, two actions, each calling
  `requireAdminAction()` first. `createPaymentLink` validates amount, description and expiry, then
  creates the link (idempotent on a per-render key). `cancelPaymentLink` serves the links list
  (D106). There is no check-payment action: the admin never calls the gateway (D108).
- [`product-types.ts`](product-types.ts) — the product admin contract (D105b): `PRODUCT_ID_FIELD`,
  `PRODUCT_STATUS_FIELD`, `ProductFormState`, `ProductStatusState`, `ProductListQuery`. The product's
  own field names are `PRODUCT_FIELD` in `@/features/catalog/product-input`.
- [`product-queries.ts`](product-queries.ts) — gated reads for Server Components: `adminListProducts`,
  `adminGetProduct`, `adminListBrands` (every brand, or one category's since D127b), `adminListVendors`,
  `adminListRimSizes` (D127b), `adminListPhotos`, `adminCountPublished`. Each calls `requireAdminSession()`
  first. Not `"use server"`.
- [`product-actions.ts`](product-actions.ts) — `"use server"`. `createProductAction`,
  `updateProductAction`, `setProductStatusAction`, `bulkSetProductStatusAction`. Each calls
  `requireAdminAction(formData)` first and then `catalog/store.ts`; the create and update actions
  validate with `parseProductInput()` in between.
- [`photo-actions.ts`](photo-actions.ts) — `"use server"`, D117, storage D126b. `requestPhotoUpload` (signs a
  10-minute R2 link for `PUT`s of one type at one staging key `uploads/<product>/<stem>-<id>`), `addPhoto`
  (takes that key, checks it with a `HEAD`, reads exactly that version with a 10 MB cap, makes the 480 and
  1000 sizes, stores them under `products/<product>/`,
  deletes the original, then records the row), `removePhoto` (row, then both sizes), `movePhoto`. Each
  calls `requireAdminAction(formData)` first. The only admin file that writes to the bucket.
- [`product-display.ts`](product-display.ts) — pure: spec line, labels, `displayPrice`, and
  `productFormValues()` (a saved product as form values, extra specs and vendor prices included).
  Since D125 also `vendorPriceLabel()` (`$388.12`, cents always), `lowestVendorPrice()` and
  `extraSpecsText()` (one `Label: value` per line). Client-safe.
- [`storefront-link.ts`](storefront-link.ts) — the View on site URL from env `STOREFRONT_URL` (D116).
- [`greeting.ts`](greeting.ts) — the home's rotating lines per Brampton-time band (D118). Copy the owner may
  rewrite.
- [`components/product-form.tsx`](components/product-form.tsx) — client island, create and edit, all three
  categories, brand and vendor dropdowns, source rows. Remounts its fields after every answer. D125: an
  accessory's brand select opens on `No brand` (empty value) and is not required; wheels gain Finish
  family / Colour / Lug count, accessories Part type / Weight (lb); every category ends with an `Extra
  specs` textarea (`extra_specs`, one `Label: value` per line); the edit page passes the saved
  `lowestVendorPrice` for the sources block. D127b: the brand list is the product's category's; the name
  field is `Full name`, with a live "On the site this reads" line (brand + model, or the name when the model
  is blank, through `productName()`).
- [`components/product-source-row.tsx`](components/product-source-row.tsx) — one source row (vendor,
  SKU, **vendor price**, link) and the `Lowest vendor price` line (D125). No hooks and no `"use client"`,
  so `/styleguide` renders the real row inert (D93).
- [`components/admin-product-card.tsx`](components/admin-product-card.tsx) — one list card; `inert` for the
  styleguide.
- [`components/product-status-buttons.tsx`](components/product-status-buttons.tsx) — client island,
  Publish / Hide / Discontinue for one product.
- [`components/bulk-status-bar.tsx`](components/bulk-status-bar.tsx) — client island, ticked rows or all
  matching; builds the "all matching" post itself so ticked ids never ride along. It posts **every** list
  filter (D127b): one left out would widen the change past what the list shows.
- [`components/product-filters.tsx`](components/product-filters.tsx) — the list's GET form (`next/form`):
  search, category, status, brand, and since D127b vendor, accessory type, rim size and a no-photo tick box.
- [`components/category-type-filter.tsx`](components/category-type-filter.tsx) — client island inside the
  filters (D127b): the Category select, and the Accessory type select shown while Accessories is chosen.
- [`components/page-jump.tsx`](components/page-jump.tsx) — the list's Go to page GET form (D127b), carrying
  the current filter as hidden fields. No JavaScript of its own.
- [`components/product-photos.tsx`](components/product-photos.tsx) — client island, upload (browser →
  R2 with the signed link, D126b), order, remove. Thumbnails draw the `card` size via `photoSource()`.
- [`components/login-form.tsx`](components/login-form.tsx) — client island. `useActionState` + focus
  management, the `quote-form.tsx` idiom.
- [`components/login-error-summary.tsx`](components/login-error-summary.tsx) — authored error state,
  its own module so `/admin/styleguide` renders the real component.
- [`components/admin-top-bar.tsx`](components/admin-top-bar.tsx) — logo (links home), `Admin` label, the
  two section links (D118), sign out.
- [`components/payment-link-form.tsx`](components/payment-link-form.tsx) — client island. Amount,
  description, expiry (D103), plus the hidden idempotency key.
- [`components/payment-link-success.tsx`](components/payment-link-success.tsx) — authored success state:
  the link, reference, amount, expiry, and the **test mode** notice while the gateway is the demo (D107).
- [`components/payment-link-list.tsx`](components/payment-link-list.tsx) — the latest 50 links as stacked
  cards: status, paid-with card and approval code, duplicate-payment alert, the *Payment started, not
  confirmed* note for an attempt that never returned (D108), copy link (D106).
- [`components/link-row-actions.tsx`](components/link-row-actions.tsx) — client island. Cancel (with a
  confirm) for one row.
- [`components/copy-link-button.tsx`](components/copy-link-button.tsx) — client island. Clipboard write
  with a real failure path.

## Rules

- **Nothing here has an artboard** (D89). The `design/` export covers three storefront routes only, so
  this folder has no authority-level-2 source. Everything is authored from the existing token system
  under `.claude/rules/ui.md`; no token, colour, radius or spacing value may be invented. Where a value
  is genuinely missing, it goes to **Open**, not into the code.
- **Mobile-first, and the tablet band is primary.** The client confirmed he works "mostly on phone and
  tab". iPad portrait (~744–834px) lands in the `sm:` 720–1099 band, so that band is a design target
  here, not a fall-out of `sm:` (contrast D41/D46, which had to rule on it after the fact on the
  storefront).
- **No hover-only affordances.** Hover is scoped to `@media (hover: hover)` repo-wide (D17), so anything
  revealed only on hover is permanently unreachable on his devices. Every control is persistently visible.
- **No gateway in this folder.** The PSP is Converge (D99), but that code lives in
  `src/features/payments/`. This folder may import that feature's `service`, `config` and `money` modules
  (D106), and never `converge.ts`; nothing here may name or be shaped around a gateway (D92, as amended
  by D99).
- **Three fields.** The builder takes an amount, a description and an expiry (D103). No line items, no
  quantities, no fees, no HST, no totals — the owner ruled it a wrapper, not a calculator (D92).
- **Nothing here moves money out.** No refund or void button; those are done in the Converge portal.
- Every protected page calls `requireAdminSession()` first, and **every Server Action here calls
  `requireAdminAction(formData)` first** (`signIn`, which has no session yet, calls
  `assertSameOriginRequest()`). An action is a public POST endpoint whether or not its page is gated, and
  `src/proxy.ts` (D97) routes by host and is deliberately not a gate, so there is still no single choke
  point: a page or action that forgets is simply unprotected (D95).
- **Every signed-in form carries `<input type="hidden" name={ADMIN_CSRF_FIELD}>`** with the token from
  the page's `requireAdminSession()`, passed down as a `csrfToken` prop (D95).
- Credentials live only in Vercel env vars: `ADMIN_USERNAME`, `ADMIN_SESSION_SECRET` (32+ characters),
  `ADMIN_PASSWORD_HASH` from `npm run admin:hash-password` (or `ADMIN_PASSWORD` until that is set).
- The password is never echoed back to the client, in any state.
- **Every date and time is Brampton's** (D118): format through `@/lib/time`, never with a zone typed here.
- **Brands and vendors are picked from the catalogue's own** (D116): dropdowns on the form, and the create
  and update actions refuse any other spelling. **A brand must already be on a product of the same
  category** (D127b), on the form and in the actions. There is no way to add a new brand or vendor once the
  catalogue is loaded (owner, 2026-10-03: *"Leave it for now"*; the importer loads only into an empty
  catalogue, D113). **An accessory may have no brand** (D125); a tire or wheel may not, which the validator
  and the database hold too.
- **Every list filter is also a bulk filter** (D127b). A filter added to the list goes into
  `PRODUCT_STATUS_FIELD`, `bulk-status-bar.tsx`, `readFilter()` in `product-actions.ts` (which refuses a
  value it cannot read) and `filterConditions()` in `catalog/store.ts`, in the same change.
- **A vendor's price is staff only** (D125): typed and shown here, cents kept (`vendorPriceLabel`), never
  with `Price`, and never passed to anything on the storefront.
- **Removing a shared catalogue photo unlinks it and keeps the file** (D139b): the bulk load's photos live
  under `catalog/`, used by many products, and `removePhoto` deletes files only under the product's own
  `products/<uuid>/` folder (it logs the rest). Staff uploads stay per product and are deleted as before.
- **A removed photo's URL can outlive it briefly** (D126b): the files are deleted at once, but they are
  marked immutable, so a copy Cloudflare or a browser cached may answer the (unlinked) URL until it
  expires.
- **A photo is recorded only after R2 confirms it** (D117, D126b): `addPhoto` accepts only a staging key
  this product's handshake could have issued, `HEAD`s it for an allowed type within 10 MB, and records the
  stored `full` URL, never one the browser sends.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D89 | 2026-09-21 | Admin is authored with no artboard; Track Night tokens reused, no new theme | The design export covers three storefront routes; a second design system is unaffordable before Oct 15 | Owner |
| D90 | 2026-09-21 | Subdomain rewrite deferred; routes ship at `/admin` | A preview deployment resolves one `*.vercel.app` host, so a host-keyed rule cannot be tested there | Owner |
| D91 | 2026-09-21 | Stub cookie gate, username + password, one shared credential, lands on the builder | One shop, no staff accounts; real auth needs a backend that is deferred | Owner |
| D92 | 2026-09-21 | Payment link = amount + description only; no computation | Owner: *"its simply just a payment link generator … basically just a wrapper on top of payment gateway they choose"* | Owner |
| D93 | 2026-09-21 | Admin authored states go to `/admin/styleguide`, not the storefront's | Staff states do not belong on a public storefront reference page | Owner |
| D94 | 2026-09-21 | ~~The generated link is a realistic placeholder, visibly labelled as not connected~~ **Retired by D107** | It must demo convincingly without anyone mistaking it for live | Owner |
| D95 | 2026-09-23 | One shared sign-in, hardened: scrypt hash, signed `__Host-` cookie, CSRF token + origin check on every action, admin security headers, audit log. No login limit, no per-user accounts, no 2FA | Owner: *"only one login account password works"*, *"lets not build limit failed login"* | Owner |
| D96 | 2026-09-23 | `admin.platinumwheels.ca` wired: a DNS-only Cloudflare CNAME to Vercel; the apex stays on the goodwill site | Owner chose the admin subdomain only; must never proxy the record or move the nameservers (email) | Owner |
| D97 | 2026-09-23 | `src/proxy.ts`: on the admin host non-`/admin` paths 307 to `/admin`; elsewhere `/admin` is a 404; production only. **Prefix and preview rule superseded by D115** | The subdomain became real, so the D90 deferral no longer applied | Owner |
| D115 | 2026-10-01 | Prefix-less admin URLs on admin hosts only; `/admin/**` 404s everywhere | Owner: *"we should not build admin routes as /admin"* | Owner |
| D116 | 2026-10-01 | Product screens: cards, per-card status, bulk ticked or all matching, "Display price", pick-from-existing brand and vendor, `STOREFRONT_URL` | P2 scope, rulings asked one at a time | Owner |
| D117 | 2026-10-01 | Photos: browser → Blob with a one-file token, verified by `head()`; 8 × 10 MB; contain; delete removes the file | Owner chose each limit | Owner |
| D126b | 2026-10-03 | Photos move to Cloudflare R2 in two sizes (480 / 1000 WebP); signed `PUT`, staging key, sized on the server; Blob removed | Hobby Blob locks for 30 days past 2,000 uploads; 5,000 resizes a month | Owner |
| D118 | 2026-10-01 | Admin home greeting + tiles; builder at `/payment-links`; top bar nav; Brampton time everywhere | Owner: *"all times used in application need to be brampton time zone"* | Owner |
| D127b | 2026-10-03 | `Full name` + title preview; category-scoped brands; vendor / type / rim / no-photo filters; Go to page; list index; bulk count in SQL | An audit of the admin against the loaded D125 catalogue | Owner |

Global rows live in the root [`llm.md`](../../../llm.md) §5b and are referenced by ID, never restated.

## Connects to

- **Depends on:** `src/components/ui/` (button, input, field-label), `src/lib/site.ts` (`SITE`),
  `next/headers`, `next/navigation` and `node:crypto`.
- **Depended on by:** `src/app/admin/` (layout and every admin route).
- **Depends on (D125):** `src/lib/product-name.ts` (photo alt text).
- **Depends on (D105b, D116, D117):** `src/features/catalog/` — `store.ts`, `lookups.ts`, `photos.ts`,
  `product-input.ts`, `catalog-types.ts`, `adapter.ts` (labels), and for photos (D126b) `photo-files.ts`,
  `photo-sizes.ts`, `photo-store.ts`; `src/lib/time.ts`.
  This is the D37 graph's existing direction (`features → catalog`), so no edge is reversed.
- **Deliberately does not touch:** `src/features/finder|home|product|results/`. The admin shares the
  primitives and the tokens, and nothing else.

## Don't

- **Don't add a Server Action without `requireAdminAction(formData)` as its first statement**, or a
  signed-in form without the `ADMIN_CSRF_FIELD` hidden input. Either gap reopens what D95 closed.
- **Don't log a submitted username or password.** `logAdminAuthEvent()` logs the event and the IP only;
  a password typed into the username box would otherwise land in Vercel's logs.
- **Don't change the `ADMIN_PASSWORD_HASH` format on one side only.** `session.ts`
  `parsePasswordHash()` and `scripts/hash-admin-password.mjs` must agree.
- **Don't use the `Price` primitive for an amount.** `src/components/ui/price.tsx` deliberately forbids
  cents and is parity-measured on all three storefront routes; a payment amount needs `$452.60`.
- **Don't add fields to the builder.** Customer name, email, reference, expiry and line items were all
  offered to the owner and declined this session. Adding one is a scope change, not an improvement.
  **One exception:** D103 (2026-09-23) adds a staff-chosen expiry. It lands with the payments wiring, not
  before.
- **Don't add a local class-merge helper.** The 13 hand-rolled copies the D56 audit found were
  consolidated into [`src/lib/cx.ts`](../../lib/cx.ts) by D63. Import `cx` / `join` from `@/lib/cx`
  when a conditional class list needs one; the admin currently needs neither.
- **Don't add a delete action for products.** A product leaves the site by becoming `hidden` or
  `discontinued`, so old links keep working (D105b).
- **Don't call the name field the product's title.** The storefront reads brand + model and falls back to
  the name only when the model is blank (D127b); the preview line under the field is the truth.
- **Don't let a bulk status change run with no ticked rows and no filter.** `bulkSetProductStatus`
  refuses it; an empty submit must never mean the whole catalogue (D107b).
- **Don't put a product read in a `"use server"` file.** Every export there is a public POST endpoint.
- **Don't import a value from a `"use client"` module into a server component.** It arrives as a client
  reference, not the value; that is why `BULK_FORM_ID` lives in `product-types.ts`.
- **Don't post a ticked-rows change and an all-matching change in one request.** Ticked ids win and the
  filter is ignored (D107b); `bulk-status-bar.tsx` builds each separately.
- **Don't send a photo's bytes in a Server Action's request.** A function request body tops out at
  4.5 MB; the browser `PUT`s to R2 directly and `addPhoto` reads the file from there (D117, D126b).
- **Don't let `addPhoto` take a URL or a key the server did not issue.** It parses the staging key against
  the product id; anything else is refused before R2 is asked (D126b).

## Open

1. **What D95 declined:** per-user accounts, a second factor, per-session revocation (changing the
   password or `ADMIN_SESSION_SECRET` signs everyone out at once). Revisit if staff beyond the owner
   need their own logins. Owner.
2. ~~**PSP selection.**~~ **Closed by D99 and D107:** the PSP is Converge and the builder creates real
   links. What is left is proving it against the gateway, which waits on the owner actions in `todo.md`
   "Owner — payments".
3. ~~**Product CRUD screens.**~~ **Built by D116 and D117.** Still open: **the storefront product page shows
   only the main photo** (`src/features/product/components/pdp-gallery.tsx` takes one image), so photos 2–8
   are stored and ordered but not displayed; a gallery is storefront work for the owner to schedule. The
   greeting lines (`greeting.ts`) await the owner's read. Every successful product or photo write calls
   `updateTag(CATALOGUE_TAG)` (D109), which expires the cached home row and has Next re-render the route
   it was posted from. Owner.
4. **Switch production to `ADMIN_PASSWORD_HASH`.** `ADMIN_USERNAME`, `ADMIN_PASSWORD` and
   `ADMIN_SESSION_SECRET` are set in the Vercel project (Production + Preview). Until the hash replaces
   `ADMIN_PASSWORD`, every instance logs `admin.config.plaintext_password`. **Deferred by the owner,
   2026-09-23:** *"without npm run admin:hash-password will the ADMIN_PASSWORD keep working if yes lets defer it for later"*. It does: plaintext is the documented fallback while no hash is set. A
   *malformed* hash never falls back, so set the hash only from the script.
5. **Session length.** 12 hours was chosen by the coordinator, not ruled on. Vetoable.
6. **No rate limiting or lockout** on the sign-in form. Declined twice: 2026-09-21, and 2026-09-23 when
   the storage question was put ("lets not build limit failed login", D95). scrypt's cost per attempt is
   the only brake, so password length is the defence (the hash script enforces 12+). Reconsider if the
   `admin.signin.rejected` log lines show guessing.
7. ~~**Confirm the D96 reading of D95**~~ **Closed 2026-09-23:** *"no i meant admin stays and main website stays deferred"*. Admin subdomain wired, apex
   deferred.
8. **`addPhoto` trusts the stored Content-Type** (`photo-actions.ts`): the browser declares JPEG, PNG or WebP
   and `sharp` then decodes whatever bytes arrived, so a GIF, TIFF or SVG labelled `image/jpeg` would be
   stored as WebP. Admin-only, and the 100-megapixel cap holds. A fix is to check
   `(await sharp(buffer).metadata()).format` against the three types. Found by the D138 review; whether
   to fix is the owner's call.
