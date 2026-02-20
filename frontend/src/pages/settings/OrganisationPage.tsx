import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import {
  Building2, Globe, Users, Shield, Factory, Briefcase,
  Calendar, Mail, Crown
} from 'lucide-react';
import './OrganisationPage.css';

interface OrgData {
  id: string;
  name: string;
  country: string;
  companySize: string;
  craRole: string;
  industry: string;
  userRole: string;
}

interface Member {
  id: string;
  email: string;
  orgRole: string;
  preferredLanguage: string | null;
  createdAt: string;
}

const SIZE_LABELS: Record<string, string> = {
  micro: 'Micro (< 10 employees)',
  small: 'Small (10–49 employees)',
  medium: 'Medium (50–249 employees)',
  large: 'Large (250+ employees)',
};

const ROLE_LABELS: Record<string, { label: string; icon: typeof Factory }> = {
  manufacturer: { label: 'Manufacturer', icon: Factory },
  importer: { label: 'Importer', icon: Globe },
  distributor: { label: 'Distributor', icon: Users },
  open_source_steward: { label: 'Open Source Steward', icon: Shield },
};

const LANG_LABELS: Record<string, string> = {
  en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
  nl: 'Dutch', pt: 'Portuguese', pl: 'Polish', sv: 'Swedish', da: 'Danish',
  fi: 'Finnish', el: 'Greek', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian',
  bg: 'Bulgarian', hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian', et: 'Estonian',
  lv: 'Latvian', lt: 'Lithuanian', mt: 'Maltese', ga: 'Irish',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatLanguage(lang: string | null): string {
  if (!lang) return '—';
  const code = lang.split('-')[0].toLowerCase();
  return LANG_LABELS[code] || lang.toUpperCase();
}

export default function OrganisationPage() {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const token = localStorage.getItem('session_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [orgRes, membersRes] = await Promise.all([
        fetch('/api/org', { headers }),
        fetch('/api/org/members', { headers }),
      ]);

      if (orgRes.ok) {
        setOrg(await orgRes.json());
      }
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Organisation" />
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      </>
    );
  }

  if (!org) {
    return (
      <>
        <PageHeader title="Organisation" />
        <p style={{ color: 'var(--muted)' }}>No organisation found.</p>
      </>
    );
  }

  const roleInfo = ROLE_LABELS[org.craRole] || { label: org.craRole, icon: Shield };
  const RoleIcon = roleInfo.icon;

  return (
    <>
      <PageHeader title="Organisation" />

      <div className="org-page-grid">
        {/* Organisation Details Card */}
        <div className="org-card org-details-card">
          <div className="org-card-header">
            <Building2 size={20} />
            <h3>Organisation Details</h3>
          </div>
          <div className="org-card-body">
            <div className="org-field">
              <label><Building2 size={14} /> Name</label>
              <span>{org.name}</span>
            </div>
            <div className="org-field">
              <label><Globe size={14} /> Country</label>
              <span>{org.country}</span>
            </div>
            <div className="org-field">
              <label><Users size={14} /> Company Size</label>
              <span>{SIZE_LABELS[org.companySize] || org.companySize}</span>
            </div>
            <div className="org-field">
              <label><RoleIcon size={14} /> CRA Role</label>
              <span className="org-role-badge">{roleInfo.label}</span>
            </div>
            {org.industry && (
              <div className="org-field">
                <label><Briefcase size={14} /> Industry</label>
                <span>{org.industry}</span>
              </div>
            )}
            <div className="org-field">
              <label><Shield size={14} /> Organisation ID</label>
              <span className="org-mono">{org.id}</span>
            </div>
          </div>
        </div>

        {/* CRA Compliance Summary Card */}
        <div className="org-card org-cra-card">
          <div className="org-card-header">
            <Shield size={20} />
            <h3>CRA Compliance Status</h3>
          </div>
          <div className="org-card-body">
            <div className="cra-status-item">
              <div className="cra-status-label">Regulatory Classification</div>
              <div className="cra-status-value">
                <RoleIcon size={16} style={{ color: 'var(--accent)' }} />
                {roleInfo.label}
              </div>
            </div>
            <div className="cra-status-item">
              <div className="cra-status-label">SME Exemptions</div>
              <div className="cra-status-value">
                {org.companySize === 'micro' ? (
                  <span className="badge badge-green">Eligible</span>
                ) : org.companySize === 'small' ? (
                  <span className="badge badge-amber">Partial</span>
                ) : (
                  <span className="badge badge-muted">Not Applicable</span>
                )}
              </div>
            </div>
            <div className="cra-status-item">
              <div className="cra-status-label">Products Registered</div>
              <div className="cra-status-value">0</div>
            </div>
            <div className="cra-status-item">
              <div className="cra-status-label">Open Obligations</div>
              <div className="cra-status-value">0</div>
            </div>
            <div className="cra-info">
              As a <strong>{roleInfo.label.toLowerCase()}</strong> in the <strong>{org.country}</strong>,
              your organisation is subject to CRA obligations under{' '}
              {org.craRole === 'manufacturer' ? 'Articles 13–16' :
               org.craRole === 'importer' ? 'Article 19' :
               org.craRole === 'distributor' ? 'Article 20' :
               'Article 24'} of the Cyber Resilience Act.
            </div>
          </div>
        </div>

        {/* Members Card */}
        <div className="org-card org-members-card">
          <div className="org-card-header">
            <Users size={20} />
            <h3>Members ({members.length})</h3>
          </div>
          <div className="org-card-body">
            {members.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No members found.</p>
            ) : (
              <table className="org-members-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Language</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className="member-email">
                          <Mail size={14} />
                          {m.email}
                        </div>
                      </td>
                      <td>
                        <span className={`member-role ${m.orgRole === 'admin' ? 'role-admin' : ''}`}>
                          {m.orgRole === 'admin' && <Crown size={12} />}
                          {m.orgRole}
                        </span>
                      </td>
                      <td>{formatLanguage(m.preferredLanguage)}</td>
                      <td>
                        <div className="member-date">
                          <Calendar size={14} />
                          {formatDate(m.createdAt)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
