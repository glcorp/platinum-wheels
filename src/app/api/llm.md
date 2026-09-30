# src/app/api/

## Purpose

Machine endpoints, not pages. One today: the daily payment reconcile that Vercel Cron calls.

## Owns

- [`cron/reconcile/route.ts`](cron/reconcile/route.ts) — `GET`, scheduled in `vercel.json` (daily; Hobby allows
  no more often). It resolves attempts left `pending` after their hosted-page session died (D107,
  `docs/payments.md` §2). Refuses anything without `Authorization: Bearer $CRON_SECRET`.

## Rules

- **Every route here authenticates its caller.** A cron path is a public URL.
- Thin: the work lives in `src/features/payments/service.ts`.

## Decisions

| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | D107 in root `llm.md` §5b. | — |

## Connects to

- **Depends on:** `src/features/payments/`, env `CRON_SECRET`.
- **Depended on by:** Vercel Cron (`vercel.json`).

## Don't

- Don't make the reconcile more frequent than daily on Hobby: the deploy fails.

## Open

— none.
