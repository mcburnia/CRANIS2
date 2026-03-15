/**
 * SupplyChainRiskCard — displays the computed supply chain risk scorecard
 * at the top of the Supply Chain tab. Fetches from
 * /api/products/:productId/supply-chain-risk.
 */

import { useState, useEffect } from 'react';
import { Shield, Loader2, RefreshCw } from 'lucide-react';

interface AreaScore {
  area: string;
  label: string;
  score: number;
  maxScore: number;
  details: string;
}

interface RiskDependency {
  name: string;
  version: string | null;
  riskScore: number;
  flags: string[];
}

interface RiskData {
  overallScore: number;
  riskLevel: string;
  areas: AreaScore[];
  topRisks: RiskDependency[];
  stats: {
    totalDependencies: number;
    withKnownSupplier: number;
    withVulnerabilities: number;
    withCopyleftLicence: number;
    withUnknownLicence: number;
    sbomFresh: boolean;
    sbomExists: boolean;
  };
}

const LEVEL_CONFIG: Record<string, { label: string; colour: string; bg: string }> = {
  low:      { label: 'Low Risk',      colour: '#166534', bg: '#dcfce7' },
  medium:   { label: 'Medium Risk',   colour: '#92400e', bg: '#fef3c7' },
  high:     { label: 'High Risk',     colour: '#991b1b', bg: '#fee2e2' },
  critical: { label: 'Critical Risk', colour: '#7f1d1d', bg: '#fecaca' },
};

function scoreColour(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  if (score >= 25) return '#ef4444';
  return '#991b1b';
}

export default function SupplyChainRiskCard({ productId }: { productId: string }) {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTopRisks, setShowTopRisks] = useState(false);

  async function fetchRisk() {
    setLoading(true);
    const token = localStorage.getItem('session_token');
    try {
      const res = await fetch(`/api/products/${productId}/supply-chain-risk`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchRisk(); }, [productId]);

  if (loading) return (
    <div className="sc-risk-card" style={{ textAlign: 'center', padding: 24 }}>
      <Loader2 className="spin" size={20} />
    </div>
  );

  if (!data) return null;

  const level = LEVEL_CONFIG[data.riskLevel] || LEVEL_CONFIG.medium;

  return (
    <div className="sc-risk-card">
      <div className="sc-risk-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Supply Chain Risk</h3>
          <span style={{
            padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
            background: level.bg, color: level.colour,
          }}>
            {level.label}
          </span>
        </div>
        <button
          onClick={fetchRisk}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Score bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          flex: 1, height: 10, borderRadius: 5, background: '#f3f4f6', overflow: 'hidden',
        }}>
          <div style={{
            width: `${data.overallScore}%`, height: '100%', borderRadius: 5,
            background: scoreColour(data.overallScore), transition: 'width 0.5s',
          }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: scoreColour(data.overallScore), minWidth: 40 }}>
          {data.overallScore}
        </span>
      </div>

      {/* Area breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
        {data.areas.map(a => (
          <div key={a.area} style={{
            padding: '8px 12px', borderRadius: 8, background: '#f8fafc',
            border: '1px solid #f3f4f6',
          }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>{a.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: scoreColour(a.score) }}>{a.score}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>/ 100</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>{a.details}</div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', flexWrap: 'wrap', marginBottom: 8 }}>
        <span>{data.stats.totalDependencies} dependencies</span>
        <span>{data.stats.withKnownSupplier} with known supplier</span>
        <span>{data.stats.withVulnerabilities} with vulnerabilities</span>
        <span>{data.stats.withCopyleftLicence} copyleft</span>
      </div>

      {/* Top risks toggle */}
      {data.topRisks.length > 0 && (
        <>
          <button
            onClick={() => setShowTopRisks(!showTopRisks)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: '#a855f7', padding: 0,
            }}
          >
            {showTopRisks ? 'Hide' : 'Show'} top {data.topRisks.length} risk dependencies
          </button>
          {showTopRisks && (
            <div style={{ marginTop: 8 }}>
              {data.topRisks.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13,
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    {r.version && <span style={{ color: '#9ca3af', marginLeft: 4 }}>@{r.version}</span>}
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {r.flags.join(' \u2022 ')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: scoreColour(100 - r.riskScore),
                    minWidth: 30, textAlign: 'right',
                  }}>
                    {r.riskScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
