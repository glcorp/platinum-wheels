import type { Metadata } from "next";
import Link from "next/link";

import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { greetingFor } from "@/features/admin/greeting";
import { adminCountPublished } from "@/features/admin/product-queries";
import { requireAdminSession } from "@/features/admin/session";
import { ADMIN_ROUTES } from "@/features/admin/types";
import { countOpenLinks } from "@/features/payments/service";
import { SHOP_WEEKDAY_DATE } from "@/lib/time";

/* ---------------------------------------------------------------------------
   / (admin host) — the admin home (D118)

   NO ARTBOARD DRAWS THIS (D89). Authored from existing tokens only.

   Owner, 2026-10-01: the root is a welcome, "like welcome {back} back is
   dynamic how its there in claude code where its always some personalised
   message according to time", plus two tiles, one per section, each with
   one live number. The greeting's lines live in `greeting.ts`; the time of
   day is Brampton's.

   Served at `admin.platinumwheels.ca/` from this folder by `src/proxy.ts`
   (D115). The gate's landing page: sign-in and a CSRF mismatch both come
   back here (`session.ts`).
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Home",
};

/** A tile's number must never take the page down: if the database is
 *  unreachable the tile simply shows no number. */
async function settle(read: () => Promise<number>, at: string): Promise<number | null> {
  try {
    return await read();
  } catch (error) {
    console.error(JSON.stringify({ at, detail: error instanceof Error ? error.message : "unknown" }));
    return null;
  }
}

function Tile({
  href,
  title,
  note,
  count,
  unit,
}: {
  href: string;
  title: string;
  note: string;
  count: number | null;
  unit: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="bg-surface border-border-strong hover:border-ink-dim flex h-full flex-col gap-3 border p-5 sm:p-6"
      >
        <span className="display text-ink text-display-28 sm:text-display-32">{title}</span>
        <span className="text-ink-muted text-15 leading-body">{note}</span>
        {count !== null ? (
          <span className="mt-auto flex items-baseline gap-2 pt-2">
            <span className="numeral text-ink text-28 leading-flat">{count.toLocaleString("en-CA")}</span>
            <span className="label text-ink-dim text-11 tracking-12">{unit}</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export default async function AdminHomePage() {
  const { csrfToken } = await requireAdminSession();
  const now = new Date();
  const [openLinks, published] = await Promise.all([
    settle(() => countOpenLinks(), "admin.home.countOpenLinks"),
    settle(() => adminCountPublished(), "admin.home.countPublished"),
  ]);

  return (
    <>
      <AdminTopBar csrfToken={csrfToken} current="home" />
      <main
        id="main"
        tabIndex={-1}
        className="w-full flex-1 px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-30 md:px-12 lg:mx-auto lg:max-w-content"
      >
        <p className="label text-ink-dim text-11 tracking-12 sm:text-12">{SHOP_WEEKDAY_DATE.format(now)}</p>
        {/* A fresh line on every visit (owner ruling). The page is per request
            anyway: it reads the session cookie. */}
        <h1 className="display text-ink mt-3 text-display-40 sm:text-display-56">
          {greetingFor(now)}
        </h1>

        <ul className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6">
          <Tile
            href={ADMIN_ROUTES.paymentLinks}
            title="Payment links"
            note="Raise a link for a quoted job and see which ones were paid."
            count={openLinks}
            unit="open"
          />
          <Tile
            href={ADMIN_ROUTES.products}
            title="Products"
            note="Add, edit, photograph and publish what the shop sells."
            count={published}
            unit="published"
          />
        </ul>
      </main>
    </>
  );
}
