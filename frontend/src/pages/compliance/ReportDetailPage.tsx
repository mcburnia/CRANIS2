import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import {
  ArrowLeft, Shield, AlertTriangle, Clock, CheckCircle2,
  Send, AlertCircle, X, Save, Info
} from 'lucide-react';
import './ReportDetailPage.css';

/* ── Types ────────────────────────────────────────────────── */

interface Stage {
  id: string;
  stage: string;
  content: Record<string, any>;
  submittedBy: string;
  submittedByEmail: string;
  submittedAt: string;
}

interface LinkedFinding {
  id: string;
  title: string;
  severity: string;
  cvss_score: number | null;
  source: string;
  source_id: string;
  dependency_name: string;
  dependency_version: string;
  fixed_version: string | null;
  description: string;
}

interface Report {
  id: string;
  orgId: string;
  productId: string;
  productName: string;
  reportType: 'vulnerability' | 'incident';
  status: string;
  awarenessAt: string | null;
  earlyWarningDeadline: string | null;
  notificationDeadline: string | null;
  finalReportDeadline: string | null;
  csirtCountry: string | null;
  memberStatesAffected: string[];
  linkedFindingId: string | null;
  enisaReference: string | null;
  sensitivityTlp: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

const EU_COUNTRIES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia',
  CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia',
  FI: 'Finland', FR: 'France', DE: 'Germany', GR: 'Greece',
  HU: 'Hungary', IE: 'Ireland', IT: 'Italy', LV: 'Latvia',
  LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia',
  SI: 'Slovenia', ES: 'Spain', SE: 'Sweden',
};

const TLP_OPTIONS = ['WHITE', 'GREEN', 'AMBER', 'RED'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  early_warning_sent: 'Early Warning Sent',
  notification_sent: 'Notification Sent',
  final_report_sent: 'Final Report Sent',
  closed: 'Closed',
};

/* ── Helpers ──────────────────────────────────────────────── */

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCountdown(deadline: string): { text: string; isOverdue: boolean } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) {
    const h = Math.floor(Math.abs(diff) / 3600000);
    return { text: h < 24 ? `${h}h overdue` : `${Math.floor(h / 24)}d overdue`, isOverdue: true };
  }
  const h = Math.floor(diff / 3600000);
  if (h < 1) return { text: `${Math.floor(diff / 60000)}m remaining`, isOverdue: false };
  if (h < 24) return { text: `${h}h remaining`, isOverdue: false };
  return { text: `${Math.floor(h / 24)}d remaining`, isOverdue: false };
}

type StageKey = 'early_warning' | 'notification' | 'final_report';

/* ── Component ────────────────────────────────────────────── */

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [linkedFinding, setLinkedFinding] = useState<LinkedFinding | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<StageKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ csirtCountry: '', memberStates: [] as string[], tlp: 'AMBER', awarenessAt: '' });

  // Stage form states
  const [earlyWarningForm, setEarlyWarningForm] = useState({
    summary: '', memberStatesDetail: '', exploitedSince: '', sensitivityNote: '',
    suspectedMalicious: 'unknown' as 'yes' | 'no' | 'unknown', // incident only
  });
  const [notificationForm, setNotificationForm] = useState({
    vulnerabilityDetails: '', exploitNature: '', correctiveMeasures: '',
    userMitigations: '', patchStatus: 'in_progress' as 'available' | 'in_progress' | 'planned',
    affectedComponent: '', incidentNature: '', initialAssessment: '',
  });
  const [finalForm, setFinalForm] = useState({
    detailedDescription: '', severityAssessment: '', rootCause: '',
    maliciousActorInfo: '', securityUpdates: '', preventiveMeasures: '',
    userNotificationStatus: 'informed' as 'informed' | 'pending' | 'not_required',
    threatType: '', ongoingMitigation: '',
  });

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetchReport();
  }, [id]);

  async function fetchReport() {
    try {
      const res = await fetch(`/api/cra-reports/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        setStages(data.stages);
        setLinkedFinding(data.linkedFinding);

        // Set meta form from report
        setMetaForm({
          csirtCountry: data.report.csirtCountry || '',
          memberStates: data.report.memberStatesAffected || [],
          tlp: data.report.sensitivityTlp || 'AMBER',
          awarenessAt: data.report.awarenessAt ? new Date(data.report.awarenessAt).toISOString().slice(0, 16) : '',
        });

        // Pre-fill early warning from linked finding
        if (data.linkedFinding && !data.stages.find((s: Stage) => s.stage === 'early_warning')) {
          setEarlyWarningForm(prev => ({
            ...prev,
            summary: `${data.linkedFinding.title} — affecting ${data.linkedFinding.dependency_name}@${data.linkedFinding.dependency_version}. ${data.linkedFinding.severity} severity${data.linkedFinding.cvss_score ? ` (CVSS ${data.linkedFinding.cvss_score})` : ''}.`,
          }));
          setNotificationForm(prev => ({
            ...prev,
            vulnerabilityDetails: data.linkedFinding.description || '',
            affectedComponent: `${data.linkedFinding.dependency_name}@${data.linkedFinding.dependency_version} (${data.linkedFinding.source}: ${data.linkedFinding.source_id})`,
            patchStatus: data.linkedFinding.fixed_version ? 'available' : 'in_progress',
          }));
        }

        // Auto-open next stage form
        const stageNames = data.stages.map((s: Stage) => s.stage);
        if (!stageNames.includes('early_warning') && data.report.status === 'draft') setActiveStage('early_warning');
        else if (!stageNames.includes('notification') && data.report.status === 'early_warning_sent') setActiveStage('notification');
        else if (!stageNames.includes('final_report') && data.report.status === 'notification_sent') setActiveStage('final_report');
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMeta() {
    try {
      const res = await fetch(`/api/cra-reports/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          csirtCountry: metaForm.csirtCountry || null,
          memberStatesAffected: metaForm.memberStates,
          sensitivityTlp: metaForm.tlp,
          awarenessAt: metaForm.awarenessAt ? new Date(metaForm.awarenessAt).toISOString() : null,
        }),
      });
      if (res.ok) {
        setEditingMeta(false);
        fetchReport();
      }
    } catch (err) {
      console.error('Failed to save meta:', err);
    }
  }

  async function handleSubmitStage(stage: StageKey) {
    setSubmitting(true);
    try {
      let content: Record<string, any> = {};

      if (stage === 'early_warning') {
        content = { ...earlyWarningForm };
      } else if (stage === 'notification') {
        content = { ...notificationForm };
      } else if (stage === 'final_report') {
        content = { ...finalForm };
      }

      const res = await fetch(`/api/cra-reports/${id}/stages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ stage, content }),
      });

      if (res.ok) {
        setActiveStage(null);
        fetchReport();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit');
      }
    } catch (err) {
      console.error('Failed to submit stage:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    if (!confirm('Close this report? This marks it as resolved.')) return;
    try {
      const res = await fetch(`/api/cra-reports/${id}/close`, { method: 'POST', headers });
      if (res.ok) fetchReport();
    } catch (err) {
      console.error('Failed to close report:', err);
    }
  }

  if (loading || !report) {
    return (
      <>
        <PageHeader title="Report Detail" />
        <p className="rd-loading">Loading report...</p>
      </>
    );
  }

  const isVuln = report.reportType === 'vulnerability';
  const stageNames = stages.map(s => s.stage);

  // Timeline stages
  const timelineStages = [
    {
      key: 'early_warning' as StageKey,
      label: 'Early Warning',
      deadline: report.earlyWarningDeadline,
      timeframe: '24 hours',
      submitted: stageNames.includes('early_warning'),
      stage: stages.find(s => s.stage === 'early_warning'),
    },
    {
      key: 'notification' as StageKey,
      label: isVuln ? 'Vulnerability Notification' : 'Incident Notification',
      deadline: report.notificationDeadline,
      timeframe: '72 hours',
      submitted: stageNames.includes('notification'),
      stage: stages.find(s => s.stage === 'notification'),
    },
    {
      key: 'final_report' as StageKey,
      label: 'Final Report',
      deadline: report.finalReportDeadline,
      timeframe: isVuln ? '14 days' : '1 month',
      submitted: stageNames.includes('final_report'),
      stage: stages.find(s => s.stage === 'final_report'),
    },
  ];

  return (
    <>
      <PageHeader title="Report Detail" />

      {/* Back link */}
      <Link to="/vulnerability-reports" className="rd-back">
        <ArrowLeft size={16} /> Back to ENISA Reporting
      </Link>

      <div className="rd-layout">
        {/* Main content */}
        <div className="rd-main">
          {/* Report header */}
          <div className="rd-header-card">
            <div className="rd-header-top">
              <div>
                <h2 className="rd-product-name">{report.productName}</h2>
                <div className="rd-header-badges">
                  <span className={`rd-type-badge rd-type-${report.reportType}`}>
                    {isVuln ? <AlertTriangle size={14} /> : <Shield size={14} />}
                    {isVuln ? 'Actively Exploited Vulnerability' : 'Severe Incident'}
                  </span>
                  <span className={`rd-status-badge rd-status-${report.status}`}>
                    {STATUS_LABELS[report.status] || report.status}
                  </span>
                </div>
              </div>
              {report.status !== 'closed' && (
                <button className="rd-close-btn" onClick={handleClose}>Close Report</button>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="rd-timeline">
            <h3 className="rd-section-title">Article 14 Timeline</h3>
            <div className="rd-timeline-track">
              {timelineStages.map((ts, i) => {
                const countdown = ts.deadline ? formatCountdown(ts.deadline) : null;
                const isNext = !ts.submitted && (i === 0 || timelineStages[i - 1].submitted);
                const canSubmit = isNext && report.status !== 'closed';

                return (
                  <div key={ts.key} className={`rd-timeline-stage ${ts.submitted ? 'submitted' : ''} ${countdown?.isOverdue && !ts.submitted ? 'overdue' : ''} ${isNext ? 'next' : ''}`}>
                    <div className="rd-timeline-dot">
                      {ts.submitted ? <CheckCircle2 size={20} /> : isNext ? <Clock size={20} /> : <div className="rd-dot-empty" />}
                    </div>
                    <div className="rd-timeline-content">
                      <div className="rd-timeline-label">{ts.label}</div>
                      <div className="rd-timeline-timeframe">{ts.timeframe}</div>
                      {ts.submitted && ts.stage ? (
                        <div className="rd-timeline-submitted">
                          <CheckCircle2 size={12} />
                          Submitted {formatDate(ts.stage.submittedAt)}
                          <button className="rd-view-btn" onClick={() => setActiveStage(activeStage === ts.key ? null : ts.key)}>
                            {activeStage === ts.key ? 'Hide' : 'View'}
                          </button>
                        </div>
                      ) : (
                        <>
                          {countdown && (
                            <div className={`rd-timeline-countdown ${countdown.isOverdue ? 'overdue' : ''}`}>
                              {countdown.isOverdue && <AlertCircle size={12} />}
                              {countdown.text}
                            </div>
                          )}
                          {canSubmit && (
                            <button className="rd-submit-stage-btn" onClick={() => setActiveStage(ts.key)}>
                              <Send size={14} /> {activeStage === ts.key ? 'Cancel' : `Prepare ${ts.label}`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {i < timelineStages.length - 1 && <div className="rd-timeline-connector" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active stage form or view */}
          {activeStage && (
            <div className="rd-stage-panel">
              <div className="rd-stage-header">
                <h3>{timelineStages.find(t => t.key === activeStage)?.label}</h3>
                <button className="rd-stage-close" onClick={() => setActiveStage(null)}><X size={18} /></button>
              </div>

              {/* If already submitted, show read-only */}
              {stageNames.includes(activeStage) ? (
                <div className="rd-stage-readonly">
                  {Object.entries(stages.find(s => s.stage === activeStage)?.content || {}).map(([key, val]) => (
                    <div key={key} className="rd-readonly-field">
                      <label>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
                      <div className="rd-readonly-value">{String(val) || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Editable form */
                <>
                  {activeStage === 'early_warning' && (
                    <div className="rd-form">
                      <div className="rd-form-group">
                        <label>{isVuln ? 'Vulnerability Summary' : 'Incident Summary'} *</label>
                        <textarea
                          value={earlyWarningForm.summary}
                          onChange={e => setEarlyWarningForm(f => ({ ...f, summary: e.target.value }))}
                          placeholder={isVuln ? 'Brief description of the actively exploited vulnerability...' : 'Brief description of the severe incident...'}
                          rows={4}
                        />
                      </div>
                      {!isVuln && (
                        <div className="rd-form-group">
                          <label>Suspected unlawful or malicious cause?</label>
                          <select
                            value={earlyWarningForm.suspectedMalicious}
                            onChange={e => setEarlyWarningForm(f => ({ ...f, suspectedMalicious: e.target.value as any }))}
                          >
                            <option value="unknown">Unknown</option>
                            <option value="yes">Yes — suspected malicious</option>
                            <option value="no">No — not suspected</option>
                          </select>
                        </div>
                      )}
                      <div className="rd-form-group">
                        <label>Member States where product is available</label>
                        <textarea
                          value={earlyWarningForm.memberStatesDetail}
                          onChange={e => setEarlyWarningForm(f => ({ ...f, memberStatesDetail: e.target.value }))}
                          placeholder="e.g. Product available in Finland, Germany, France, and all other EU Member States"
                          rows={2}
                        />
                      </div>
                      <div className="rd-form-group">
                        <label>Additional sensitivity notes</label>
                        <textarea
                          value={earlyWarningForm.sensitivityNote}
                          onChange={e => setEarlyWarningForm(f => ({ ...f, sensitivityNote: e.target.value }))}
                          placeholder="Any information about sensitivity level or dissemination restrictions..."
                          rows={2}
                        />
                      </div>
                      <div className="rd-form-actions">
                        <button className="rd-btn-secondary" onClick={() => setActiveStage(null)}>Cancel</button>
                        <button className="rd-btn-primary" onClick={() => handleSubmitStage('early_warning')} disabled={!earlyWarningForm.summary || submitting}>
                          <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Early Warning'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStage === 'notification' && (
                    <div className="rd-form">
                      {isVuln ? (
                        <>
                          <div className="rd-form-group">
                            <label>Vulnerability Details *</label>
                            <textarea
                              value={notificationForm.vulnerabilityDetails}
                              onChange={e => setNotificationForm(f => ({ ...f, vulnerabilityDetails: e.target.value }))}
                              placeholder="General information about the vulnerability — CVE, description, affected versions..."
                              rows={4}
                            />
                          </div>
                          <div className="rd-form-group">
                            <label>Nature of Exploit</label>
                            <textarea
                              value={notificationForm.exploitNature}
                              onChange={e => setNotificationForm(f => ({ ...f, exploitNature: e.target.value }))}
                              placeholder="How is the vulnerability being exploited in the wild?"
                              rows={3}
                            />
                          </div>
                          <div className="rd-form-group">
                            <label>Affected Component</label>
                            <input
                              type="text"
                              value={notificationForm.affectedComponent}
                              onChange={e => setNotificationForm(f => ({ ...f, affectedComponent: e.target.value }))}
                              placeholder="e.g. lodash@4.17.20 (GHSA-xxxx)"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rd-form-group">
                            <label>Nature of Incident *</label>
                            <textarea
                              value={notificationForm.incidentNature}
                              onChange={e => setNotificationForm(f => ({ ...f, incidentNature: e.target.value }))}
                              placeholder="General information about the nature of the incident..."
                              rows={4}
                            />
                          </div>
                          <div className="rd-form-group">
                            <label>Initial Assessment</label>
                            <textarea
                              value={notificationForm.initialAssessment}
                              onChange={e => setNotificationForm(f => ({ ...f, initialAssessment: e.target.value }))}
                              placeholder="Initial assessment of scope and impact..."
                              rows={3}
                            />
                          </div>
                        </>
                      )}
                      <div className="rd-form-group">
                        <label>Corrective Measures Taken</label>
                        <textarea
                          value={notificationForm.correctiveMeasures}
                          onChange={e => setNotificationForm(f => ({ ...f, correctiveMeasures: e.target.value }))}
                          placeholder="What corrective or mitigating measures have been applied?"
                          rows={3}
                        />
                      </div>
                      <div className="rd-form-group">
                        <label>Measures Users Can Take</label>
                        <textarea
                          value={notificationForm.userMitigations}
                          onChange={e => setNotificationForm(f => ({ ...f, userMitigations: e.target.value }))}
                          placeholder="What steps can users take to mitigate the risk?"
                          rows={3}
                        />
                      </div>
                      {isVuln && (
                        <div className="rd-form-group">
                          <label>Patch / Update Status</label>
                          <select
                            value={notificationForm.patchStatus}
                            onChange={e => setNotificationForm(f => ({ ...f, patchStatus: e.target.value as any }))}
                          >
                            <option value="available">Available</option>
                            <option value="in_progress">In Progress</option>
                            <option value="planned">Planned</option>
                          </select>
                        </div>
                      )}
                      <div className="rd-form-actions">
                        <button className="rd-btn-secondary" onClick={() => setActiveStage(null)}>Cancel</button>
                        <button
                          className="rd-btn-primary"
                          onClick={() => handleSubmitStage('notification')}
                          disabled={submitting || (isVuln ? !notificationForm.vulnerabilityDetails : !notificationForm.incidentNature)}
                        >
                          <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Notification'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeStage === 'final_report' && (
                    <div className="rd-form">
                      <div className="rd-form-group">
                        <label>Detailed Description *</label>
                        <textarea
                          value={finalForm.detailedDescription}
                          onChange={e => setFinalForm(f => ({ ...f, detailedDescription: e.target.value }))}
                          placeholder={isVuln ? 'Detailed vulnerability description including severity and impact...' : 'Detailed incident description including severity and impact...'}
                          rows={5}
                        />
                      </div>
                      <div className="rd-form-group">
                        <label>Severity and Impact Assessment</label>
                        <textarea
                          value={finalForm.severityAssessment}
                          onChange={e => setFinalForm(f => ({ ...f, severityAssessment: e.target.value }))}
                          placeholder="Assessment of severity, scope of impact, affected user base..."
                          rows={3}
                        />
                      </div>
                      <div className="rd-form-group">
                        <label>{isVuln ? 'Root Cause Analysis' : 'Threat Type and Root Cause'}</label>
                        <textarea
                          value={isVuln ? finalForm.rootCause : finalForm.threatType}
                          onChange={e => setFinalForm(f => isVuln ? ({ ...f, rootCause: e.target.value }) : ({ ...f, threatType: e.target.value }))}
                          placeholder={isVuln ? 'What was the root cause of this vulnerability?' : 'What type of threat caused this incident?'}
                          rows={3}
                        />
                      </div>
                      {isVuln && (
                        <div className="rd-form-group">
                          <label>Information About Malicious Actors</label>
                          <textarea
                            value={finalForm.maliciousActorInfo}
                            onChange={e => setFinalForm(f => ({ ...f, maliciousActorInfo: e.target.value }))}
                            placeholder="Any available information about the threat actors exploiting this vulnerability..."
                            rows={2}
                          />
                        </div>
                      )}
                      <div className="rd-form-group">
                        <label>{isVuln ? 'Security Updates / Patches Issued' : 'Applied and Ongoing Mitigation'}</label>
                        <textarea
                          value={isVuln ? finalForm.securityUpdates : finalForm.ongoingMitigation}
                          onChange={e => setFinalForm(f => isVuln ? ({ ...f, securityUpdates: e.target.value }) : ({ ...f, ongoingMitigation: e.target.value }))}
                          placeholder={isVuln ? 'Links to patches, updates, or security advisories issued...' : 'Applied and ongoing mitigation measures...'}
                          rows={3}
                        />
                      </div>
                      <div className="rd-form-group">
                        <label>Preventive Measures</label>
                        <textarea
                          value={finalForm.preventiveMeasures}
                          onChange={e => setFinalForm(f => ({ ...f, preventiveMeasures: e.target.value }))}
                          placeholder="What preventive measures are being implemented for the future?"
                          rows={3}
                        />
                      </div>
                      {isVuln && (
                        <div className="rd-form-group">
                          <label>User Notification Status</label>
                          <select
                            value={finalForm.userNotificationStatus}
                            onChange={e => setFinalForm(f => ({ ...f, userNotificationStatus: e.target.value as any }))}
                          >
                            <option value="informed">Users Informed</option>
                            <option value="pending">Notification Pending</option>
                            <option value="not_required">Not Required</option>
                          </select>
                        </div>
                      )}
                      <div className="rd-form-actions">
                        <button className="rd-btn-secondary" onClick={() => setActiveStage(null)}>Cancel</button>
                        <button
                          className="rd-btn-primary"
                          onClick={() => handleSubmitStage('final_report')}
                          disabled={submitting || !finalForm.detailedDescription}
                        >
                          <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Final Report'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Linked Finding */}
          {linkedFinding && (
            <div className="rd-linked-finding">
              <h3 className="rd-section-title">Linked Vulnerability Finding</h3>
              <div className="rd-finding-card">
                <div className="rd-finding-header">
                  <span className={`rd-severity rd-severity-${linkedFinding.severity}`}>{linkedFinding.severity}</span>
                  <span className="rd-finding-source">{linkedFinding.source}: {linkedFinding.source_id}</span>
                </div>
                <div className="rd-finding-title">{linkedFinding.title}</div>
                <div className="rd-finding-detail">
                  {linkedFinding.dependency_name}@{linkedFinding.dependency_version}
                  {linkedFinding.fixed_version && <span className="rd-fix-available"> — fix: {linkedFinding.fixed_version}</span>}
                </div>
                {linkedFinding.description && (
                  <p className="rd-finding-desc">{linkedFinding.description.slice(0, 300)}{linkedFinding.description.length > 300 ? '...' : ''}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="rd-sidebar">
          {/* Report metadata */}
          <div className="rd-meta-card">
            <div className="rd-meta-header">
              <h4>Report Details</h4>
              {!editingMeta && report.status !== 'closed' && (
                <button className="rd-edit-btn" onClick={() => setEditingMeta(true)}>Edit</button>
              )}
            </div>

            {editingMeta ? (
              <div className="rd-meta-edit">
                <div className="rd-form-group">
                  <label>CSIRT Country</label>
                  <select value={metaForm.csirtCountry} onChange={e => setMetaForm(f => ({ ...f, csirtCountry: e.target.value }))}>
                    <option value="">Select CSIRT...</option>
                    {Object.entries(EU_COUNTRIES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="rd-form-group">
                  <label>Awareness Date/Time</label>
                  <input
                    type="datetime-local"
                    value={metaForm.awarenessAt}
                    onChange={e => setMetaForm(f => ({ ...f, awarenessAt: e.target.value }))}
                  />
                </div>
                <div className="rd-form-group">
                  <label>TLP Classification</label>
                  <select value={metaForm.tlp} onChange={e => setMetaForm(f => ({ ...f, tlp: e.target.value }))}>
                    {TLP_OPTIONS.map(t => <option key={t} value={t}>TLP:{t}</option>)}
                  </select>
                </div>
                <div className="rd-meta-actions">
                  <button className="rd-btn-secondary" onClick={() => setEditingMeta(false)}>Cancel</button>
                  <button className="rd-btn-primary" onClick={handleSaveMeta}><Save size={14} /> Save</button>
                </div>
              </div>
            ) : (
              <div className="rd-meta-fields">
                <div className="rd-meta-row">
                  <span className="rd-meta-label">Product</span>
                  <Link to={`/products/${report.productId}`} className="rd-meta-value rd-link">{report.productName}</Link>
                </div>
                <div className="rd-meta-row">
                  <span className="rd-meta-label">CSIRT</span>
                  <span className="rd-meta-value">{report.csirtCountry ? `${EU_COUNTRIES[report.csirtCountry]} (${report.csirtCountry})` : 'Not set'}</span>
                </div>
                <div className="rd-meta-row">
                  <span className="rd-meta-label">Aware Since</span>
                  <span className="rd-meta-value">{formatDate(report.awarenessAt)}</span>
                </div>
                <div className="rd-meta-row">
                  <span className="rd-meta-label">TLP</span>
                  <span className={`rd-tlp rd-tlp-${report.sensitivityTlp?.toLowerCase()}`}>TLP:{report.sensitivityTlp}</span>
                </div>
                <div className="rd-meta-row">
                  <span className="rd-meta-label">Created By</span>
                  <span className="rd-meta-value">{report.createdByEmail}</span>
                </div>
                <div className="rd-meta-row">
                  <span className="rd-meta-label">Created</span>
                  <span className="rd-meta-value">{formatDate(report.createdAt)}</span>
                </div>
                {report.enisaReference && (
                  <div className="rd-meta-row">
                    <span className="rd-meta-label">ENISA Ref</span>
                    <span className="rd-meta-value">{report.enisaReference}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ENISA SRP info */}
          <div className="rd-srp-card">
            <Info size={16} />
            <div>
              <strong>ENISA Single Reporting Platform</strong>
              <p>The SRP goes live September 2026. Reports prepared here will be ready for submission when the platform opens.</p>
            </div>
          </div>

          {/* Deadlines summary */}
          <div className="rd-deadlines-card">
            <h4>Deadlines</h4>
            {timelineStages.map(ts => {
              const countdown = ts.deadline ? formatCountdown(ts.deadline) : null;
              return (
                <div key={ts.key} className={`rd-deadline-row ${ts.submitted ? 'done' : ''}`}>
                  <span className="rd-deadline-label">{ts.label}</span>
                  <span className="rd-deadline-date">{formatDate(ts.deadline)}</span>
                  {ts.submitted ? (
                    <span className="rd-deadline-done"><CheckCircle2 size={12} /> Done</span>
                  ) : countdown ? (
                    <span className={`rd-deadline-countdown ${countdown.isOverdue ? 'overdue' : ''}`}>{countdown.text}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
