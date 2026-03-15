"""
BeckMap Engine — generates Beck-style transit map SVGs for the CRANIS2
interactive user guide.

Follows the specification in beck_engine.md. Produces clean SVG with
clickable station groups, colour-coded lines, and smart label placement.
"""

import math
from math import hypot

# ── Constants ──────────────────────────────────────────────────

W = 760          # viewBox width
ML = 55          # left margin (centre of first station)
MR = 55          # right margin (centre of last station)
R = 8            # station radius
RI = 12          # interchange radius
ROW_RATIO = math.sqrt(3) / 2  # ≈ 0.866

# Colour palette
TEAL   = '#1D9E75'
CORAL  = '#D85A30'
PURPLE = '#534AB7'
BLUE   = '#185FA5'
AMBER  = '#BA7517'
GREEN  = '#3B6D11'
GRAY   = '#888780'

# ── Helpers ────────────────────────────────────────────────────

def _trim(x1, y1, x2, y2, r1, r2):
    """Trim a line segment by station radii at both ends."""
    d = hypot(x2 - x1, y2 - y1)
    if d == 0:
        return x1, y1, x2, y2
    dx, dy = (x2 - x1) / d, (y2 - y1) / d
    return x1 + r1 * dx, y1 + r1 * dy, x2 - r2 * dx, y2 - r2 * dy


def _radius(stype):
    """Get the radius for a station type."""
    if stype == 'interchange':
        return RI
    return R


def _esc(s):
    """Escape XML special characters."""
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


# ── Build ──────────────────────────────────────────────────────

def build(main, above=None, above_from=None, above_to=None,
          below=None, below_from=None, below_to=None,
          feeders=None, mc=TEAL, ac=PURPLE, bc=CORAL):
    """
    Build SVG parts for a Beck map.

    Returns (svg_parts, YA, YB, row_h) for passing to wrap().
    """
    above = above or []
    below = below or []
    feeders = feeders or []

    # ── Column grid ────────────────────────────────────────────
    # Start with main station indices
    n_main = len(main)
    cols = list(range(n_main))  # column index per main station

    # Insert branch columns
    total_extra = 0

    if above:
        if above_to is not None:
            # Through-branch: insert between departure and arrival
            insert_after = above_from
            for i in range(len(above)):
                col_idx = insert_after + 1 + i + total_extra
                cols = [c + 1 if c > insert_after + i + total_extra else c for c in cols]
            total_extra += len(above)
        else:
            # Terminus branch: insert after departure
            insert_after = above_from
            for i in range(len(above)):
                col_idx = insert_after + 1 + i + total_extra
                cols = [c + 1 if c > insert_after + i + total_extra else c for c in cols]
            total_extra += len(above)

    below_extra_start = total_extra
    if below:
        if below_to is not None:
            insert_after = below_from
            # Adjust for already-inserted above columns
            adj_insert = cols[insert_after]
            for i in range(len(below)):
                cols = [c + 1 if c > adj_insert + i else c for c in cols]
            total_extra += len(below)
        else:
            insert_after = below_from
            adj_insert = cols[insert_after]
            for i in range(len(below)):
                cols = [c + 1 if c > adj_insert + i else c for c in cols]
            total_extra += len(below)

    total_cols = n_main + total_extra
    if total_cols <= 1:
        col_spacing = W - ML - MR
    else:
        col_spacing = (W - ML - MR) / (total_cols - 1)

    # X positions for main stations
    main_x = [ML + cols[i] * col_spacing for i in range(n_main)]

    # X positions for above branch stations
    above_x = []
    if above:
        if above_to is not None:
            dep_col = cols[above_from]
            for i in range(len(above)):
                above_x.append(ML + (dep_col + 1 + i) * col_spacing)
        else:
            dep_col = cols[above_from]
            for i in range(len(above)):
                above_x.append(ML + (dep_col + 1 + i) * col_spacing)

    # X positions for below branch stations
    below_x = []
    if below:
        if below_to is not None:
            # Find the adjusted departure column
            dep_col = cols[below_from]
            # Below branch columns are inserted after above columns
            for i in range(len(below)):
                below_x.append(ML + (dep_col + 1 + i + (len(above) if above and above_from == below_from else 0)) * col_spacing)
        else:
            dep_col = cols[below_from]
            for i in range(len(below)):
                below_x.append(ML + (dep_col + 1 + i + (len(above) if above and above_from == below_from else 0)) * col_spacing)

    # ── Row geometry ───────────────────────────────────────────
    row_h = col_spacing * ROW_RATIO
    YM = 115.0
    YA = YM - row_h
    YB = YM + row_h

    # Feeder Y
    if above:
        FEEDER_Y = YA
    else:
        FEEDER_Y = YM - 52

    # ── SVG parts ──────────────────────────────────────────────
    parts = []

    # Main line segments
    for i in range(n_main - 1):
        r1 = _radius(main[i][1])
        r2 = _radius(main[i + 1][1])
        x1t, y1t, x2t, y2t = _trim(main_x[i], YM, main_x[i + 1], YM, r1, r2)
        parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{mc}" stroke-width="5" stroke-linecap="round"/>')

    # Above branch lines
    if above:
        dep_r = _radius(main[above_from][1])
        # Diagonal from main to first above station
        first_above_r = _radius(above[0][1])
        x1t, y1t, x2t, y2t = _trim(main_x[above_from], YM, above_x[0], YA, dep_r, first_above_r)
        parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{ac}" stroke-width="4" stroke-linecap="round"/>')

        # Horizontal segments between above stations
        for i in range(len(above) - 1):
            r1 = _radius(above[i][1])
            r2 = _radius(above[i + 1][1])
            x1t, y1t, x2t, y2t = _trim(above_x[i], YA, above_x[i + 1], YA, r1, r2)
            parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{ac}" stroke-width="4" stroke-linecap="round"/>')

        # Return diagonal (through-branch)
        if above_to is not None:
            last_above_r = _radius(above[-1][1])
            arr_r = _radius(main[above_to][1])
            x1t, y1t, x2t, y2t = _trim(above_x[-1], YA, main_x[above_to], YM, last_above_r, arr_r)
            parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{ac}" stroke-width="4" stroke-linecap="round"/>')

    # Below branch lines
    if below:
        dep_r = _radius(main[below_from][1])
        first_below_r = _radius(below[0][1])
        x1t, y1t, x2t, y2t = _trim(main_x[below_from], YM, below_x[0], YB, dep_r, first_below_r)
        parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{bc}" stroke-width="4" stroke-linecap="round"/>')

        for i in range(len(below) - 1):
            r1 = _radius(below[i][1])
            r2 = _radius(below[i + 1][1])
            x1t, y1t, x2t, y2t = _trim(below_x[i], YB, below_x[i + 1], YB, r1, r2)
            parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{bc}" stroke-width="4" stroke-linecap="round"/>')

        if below_to is not None:
            last_below_r = _radius(below[-1][1])
            arr_r = _radius(main[below_to][1])
            x1t, y1t, x2t, y2t = _trim(below_x[-1], YB, main_x[below_to], YM, last_below_r, arr_r)
            parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{bc}" stroke-width="4" stroke-linecap="round"/>')

    # Feeder lines (dashed vertical)
    feeder_data = []
    for f in feeders:
        fid, flabel, fsub, attach_id = f[0], f[1], f[2], f[3]
        # Find attach X
        attach_x = ML
        for i, m in enumerate(main):
            if m[0] == attach_id:
                attach_x = main_x[i]
                break
        feeder_data.append((fid, flabel, fsub, attach_x, FEEDER_Y))
        x1t, y1t, x2t, y2t = _trim(attach_x, FEEDER_Y, attach_x, YM, R, R)
        parts.append(f'<line x1="{x1t:.1f}" y1="{y1t:.1f}" x2="{x2t:.1f}" y2="{y2t:.1f}" stroke="{AMBER}" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 4"/>')

    # ── Station shapes ─────────────────────────────────────────

    def _station_svg(sid, stype, label, sub, x, y, colour=None, label_pos='below'):
        """Generate SVG for a single station."""
        c = colour or mc
        g_parts = []

        if stype == 'terminus' or stype == 'terminus-branch':
            g_parts.append(f'<rect x="{x - 6:.1f}" y="{y - 10:.1f}" width="12" height="20" rx="2" fill="{c}"/>')
            g_parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{R}" fill="white" stroke="{c}" stroke-width="3"/>')
        elif stype == 'interchange':
            g_parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{RI}" fill="white" stroke="{c}" stroke-width="3"/>')
            g_parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{RI // 2}" fill="{c}"/>')
        elif stype == 'feeder':
            g_parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{R}" fill="white" stroke="{AMBER}" stroke-width="2.5"/>')
        else:  # station
            g_parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{R}" fill="white" stroke="{c}" stroke-width="3"/>')

        # Label
        lbl_colour = c if stype == 'feeder' else '#1A1A18'
        if label_pos == 'above':
            ly1 = y - 26
            ly2 = y - 13
        else:
            ly1 = y + 22
            ly2 = y + 35

        anchor = 'middle'
        lx = x

        g_parts.append(f'<text x="{lx:.1f}" y="{ly1:.1f}" text-anchor="{anchor}" class="lbl" font-weight="600" style="fill:{lbl_colour}">{_esc(label)}</text>')
        g_parts.append(f'<text x="{lx:.1f}" y="{ly2:.1f}" text-anchor="{anchor}" class="lbl-sub">{_esc(sub)}</text>')

        return f'<g class="stn" id="ms-{sid}" onclick="show(\'{sid}\')">' + ''.join(g_parts) + '</g>'

    # Determine label positions based on branching
    def _main_label_pos(i):
        is_above_dep = above and above_from == i
        is_below_dep = below and below_from == i
        is_above_arr = above and above_to == i
        is_below_arr = below and below_to == i

        if is_above_dep and is_below_dep:
            return 'below'  # label below, will be at right in full engine
        if is_above_arr and is_below_arr:
            return 'above'
        if is_above_dep or is_above_arr:
            return 'below'
        if is_below_dep or is_below_arr:
            return 'above'
        return 'below'

    # Main stations
    for i, m in enumerate(main):
        sid, stype, label, sub = m[0], m[1], m[2], m[3]
        colour = m[4] if len(m) > 4 else None
        lpos = _main_label_pos(i)
        parts.append(_station_svg(sid, stype, label, sub, main_x[i], YM, colour, lpos))

    # Above branch stations
    for i, a in enumerate(above):
        sid, stype, label, sub = a[0], a[1], a[2], a[3]
        colour = a[4] if len(a) > 4 else ac
        parts.append(_station_svg(sid, stype, label, sub, above_x[i], YA, colour, 'above'))

    # Below branch stations
    for i, b in enumerate(below):
        sid, stype, label, sub = b[0], b[1], b[2], b[3]
        colour = b[4] if len(b) > 4 else bc
        parts.append(_station_svg(sid, stype, label, sub, below_x[i], YB, colour, 'below'))

    # Feeder stations
    for fid, flabel, fsub, fx, fy in feeder_data:
        parts.append(_station_svg(fid, 'feeder', flabel, fsub, fx, fy, AMBER, 'above'))

    return parts, YA, YB, row_h


# ── Wrap ───────────────────────────────────────────────────────

def wrap(build_result, has_above=False, has_below=False, has_feeder=False):
    """
    Wrap build() output into a complete SVG string with legend.
    """
    parts, YA, YB, row_h = build_result

    # Determine content bounds
    top_y = 115.0  # main line
    bottom_y = 115.0

    if has_above:
        top_y = min(top_y, YA - 30)  # label space above branch
    if has_feeder and not has_above:
        top_y = min(top_y, 115.0 - 52 - 30)  # feeder with labels
    elif has_feeder:
        top_y = min(top_y, YA - 30)
    if has_below:
        bottom_y = max(bottom_y, YB + 40)

    # Y offset if content goes above y=0
    y_offset = 0
    if top_y < 0:
        y_offset = -top_y
    elif top_y < 20:
        y_offset = 20 - top_y

    # Legend Y
    if has_below:
        legend_y = YB + y_offset + 50
    elif has_above or has_feeder:
        legend_y = 115.0 + y_offset + 50
    else:
        legend_y = 115.0 + y_offset + 50

    # Ensure legend is below all content
    content_bottom = (bottom_y if has_below else 115.0 + 35) + y_offset
    legend_y = max(legend_y, content_bottom + 18)

    # Build legend
    legend = []
    lx = 30
    ly = legend_y

    legend.append(f'<line x1="{lx}" y1="{ly}" x2="{lx + 25}" y2="{ly}" stroke="{TEAL}" stroke-width="4" stroke-linecap="round"/>')
    legend.append(f'<text x="{lx + 31}" y="{ly + 4}" class="lbl-sub">Main journey</text>')
    lx = 150
    legend.append(f'<line x1="{lx}" y1="{ly}" x2="{lx + 25}" y2="{ly}" stroke="{CORAL}" stroke-width="4" stroke-linecap="round"/>')
    legend.append(f'<text x="{lx + 31}" y="{ly + 4}" class="lbl-sub">Error / branch</text>')
    lx = 278
    legend.append(f'<line x1="{lx}" y1="{ly}" x2="{lx + 25}" y2="{ly}" stroke="{AMBER}" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>')
    legend.append(f'<text x="{lx + 31}" y="{ly + 4}" class="lbl-sub">Feeder</text>')
    lx = 368
    legend.append(f'<line x1="{lx}" y1="{ly}" x2="{lx + 25}" y2="{ly}" stroke="{PURPLE}" stroke-width="4" stroke-linecap="round"/>')
    legend.append(f'<text x="{lx + 31}" y="{ly + 4}" class="lbl-sub">Next process</text>')
    lx = 468
    legend.append(f'<circle cx="{lx}" cy="{ly}" r="6" fill="white" stroke="#888" stroke-width="2"/>')
    legend.append(f'<circle cx="{lx}" cy="{ly}" r="3" fill="#888"/>')
    legend.append(f'<text x="{lx + 11}" y="{ly + 4}" class="lbl-sub">Interchange</text>')

    # ViewBox height
    vb_height = int(legend_y + 28)

    # Assemble SVG
    svg_content = '\n'.join(parts)
    legend_content = '\n  '.join(legend)

    if y_offset > 0:
        svg_body = f'<g transform="translate(0,{y_offset:.1f})">{svg_content}</g>\n  {legend_content}'
    else:
        svg_body = f'{svg_content}\n  {legend_content}'

    return f'''<svg viewBox="0 0 {W} {vb_height}" xmlns="http://www.w3.org/2000/svg"><defs><style>
  .lbl{{font-family:'Outfit','Helvetica Neue',sans-serif;font-size:11px;fill:#1A1A18;}}
  .lbl-sub{{font-family:'Outfit','Helvetica Neue',sans-serif;font-size:9.5px;fill:#8C8A84;}}
</style></defs>{svg_body}</svg>'''
