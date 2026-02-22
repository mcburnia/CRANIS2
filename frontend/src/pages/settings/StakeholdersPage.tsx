import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { Building2, Package, ChevronRight, Loader2, Save } from 'lucide-react';
import './StakeholdersPage.css';

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
            <span className="sk-role-title">{stakeholder.title}</span>
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
