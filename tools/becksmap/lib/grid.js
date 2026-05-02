/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Beck Map Grid System
 *
 * Equidistant row grid with h=26px row height.
 * All coordinates are within a <g transform="translate(0,12)"> group.
 */

export const GRID = {
  rowHeight: 26,
  translateY: 12,
  svgWidth: 760,

  // Row Y positions (within the translated group)
  rows: {
    upperBranchText:    { title: 0,   sub: 13  },
    upperBranchStation: { cy: 26 },
    upperBranchLower:   { title: 52,  sub: 65  },
    mainUpperText:      { title: 78,  sub: 91  },
    mainStation:        { cy: 104 },
    mainLowerText:      { title: 130, sub: 143 },
    lowerBranchUpper:   { title: 156, sub: 169 },
    lowerBranchStation: { cy: 182 },
    lowerBranchLower:   { title: 208, sub: 221 },
    gap:                { y: 234 },
    legend:             { y: 260 },
  },

  // Derived values
  mainY: 104,
  upperBranchY: 26,
  lowerBranchY: 182,
  branchDistance: 78, // 3 rows * 26

  // Polyline departure/arrival Y values
  polylineAboveDepart: 96,   // just above main station
  polylineAboveArrive: 26,   // upper branch station
  polylineBelowDepart: 112,  // just below main station
  polylineBelowArrive: 182,  // lower branch station

  // Feeder line Y values
  feederTop: 34,    // just below upper branch station
  feederBottom: 96,  // just above main station

  // Terminus rect
  terminusRectY: 94,
  terminusRectHeight: 20,

  // viewBox heights
  viewBoxNoLower: 206,
  viewBoxWithLower: 284,

  // Legend Y (absolute, outside the group, so add translateY)
  legendNoLower: 194,
  legendWithLower: 272,
};

// Standard line colours
export const COLOURS = {
  main:    '#1D9E75',
  error:   '#D85A30',
  feeder:  '#BA7517',
  next:    '#534AB7',
  blue:    '#185FA5',
  green:   '#3B6D11',
};

// Badge background/text colour pairs
export const BADGE_CLASSES = {
  teal:   { bg: '#E1F5EE', fg: '#085041' },
  coral:  { bg: '#FAECE7', fg: '#711E08' },
  purple: { bg: '#EEEDFE', fg: '#26215C' },
  amber:  { bg: '#FAEEDA', fg: '#412402' },
  blue:   { bg: '#E6F1FB', fg: '#042C53' },
  green:  { bg: '#EAF3DE', fg: '#173404' },
  gray:   { bg: '#F1EFE8', fg: '#2C2C2A' },
};

/**
 * Calculate evenly spaced X positions for N stations on the main line.
 * Stations are distributed from x=55 to x=705 with equal spacing.
 */
export function calculateStationXPositions(count) {
  if (count <= 1) return [55];
  const startX = 55;
  const endX = 705;
  const spacing = (endX - startX) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(startX + i * spacing));
}

/**
 * Calculate polyline points for an above branch.
 * Branch departs at departX and rejoins at rejoinX (or is a terminus).
 */
export function polylineAbove(departX, rejoinX) {
  const d = GRID.branchDistance; // 78px at 45 degrees = 78px horizontal
  if (rejoinX != null) {
    // Rejoining branch
    return `${departX},${GRID.polylineAboveDepart} ${departX + d},${GRID.polylineAboveArrive} ${rejoinX - d},${GRID.polylineAboveArrive} ${rejoinX},${GRID.polylineAboveDepart}`;
  }
  // Terminus branch (extends right without rejoining)
  return `${departX},${GRID.polylineAboveDepart} ${departX + d},${GRID.polylineAboveArrive} ${departX + d + 80},${GRID.polylineAboveArrive}`;
}

/**
 * Calculate polyline points for a below branch.
 */
export function polylineBelow(departX, rejoinX) {
  const d = GRID.branchDistance;
  if (rejoinX != null) {
    return `${departX},${GRID.polylineBelowDepart} ${departX + d},${GRID.polylineBelowArrive} ${rejoinX - d},${GRID.polylineBelowArrive} ${rejoinX},${GRID.polylineBelowDepart}`;
  }
  return `${departX},${GRID.polylineBelowDepart} ${departX + d},${GRID.polylineBelowArrive} ${departX + d + 80},${GRID.polylineBelowArrive}`;
}

/**
 * Determine label positions for main-line stations with alternation.
 * Returns an array of { above: boolean } for each station.
 */
export function calculateLabelAlternation(stations, feederTargetIds) {
  const feederSet = new Set(feederTargetIds || []);
  const result = [];
  let nextBelow = true; // first station is below

  for (let i = 0; i < stations.length; i++) {
    const stn = stations[i];
    const isLast = i === stations.length - 1;
    const hasFeeder = feederSet.has(stn.id);

    if (hasFeeder) {
      // Feeder above forces labels below
      result.push({ above: false });
      nextBelow = false; // next station should be above
    } else if (isLast) {
      // Last station always below
      result.push({ above: false });
    } else {
      result.push({ above: !nextBelow });
      nextBelow = !nextBelow;
    }
  }

  return result;
}

/**
 * Determine text-anchor for a station based on its role.
 */
export function getTextAnchor(index, station, stations, branchDepartIds, branchArriveIds) {
  const departSet = new Set(branchDepartIds || []);
  const arriveSet = new Set(branchArriveIds || []);

  if (index === 0) return 'start'; // left-edge rule
  if (departSet.has(station.id)) return 'end'; // branches depart right
  if (arriveSet.has(station.id)) return 'start'; // branches arrive from left
  return 'middle';
}
