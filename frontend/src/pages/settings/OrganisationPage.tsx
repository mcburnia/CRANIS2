import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import {
  Building2, Globe, Users, Shield, Factory, Briefcase,
  Calendar, Mail, Crown, MapPin, Phone, Edit3, Save, X
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
  website: string;
  contactEmail: string;
  contactPhone: string;
  street: string;
  city: string;
  postcode: string;
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
  small: 'Small (10\u201349 employees)',
  medium: 'Medium (50\u2013249 employees)',
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
  if (!lang) return '\u2014';
  const code = lang.split('-')[0].toLowerCase();
  return LANG_LABELS[code] || lang.toUpperCase();
}

export default function OrganisationPage() {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Manufacturer details edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    website: '', contactEmail: '', contactPhone: '',
    street: '', city: '', postcode: '',
  });

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
        const data = await orgRes.json();
        setOrg(data);
        setEditForm({
          website: data.website || '',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          street: data.street || '',
          city: data.city || '',
          postcode: data.postcode || '',
        });
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

  function startEditing() {
    if (!org) return;
    setEditForm({
      website: org.website || '',
      contactEmail: org.contactEmail || '',
      contactPhone: org.contactPhone || '',
      street: org.street || '',
      city: org.city || '',
      postcode: org.postcode || '',
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function handleSave() {
    if (!org) return;
    setSaving(true);
    const token = localStorage.getItem('session_token');

    try {
      const res = await fetch('/api/org', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: org.name,
          country: org.country,
          companySize: org.companySize,
          craRole: org.craRole,
          industry: org.industry,
          ...editForm,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setOrg(updated);
        setEditing(false);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
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
  const hasManufacturerData = org.website || org.contactEmail || org.contactPhone || org.street || org.city || org.postcode;

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
              {org.craRole === 'manufacturer' ? 'Articles 13\u201316' :
               org.craRole === 'importer' ? 'Article 19' :
               org.craRole === 'distributor' ? 'Article 20' :
               'Article 24'} of the Cyber Resilience Act.
            </div>
          </div>
        </div>

        {/* Manufacturer Details Card */}
        <div className="org-card org-manufacturer-card">
          <div className="org-card-header">
            <MapPin size={20} />
            <h3>Manufacturer Details</h3>
            {org.userRole === 'admin' && !editing && (
              <button className="org-edit-btn" onClick={startEditing}>
                <Edit3 size={14} /> Edit
              </button>
            )}
            {editing && (
              <div className="org-edit-actions">
                <button className="org-save-btn" onClick={handleSave} disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="org-cancel-btn" onClick={cancelEditing} disabled={saving}>
                  <X size={14} /> Cancel
                </button>
              </div>
            )}
          </div>
          <div className="org-card-body">
            {editing ? (
              <div className="org-edit-form">
                <div className="org-field">
                  <label><Globe size={14} /> Website</label>
                  <input
                    type="url"
                    className="org-input"
                    placeholder="https://example.com"
                    value={editForm.website}
                    onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                  />
                </div>
                <div className="org-field">
                  <label><Mail size={14} /> Contact Email</label>
                  <input
                    type="email"
                    className="org-input"
                    placeholder="compliance@example.com"
                    value={editForm.contactEmail}
                    onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  />
                </div>
                <div className="org-field">
                  <label><Phone size={14} /> Contact Phone</label>
                  <input
                    type="tel"
                    className="org-input"
                    placeholder="+44 20 1234 5678"
                    value={editForm.contactPhone}
                    onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })}
                  />
                </div>
                <div className="org-field">
                  <label><MapPin size={14} /> Street</label>
                  <input
                    type="text"
                    className="org-input"
                    placeholder="123 High Street"
                    value={editForm.street}
                    onChange={e => setEditForm({ ...editForm, street: e.target.value })}
                  />
                </div>
                <div className="org-field">
                  <label><MapPin size={14} /> City</label>
                  <input
                    type="text"
                    className="org-input"
                    placeholder="London"
                    value={editForm.city}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="org-field">
                  <label><MapPin size={14} /> Postcode</label>
                  <input
                    type="text"
                    className="org-input"
                    placeholder="SW1A 1AA"
                    value={editForm.postcode}
                    onChange={e => setEditForm({ ...editForm, postcode: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <>
                {!hasManufacturerData ? (
                  <div className="org-empty-manufacturer">
                    <p>No manufacturer details configured yet.</p>
                    <p className="org-empty-hint">These details appear as the manufacturer in exported SBOMs and compliance packages.</p>
                  </div>
                ) : (
                  <>
                    {org.website && (
                      <div className="org-field">
                        <label><Globe size={14} /> Website</label>
                        <span><a href={org.website} target="_blank" rel="noopener noreferrer" className="org-link">{org.website}</a></span>
                      </div>
                    )}
                    {org.contactEmail && (
                      <div className="org-field">
                        <label><Mail size={14} /> Contact Email</label>
                        <span>{org.contactEmail}</span>
                      </div>
                    )}
                    {org.contactPhone && (
                      <div className="org-field">
                        <label><Phone size={14} /> Phone</label>
                        <span>{org.contactPhone}</span>
                      </div>
                    )}
                    {(org.street || org.city || org.postcode) && (
                      <div className="org-field">
                        <label><MapPin size={14} /> Address</label>
                        <span>{[org.street, org.city, org.postcode].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="org-manufacturer-info">
                  These details appear as the manufacturer in exported SBOMs and compliance packages.
                </div>
              </>
            )}
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
