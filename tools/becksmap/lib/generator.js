/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Beck Map SVG Generator
 *
 * Takes a map definition object and produces a complete SVG string
 * following the Beck Map Design Spec.
 */

import {
  GRID, COLOURS, BADGE_CLASSES,
  calculateStationXPositions, calculateLabelAlternation, getTextAnchor,
  polylineAbove, polylineBelow,
} from './grid.js';

/**
 * Generate the complete SVG for a Beck map.
 */
export function generateSVG(def) {
  const mainStations = def.mainLine || [];
  const branches = def.branches || { above: [], below: [] };
  const feeders = def.feeders || [];
  const hasLowerBranch = (branches.below || []).length > 0;

  const viewBoxHeight = hasLowerBranch ? GRID.viewBoxWithLower : GRID.viewBoxNoLower;
  const legendY = hasLowerBranch ? GRID.legendWithLower : GRID.legendNoLower;

  // Calculate X positions for main-line stations
  const xPositions = calculateStationXPositions(mainStations.length);

  // Build a lookup of station id → x position
  const stationXMap = {};
  mainStations.forEach((stn, i) => { stationXMap[stn.id] = xPositions[i]; });

  // Determine which stations have feeders/branches for label rules
  const feederTargetIds = feeders.map(f => f.target);
  const branchDepartIds = [];
  const branchArriveIds = [];

  for (const b of [...(branches.above || []), ...(branches.below || [])]) {
    if (b.from) branchDepartIds.push(b.from);
    if (b.to && b.to !== b.from) branchArriveIds.push(b.to);
  }

  // Calculate label alternation
  const labelPositions = calculateLabelAlternation(mainStations, feederTargetIds);

  // Start building SVG
  const parts = [];

  parts.push(`<svg viewBox="0 0 ${GRID.svgWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(`<defs><style>`);
  parts.push(`  .lbl{font-family:'Outfit','Helvetica Neue',sans-serif;font-size:11px;fill:#1A1A18;}`);
  parts.push(`  .lbl-sub{font-family:'Outfit','Helvetica Neue',sans-serif;font-size:9.5px;fill:#8C8A84;}`);
  parts.push(`</style></defs>`);
  parts.push(`<g transform="translate(0,${GRID.translateY})">`);

  // Draw main-line track segments
  for (let i = 0; i < mainStations.length - 1; i++) {
    const x1 = xPositions[i] + 8; // after station circle
    const x2 = xPositions[i + 1] - 8; // before next station circle
    // Adjust for interchange (larger radius)
    const stn1 = mainStations[i];
    const stn2 = mainStations[i + 1];
    const adj1 = (stn1.type === 'interchange' || stn1.type === 'endpoint') ? 4 : 0;
    const adj2 = (stn2.type === 'interchange' || stn2.type === 'endpoint') ? 4 : 0;
    parts.push(`<line x1="${x1 + adj1}" y1="${GRID.mainY}" x2="${x2 - adj2}" y2="${GRID.mainY}" stroke="${COLOURS.main}" stroke-width="5" stroke-linecap="round"/>`);
  }

  // Draw branch polylines
  for (const b of (branches.above || [])) {
    const departX = stationXMap[b.from];
    const rejoinX = b.to ? stationXMap[b.to] : null;
    const colour = COLOURS[b.colour] || b.colour || COLOURS.next;
    parts.push(`<polyline points="${polylineAbove(departX, rejoinX)}" fill="none" stroke="${colour}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  for (const b of (branches.below || [])) {
    const departX = stationXMap[b.from];
    const rejoinX = b.to ? stationXMap[b.to] : null;
    const colour = COLOURS[b.colour] || b.colour || COLOURS.blue;
    parts.push(`<polyline points="${polylineBelow(departX, rejoinX)}" fill="none" stroke="${colour}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // Draw feeder lines
  for (const f of feeders) {
    const x = stationXMap[f.target];
    parts.push(`<line x1="${x}" y1="${GRID.feederTop}" x2="${x}" y2="${GRID.feederBottom}" stroke="${COLOURS.feeder}" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 4"/>`);
  }

  // Draw main-line stations
  mainStations.forEach((stn, i) => {
    const x = xPositions[i];
    const cy = GRID.mainY;
    const anchor = getTextAnchor(i, stn, mainStations, branchDepartIds, branchArriveIds);
    const labelsAbove = labelPositions[i].above;
    const titleY = labelsAbove ? GRID.rows.mainUpperText.title : GRID.rows.mainLowerText.title;
    const subY = labelsAbove ? GRID.rows.mainUpperText.sub : GRID.rows.mainLowerText.sub;
    const colour = stn.colour ? (COLOURS[stn.colour] || stn.colour) : COLOURS.main;
    const endColour = stn.type === 'endpoint' ? (COLOURS[stn.endColour] || COLOURS.green) : null;

    parts.push(`<g class="stn" id="ms-${stn.id}" onclick="show('${stn.id}')">`);

    if (stn.type === 'terminus') {
      parts.push(`<rect x="${x - 6}" y="${GRID.terminusRectY}" width="12" height="${GRID.terminusRectHeight}" rx="2" fill="${colour}"/>`);
      parts.push(`<circle cx="${x}" cy="${cy}" r="8" fill="white" stroke="${colour}" stroke-width="3"/>`);
    } else if (stn.type === 'interchange') {
      parts.push(`<circle cx="${x}" cy="${cy}" r="12" fill="white" stroke="${colour}" stroke-width="3"/>`);
      parts.push(`<circle cx="${x}" cy="${cy}" r="6" fill="${colour}"/>`);
    } else if (stn.type === 'endpoint') {
      const ec = endColour || COLOURS.green;
      parts.push(`<circle cx="${x}" cy="${cy}" r="12" fill="white" stroke="${ec}" stroke-width="3"/>`);
      parts.push(`<circle cx="${x}" cy="${cy}" r="6" fill="${ec}"/>`);
    } else {
      parts.push(`<circle cx="${x}" cy="${cy}" r="8" fill="white" stroke="${colour}" stroke-width="3"/>`);
    }

    const labelColour = stn.labelColour || '#1A1A18';
    parts.push(`<text x="${x}" y="${titleY}" text-anchor="${anchor}" class="lbl" font-weight="600" style="fill:${labelColour}">${escapeXml(stn.label)}</text>`);
    parts.push(`<text x="${x}" y="${subY}" text-anchor="${anchor}" class="lbl-sub">${escapeXml(stn.sub)}</text>`);
    parts.push(`</g>`);
  });

  // Draw feeder stations (above main line)
  for (const f of feeders) {
    const x = stationXMap[f.target];
    const cy = GRID.upperBranchY;
    const colour = COLOURS[f.colour] || COLOURS.feeder;
    parts.push(`<g class="stn" id="ms-${f.id}" onclick="show('${f.id}')">`);
    parts.push(`<circle cx="${x}" cy="${cy}" r="8" fill="white" stroke="${colour}" stroke-width="2.5"/>`);
    parts.push(`<text x="${x}" y="${GRID.rows.upperBranchText.title}" text-anchor="middle" class="lbl" font-weight="600" style="fill:${colour}">${escapeXml(f.label)}</text>`);
    parts.push(`<text x="${x}" y="${GRID.rows.upperBranchText.sub}" text-anchor="middle" class="lbl-sub">${escapeXml(f.sub)}</text>`);
    parts.push(`</g>`);
  }

  // Draw branch stations
  for (const b of (branches.above || [])) {
    for (const stn of (b.stations || [])) {
      const cy = GRID.upperBranchY;
      const colour = COLOURS[b.colour] || b.colour || COLOURS.next;
      parts.push(`<g class="stn" id="ms-${stn.id}" onclick="show('${stn.id}')">`);
      parts.push(`<circle cx="${stn.x}" cy="${cy}" r="8" fill="white" stroke="${colour}" stroke-width="3"/>`);
      parts.push(`<text x="${stn.x}" y="${GRID.rows.upperBranchText.title}" text-anchor="middle" class="lbl" font-weight="600" style="fill:${colour}">${escapeXml(stn.label)}</text>`);
      parts.push(`<text x="${stn.x}" y="${GRID.rows.upperBranchText.sub}" text-anchor="middle" class="lbl-sub">${escapeXml(stn.sub)}</text>`);
      parts.push(`</g>`);
    }
  }

  for (const b of (branches.below || [])) {
    for (const stn of (b.stations || [])) {
      const cy = GRID.lowerBranchY;
      const colour = COLOURS[b.colour] || b.colour || COLOURS.blue;
      parts.push(`<g class="stn" id="ms-${stn.id}" onclick="show('${stn.id}')">`);
      parts.push(`<circle cx="${stn.x}" cy="${cy}" r="8" fill="white" stroke="${colour}" stroke-width="3"/>`);
      parts.push(`<text x="${stn.x}" y="${GRID.rows.lowerBranchLower.title}" text-anchor="middle" class="lbl" font-weight="600" style="fill:${colour}">${escapeXml(stn.label)}</text>`);
      parts.push(`<text x="${stn.x}" y="${GRID.rows.lowerBranchLower.sub}" text-anchor="middle" class="lbl-sub">${escapeXml(stn.sub)}</text>`);
      parts.push(`</g>`);
    }
  }

  // Close the translated group
  parts.push(`</g>`);

  // Draw legend (outside the group, absolute coordinates)
  parts.push(generateLegend(legendY));

  parts.push(`</svg>`);

  return parts.join('\n');
}

/**
 * Generate the legend SVG elements.
 */
function generateLegend(y) {
  const textY = y + 4;
  const items = [
    { x1: 30, colour: COLOURS.main, width: 4, label: 'Main journey', dash: false },
    { x1: 150, colour: COLOURS.error, width: 4, label: 'Error / branch', dash: false },
    { x1: 278, colour: COLOURS.feeder, width: 3, label: 'Feeder', dash: true },
    { x1: 368, colour: COLOURS.next, width: 4, label: 'Next process', dash: false },
  ];

  const parts = [];
  for (const item of items) {
    const dashAttr = item.dash ? ' stroke-dasharray="5 4"' : '';
    parts.push(`  <line x1="${item.x1}" y1="${y}" x2="${item.x1 + 25}" y2="${y}" stroke="${item.colour}" stroke-width="${item.width}" stroke-linecap="round"${dashAttr}/>`);
    parts.push(`  <text x="${item.x1 + 31}" y="${textY}" class="lbl-sub">${item.label}</text>`);
  }

  // Interchange symbol
  parts.push(`  <circle cx="468" cy="${y}" r="6" fill="white" stroke="#888" stroke-width="2"/>`);
  parts.push(`  <circle cx="468" cy="${y}" r="3" fill="#888"/>`);
  parts.push(`  <text x="479" y="${textY}" class="lbl-sub">Interchange</text>`);

  return parts.join('\n');
}

/**
 * Escape XML special characters in text content.
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
