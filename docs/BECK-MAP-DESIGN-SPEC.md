<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# Beck Map Design Specification

**Version:** 1.0
**Author:** Andi McBurnie
**Last updated:** 2026-03-16

This document defines the design rules for all Beck map SVG diagrams in the CRANIS2 help guide system. All new and existing maps must conform to these rules.

---

## Grid System

All maps use an equidistant row grid with row height **h = 26px**.

Coordinates are within a `<g transform="translate(0,12)">` group which provides top padding.

| Row | Purpose | y position |
|-----|---------|-----------|
| 0 | Upper branch title/sub | title=0, sub=13 |
| 1 | Upper branch station | cy=26 |
| 2 | Upper branch lower text | title=52, sub=65 |
| 3 | Main line upper text | title=78, sub=91 |
| 4 | Main line station | cy=104 |
| 5 | Main line lower text | title=130, sub=143 |
| 6 | Lower branch upper text | title=156, sub=169 |
| 7 | Lower branch station | cy=182 |
| 8 | Lower branch lower text | title=208, sub=221 |
| 9 | Gap (empty) | 234 |
| 10 | Legend | 260 |

Empty rows maintain their spacing even when unoccupied. The grid is consistent across all diagrams.

---

## viewBox and Translate

- **translate:** Always `translate(0,12)`
- **viewBox (no lower branch):** `0 0 760 206`
- **viewBox (with lower branch):** `0 0 760 284`

---

## Legend Placement

The legend sits **outside** the `<g>` group, in absolute SVG coordinates. It is always one row gap below the lowest occupied content row.

- **No lower branch:** legend y = 194 (absolute)
- **With lower branch:** legend y = 272 (absolute)

---

## Main Line

- Station circles: cy=104
- Terminus rect: y=94, height=20
- Horizontal track lines: y1=104, y2=104
- Interchange double circle: outer cy=104, inner cy=104

---

## Branch Lines

### Upper branch (above main line)
- Station: cy=26
- Feeder line (vertical, dashed): from y=34 to y=96
- Polyline departure: starts at (x, 96), 45 degrees up
- Polyline arrival: 45 degrees down to (x, 96)
- Branch distance: 78px (3 rows of 26px)

### Lower branch (below main line)
- Station: cy=182
- Polyline departure: starts at (x, 112), 45 degrees down
- Polyline arrival: 45 degrees up to (x, 112)
- Branch distance: 78px (3 rows of 26px)

### Branch geometry rules
- All branches use `<polyline>` elements with 45-degree diagonals levelling to horizontal
- Branches always straighten to horizontal before reaching a station
- Minimum 40px horizontal track on each side of a branch station
- No direct diagonal lines terminating at station dots

---

## Label Positioning

### Alternation
- Station labels alternate between above (row 3) and below (row 5) along the main line
- First station: labels below
- Second station: labels above
- Continue alternating
- Edge stations (last on the line): labels below to avoid SVG clipping

### Feeder rule
- If a station has a vertical feeder line above it, labels must be below
- This forced position resets the alternation pattern for subsequent stations

### Interchange positioning
- If branches depart to the right: text-anchor="end" (labels to the left of station centre)
- If branches arrive from the left: text-anchor="start" (labels to the right of station centre)

### Left-edge rule
- First station (cx=55): always text-anchor="start" to prevent text clipping off the left SVG edge

### Branch station labels
- Upper branch stations (cy=26): labels above at y=0/13
- Lower branch stations (cy=182): labels below at y=208/221

---

## Hover Accessibility

All station groups (`.stn`) have a hover grow effect for accessibility:

```css
.stn .lbl, .stn .lbl-sub {
  transition: font-size .15s ease, font-weight .15s ease;
}
.stn:hover .lbl {
  font-size: 15px;
  font-weight: 700;
}
.stn:hover .lbl-sub {
  font-size: 13px;
  font-weight: 500;
}
```

Default sizes: `.lbl` = 11px, `.lbl-sub` = 9.5px.

---

## Station Types

| Type | Visual | Usage |
|------|--------|-------|
| Standard | Circle r=8, white fill, coloured stroke | Regular station |
| Interchange | Circle r=12 + inner circle r=6 | Branch point or decision |
| Terminus | Rect + circle overlay | Start or end of a line |

---

## Line Colours

| Colour | Hex | Usage |
|--------|-----|-------|
| Teal (main) | #1D9E75 | Main journey |
| Coral (error) | #D85A30 | Error or recovery path |
| Amber (feeder) | #BA7517 | Feeder line (dashed) |
| Purple (next) | #534AB7 | Next process / continuation |
| Blue | #185FA5 | Alternative path |
| Green (end) | #3B6D11 | Completion / success |

---

## Cache Busting

The help panel iframe uses a `HELP_VERSION` query parameter. Bump this constant in `frontend/src/components/HelpPanel.tsx` whenever help content changes.

---

## References

- Help Guide Standard: `docs/HELP-GUIDE-STANDARD.md`
- Help Panel component: `frontend/src/components/HelpPanel.tsx`
- Help files: `frontend/public/help/`
