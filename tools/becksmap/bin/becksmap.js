#!/usr/bin/env node
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
 * becksmap — Beck map diagram generator for interactive help pages
 *
 * Usage:
 *   becksmap generate <input.json> [--output <file.html>]
 *   becksmap generate <dir/*.json> --outdir <dir/>
 *   becksmap validate <input.json>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename, dirname, extname } from 'path';
import { generatePage } from '../lib/template.js';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(`
becksmap — Beck map diagram generator

Usage:
  becksmap generate <input.json> [--output <file.html>]
  becksmap generate <input.json> --outdir <dir/>
  becksmap validate <input.json>

Commands:
  generate   Read a JSON map definition and produce a standalone HTML file
  validate   Check a JSON definition for errors without generating output

Options:
  --output   Output file path (default: same name as input with .html extension)
  --outdir   Output directory (for batch processing)

Examples:
  becksmap generate maps/ch1_05.json --output public/help/ch1_05_add_product.html
  becksmap generate maps/*.json --outdir public/help/
  becksmap validate maps/ch1_05.json
`);
  process.exit(0);
}

if (command === 'generate') {
  const inputFiles = [];
  let outputFile = null;
  let outputDir = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[++i];
    } else if (args[i] === '--outdir' && args[i + 1]) {
      outputDir = args[++i];
    } else if (!args[i].startsWith('--')) {
      inputFiles.push(args[i]);
    }
  }

  if (inputFiles.length === 0) {
    console.error('Error: no input files specified');
    process.exit(1);
  }

  for (const inputPath of inputFiles) {
    const absPath = resolve(inputPath);

    if (!existsSync(absPath)) {
      console.error(`Error: file not found: ${absPath}`);
      process.exit(1);
    }

    let def;
    try {
      const raw = readFileSync(absPath, 'utf-8');
      def = JSON.parse(raw);
    } catch (err) {
      console.error(`Error: failed to parse ${inputPath}: ${err.message}`);
      process.exit(1);
    }

    // Validate
    const errors = validateDefinition(def);
    if (errors.length > 0) {
      console.error(`Validation errors in ${inputPath}:`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }

    // Generate
    const html = generatePage(def);

    // Determine output path
    let outPath;
    if (outputFile && inputFiles.length === 1) {
      outPath = resolve(outputFile);
    } else if (outputDir) {
      const name = basename(inputPath, extname(inputPath)) + '.html';
      outPath = resolve(outputDir, name);
    } else {
      outPath = resolve(dirname(absPath), basename(inputPath, extname(inputPath)) + '.html');
    }

    // Ensure output directory exists
    const outDir = dirname(outPath);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    writeFileSync(outPath, html, 'utf-8');
    console.log(`Generated: ${outPath}`);
  }

} else if (command === 'validate') {
  const inputPath = args[1];
  if (!inputPath) {
    console.error('Error: no input file specified');
    process.exit(1);
  }

  const absPath = resolve(inputPath);
  if (!existsSync(absPath)) {
    console.error(`Error: file not found: ${absPath}`);
    process.exit(1);
  }

  let def;
  try {
    const raw = readFileSync(absPath, 'utf-8');
    def = JSON.parse(raw);
  } catch (err) {
    console.error(`Error: failed to parse ${inputPath}: ${err.message}`);
    process.exit(1);
  }

  const errors = validateDefinition(def);
  if (errors.length > 0) {
    console.error(`Validation errors:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('Valid.');
  process.exit(0);

} else {
  console.error(`Unknown command: ${command}. Run 'becksmap --help' for usage.`);
  process.exit(1);
}

/**
 * Validate a map definition and return an array of error messages.
 */
function validateDefinition(def) {
  const errors = [];

  if (!def.title) errors.push('Missing required field: title');
  if (!def.mainLine || !Array.isArray(def.mainLine)) errors.push('Missing or invalid: mainLine (must be an array)');
  if (def.mainLine && def.mainLine.length === 0) errors.push('mainLine must have at least one station');

  // Check station IDs are unique
  const ids = new Set();
  for (const stn of (def.mainLine || [])) {
    if (!stn.id) errors.push('Main-line station missing id');
    if (!stn.label) errors.push(`Station ${stn.id || '?'} missing label`);
    if (ids.has(stn.id)) errors.push(`Duplicate station id: ${stn.id}`);
    ids.add(stn.id);
  }

  for (const f of (def.feeders || [])) {
    if (!f.id) errors.push('Feeder missing id');
    if (!f.target) errors.push(`Feeder ${f.id || '?'} missing target`);
    if (f.target && !ids.has(f.target)) errors.push(`Feeder target '${f.target}' not found in mainLine`);
    if (ids.has(f.id)) errors.push(`Duplicate station id: ${f.id}`);
    ids.add(f.id);
  }

  for (const dir of ['above', 'below']) {
    for (const b of (def.branches?.[dir] || [])) {
      if (!b.from) errors.push(`Branch (${dir}) missing 'from' station`);
      if (b.from && !ids.has(b.from)) errors.push(`Branch 'from' station '${b.from}' not found in mainLine`);
      if (b.to && !ids.has(b.to)) errors.push(`Branch 'to' station '${b.to}' not found in mainLine`);
      for (const stn of (b.stations || [])) {
        if (!stn.id) errors.push(`Branch station (${dir}) missing id`);
        if (!stn.x) errors.push(`Branch station ${stn.id || '?'} missing x position`);
        if (ids.has(stn.id)) errors.push(`Duplicate station id: ${stn.id}`);
        ids.add(stn.id);
      }
    }
  }

  // Check station content exists for all stations
  const stationContent = def.stations || {};
  for (const id of ids) {
    if (!stationContent[id]) errors.push(`Missing station content for '${id}'`);
  }

  return errors;
}
