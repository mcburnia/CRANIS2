/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

// Helper: Convert Neo4j DateTime or string to ISO string
export function toISOString(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val.toStandardDate) return val.toStandardDate().toISOString();
  if (val.year) {
    const y = val.year.low ?? val.year;
    const m = val.month.low ?? val.month;
    const d = val.day.low ?? val.day;
    return new Date(y, m - 1, d).toISOString();
  }
  return String(val);
}
