import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './DependenciesPage.css';

interface Dependency {
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  purl: string;
  supplier: string;
}

interface SBOMInfo {
  spdxVersion: string;
  packageCount: number;
  isStale: boolean;
  syncedAt: string;
}

interface ProductDeps {
  id: string;
  name: string;
  craCategory: string | null;
  sbom: SBOMInfo | null;
  dependencies: Dependency[];
}

interface OverviewData {
  products: ProductDeps[];
  totals: {
    totalDependencies: number; totalPackages: number;
    ecosystems: Record<string, number>; ecosystemCount: number;
    licenseBreakdown: Record<string, number>; licenseCount: number;
    staleSboms: number;
  };
  licenseRisk: { unknown: number; copyleft: number };
}

type Filter = 'all' | 'has_sbom' | 'no_sbom';

const LICENSE_COLORS: Record<string, string> = {
  'MIT': '#4caf50', 'ISC': '#2196f3', 'Apache-2.0': '#ff9800', 'BSD-2-Clause': '#9c27b0',
  'BSD-3-Clause': '#673ab7', 'CC-BY-4.0': '#00bcd4', 'BlueOak-1.0.0': '#607d8b',
  '0BSD': '#8bc34a', 'CC0-1.0': '#cddc39',
};

export default function DependenciesPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch('/api/dependencies/overview', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <><PageHeader title="Dependencies" /><p className="dp-empty">Loading...</p></>;
  if (!data) return <><PageHeader title="Dependencies" /><p className="dp-empty">Unable to load dependencies.</p></>;

  const { products, totals, licenseRisk } = data;
  if (products.length === 0) return (
    <><PageHeader title="Dependencies" /><p className="dp-empty">No products yet. <Link to="/products">Add your first product</Link> to track dependencies.</p></>
  );

  const filtered = products.filter(p => {
    if (filter === 'has_sbom') return p.sbom !== null;
    if (filter === 'no_sbom') return p.sbom === null;
    return true;
  });

  const getTopLicenses = (deps: Dependency[]) => {
    const counts: Record<string, number> = {};
    deps.forEach(d => { const l = d.license || 'Unknown'; counts[l] = (counts[l] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };

  const getFilteredDeps = (productId: string, deps: Dependency[]) => {
    const term = (searchTerms[productId] || '').toLowerCase();
    if (!term) return deps;
    return deps.filter(d =>
      d.name.toLowerCase().includes(term) ||
      d.license?.toLowerCase().includes(term) ||
      d.ecosystem?.toLowerCase().includes(term)
    );
  };

  const DISPLAY_LIMIT = 25;

  return (
    <>
      <PageHeader title="Dependencies" />
      <div className="dp-stats">
        <StatCard label="Dependencies" value={totals.totalDependencies} color="blue" sub={`${totals.totalPackages} total packages`} />
        <StatCard label="Ecosystems" value={totals.ecosystemCount} color="green" sub={Object.keys(totals.ecosystems).join(', ') || 'none'} />
        <StatCard label="License Types" value={totals.licenseCount} color="blue" sub={licenseRisk.unknown > 0 ? `${licenseRisk.unknown} unknown` : 'all identified'} />
        <StatCard label="Stale SBOMs" value={totals.staleSboms} color={totals.staleSboms > 0 ? 'amber' : 'green'} sub={totals.staleSboms > 0 ? 'need re-sync' : 'all up to date'} />
      </div>

      <div className="dp-filter-bar">
        {[
          { key: 'all' as Filter, label: 'All' },
          { key: 'has_sbom' as Filter, label: 'Has SBOM' },
          { key: 'no_sbom' as Filter, label: 'No SBOM' },
        ].map(f => (
          <button key={f.key} className={`dp-filter-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="dp-empty">No products match this filter.</p>}

      {filtered.map(product => {
        const topLicenses = getTopLicenses(product.dependencies);
        const totalDeps = product.dependencies.length;
        const filteredDeps = getFilteredDeps(product.id, product.dependencies);
        const isExpanded = expanded[product.id];
        const displayDeps = isExpanded ? filteredDeps : filteredDeps.slice(0, DISPLAY_LIMIT);

        return (
          <div key={product.id} className="dp-product-card">
            <div className="dp-card-header">
              <h3><Link to={`/products/${product.id}?tab=dependencies`}>{product.name}</Link></h3>
              <span className="dp-count-badge">{totalDeps} dependencies</span>
              <div className="dp-sbom-info">
                {product.sbom ? (
                  <>
                    <span className={`dp-sbom-badge ${product.sbom.isStale ? 'stale' : 'fresh'}`}>
                      {product.sbom.isStale ? 'Stale' : 'Current'}
                    </span>
                    <span>{product.sbom.spdxVersion}</span>
                    <span>{product.sbom.packageCount} packages</span>
                  </>
                ) : (
                  <span className="dp-sbom-badge none">No SBOM</span>
                )}
              </div>
            </div>

            {product.dependencies.length === 0 ? (
              <div className="dp-no-sbom">
                No dependencies found. <Link to={`/products/${product.id}`}>Sync the repository</Link> to generate an SBOM.
              </div>
            ) : (
              <>
                {/* License distribution bar */}
                {topLicenses.length > 0 && (
                  <>
                    <div className="dp-license-bar">
                      {topLicenses.map(([license, count]) => (
                        <div
                          key={license}
                          className="dp-license-bar-segment"
                          style={{
                            width: `${(count / totalDeps) * 100}%`,
                            background: LICENSE_COLORS[license] || '#666',
                          }}
                          title={`${license}: ${count}`}
                        />
                      ))}
                    </div>
                    <div className="dp-license-legend">
                      {topLicenses.slice(0, 6).map(([license, count]) => (
                        <span key={license} className="dp-legend-item">
                          <span className="dp-legend-dot" style={{ background: LICENSE_COLORS[license] || '#666' }} />
                          {license} ({count})
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {/* Search */}
                <div className="dp-search-bar">
                  <input
                    type="text"
                    className="dp-search-input"
                    placeholder="Search dependencies by name, license, or ecosystem..."
                    value={searchTerms[product.id] || ''}
                    onChange={e => setSearchTerms(prev => ({ ...prev, [product.id]: e.target.value }))}
                  />
                </div>

                {/* Dependencies table */}
                <table className="dp-deps-table">
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Version</th>
                      <th>Ecosystem</th>
                      <th>License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDeps.map((dep, i) => (
                      <tr key={`${dep.purl || dep.name}-${i}`}>
                        <td>{dep.name}</td>
                        <td>{dep.version}</td>
                        <td className="ecosystem">{dep.ecosystem}</td>
                        <td className="license">{dep.license || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredDeps.length > DISPLAY_LIMIT && !isExpanded && (
                  <div className="dp-show-more">
                    <button onClick={() => setExpanded(prev => ({ ...prev, [product.id]: true }))}>
                      Show all {filteredDeps.length} dependencies
                    </button>
                  </div>
                )}
                {isExpanded && filteredDeps.length > DISPLAY_LIMIT && (
                  <div className="dp-show-more">
                    <button onClick={() => setExpanded(prev => ({ ...prev, [product.id]: false }))}>
                      Show less
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
