# To do — actions outside the code

This file lists work that a session **cannot do from the repo**: dashboards, DNS, accounts and keys that
belong to the owner or the client. Code work lives in `HANDOFF.md` §6, and open questions live in root
`llm.md` §7.

**Rules.**
- Each item names who does it, why, and how we check it is done.
- When an item is done, verify it and **delete it**. This file is not a log (root `llm.md` §1.7).
- Anything that turns into a decision goes to root `llm.md` §5b.
- **Never** write a secret (API key, password, DNS login) in this file or anywhere else in the repo.

---

## DNS and mail, as measured 2026-09-23

Source: `dig` against the live domain, 2026-09-23. **Re-run the checks before trusting this table.**

| What | Record | Value / state |
|---|---|---|
| DNS host | NS | **Cloudflare** (`connie` / `donald.ns.cloudflare.com`), not GoDaddy. GoDaddy appears only as the DMARC report address |
| Inbound mail | MX | Google Workspace (`aspmx.l.google.com` + alternates) |
| SPF (root) | TXT `@` | `v=spf1 include:_spf.google.com ~all`. **Only one SPF record is allowed**: merge new `include:`s into it, never add a second |
| DMARC | TXT `_dmarc` | `p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net` |
| Resend DKIM | TXT `resend._domainkey` | present, so the domain is verified in the goodwill site's Resend account |
| Resend return path | `send` TXT + MX | `v=spf1 include:amazonses.com ~all`, MX `feedback-smtp.us-east-1.amazonses.com` |
| Google DKIM | TXT `google._domainkey` | **missing**, see item 1 |
| Website | A `@` | Cloudflare-proxied (orange cloud). The goodwill site is served from there |

Resend mail passes DMARC as it stands. DKIM passes on `resend._domainkey`. SPF passes on `send.`
because alignment is relaxed. **No DNS change is needed for the storefront's quote emails.**

---

## Owner

1. **Turn on Google Workspace DKIM.**
   - **Why:** Gmail sent from `@platinumwheels.ca` is currently signed as `gappssmtp.com`, which never
     aligns with our domain. It passes DMARC on SPF alone, and **forwarding breaks SPF**. With
     `p=quarantine`, the owner's own mail can then land in spam.
   - **How:**
     1. In the Google Admin console, open Apps → Google Workspace → Gmail → Authenticate email.
     2. Pick `platinumwheels.ca` and generate a new record: 2048-bit, prefix `google`.
     3. In Cloudflare DNS, add that TXT record at `google._domainkey`. TXT records are not proxied, and
        no other record changes.
     4. Wait for it to propagate. Back in the Admin console, click **Start authentication**. The order
        matters: publish first, then click.
   - **Done when:** `dig +short TXT google._domainkey.platinumwheels.ca` returns `v=DKIM1; k=rsa; p=…`,
     the Admin console says "Authenticating email", and a test mail's "Show original" reads
     `DKIM: PASS with domain platinumwheels.ca`.
   - Independent of the storefront; do it any time. Google's steps:
     https://support.google.com/a/answer/174124
2. **Turn the quote emails on, after testing the live form (D104).**
   - **State, checked 2026-09-24:** Vercel env has all three for Production and Preview:
     `RESEND_API_KEY` (Sensitive, added by the owner 2026-09-24), `LEAD_CAPTURE_EMAIL` =
     `sales@platinumwheels.ca` (the sender and the alert inbox) and `AUTO_EMAIL_LEAD_CAPTURE_ENABLED` =
     `false`, so nothing is sent yet. Whether the key is **Sending access** restricted to
     `platinumwheels.ca` (owner ruling 2026-09-23) cannot be seen from Vercel; confirm in Resend.
   - **How:** once the code is on production and the form has been tested there, set the flag to
     exactly `true` and **redeploy**: env changes only reach a new deployment. Setting it back to
     `false` and redeploying stops the emails again.
   - **Done when:** one real test enquiry with the flag on delivers both emails (alert in `sales@`,
     auto-reply in the tester's inbox, neither in spam).
   - **Never** commit the key or paste it into a chat. For local testing it goes in `.env.local`
     (`.env*` is gitignored).
3. **Accept Resend's DPA** (https://resend.com/legal/dpa).
   - **Why:** PIPEDA keeps the shop accountable for data its processor handles. Resend stores account
     data in the US, and the privacy page will say so.
4. **Keep the quote alerts.**
   - **Why:** the owner alert email is the CASL consent record (owner ruling 2026-09-23). There is no
     database.
   - **How:** add a Gmail filter on `sales@` that labels quote alerts and never auto-deletes them.
5. **Watch the Resend free quota:** 100 emails a day and 3,000 a month, **shared by the goodwill site
   and the storefront**. Each quote sends 2 emails, so the ceiling is about 50 quotes a day across both
   sites. The fix is Resend Pro.
9. **Reset the Neon database password.**
   - **Why:** the `neondb_owner` connection string was pasted into a chat on 2026-09-30 to run the
     catalogue load (D113), and again on 2026-10-03 to empty the catalogue and load the D125 one, so it is no longer a secret
     only Vercel holds.
   - **How:** in the Neon console, reset the password for role `neondb_owner`. The Vercel Neon
     integration owns `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; check both changed there, then
     **redeploy**, because env changes only reach a new deployment.
   - **Done when:** the old string is refused and the production storefront still lists products.

## Owner — payments (Converge demo; design in `docs/payments.md`)

**Done 2026-10-01/02 (D121):** Fixie via the Vercel integration (outbound IPs `52.87.82.133`,
`52.5.155.132`); Elavon allowlisted them on the demo account; `pay.platinumwheels.ca` on Vercel with its
certificate, plus the Cloudflare CNAME (DNS only); `CONVERGE_ENV=demo`, `CONVERGE_ACCOUNT_ID=0023020`,
`CONVERGE_USER_ID=apiuser116349` and the rotated `CONVERGE_PIN` in Vercel. Converge portal → Hosted
Payments (2026-10-02): Cancel Link, Approval and Decline button links (with transaction data) and the
Response Page Redirect URL all point at `https://pay.platinumwheels.ca/pay/return`; billing address fields
are optional; CAPTCHA was already on and is left on. **No demo extension** (owner
ruling 2026-10-01): demo testing wraps up by 2026-10-04.

P8. **Export script (D119), self-serve in the portal.** Point it at `https://pay.platinumwheels.ca/pay/notify`
   with a username and password, then put them in Vercel as `CONVERGE_NOTIFY_USER` (plain) and
   `CONVERGE_NOTIFY_PASSWORD` (Sensitive), Production only, and redeploy. Until then the route is off.
P9. **Rotate the PIN after demo testing.** The current one was pasted into a chat on 2026-10-02.
P10. **Undo the 2026-10-03 diagnostics** now that the demo approves (D125b): delete `CONVERGE_SEND_INVOICE`
   from Vercel (the code no longer reads it); in the Converge portal turn the hosted page's **CAPTCHA back
   on**, narrow `apiuser116349`'s user rights back to what the hosted page and `txnquery` need, and void
   the test sales (VT 10/02 14:53, Buy Button 15:34, our 16:05 approval 122262) before go-live.

## Client — payments go-live

P7. **Production Converge credentials, vendor ID and the certification test script** from Elavon. Then
   redo P2 (production IPs, by phone: 1-800-377-3962) and P3 on the production account, and set
   `CONVERGE_ENV=production`.

## Owner, at launch (when the storefront replaces the goodwill site)

6. **Set the website records in Cloudflare to DNS only (grey cloud)** once `@`/`www` point at Vercel.
   - **Why:** Vercel advises against a proxy in front of it, because the proxy hides traffic from
     Vercel's Firewall and item 7 depends on that.
   - **Leave alone:** MX and every TXT record.
7. **Add one Vercel Firewall rate-limit rule** on the quote form's POST.
   - **Suggested:** 5 POST requests per 10 minutes per IP on `/cart`, where the form has lived since
     D122 (it was `/products/*` before). This is a derived default and the owner can veto it. The cart
     page also POSTs once per visit to refresh the lines, so do not set it lower.
   - **Why:** this is the rate-limit half of the promised form protection (owner ruling 2026-09-23).
     The honeypot and timer live in the action.
   - **Depends on:** the Vercel plan. Hobby is non-commercial only, and only `glcorp`-authored merge
     commits deploy. See root `llm.md` §7.24.

## Owner — admin products (D116, D117)

10. **`STOREFRONT_URL` is set in Vercel (Production)** to `https://platinum-wheels-one.vercel.app` (2026-10-01).
    It reaches the site with the deploy the canonical merge (D124) triggers. Change it to
    `https://platinumwheels.ca` at launch.
    - **Why:** the product edit page's **View on site** link is built from it; while it is unset the link
      is simply not shown. The admin lives on its own host, so the link cannot be relative.
    - **Check:** open a published product in the admin; **View on site** opens its storefront page.

12. **Check the D127b admin changes on production once its PR merges.**
    - **Why:** they were checked on a scratch database, never on the real catalogue (D127b).
    - **Check:** on `/products`, filter by a vendor, by Accessories → a type, by a rim size and by
      **Only products with no photo**; each count looks right, and **Go to page** keeps the filter. On a
      tire's edit page the Brand list holds tire brands only, and the line under **Full name** reads the
      brand and model the storefront shows.

13. **Check the D142 move on production once its PR merges.**
    - **Why:** migration `0005` was run on a scratch copy of the catalogue, never on Neon.
    - **Check:** an accessory's product page still shows its `Part number` row; a tire that showed `M+S`
      still does; a tire's page has no `Part number` row; in the admin, an accessory's edit page fills the
      `Part number` field and an M+S tire has the `M+S` box ticked.

## Owner — photo bucket (D126b)

11. **Finish the Cloudflare R2 photo bucket and its five Vercel settings.** The code is merged without them
    (owner, 2026-10-03, D138).
    - **Why:** product photos live in R2 since D126b. Until all five settings exist and the site is
      redeployed, the admin says "Photo uploads are not set up on this deployment" and the bulk photo
      load cannot run.
    - **Where it stands, 2026-10-04:** steps 1–5 done by the coordinator on the owner's instruction
      (bucket; `photos.platinumwheels.ca` connected, status Active; CORS for `https://admin.platinumwheels.ca`
      PUT + Content-Type; lifecycle rule "Clear abandoned admin uploads", `uploads/`, 1 day), plus an R2
      budget alert at **$1 USD** to `platinumwheelsca@gmail.com` (owner, 2026-10-04). Vercel holds
      `R2_ACCOUNT_ID`, `R2_BUCKET` and `PHOTOS_BASE_URL`. **Still the owner's:** step 6 (the API token)
      and the two Sensitive keys in step 7, then the redeploy.
    - **How** (Cloudflare dashboard, the account that holds `platinumwheels.ca`):
      1. **R2 Object Storage → turn R2 on.** Cloudflare asks for a payment method even on the free tier
         (10 GB, 1M writes and 10M reads a month, no charge for downloads). Owner only.
      2. **Create bucket** `platinum-wheels-photos` (the coordinator can do this through the Cloudflare
         connector once R2 is on).
      3. Bucket → **Settings → Custom Domains → Add** `photos.platinumwheels.ca` → **Connect Domain**.
         Cloudflare adds the DNS record itself. Leave the `r2.dev` URL **off**: it is rate-limited.
      4. Bucket → **Settings → CORS Policy → Add CORS policy**, JSON tab:
         ```json
         [
           {
             "AllowedOrigins": ["https://admin.platinumwheels.ca"],
             "AllowedMethods": ["PUT"],
             "AllowedHeaders": ["Content-Type"],
             "MaxAgeSeconds": 3600
           }
         ]
         ```
         Without it the admin's browser upload is refused.
      5. Bucket → **Settings → Object lifecycle rules → Add rule**: prefix `uploads/`, delete objects
         **1 day** after upload. It clears originals whose upload tab was closed halfway.
      6. **R2 → Manage API tokens → Create API token**: permission **Object Read & Write**, applied to
         **`platinum-wheels-photos` only**, no expiry. Copy the **Access Key ID** and **Secret Access
         Key** (the secret is shown once). Note the **Account ID** shown on the R2 overview page.
      7. **Vercel → platinum-wheels → Settings → Environment Variables**, Production and Preview:
         `R2_ACCOUNT_ID`, `R2_BUCKET` = `platinum-wheels-photos` and `PHOTOS_BASE_URL` =
         `https://photos.platinumwheels.ca` as plain values (the coordinator may add these three);
         `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as **Sensitive**, typed by the owner only, never
         pasted into a chat.
      8. **Redeploy** production once the last setting is in (settings are read at deploy time).
    - **Done when:** a photo added on a product's admin edit page shows on its storefront card and page,
      and `curl -sI https://photos.platinumwheels.ca/<a stored key>` answers `200` with
      `cache-control: public, max-age=31536000, immutable`.
    - **Then the catalogue photos (D139b):** the owner writes a settings file outside the repo
      (`chmod 600`), holding the five R2 settings and `IMPORT_DATABASE_URL` (direct Neon address), one
      `KEY=value` per line. The coordinator runs `npm run catalog:photos -- ~/Downloads/photos-for-cloudflare
      --env <that file>`: dry run, then `--upload`, then `--link`, each only on the owner's go, then a
      redeploy so cached listings show the photos. Delete the file afterwards and do item 9 (Neon password).
    - **After the bulk load is proven:** delete the empty Vercel Blob store `platninum-wheels`
      (Vercel → Storage); its `BLOB_*` settings go with it. Nothing reads them since D126b.

## Owner — cart and prices (D122)

C1. **Prices stay off for launch; turning them on is one variable and a redeploy.**
   - **State:** `NEXT_PUBLIC_STOREFRONT_PRICES_ENABLED` is not set anywhere, which is "off": no price
     on any card or product page, no price filter or sort, footer reads `Brampton, Ontario`. Client
     ruling 2026-10-01: no prices at launch, because the vendor sheets mix retail, dealer and
     with-shipping figures.
   - **How, later:** set it to exactly `true` in Vercel (Production, and Preview if wanted) and
     **redeploy**: it is baked in at build time. Do it only once every published product's price is a
     customer price, or a dealer price goes public (catalogue import notes: PRO WHEELS' only price is
     the dealer price).
   - **Done when:** a card reads `from $NNN / tire` and the footer reads `Prices in CAD, before tax`.
C2. **Have the privacy page's cart sentence reviewed** with the rest of the policy (D122 changed one
   factual sentence: the cart is kept in the browser's local storage).

## Owner, at launch — search (D112)

S1. **Turn search indexing on in the same deploy that goes onto the apex.**
   - **Why:** the storefront ships with search engines blocked (`SEARCH_INDEXING_ENABLED` unset or
     `false`). The page-level `noindex` is fixed when the site is built, so a build made with the flag
     off stays `noindex` wherever it is served. **`platinumwheels.ca` ranks today with the goodwill
     site.** Pointing it at a flag-off build tells Google to drop it.
   - **How:** in Vercel, set `SEARCH_INDEXING_ENABLED` to exactly `true` for **Production only**
     (lower case, no spaces; anything else is off) and **redeploy**. Only then move the apex (item 6).
   - **Google keeps a copy of `robots.txt` for up to a day.** After the switch, ask for a fresh read in
     Search Console (Settings, robots.txt, "Request a recrawl"), and repeat the checks below daily for
     the first week: the classic failure is a site that launched still saying `noindex`.
   - **Done when:** `curl https://platinumwheels.ca/robots.txt` shows `Allow: /` and the `Sitemap:` line;
     the home page's source has `<meta name="robots" content="index, follow, …">`;
     `https://platinumwheels.ca/sitemap.xml` lists four files; and `robots.txt` on
     `admin.platinumwheels.ca`, `pay.platinumwheels.ca` and the `*.vercel.app` URL still says
     `Disallow: /`.
S2. **Redirect `www.platinumwheels.ca` to the apex** in Vercel (Domains, add `www`, "Redirect to
   `platinumwheels.ca`").
   - **Why:** `www` answers 200 with the same pages today (measured 2026-09-30), a duplicate of every
     URL. The storefront names the apex as canonical and refuses to list itself on `www`.
   - **Done when:** `curl -I https://www.platinumwheels.ca/` answers 308 to `https://platinumwheels.ca/`.
S3. **Verify the domain in Google Search Console and submit the sitemap.**
   - **How:** add a **Domain** property for `platinumwheels.ca`, publish the TXT record it gives in
     Cloudflare (TXT records are never proxied), then submit `https://platinumwheels.ca/sitemap.xml`.
   - **Why:** with no third-party scripts on the site (`docs/decisions.md` §6), Search Console is the
     only place search data shows up.
   - **Done when:** the sitemap reads "Success" and the four child sitemaps are listed.
   - **Bing too:** add the site in Bing Webmaster Tools (it can import from Search Console) and submit
     the same sitemap. Copilot answers from Bing's index, and ChatGPT search uses Bing among its sources.
S3b. **Check that nothing blocks AI search crawlers**, unless the owner wants them blocked.
   - **Why:** `robots.txt` admits every crawler once indexing is on, which is what lets ChatGPT search,
     Perplexity, Claude and Copilot cite the site. A dashboard toggle can still block them.
   - **How:** in Vercel, Firewall, confirm the **AI Bots** managed ruleset and **Bot Protection** are
     off (both are off by default). In Cloudflare, item 6 already makes the website records DNS only,
     which takes Cloudflare's AI-bot blocking out of the path.

## Client, via the owner — search (D112)

S4. **Decide how customers receive their goods.**
   - **Why:** the site describes an online store based in Brampton because this is undecided. A
     **Google Business Profile is only allowed if the owners meet customers in person** (delivery or
     installation); an online-only business is not eligible.
   - **Then:** if they do, create the profile as a service-area business with the **address hidden** and
     Brampton as the area, and the site links to it. If they do not, create none.
S5. **Confirm the legal name.** The storefront says `Platinum Wheels and Tire Solutions`; the goodwill
   site's markup says `… Inc.`. The value is `SITE.legalName` in `src/lib/site.ts`.

## Later — search (D112)

S6. **Add prices to the product structured data** once the owner settles the pricing rule and confirms
   prices are shown publicly. Until then a product's markup has no offer, by ruling, and so does not
   qualify for Google's product rich result. `src/features/seo/schema.ts`.

## Client, via the owner

8. **Street address.** The email footer ships with `Brampton, ON` for now (owner ruling 2026-09-23).
   A full mailing address becomes **mandatory before any marketing email** (CASL, SOR/2012-36). Same
   ask as root `llm.md` §7.11.
