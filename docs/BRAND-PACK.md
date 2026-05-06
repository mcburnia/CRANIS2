<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 Brand Pack

A reference for designers (e.g. Canva templates, marketing collateral) setting up the CRANIS2 brand in external tools. Contents are derived from the live application stylesheets and welcome-site templates — this document tracks what is actually in use.

---

## 1. Logo

The canonical logo files live at `frontend/public/branding/` in the repository:

| File | Use |
|---|---|
| `cranis2-logo-wide.png` | Primary horizontal lockup — websites, pitch decks, headers |
| `cranis2-logo.png` | Compact horizontal — email signatures, footers |
| `cranis2-logo-square.png` | Square avatar — social profiles, app icons |
| `cranis2-icon-128.png` | Favicon / small icon (128 × 128) |

**Wordmark construction:** "CRANIS" in white, "2" in purple, on a near-black background, with a thin purple underline accent below the wordmark. Heavy sans-serif, tightly tracked, all caps.

**Clear space:** keep at least the height of the letter "C" clear of other elements on every side of the lockup.

**Don't:**

- Recolour the wordmark
- Change the proportion of the "2" relative to "CRANIS"
- Place the logo on busy or low-contrast backgrounds
- Apply drop shadows or outer glows

---

## 2. Colour Palette

### Primary brand colour

| Name | Hex | RGB |
|---|---|---|
| **CRANIS2 Purple** | `#A855F7` | 168, 85, 247 |

Used for the logo "2", primary CTAs, links, hover states, and brand accents on the public-facing site.

### Core dark-theme palette (in-application)

| Role | Hex | RGB |
|---|---|---|
| Background (near-black) | `#0F1117` | 15, 17, 23 |
| Surface (panels) | `#1A1D27` | 26, 29, 39 |
| Border | `#2A2D3A` | 42, 45, 58 |
| Text (off-white) | `#E4E4E7` | 228, 228, 231 |
| Muted text | `#8B8D98` | 139, 141, 152 |

### Light-theme palette (marketing / welcome surfaces)

| Role | Hex |
|---|---|
| Page background | `#F8FAFC` |
| Body text | `#111827` |

### Action and status colours

| Role | Hex | Use |
|---|---|---|
| Action blue | `#3B82F6` | In-application primary buttons, links |
| Action blue (hover) | `#2563EB` | Hover state |
| Success green | `#22C55E` | Positive status, "compliant" |
| Warning amber | `#F59E0B` | Attention, in-progress |
| Error red | `#EF4444` | Failures, breaches, blockers |

---

## 3. Typography

### Primary typeface — Inter

Free, open-source, available at [fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter). Inter is built into Canva and most design tools.

**Weights in active use:**

- **400 Regular** — body text
- **600 Semibold** — section headings, badges, buttons
- **700 Bold** — page titles, stat values, the wordmark

### Type scale (from the live UI)

| Element | Size | Weight |
|---|---|---|
| Page title (H1) | 1.6 rem (~26 px) | 700 |
| Section heading (H3) | 1.1 rem (~18 px) | 600 |
| Body | 0.9 rem (~14 px) | 400 |
| Stat value | 1.8 rem (~29 px) | 700 |
| Small label / table header | 0.75 rem (~12 px) | 600, uppercase, letter-spacing 0.05em |
| Badge / button | 0.85 rem | 600 |

### Fallback stack

```
-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif
```

---

## 4. Brand Voice

- **British English** throughout (organise, colour, licence as a noun)
- **Tone:** precise, regulatory, plainly written — CRANIS2 is a compliance platform for the EU Cyber Resilience Act and NIS2 Directive
- **Tagline (metadata):** *EU Cyber Resilience Act & NIS2 Compliance Platform*
- **Audience:** software organisations and their compliance, security, and engineering teams

---

## 5. Quick Reference Card (for Canva)

```
Brand colour:   #A855F7   (CRANIS2 Purple)
Dark BG:        #0F1117
Light BG:       #F8FAFC
Text on dark:   #E4E4E7
Text on light:  #111827
Heading font:   Inter Bold (700)
Body font:      Inter Regular (400)
```

---

## 6. Contact

For brand enquiries, asset requests, or licence questions:

**Andrew (Andi) MCBURNIE** — `andi@mcburnie.com`
