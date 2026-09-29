---
paths: src/**/*.tsx
---

# Platinum Wheels — UI authoring rules

## Taste dials

```
DESIGN_VARIANCE: 7   # asymmetric 60/40 splits that flip between sections, not centred-everything
MOTION_INTENSITY: 6  # D92 "Expressive": eased hover + press, route slides/crossfades, card→PDP morph, grid stagger ≤150ms, below-fold reveal once; no parallax, no magnetic, no page-load choreography
VISUAL_DENSITY: 5    # storefront pages; the results grid may go to 6
```

Taste rules are **subordinate** to `design/assets/*.html` and `design/DESIGN.md`. If a taste rule
contradicts the design, the design wins. Log it in `design/DEVIATIONS.md` only if the shipped code ends up
differing from the design.

## Authority order (full version in `docs/decisions.md`)

1. `docs/decisions.md` — stack, SEO, security, mobile-first, perf, business rules.
2. `design/assets/*.html` — **authoritative for colour** (theme "Track Night"), layout, copy.
   `design/DESIGN.md` — authoritative for type roles, composition rules, motion, copy voice.
   DESIGN.md §2 (the racing-red palette) is superseded; the rest of DESIGN.md stands.
3. Supporting skills (impeccable, taste, frontend-design, web-design-guidelines) — fill gaps, check and
   polish. They never change a token, font, radius or layout the design already defines.

## Non-negotiables while writing JSX

- **Tokens only.** No Tailwind default palette (`bg-slate-900`, `text-red-500`), no arbitrary values
  (`text-[#C9F23A]`, `p-[13px]`, `w-[347px]`). A missing value means adding a token to `@theme` that is
  traced by comment to the artboard element it was measured from — never a guess.
- **One accent per frame is NOT enforced** (owner decision — `docs/decisions.md` §1.1). The artboards
  break it everywhere: accent Winter badge + accent CTA in the same card, accent nav underline + accent
  phone CTA in the same header. Ship what is drawn; do not demote a second accent to "fix" it.
- **Quote-first.** CTAs are "Request a quote" / "Inquire". Never cart, checkout or "Buy now".
- **Flush-left.** Headline, body, CTA, price and image share one left edge inside their column. Ragged
  right. Nothing centred that could be flush-left.
- **No depth tricks.** No shadows, no blur, no `backdrop-filter`, no glass, no gradients other than the
  hero's bottom fade. Radius 0–4px; nothing is a pill.
- **Prices** are white (`--color-ink`), Barlow 700, `tabular-nums`, full-size `$` and no cents, never
  accent-coloured, never superscript.
- Server Components by default. `"use client"` only on leaf islands — never inside `src/app/`. The one
  exception is `src/app/(storefront)/error.tsx`, which Next **requires** to carry the directive itself
  (D62); it holds no component code, only a re-export of `src/components/site/route-error.tsx`.
- `next/image` with `sizes` and a reserved aspect box; `next/link` for internal links.
- Tap targets ≥44px, inputs ≥16px font, `dvh` not `vh`, `prefers-reduced-motion` honoured.

## Copy

Artboard copy ships verbatim — exact wording, case and punctuation. The em-dash ban and other taste copy
rules apply **only to new copy** we write for states the design doesn't show, never to design copy.
Short, declarative, specific: brand and size over adjectives. CTAs ≤2 words. "You" for the customer, "we"
for the shop. No exclamation marks, no emoji.

## States the design doesn't show

Empty results, loading, error, form success, 404: build them from existing tokens and primitives only, at
the same level of finish as the happy path, and add them to `/styleguide`.
