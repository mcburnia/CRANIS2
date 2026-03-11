/**
 * AdminCopilotPage
 * Admin panel for viewing and editing CoPilot AI prompts in context.
 * Shows the quality standard preamble + each capability prompt with config.
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Check, ChevronDown, Save, RotateCcw, Shield, FileText, Scale } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import '../../components/styles/admin-copilot.css';

interface CopilotPrompt {
  id: string;
  prompt_key: string;
  category: string;
  title: string;
  description: string;
  system_prompt: string;
  model: string;
  max_tokens: number;
  temperature: number;
  enabled: boolean;
  version: number;
  updated_at: string;
  updated_by: string | null;
}

interface EditState {
  system_prompt: string;
  model: string;
  max_tokens: number;
  temperature: number;
  enabled: boolean;
  description: string;
}

export default function AdminCopilotPage() {
  const [prompts, setPrompts] = useState<CopilotPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadPrompts = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/copilot-prompts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load prompts');
      const data = await res.json();
      setPrompts(data.prompts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const qualityStandard = prompts.find(p => p.prompt_key === 'quality_standard');
  const capabilities = prompts.filter(p => p.category === 'capability');
  const sectionGuidance = prompts.filter(p => p.category === 'section_guidance');
  const obligationGuidance = prompts.filter(p => p.category === 'obligation_guidance');

  const getEdit = (key: string): EditState => {
    if (edits[key]) return edits[key];
    const prompt = prompts.find(p => p.prompt_key === key);
    if (!prompt) return { system_prompt: '', model: '', max_tokens: 2000, temperature: 1.0, enabled: true, description: '' };
    return {
      system_prompt: prompt.system_prompt,
      model: prompt.model,
      max_tokens: prompt.max_tokens,
      temperature: prompt.temperature,
      enabled: prompt.enabled,
      description: prompt.description,
    };
  };

  const setEdit = (key: string, field: keyof EditState, value: any) => {
    const current = getEdit(key);
    setEdits(prev => ({ ...prev, [key]: { ...current, [field]: value } }));
  };

  const hasChanges = (key: string): boolean => {
    const edit = edits[key];
    if (!edit) return false;
    const prompt = prompts.find(p => p.prompt_key === key);
    if (!prompt) return false;
    return (
      edit.system_prompt !== prompt.system_prompt ||
      edit.model !== prompt.model ||
      edit.max_tokens !== prompt.max_tokens ||
      edit.temperature !== prompt.temperature ||
      edit.enabled !== prompt.enabled ||
      edit.description !== prompt.description
    );
  };

  const handleSave = async (key: string) => {
    const edit = edits[key];
    if (!edit) return;

    setSaving(key);
    setError(null);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/copilot-prompts/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(edit),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      const updated = await res.json();
      setPrompts(prev => prev.map(p => p.prompt_key === key ? updated : p));
      setEdits(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
      setSuccess(`"${updated.title}" saved (v${updated.version})`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (key: string) => {
    setEdits(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  const toggleExpand = (key: string) => {
    setExpandedKey(prev => prev === key ? null : key);
  };

  if (loading) return <div className="acp-container"><div className="acp-loading">Loading CoPilot prompts...</div></div>;

  return (
    <div className="acp-container">
      <PageHeader title="AI CoPilot Settings" />
      <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 14 }}>
        Review and edit system prompts for each CoPilot capability. Changes take effect immediately.
      </p>

      {error && <div className="acp-error"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="acp-success"><Check size={16} /> {success}</div>}

      {/* Quality Standard (foundation) */}
      {qualityStandard && (
        <div className="acp-foundation">
          <div className="acp-foundation-header">
            <h2><Shield size={18} /> Output Quality Standard <span className="acp-foundation-badge">Foundation</span></h2>
            <button
              className="acp-btn-reset"
              onClick={() => toggleExpand('quality_standard')}
            >
              {expandedKey === 'quality_standard' ? 'Collapse' : 'Edit'}
            </button>
          </div>
          <p className="acp-foundation-desc">
            {qualityStandard.description}
          </p>

          {expandedKey === 'quality_standard' ? (
            <div>
              <div className="acp-context-label">Quality Preamble (prepended to all capability prompts)</div>
              <textarea
                className="acp-prompt-textarea"
                value={getEdit('quality_standard').system_prompt}
                onChange={e => setEdit('quality_standard', 'system_prompt', e.target.value)}
              />
              <div className="acp-actions">
                <span className="acp-version-info">
                  v{qualityStandard.version} &middot; Updated {qualityStandard.updated_at ? new Date(qualityStandard.updated_at).toLocaleDateString('en-GB') : 'never'}
                </span>
                <div className="acp-btn-group">
                  {hasChanges('quality_standard') && (
                    <>
                      <button className="acp-btn-reset" onClick={() => handleReset('quality_standard')}>
                        <RotateCcw size={14} /> Discard
                      </button>
                      <button
                        className="acp-btn-save"
                        onClick={() => handleSave('quality_standard')}
                        disabled={saving === 'quality_standard'}
                      >
                        <Save size={14} /> {saving === 'quality_standard' ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="acp-quality-preview">
              {qualityStandard.system_prompt.substring(0, 400)}...
            </div>
          )}
        </div>
      )}

      {/* Capability prompts */}
      <h2 className="acp-section-heading">Capability Prompts</h2>
      <div className="acp-capabilities">
        {capabilities.map(prompt => renderCapabilityCard(prompt))}
      </div>

      {/* Section guidance */}
      {sectionGuidance.length > 0 && (
        <>
          <h2 className="acp-section-heading"><FileText size={18} /> Technical File Section Guidance <span className="acp-count-badge">{sectionGuidance.length}</span></h2>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 13 }}>
            Regulatory context injected into AI suggestions for each Annex VII technical file section.
          </p>
          <div className="acp-capabilities">
            {sectionGuidance.map(prompt => renderGuidanceCard(prompt))}
          </div>
        </>
      )}

      {/* Obligation guidance */}
      {obligationGuidance.length > 0 && (
        <>
          <h2 className="acp-section-heading"><Scale size={18} /> Obligation Guidance <span className="acp-count-badge">{obligationGuidance.length}</span></h2>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 13 }}>
            Regulatory context injected into AI suggestions for each CRA obligation evidence section.
          </p>
          <div className="acp-capabilities">
            {obligationGuidance.map(prompt => renderGuidanceCard(prompt))}
          </div>
        </>
      )}
    </div>
  );

  function renderCapabilityCard(prompt: CopilotPrompt) {
    const isExpanded = expandedKey === prompt.prompt_key;
    const edit = getEdit(prompt.prompt_key);
    const changed = hasChanges(prompt.prompt_key);

    return (
      <div key={prompt.prompt_key} className="acp-card">
        <div className="acp-card-header" onClick={() => toggleExpand(prompt.prompt_key)}>
          <div className="acp-card-title">
            <h3>{prompt.title}</h3>
            <span className="acp-card-key">{prompt.prompt_key}</span>
            {changed && <span className="acp-foundation-badge" style={{ background: '#f59e0b' }}>Unsaved</span>}
          </div>
          <div className="acp-card-meta">
            <span className="acp-card-model">{prompt.model}</span>
            <span className="acp-card-tokens">{prompt.max_tokens} tokens</span>
            <ChevronDown size={16} className={`acp-card-chevron ${isExpanded ? 'open' : ''}`} />
          </div>
        </div>

        {isExpanded && (
          <div className="acp-card-body">
            <p className="acp-card-desc">{prompt.description}</p>

            {qualityStandard && (
              <div>
                <div className="acp-context-label">Layer 1 — Quality Standard (shared preamble)</div>
                <div className="acp-quality-preview">
                  {qualityStandard.system_prompt.substring(0, 300)}...
                </div>
              </div>
            )}

            <div className="acp-context-label">Layer 3 — Capability System Prompt</div>
            <textarea
              className="acp-prompt-textarea"
              value={edit.system_prompt}
              onChange={e => setEdit(prompt.prompt_key, 'system_prompt', e.target.value)}
            />

            <div className="acp-config-row">
              <div className="acp-config-field">
                <label>Model</label>
                <select
                  value={edit.model}
                  onChange={e => setEdit(prompt.prompt_key, 'model', e.target.value)}
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-opus-4-1">Claude Opus 4.1</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                </select>
              </div>
              <div className="acp-config-field">
                <label>Max Tokens</label>
                <input
                  type="number"
                  min={100}
                  max={16000}
                  step={100}
                  value={edit.max_tokens}
                  onChange={e => setEdit(prompt.prompt_key, 'max_tokens', parseInt(e.target.value) || 2000)}
                />
              </div>
              <div className="acp-config-field">
                <label>Temperature</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={edit.temperature}
                  onChange={e => setEdit(prompt.prompt_key, 'temperature', parseFloat(e.target.value) || 1.0)}
                />
              </div>
              <div className="acp-config-field">
                <label className="acp-toggle">
                  <input
                    type="checkbox"
                    checked={edit.enabled}
                    onChange={e => setEdit(prompt.prompt_key, 'enabled', e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className="acp-actions">
              <span className="acp-version-info">
                v{prompt.version} &middot; Updated {prompt.updated_at ? new Date(prompt.updated_at).toLocaleDateString('en-GB') : 'never'}
              </span>
              <div className="acp-btn-group">
                {changed && (
                  <>
                    <button className="acp-btn-reset" onClick={() => handleReset(prompt.prompt_key)}>
                      <RotateCcw size={14} /> Discard
                    </button>
                    <button
                      className="acp-btn-save"
                      onClick={() => handleSave(prompt.prompt_key)}
                      disabled={saving === prompt.prompt_key}
                    >
                      <Save size={14} /> {saving === prompt.prompt_key ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderGuidanceCard(prompt: CopilotPrompt) {
    const isExpanded = expandedKey === prompt.prompt_key;
    const edit = getEdit(prompt.prompt_key);
    const changed = hasChanges(prompt.prompt_key);

    return (
      <div key={prompt.prompt_key} className="acp-card">
        <div className="acp-card-header" onClick={() => toggleExpand(prompt.prompt_key)}>
          <div className="acp-card-title">
            <h3>{prompt.title}</h3>
            <span className="acp-card-key">{prompt.prompt_key}</span>
            {changed && <span className="acp-foundation-badge" style={{ background: '#f59e0b' }}>Unsaved</span>}
          </div>
          <div className="acp-card-meta">
            <span className={`acp-card-enabled ${prompt.enabled ? '' : 'disabled'}`}>
              {prompt.enabled ? 'Active' : 'Disabled'}
            </span>
            <ChevronDown size={16} className={`acp-card-chevron ${isExpanded ? 'open' : ''}`} />
          </div>
        </div>

        {isExpanded && (
          <div className="acp-card-body">
            <p className="acp-card-desc">{prompt.description}</p>

            <div className="acp-context-label">Regulatory Guidance (injected into user prompt context)</div>
            <textarea
              className="acp-prompt-textarea"
              value={edit.system_prompt}
              onChange={e => setEdit(prompt.prompt_key, 'system_prompt', e.target.value)}
            />

            <div className="acp-config-row">
              <div className="acp-config-field">
                <label className="acp-toggle">
                  <input
                    type="checkbox"
                    checked={edit.enabled}
                    onChange={e => setEdit(prompt.prompt_key, 'enabled', e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className="acp-actions">
              <span className="acp-version-info">
                v{prompt.version} &middot; Updated {prompt.updated_at ? new Date(prompt.updated_at).toLocaleDateString('en-GB') : 'never'}
              </span>
              <div className="acp-btn-group">
                {changed && (
                  <>
                    <button className="acp-btn-reset" onClick={() => handleReset(prompt.prompt_key)}>
                      <RotateCcw size={14} /> Discard
                    </button>
                    <button
                      className="acp-btn-save"
                      onClick={() => handleSave(prompt.prompt_key)}
                      disabled={saving === prompt.prompt_key}
                    >
                      <Save size={14} /> {saving === prompt.prompt_key ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
