import Link from "next/link";

import { ADMIN_ROUTES } from "@/features/admin/types";

/* ---------------------------------------------------------------------------
   The admin's 404 (D115). Staff copy, not the storefront's: no shop links,
   no "call us". Renders without the top bar, because a not-found answer
   carries no session check and must not offer a Sign out that may not work.
   --------------------------------------------------------------------------- */

export default function AdminNotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="w-full flex-1 px-4 pt-14 pb-20 sm:px-8 sm:pt-20 md:px-12 lg:mx-auto lg:max-w-content"
    >
      <p className="label text-ink-dim text-11 tracking-12">Not found</p>
      <h1 className="display text-ink mt-3 text-display-40 sm:text-display-56">Nothing here</h1>
      <p className="text-ink-muted mt-3 max-w-measure text-15 leading-body sm:text-16">
        This page does not exist, or the product was never created.
      </p>
      <Link
        href={ADMIN_ROUTES.home}
        className="label text-ink mt-8 inline-flex min-h-11 items-center text-12 tracking-12 underline underline-offset-4"
      >
        Go to the admin home
      </Link>
    </main>
  );
}
