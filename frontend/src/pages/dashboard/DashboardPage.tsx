import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { Package, AlertTriangle, Users, ScrollText } from 'lucide-react';
import './DashboardPage.css';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" timestamp="Last sync: 19 Feb 2026, 08:15 UTC" />

      <div className="welcome-banner">
        <h2>Setup complete ✓</h2>
        <p>CRANIS2 is now tracking 3 repositories across 2 products for Acme Software Ltd. Your first contributor snapshot and dependency scan will run within 24 hours.</p>
      </div>

      <div className="stats">
        <StatCard label="Products" value={2} color="blue" sub="2 classified" />
        <StatCard label="Registered Repos" value={3} color="blue" sub="3 active, 0 pending" />
        <StatCard label="Contributors" value={18} color="amber" sub="2 dormant (no commits 90d+)" />
        <StatCard label="Est. Monthly Cost" value="€108" color="green" sub="18 × €6.00" />
        <StatCard label="Risk Findings" value={3} color="red" sub="1 critical, 2 high" />
      </div>

      <div className="section">
        <h3><Package size={18} /> Products & Compliance</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>CRA Category</th>
              <th>Obligations</th>
              <th>Technical File</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Acme Platform</strong></td>
              <td><span className="badge green">Default</span></td>
              <td>2 / 8 complete</td>
              <td>
                <div className="progress-bar"><div className="progress-fill amber" style={{ width: '25%' }} /></div>
                <span className="progress-text">25%</span>
              </td>
              <td><span className="badge amber">In Progress</span></td>
            </tr>
            <tr>
              <td><strong>Acme Pay</strong></td>
              <td><span className="badge amber">Important I</span></td>
              <td>0 / 12 complete</td>
              <td>
                <div className="progress-bar"><div className="progress-fill amber" style={{ width: '8%' }} /></div>
                <span className="progress-text">8%</span>
              </td>
              <td><span className="badge red">Not Started</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3><AlertTriangle size={18} /> Dependency Risk Findings</h3>
        <div className="risk-card">
          <div className="risk-header">
            <div className="risk-title"><span className="badge red">Critical</span> CVE-2026-1234</div>
            <div className="risk-detail">Found today</div>
          </div>
          <div className="risk-detail">Remote code execution in <span className="risk-pkg">lodash@4.17.20</span> — acme-platform</div>
        </div>
        <div className="risk-card">
          <div className="risk-header">
            <div className="risk-title"><span className="badge amber">High</span> CVE-2026-5678</div>
            <div className="risk-detail">Found yesterday</div>
          </div>
          <div className="risk-detail">SQL injection in <span className="risk-pkg">pg-query@2.1.0</span> — acme-payment-gateway</div>
        </div>
        <div className="risk-card">
          <div className="risk-header">
            <div className="risk-title"><span className="badge amber">High</span> CVE-2026-9012</div>
            <div className="risk-detail">Found 3 days ago</div>
          </div>
          <div className="risk-detail">Authentication bypass in <span className="risk-pkg">jose@4.11.1</span> — acme-auth-service</div>
        </div>
      </div>

      <div className="section">
        <h3><Users size={18} /> Contributor Overview</h3>
        <table>
          <thead>
            <tr><th>Repository</th><th>Contributors</th><th>Dormant</th><th>Last Snapshot</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>acme-platform</td>
              <td>14</td>
              <td><span className="badge amber">2</span></td>
              <td>19 Feb 2026</td>
            </tr>
            <tr>
              <td>acme-auth-service</td>
              <td>6</td>
              <td><span className="badge green">0</span></td>
              <td>19 Feb 2026</td>
            </tr>
            <tr>
              <td>acme-payment-gateway</td>
              <td>4</td>
              <td><span className="badge green">0</span></td>
              <td>19 Feb 2026</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3><ScrollText size={18} /> Recent Activity</h3>
        <div className="activity-feed">
          <div className="activity-item">
            <div className="activity-dot green" />
            <div className="activity-content">
              <div className="activity-text">Organisation <strong>Acme Software Ltd</strong> onboarded successfully</div>
              <div className="activity-time">19 Feb 2026, 09:00</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-dot blue" />
            <div className="activity-content">
              <div className="activity-text">3 repositories registered — webhooks installed</div>
              <div className="activity-time">19 Feb 2026, 09:02</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-dot blue" />
            <div className="activity-content">
              <div className="activity-text"><strong>Acme Platform</strong> classified as Default — 8 obligations generated</div>
              <div className="activity-time">19 Feb 2026, 09:05</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-dot amber" />
            <div className="activity-content">
              <div className="activity-text"><strong>Acme Pay</strong> classified as Important (Class I) — 12 obligations generated</div>
              <div className="activity-time">19 Feb 2026, 09:06</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-dot red" />
            <div className="activity-content">
              <div className="activity-text">Critical vulnerability found: CVE-2026-1234 in <strong>lodash@4.17.20</strong></div>
              <div className="activity-time">19 Feb 2026, 08:15</div>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-dot amber" />
            <div className="activity-content">
              <div className="activity-text">2 dormant contributors detected in <strong>acme-platform</strong> (no activity 90d+)</div>
              <div className="activity-time">19 Feb 2026, 08:15</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
