import Image from "next/image";

import { CONTACTS, SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   The pay host's 404 (D145 audit, COPY / SEC-EDGE; D151).

   Every 404 on `pay.platinumwheels.ca` lands here: an unknown or mistyped
   token (`[token]/page.tsx`), a deeper path (`[...missing]/page.tsx`), bare
   `/pay` (`page.tsx`), and in production any path that is not `/pay/**`,
   which `decideHostRouting` rewrites to `/pay` (D105). Before this, the
   storefront's 404 answered, and every link on it (the header, `Shop tires`)
   was itself a 404 on the pay host: a dead end for a customer holding a bill.

   So it carries no site chrome and no storefront link (this folder's rule),
   only the way out a customer actually has: the shop's phone and email, from
   `CONTACTS[0]` and `SITE.email`, never typed here. The logo row and the
   surface panel are the `/pay/<token>` page's own, so a customer who mistypes
   a link sees the same page frame as the one they meant to open.

   Noindex comes from Next itself (every 404 carries `noindex`), from the
   `/pay/:path*` X-Robots-Tag header (`next.config.ts`) and from `robots.txt`,
   which disallows the pay host entirely (D112).
   --------------------------------------------------------------------------- */

export default function PayNotFound() {
  const contact = CONTACTS[0];

  return (
    <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pt-8 pb-20 sm:px-8 sm:pt-14">
      <div className="mx-auto flex w-full max-w-measure flex-col gap-8">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/logo/platinum-wheels-logo-transparent.webp"
            alt=""
            width={512}
            height={507}
            sizes="(min-width: 720px) 65px, 53px"
            className="h-13 w-auto sm:h-16"
            priority
          />
          <span className="label text-ink text-11 tracking-12 sm:text-12">{SITE.legalName}</span>
        </div>

        <section className="bg-surface border-border-strong flex flex-col gap-4 border p-5 sm:p-8">
          <h1 className="display text-ink text-display-28 sm:text-display-40">Payment link not found</h1>
          <p className="text-ink-muted text-15 leading-body">
            There&apos;s no payment at this address. If you came from a link in our email, open it again from the
            email and make sure the whole link was copied.
          </p>
          <p className="text-ink-muted text-15 leading-body">
            Still stuck? Call {contact.name} at{" "}
            <a className="text-ink underline" href={`tel:${contact.tel}`}>
              {contact.display}
            </a>{" "}
            or email{" "}
            <a className="text-ink underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>{" "}
            and we&apos;ll send you a new link.
          </p>
        </section>
      </div>
    </main>
  );
}
