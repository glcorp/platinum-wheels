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

## Owner, at launch (when the storefront replaces the goodwill site)

6. **Set the website records in Cloudflare to DNS only (grey cloud)** once `@`/`www` point at Vercel.
   - **Why:** Vercel advises against a proxy in front of it, because the proxy hides traffic from
     Vercel's Firewall and item 7 depends on that.
   - **Leave alone:** MX and every TXT record.
7. **Add one Vercel Firewall rate-limit rule** on the quote form's POST.
   - **Suggested:** 5 requests per 10 minutes per IP on `/products/*`. This is a derived default and
     the owner can veto it.
   - **Why:** this is the rate-limit half of the promised form protection (owner ruling 2026-09-23).
     The honeypot and timer live in the action.
   - **Depends on:** the Vercel plan. Hobby is non-commercial only, and only `glcorp`-authored merge
     commits deploy. See root `llm.md` §7.24.

## Client, via the owner

8. **Street address.** The email footer ships with `Brampton, ON` for now (owner ruling 2026-09-23).
   A full mailing address becomes **mandatory before any marketing email** (CASL, SOR/2012-36). Same
   ask as root `llm.md` §7.11.
