import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import HelpTip from '../../components/HelpTip';
import { Building2, Package, ChevronRight, Loader2, Save } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './StakeholdersPage.css';

const ROLE_HELP: Record<string, string> = {
  manufacturer_contact: 'The primary contact person or legal entity placing the product on the EU market. Required under CRA Article 13 to be identifiable on the product or packaging.',
  authorised_representative: 'A person established in the EU appointed by the manufacturer to act on their behalf for CRA compliance tasks. Required under Article 15 when the manufacturer is outside the EU.',
  compliance_officer: 'The internal person responsible for overseeing CRA compliance across your organisation. Not a specific CRA requirement but essential for governance and audit readiness.',
  security_contact: 'The person responsible for receiving and triaging vulnerability reports for this product. Required under CRA Article 11 and your coordinated vulnerability disclosure policy.',
  technical_file_owner: 'The person responsible for compiling and maintaining the technical documentation file for this product. The file must be kept up to date per CRA Article 31.',
  incident_response_lead: 'The person who coordinates response to cybersecurity incidents for this product, including mandatory ENISA reporting within 24 hours under NIS2 and CRA Article 14.',
};

interface Stakeholder {
  id: string;
  roleKey: string;
  title: string;
  craReference: string;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  address: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface ProductStakeholders {
  productName: string;
  stakeholders: Stakeholder[];
}

interface StakeholderData {
  orgStakeholders: Stakeholder[];
  productStakeholders: Record<string, ProductStakeholders>;
}

export default function StakeholdersPage() {
  usePageMeta();
  const [data, setData] = useState<StakeholderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [activeProductTab, setActiveProductTab] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, Partial<Stakeholder>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');

  async function fetchStakeholders() {
    try {
      const res = await fetch('/api/stakeholders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Set first product tab if not set
        if (!activeProductTab) {
          const productIds = Object.keys(json.productStakeholders);
          if (productIds.length > 0) setActiveProductTab(productIds[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stakeholders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStakeholders(); }, []);

  function toggleRole(stakeholder: Stakeholder) {
    if (expandedRole === stakeholder.id) {
      setExpandedRole(null);
    } else {
      setExpandedRole(stakeholder.id);
      // Load current values into edit state on first expand
      if (!editFields[stakeholder.id]) {
        setEditFields(prev => ({
          ...prev,
          [stakeholder.id]: {
            name: stakeholder.name,
            email: stakeholder.email,
            phone: stakeholder.phone,
            organisation: stakeholder.organisation,
            address: stakeholder.address,
          },
        }));
      }
    }
  }

  function updateField(id: string, field: string, value: string) {
    setEditFields(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function handleSave(id: string) {
    setSaving(id);
    try {
      const fields = editFields[id];
      const res = await fetch(`/api/stakeholders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        await fetchStakeholders();
      }
    } catch (err) {
      console.error('Failed to save stakeholder:', err);
    } finally {
      setSaving(null);
    }
  }

  function renderRoleCard(stakeholder: Stakeholder) {
    const isExpanded = expandedRole === stakeholder.id;
    const isAssigned = stakeholder.name.trim().length > 0;
    const fields = editFields[stakeholder.id] || {};

    return (
      <div key={stakeholder.id} className="sk-role-card">
        <div className="sk-role-header" onClick={() => toggleRole(stakeholder)}>
          <ChevronRight size={16} className={`sk-chevron ${isExpanded ? 'sk-chevron-open' : ''}`} />
          <div className="sk-role-info">
            <span className="sk-role-title">{stakeholder.title} <HelpTip text={ROLE_HELP[stakeholder.roleKey] || ''} /></span>
            <span className="sk-role-ref">{stakeholder.craReference}</span>
          </div>
          <div className="sk-status">
            <div className={`sk-status-dot ${isAssigned ? 'assigned' : 'empty'}`} />
            <span className="sk-status-text">{isAssigned ? 'Assigned' : 'Not assigned'}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="sk-editor">
            <div className="sk-field-row">
              <div className="sk-field">
                <label className="sk-field-label">Name</label>
                <input
                  className="sk-field-input"
                  value={fields.name || ''}
                  onChange={e => updateField(stakeholder.id, 'name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="sk-field">
                <label className="sk-field-label">Email</label>
                <input
                  className="sk-field-input"
                  type="email"
                  value={fields.email || ''}
                  onChange={e => updateField(stakeholder.id, 'email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="sk-field-row">
              <div className="sk-field">
                <label className="sk-field-label">Phone</label>
                <input
                  className="sk-field-input"
                  value={fields.phone || ''}
                  onChange={e => updateField(stakeholder.id, 'phone', e.target.value)}
                  placeholder="+44 ..."
                />
              </div>
              <div className="sk-field">
                <label className="sk-field-label">Organisation</label>
                <input
                  className="sk-field-input"
                  value={fields.organisation || ''}
                  onChange={e => updateField(stakeholder.id, 'organisation', e.target.value)}
                  placeholder="Company / entity name"
                />
              </div>
            </div>
            <div className="sk-field-row">
              <div className="sk-field sk-field-full">
                <label className="sk-field-label">Address</label>
                <textarea
                  className="sk-field-textarea"
                  value={fields.address || ''}
                  onChange={e => updateField(stakeholder.id, 'address', e.target.value)}
                  placeholder="Postal address"
                />
              </div>
            </div>
            <div className="sk-actions">
              <button
                className="sk-save-btn"
                onClick={() => handleSave(stakeholder.id)}
                disabled={saving === stakeholder.id}
              >
                {saving === stakeholder.id ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                {saving === stakeholder.id ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Stakeholders" />
        <p className="sk-empty">Loading stakeholders...</p>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Stakeholders" />
        <p className="sk-empty">Unable to load stakeholders. Please try refreshing.</p>
      </>
    );
  }

  const productIds = Object.keys(data.productStakeholders);

  return (
    <>
      <PageHeader title="Stakeholders" />

      <div className="sk-section">
        <div className="sk-section-title"><Building2 size={18} /> Organisation Stakeholders</div>
        {data.orgStakeholders.map(s => renderRoleCard(s))}
      </div>

      <div className="sk-section">
        <div className="sk-section-title"><Package size={18} /> Product Stakeholders</div>

        {productIds.length === 0 ? (
          <p className="sk-empty">No products yet. Add a product to assign product-level stakeholders.</p>
        ) : (
          <>
            <div className="sk-tabs">
              {productIds.map(pid => (
                <button
                  key={pid}
                  className={`sk-tab ${activeProductTab === pid ? 'active' : ''}`}
                  onClick={() => setActiveProductTab(pid)}
                >
                  {data.productStakeholders[pid].productName}
                </button>
              ))}
            </div>

            {activeProductTab && data.productStakeholders[activeProductTab] && (
              data.productStakeholders[activeProductTab].stakeholders.map(s => renderRoleCard(s))
            )}
          </>
        )}
      </div>
    </>
  );
}
