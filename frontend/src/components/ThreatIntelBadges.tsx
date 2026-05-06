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
 * Threat-intelligence badges for vulnerability findings.
 *
 * Renders:
 *   - A red "KEV" pill when the finding is on CISA's Known Exploited
 *     Vulnerabilities catalogue. Tooltip shows the federal due date and
 *     ransomware flag when present.
 *   - An EPSS chip with the percentile (e.g. "EPSS 87%") when an EPSS
 *     score is available. Colour shifts amber for high-probability
 *     scores (≥ 0.5) and red for very-high (≥ 0.9).
 *
 * Accepts both snake_case (raw API rows) and camelCase (mapped) fields
 * so it can be dropped into pages without a renaming pass first. Renders
 * nothing when neither signal is present.
 */

interface Props {
  f: {
    kev_listed?: boolean | null;
    kevListed?: boolean | null;
    kev_due_date?: string | null;
    kevDueDate?: string | null;
    kev_known_ransomware?: boolean | null;
    kevKnownRansomware?: boolean | null;
    epss_score?: number | string | null;
    epssScore?: number | string | null;
    epss_percentile?: number | string | null;
    epssPercentile?: number | string | null;
  };
}

function asNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default function ThreatIntelBadges({ f }: Props) {
  const kevListed = (f.kev_listed ?? f.kevListed) === true;
  const kevDueDate = f.kev_due_date ?? f.kevDueDate ?? null;
  const kevRansomware = (f.kev_known_ransomware ?? f.kevKnownRansomware) === true;
  const epssScore = asNumber(f.epss_score ?? f.epssScore);
  const epssPercentile = asNumber(f.epss_percentile ?? f.epssPercentile);

  if (!kevListed && epssScore === null) return null;

  const epssColour =
    epssScore !== null && epssScore >= 0.9 ? '#dc2626' :
    epssScore !== null && epssScore >= 0.5 ? '#f59e0b' :
    'var(--muted)';

  const kevTooltipParts: string[] = ['CISA Known Exploited Vulnerability'];
  if (kevDueDate) kevTooltipParts.push('CISA federal due date: ' + String(kevDueDate).slice(0, 10));
  if (kevRansomware) kevTooltipParts.push('Used in ransomware campaigns');
  const kevTooltip = kevTooltipParts.join('. ');

  const epssTooltip = epssScore !== null
    ? 'EPSS ' + epssScore.toFixed(4) + (epssPercentile !== null ? ' (' + (epssPercentile * 100).toFixed(1) + 'th percentile)' : '') + ' — probability of exploitation in the next 30 days'
    : '';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      {kevListed && (
        <span
          title={kevTooltip}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            fontSize: '0.65rem',
            padding: '0.1rem 0.45rem',
            borderRadius: '3px',
            fontWeight: 700,
            textTransform: 'uppercase',
            background: 'rgba(220, 38, 38, 0.15)',
            color: '#dc2626',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            letterSpacing: '0.04em',
          }}
        >
          KEV{kevRansomware ? ' · RANSOMWARE' : ''}
        </span>
      )}
      {epssScore !== null && (
        <span
          title={epssTooltip}
          style={{
            fontSize: '0.65rem',
            padding: '0.1rem 0.4rem',
            borderRadius: '3px',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.04)',
            color: epssColour,
            border: '1px solid rgba(255,255,255,0.08)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          EPSS {epssPercentile !== null ? Math.round(epssPercentile * 100) + '%' : epssScore.toFixed(2)}
        </span>
      )}
    </span>
  );
}
