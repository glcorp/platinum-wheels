import { PRIMARY_CONTACT } from "@/lib/site";

/* ---------------------------------------------------------------------------
   CallCtaPanel — the mobile-only `Not sure which one?` panel that closes the
   results page above the footer. A results section, not site chrome (D47(1),
   which closes root `llm.md` §7.9). Server Component.

   Measured: `design/inventory/results.md` §2.7 /
   `design/assets/results-mobile.html:301`:
   `margin:56px 16px 0; background:var(--surface);
    border:1px solid var(--border-strong); padding:24px;
    display:flex; flex-direction:column; gap:14px`.
   The desktop artboard draws no equivalent, so the panel stops at `md:`
   (1100) with the rest of the mobile arrangement (D46).
   --------------------------------------------------------------------------- */

export function CallCtaPanel() {
  return (
    <div
      data-probe="call-panel"
      className="bg-surface border-border-strong mx-4 mt-14 flex flex-col gap-3.5 border p-6 sm:mx-8 md:hidden"
    >
      {/* `font:700 calc(36px * var(--scale-h2))/1 var(--font-display);
          text-transform:uppercase` — 36px, line-height 1 and NO letter-spacing
          (`results.md` §5.2: "the only use of that display size anywhere").
          Not the `display` utility, which would add --display-tracking and
          0.92 leading; the family/weight/transform are written out instead,
          the same way the mobile how-it-works numeral handles "no tracking"
          (D35(3)) — `--tracking-*` is reset to `initial` in globals.css, so
          omitting the class is the only way to reach `letter-spacing: normal`. */}
      <span className="font-display text-ink text-display-36 leading-flat font-bold uppercase">
        Not sure which one?
      </span>
      {/* `400 14px/1.5 --text-muted`, copy verbatim including the straight
          apostrophe (`results-mobile.html:301`). Written as an expression so
          `react/no-unescaped-entities` does not force a typographic quote. */}
      <span className="text-ink-muted text-14 leading-body">
        {"Call the shop. We'll check your size and quote in minutes."}
      </span>
      {/* `height:52px; border:1px solid var(--accent); color:var(--text);
          border-radius:var(--radius-ctl); font:700 16px/1 var(--font-body);
          font-variant-numeric:tabular-nums; gap:10px` — Barlow 700, so NOT the
          `Button` primitive, whose `label` role is Barlow 500 uppercase.
          `numeral` carries Barlow 700 + tabular-nums. No hover rule is drawn
          (`results.md` §2.7); focus is the global accent ring (globals.css). */}
      <a
        href={`tel:${PRIMARY_CONTACT.tel}`}
        className="numeral border-accent text-ink rounded-ctl inline-flex h-13 items-center justify-center gap-2.5 border text-16 leading-flat no-underline touch-manipulation"
      >
        Call {PRIMARY_CONTACT.display}
      </a>
    </div>
  );
}
