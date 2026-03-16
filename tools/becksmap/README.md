# becksmap

A standalone CLI tool that generates interactive Beck map help pages from JSON definitions.

Named after Harry Beck, who designed the London Underground map in 1931. The Beck map metaphor works well for any process documentation where you need to show a journey through a series of steps with branches and decision points.

## Usage

```bash
# Generate a single page
node bin/becksmap.js generate maps/ch1_05.json --output public/help/ch1_05_add_product.html

# Generate multiple pages into a directory
node bin/becksmap.js generate maps/*.json --outdir public/help/

# Validate a definition without generating
node bin/becksmap.js validate maps/ch1_05.json
```

## JSON Definition Schema

```json
{
  "title": "Page title",
  "subtitle": "Short description",
  "chapter": "Chapter 1 · Section name",
  "audienceTags": ["Software Engineer", "Product Manager"],

  "mainLine": [
    { "id": "step1", "label": "Station name", "sub": "Description", "type": "terminus" },
    { "id": "step2", "label": "Decision", "sub": "Branch point", "type": "interchange" },
    { "id": "step3", "label": "Final", "sub": "Done", "type": "endpoint", "endColour": "green" }
  ],

  "feeders": [
    { "id": "helper", "target": "step2", "label": "Helper", "sub": "Optional input" }
  ],

  "branches": {
    "above": [
      {
        "from": "step2",
        "to": "step3",
        "colour": "next",
        "stations": [
          { "id": "alt", "label": "Alternative", "sub": "Other path", "x": 400 }
        ]
      }
    ],
    "below": []
  },

  "stations": {
    "step1": {
      "icon": "📦",
      "iconBg": "#F1EFE8",
      "badge": "Step 1",
      "badgeClass": "badge-gray",
      "title": "Full station title",
      "sub": "Subtitle shown in card header",
      "body": "<p>HTML content for the instruction card.</p>"
    }
  }
}
```

## Station Types

| Type | Visual | Usage |
|------|--------|-------|
| `terminus` | Rect + circle | Start of a line |
| `interchange` | Double circle (r=12 + r=6) | Branch/decision point |
| `endpoint` | Double circle with custom colour | End of a line |
| *(default)* | Circle r=8 | Regular station |

## Line Colours

Reference by name in `colour` fields:

| Name | Hex | Usage |
|------|-----|-------|
| `main` | #1D9E75 | Main journey (teal) |
| `error` | #D85A30 | Error/recovery path (coral) |
| `feeder` | #BA7517 | Feeder line (amber, dashed) |
| `next` | #534AB7 | Continuation (purple) |
| `blue` | #185FA5 | Alternative path |
| `green` | #3B6D11 | Success/completion |

## Badge Classes

Use in `badgeClass` fields: `badge-teal`, `badge-coral`, `badge-purple`, `badge-amber`, `badge-blue`, `badge-green`, `badge-gray`.

## Grid System

The engine uses an equidistant 26px row grid. See `docs/BECK-MAP-DESIGN-SPEC.md` for the full specification.

## Branch Stations

Branch stations require an explicit `x` position since they sit on a branch line rather than the evenly-spaced main line. Calculate `x` to fall within the horizontal segment of the polyline (between the two 45-degree bends).

## Requirements

- Node.js 18+
- No dependencies (uses only Node built-in modules)
