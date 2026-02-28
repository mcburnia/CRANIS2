import { useState, useEffect } from 'react';
import { FlaskConical, Loader, ChevronDown, ChevronRight, AlertCircle, CheckCircle, XCircle, MinusCircle, Play, Terminal } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminTestResultsPage.css';

interface Suite {
  id: string;
  name: string;
  category: string;
  executor: string;
  description: string | null;
  totalCases: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
  lastPassed: number;
  lastFailed: number;
  passRate: number | null;
  status: 'passing' | 'failing' | 'mixed' | 'never_run';
  nextDueAt: string | null;
}

interface Summary {
  totalSuites: number;
  totalCases: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number | null;
  lastRunAt: string | null;
  lastRunLabel: string | null;
}

interface TestCase {
  id: string;
  name: string;
  priority: string;
  tags: string[] | null;
  description: string | null;
  testSteps: string | null;
  expectedResult: string | null;
  lastStatus: string;
  lastDurationMs: number | null;
  lastRunAt: string | null;
  errorMessage: string | null;
}

type CategoryFilter = 'all' | 'route' | 'security' | 'break' | 'webhook' | 'integration';
type StatusFilter = 'all' | 'passing' | 'failing' | 'never_run';

export default function AdminTestResultsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);
  const [suiteCases, setSuiteCases] = useState<Record<string, TestCase[]>>({});
  const [loadingCases, setLoadingCases] = useState<string | null>(null);
  const [scheduleInterval, setScheduleInterval] = useState(7);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [runOutput, setRunOutput] = useState<string[]>([]);
  const [runSummary, setRunSummary] = useState<{ totalTests: number; passed: number; failed: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    fetchTestResults();
    checkRunStatus();
  }, []);

  async function fetchTestResults() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/test-results', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSummary(data.summary);
      setSuites(data.suites);
      setScheduleInterval(data.scheduleIntervalDays);
    } catch {
      setError('Failed to load test results');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuiteCases(suiteId: string) {
    if (suiteCases[suiteId]) return;
    setLoadingCases(suiteId);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/test-results/${suiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSuiteCases(prev => ({ ...prev, [suiteId]: data.cases }));
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingCases(null);
    }
  }

  async function checkRunStatus() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/test-results/run-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'running') {
        setRunStatus('running');
        setRunOutput(data.output || []);
        setShowOutput(true);
      }
    } catch {
      // Ignore — test runner may not be available yet
    }
  }

  async function handleRunTests() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/test-results/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'started' || data.status === 'already_running') {
        setRunStatus('running');
        setRunOutput([]);
        setRunSummary(null);
        setRunError(null);
        setShowOutput(true);
      }
    } catch {
      setRunError('Failed to trigger test run');
    }
  }

  // Poll for run status while running
  useEffect(() => {
    if (runStatus !== 'running') return;

    const poll = setInterval(async () => {
      try {
        const token = localStorage.getItem('session_token');
        const res = await fetch('/api/admin/test-results/run-status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setRunOutput(data.output || []);

        if (data.status === 'completed' || data.status === 'failed') {
          setRunStatus(data.status);
          setRunSummary(data.summary);
          setRunError(data.error);
          clearInterval(poll);
          // Refresh test results
          fetchTestResults();
          setSuiteCases({});
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 4000);

    return () => clearInterval(poll);
  }, [runStatus]);

  function toggleSuite(suiteId: string) {
    if (expandedSuite === suiteId) {
      setExpandedSuite(null);
    } else {
      setExpandedSuite(suiteId);
      fetchSuiteCases(suiteId);
    }
  }

  const categories: CategoryFilter[] = ['all', 'route', 'security', 'break', 'webhook', 'integration'];
  const statuses: StatusFilter[] = ['all', 'passing', 'failing', 'never_run'];

  const filtered = suites.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="atr-page">
        <PageHeader title="Test Results" />
        <div className="atr-loading"><Loader size={32} className="atr-spinner" /></div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="atr-page">
        <PageHeader title="Test Results" />
        <div className="atr-error">{error || 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="atr-page">
      <PageHeader title="Test Results">
        <button
          className="atr-run-btn"
          onClick={handleRunTests}
          disabled={runStatus === 'running'}
        >
          {runStatus === 'running' ? (
            <><Loader size={14} className="atr-spinner" /> Running...</>
          ) : (
            <><Play size={14} /> Run Tests</>
          )}
        </button>
      </PageHeader>

      {(runStatus !== 'idle' || showOutput) && (
        <div className={`atr-run-panel${runStatus === 'failed' ? ' atr-run-panel-failed' : runStatus === 'completed' ? ' atr-run-panel-done' : ''}`}>
          <div className="atr-run-header" onClick={() => setShowOutput(!showOutput)}>
            <Terminal size={14} />
            <span>
              Test Run {runStatus === 'running' ? 'in Progress' :
                        runStatus === 'completed' ? 'Complete' :
                        runStatus === 'failed' ? 'Failed' : ''}
            </span>
            {runSummary && (
              <span className="atr-run-summary-inline">
                {runSummary.passed} passed, {runSummary.failed} failed of {runSummary.totalTests}
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              {showOutput ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
          {showOutput && (
            <div className="atr-run-output">
              <pre>{runOutput.length > 0 ? runOutput.join('\n') : 'Waiting for output...'}</pre>
            </div>
          )}
          {runError && (
            <div className="atr-run-error">{runError}</div>
          )}
        </div>
      )}

      <div className="atr-stat-cards">
        <StatCard label="Test Suites" value={summary.totalSuites} />
        <StatCard label="Total Tests" value={summary.totalCases} />
        <StatCard
          label="Pass Rate"
          value={summary.passRate != null ? `${summary.passRate}%` : 'N/A'}
          color={summary.passRate === 100 ? 'green' : summary.passRate != null && summary.passRate >= 90 ? 'amber' : 'red'}
        />
        <StatCard
          label="Last Run"
          value={summary.lastRunAt ? timeAgo(summary.lastRunAt) : 'Never'}
          sub={summary.lastRunLabel || undefined}
        />
      </div>

      <div className="atr-filters">
        <div className="atr-filter-group">
          <span className="atr-filter-label">Category</span>
          {categories.map(c => (
            <button
              key={c}
              className={`atr-filter-btn${categoryFilter === c ? ' active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <div className="atr-filter-group">
          <span className="atr-filter-label">Status</span>
          {statuses.map(s => (
            <button
              key={s}
              className={`atr-filter-btn${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s === 'never_run' ? 'Never Run' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="atr-table-wrapper">
        <table className="atr-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Suite</th>
              <th>Category</th>
              <th>Tests</th>
              <th>First Run</th>
              <th>Last Run</th>
              <th>Status</th>
              <th>Pass Rate</th>
              <th>Next Due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(suite => (
              <>
                <tr
                  key={suite.id}
                  className={`atr-suite-row${expandedSuite === suite.id ? ' expanded' : ''}`}
                  onClick={() => toggleSuite(suite.id)}
                >
                  <td className="atr-expand-cell">
                    {expandedSuite === suite.id
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />}
                  </td>
                  <td className="atr-suite-name">{suite.name}</td>
                  <td><span className={`atr-badge atr-badge-${suite.category}`}>{suite.category}</span></td>
                  <td>{suite.totalCases}</td>
                  <td className="atr-date">{suite.firstRunAt ? formatDate(suite.firstRunAt) : '—'}</td>
                  <td className="atr-date">
                    {suite.lastRunAt ? (
                      <span title={new Date(suite.lastRunAt).toLocaleString()}>
                        {timeAgo(suite.lastRunAt)}
                      </span>
                    ) : '—'}
                  </td>
                  <td><StatusBadge status={suite.status} /></td>
                  <td>
                    {suite.passRate != null ? (
                      <span className={`atr-pass-rate ${getPassRateColor(suite.passRate)}`}>
                        {suite.passRate}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="atr-date">
                    {suite.nextDueAt ? (
                      <DueBadge date={suite.nextDueAt} />
                    ) : '—'}
                  </td>
                </tr>
                {expandedSuite === suite.id && (
                  <tr key={`${suite.id}-detail`} className="atr-detail-row">
                    <td colSpan={9}>
                      <SuiteDetail
                        cases={suiteCases[suite.id] || []}
                        loading={loadingCases === suite.id}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="atr-empty">No suites match the selected filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="atr-footer">
        <FlaskConical size={14} />
        <span>Tests scheduled every {scheduleInterval} days</span>
        <span className="atr-footer-sep">|</span>
        <span>{summary.totalPassed} passed, {summary.totalFailed} failed</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'passing':
      return <span className="atr-status atr-status-passing"><CheckCircle size={14} /> Passing</span>;
    case 'failing':
      return <span className="atr-status atr-status-failing"><XCircle size={14} /> Failing</span>;
    case 'mixed':
      return <span className="atr-status atr-status-mixed"><AlertCircle size={14} /> Mixed</span>;
    default:
      return <span className="atr-status atr-status-never"><MinusCircle size={14} /> Never Run</span>;
  }
}

function DueBadge({ date }: { date: string }) {
  const now = Date.now();
  const due = new Date(date).getTime();
  const overdue = now > due;
  const daysUntil = Math.ceil((due - now) / 86400000);

  if (overdue) {
    return <span className="atr-due atr-due-overdue" title={new Date(date).toLocaleDateString()}>Overdue ({Math.abs(daysUntil)}d)</span>;
  }
  if (daysUntil <= 2) {
    return <span className="atr-due atr-due-soon" title={new Date(date).toLocaleDateString()}>In {daysUntil}d</span>;
  }
  return <span className="atr-due" title={new Date(date).toLocaleDateString()}>In {daysUntil}d</span>;
}

function SuiteDetail({ cases, loading }: { cases: TestCase[]; loading: boolean }) {
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  if (loading) {
    return <div className="atr-detail-loading"><Loader size={18} className="atr-spinner" /> Loading test cases...</div>;
  }
  if (cases.length === 0) {
    return <div className="atr-detail-empty">No test cases registered for this suite</div>;
  }
  return (
    <table className="atr-detail-table">
      <thead>
        <tr>
          <th style={{ width: 24 }}></th>
          <th>Test Case</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Last Run</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        {cases.map(c => (
          <>
            <tr
              key={c.id}
              className={`atr-case-row${c.lastStatus === 'failed' || c.lastStatus === 'error' ? ' atr-case-failed' : ''}${expandedCase === c.id ? ' atr-case-expanded' : ''}`}
              onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
            >
              <td className="atr-case-chevron">
                {expandedCase === c.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </td>
              <td className="atr-case-name">{c.name}</td>
              <td><span className={`atr-priority atr-priority-${c.priority}`}>{c.priority}</span></td>
              <td><CaseStatusBadge status={c.lastStatus} /></td>
              <td>{c.lastDurationMs != null ? `${c.lastDurationMs}ms` : '—'}</td>
              <td className="atr-date">{c.lastRunAt ? timeAgo(c.lastRunAt) : '—'}</td>
              <td className="atr-error-cell">{c.errorMessage || '—'}</td>
            </tr>
            {expandedCase === c.id && (
              <tr key={`${c.id}-explain`} className="atr-case-explain-row">
                <td colSpan={7}>
                  <CaseExplanation testCase={c} />
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  );
}

function CaseExplanation({ testCase }: { testCase: TestCase }) {
  const desc = testCase.description;
  const steps = testCase.testSteps;
  const expected = testCase.expectedResult;

  // Parse description lines (format: "Key: Value\nKey: Value")
  const descLines = desc ? desc.split('\n').filter(l => l.trim()) : [];

  return (
    <div className="atr-explain">
      <div className="atr-explain-fullname">
        <span className="atr-explain-label">Full test name</span>
        <span className="atr-explain-value">{testCase.name}</span>
      </div>

      {descLines.length > 0 && (
        <div className="atr-explain-section">
          {descLines.map((line, i) => {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0 && colonIdx < 25) {
              const key = line.substring(0, colonIdx).trim();
              const val = line.substring(colonIdx + 1).trim();
              return (
                <div key={i} className="atr-explain-line">
                  <span className="atr-explain-label">{key}</span>
                  <span className={`atr-explain-value${key === 'Why it matters' ? ' atr-explain-highlight' : ''}`}>{val}</span>
                </div>
              );
            }
            return <div key={i} className="atr-explain-value">{line}</div>;
          })}
        </div>
      )}

      {steps && (
        <div className="atr-explain-section">
          <span className="atr-explain-label">Test steps</span>
          <div className="atr-explain-steps">
            {steps.split('\n').map((step, i) => (
              <div key={i} className="atr-explain-step">{step}</div>
            ))}
          </div>
        </div>
      )}

      {expected && (
        <div className="atr-explain-section">
          <span className="atr-explain-label">Expected result</span>
          <span className="atr-explain-value">{expected}</span>
        </div>
      )}

      {testCase.errorMessage && (
        <div className="atr-explain-section">
          <span className="atr-explain-label atr-explain-error-label">Error details</span>
          <pre className="atr-explain-error">{testCase.errorMessage}</pre>
        </div>
      )}
    </div>
  );
}

function CaseStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'passed':
      return <span className="atr-case-status atr-cs-passed">Passed</span>;
    case 'failed':
      return <span className="atr-case-status atr-cs-failed">Failed</span>;
    case 'error':
      return <span className="atr-case-status atr-cs-failed">Error</span>;
    case 'skipped':
      return <span className="atr-case-status atr-cs-skipped">Skipped</span>;
    default:
      return <span className="atr-case-status atr-cs-never">Never Run</span>;
  }
}

function getPassRateColor(rate: number): string {
  if (rate === 100) return 'atr-rate-green';
  if (rate >= 90) return 'atr-rate-amber';
  return 'atr-rate-red';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}
