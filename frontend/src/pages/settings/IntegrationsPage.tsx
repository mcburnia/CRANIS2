/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PageHeader from '../../components/PageHeader';
import { Plug, Trash2, Check, AlertTriangle, Plus, X, Send, Loader2, Key, Copy, Terminal, ChevronDown, ChevronUp, Info, Sparkles, Monitor, Share2 } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useAuth } from '../../context/AuthContext';
import './IntegrationsPage.css';

interface TrelloBoard { id: string; name: string; }
interface TrelloBoardList { id: string; name: string; }
interface ProductBoard {
  orgId: string;
  productId: string;
  boardId: string;
  boardName: string | null;
  listVuln: string | null;
  listObligations: string | null;
  listDeadlines: string | null;
  listGaps: string | null;
}
interface Product { id: string; name: string; }
interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_by_email: string | null;
}

function authHeaders() {
  const token = localStorage.getItem('session_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function getIdeSnippet(
  ide: 'vscode' | 'cursor' | 'claude-desktop' | 'claude-code',
  apiKeyValue: string,
  apiUrl: string
): { snippet: string; filename: string; instructions: string } {
  const keyPlaceholder = apiKeyValue || 'cranis2_your_key_here';

  if (ide === 'vscode') {
    return {
      filename: '.vscode/mcp.json',
      snippet: JSON.stringify({
        servers: {
          cranis2: {
            command: 'npx',
            args: ['-y', '@cranis2/mcp-server'],
            env: {
              CRANIS2_API_KEY: keyPlaceholder,
              CRANIS2_API_URL: apiUrl,
            },
          },
        },
      }, null, 2),
      instructions: 'Create this file in your project root. VS Code will detect the MCP server automatically when using GitHub Copilot agent mode.',
    };
  }

  if (ide === 'cursor') {
    return {
      filename: '.cursor/mcp.json',
      snippet: JSON.stringify({
        mcpServers: {
          cranis2: {
            command: 'npx',
            args: ['-y', '@cranis2/mcp-server'],
            env: {
              CRANIS2_API_KEY: keyPlaceholder,
              CRANIS2_API_URL: apiUrl,
            },
          },
        },
      }, null, 2),
      instructions: 'Create this file in your project root, or add the server via Settings > MCP > Add Server.',
    };
  }

  if (ide === 'claude-desktop') {
    const configPath = navigator.platform?.toLowerCase().includes('mac')
      ? '~/Library/Application Support/Claude/claude_desktop_config.json'
      : '~/.config/Claude/claude_desktop_config.json';
    return {
      filename: configPath,
      snippet: JSON.stringify({
        mcpServers: {
          cranis2: {
            command: 'npx',
            args: ['-y', '@cranis2/mcp-server'],
            env: {
              CRANIS2_API_KEY: keyPlaceholder,
              CRANIS2_API_URL: apiUrl,
            },
          },
        },
      }, null, 2),
      instructions: 'Add to your Claude Desktop config file. Restart Claude Desktop after saving.',
    };
  }

  // claude-code
  return {
    filename: '.mcp.json',
    snippet: JSON.stringify({
      mcpServers: {
        cranis2: {
          command: 'npx',
          args: ['-y', '@cranis2/mcp-server'],
          env: {
            CRANIS2_API_KEY: keyPlaceholder,
            CRANIS2_API_URL: apiUrl,
          },
        },
      },
    }, null, 2),
    instructions: 'Create this file in your project root. Claude Code will detect the MCP server on next launch.',
  };
}

interface IdeAssistantCardProps {
  isPro: boolean;
  ideTab: 'vscode' | 'cursor' | 'claude-desktop' | 'claude-code';
  setIdeTab: (tab: 'vscode' | 'cursor' | 'claude-desktop' | 'claude-code') => void;
  ideExpanded: boolean;
  setIdeExpanded: (v: boolean) => void;
  ideKeyId: string;
  setIdeKeyId: (v: string) => void;
  apiKeys: ApiKeyRow[];
  copyToClipboard: (text: string) => void;
}

function IdeAssistantCard({
  isPro, ideTab, setIdeTab, ideExpanded, setIdeExpanded,
  ideKeyId, setIdeKeyId, apiKeys, copyToClipboard,
}: IdeAssistantCardProps) {
  const activeKeys = apiKeys.filter(k => !k.revoked_at);
  const selectedKey = activeKeys.find(k => k.id === ideKeyId);
  const apiUrl = window.location.origin;
  const { snippet, filename, instructions } = getIdeSnippet(
    ideTab,
    selectedKey ? `${selectedKey.key_prefix}...` : '',
    apiUrl,
  );

  return (
    <div className="int-card">
      <div className="int-card-header">
        <div className="int-card-title">
          <Monitor size={18} />
          <span>IDE Compliance Assistant</span>
          {!isPro && <span className="int-badge int-badge-muted">Pro</span>}
        </div>
        {isPro && (
          <button className="int-btn-ghost" onClick={() => setIdeExpanded(!ideExpanded)}>
            {ideExpanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Setup Guide</>}
          </button>
        )}
      </div>

      <p className="int-desc">
        Connect your IDE's AI assistant to CRANIS2 via the MCP protocol. Query vulnerabilities, get fix commands, verify remediation, and check compliance, all without leaving your editor.
      </p>

      {!isPro && (
        <div className="ai-upgrade-banner">
          <Info size={14} />
          <span>IDE compliance assistant requires the <strong>Pro</strong> plan. <a href="/billing"><Sparkles size={12} style={{ verticalAlign: 'middle' }} /> Upgrade now</a></span>
        </div>
      )}

      {isPro && ideExpanded && (
        <div className="int-connected">
          <div className="int-section">
            <h3>Prerequisites</h3>
            <ol className="int-cicd-prereqs">
              <li>Create an <strong>API key</strong> above (if you haven't already)</li>
              <li>Ensure <strong>Node.js 18+</strong> is installed on your machine (<code>node --version</code>)</li>
              <li>Choose your IDE below and copy the configuration</li>
            </ol>
          </div>

          {activeKeys.length > 0 && (
            <div className="int-section">
              <h3>Select API Key</h3>
              <p className="int-hint">Choose which API key to embed in the configuration. The snippet will show the key prefix. Paste the full key value when you configure your IDE.</p>
              <div className="int-field" style={{ maxWidth: 400 }}>
                <select value={ideKeyId} onChange={e => setIdeKeyId(e.target.value)}>
                  <option value="">Select an API key...</option>
                  {activeKeys.map(k => (
                    <option key={k.id} value={k.id}>{k.name} ({k.key_prefix}...)</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeKeys.length === 0 && (
            <div className="ai-upgrade-banner" style={{ marginTop: '1rem' }}>
              <Info size={14} />
              <span>No active API keys found. Create one in the <strong>API Keys</strong> section above to get started.</span>
            </div>
          )}

          <div className="int-section">
            <h3>Configuration</h3>
            <div className="int-cicd-tabs">
              <button className={`int-cicd-tab ${ideTab === 'vscode' ? 'active' : ''}`} onClick={() => setIdeTab('vscode')}>VS Code</button>
              <button className={`int-cicd-tab ${ideTab === 'cursor' ? 'active' : ''}`} onClick={() => setIdeTab('cursor')}>Cursor</button>
              <button className={`int-cicd-tab ${ideTab === 'claude-desktop' ? 'active' : ''}`} onClick={() => setIdeTab('claude-desktop')}>Claude Desktop</button>
              <button className={`int-cicd-tab ${ideTab === 'claude-code' ? 'active' : ''}`} onClick={() => setIdeTab('claude-code')}>Claude Code</button>
            </div>

            <div className="int-cicd-snippet">
              <div className="int-cicd-snippet-header">
                <span>Add to <code>{filename}</code></span>
                <button className="int-btn-ghost" onClick={() => copyToClipboard(snippet)} title="Copy to clipboard"><Copy size={14} /> Copy</button>
              </div>
              <pre className="int-cicd-code">{snippet}</pre>
              <p className="int-hint">{instructions}</p>
              {selectedKey && (
                <p className="int-hint">
                  Replace <code>{selectedKey.key_prefix}...</code> with your full API key value. If you've lost it, revoke and create a new one.
                </p>
              )}
            </div>
          </div>

          <div className="int-section">
            <h3>Available Tools</h3>
            <table className="int-cicd-table">
              <thead>
                <tr><th>Tool</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>list_products</code></td><td>List all products in your organisation</td></tr>
                <tr><td><code>get_vulnerabilities</code></td><td>Get vulnerability findings (filterable by severity/status)</td></tr>
                <tr><td><code>get_mitigation</code></td><td>Get ecosystem-aware fix command (npm, pip, cargo, etc.)</td></tr>
                <tr><td><code>verify_fix</code></td><td>Trigger SBOM rescan and confirm fix applied</td></tr>
                <tr><td><code>get_compliance_status</code></td><td>Pass/fail compliance check against threshold</td></tr>
              </tbody>
            </table>
          </div>

          <div className="int-section">
            <h3>Example Workflow</h3>
            <div className="int-ide-workflow">
              <div className="int-ide-workflow-step">
                <span className="int-ide-workflow-num">1</span>
                <div>
                  <strong>Ask your AI assistant:</strong>
                  <p>"What vulnerabilities does my project have?"</p>
                </div>
              </div>
              <div className="int-ide-workflow-step">
                <span className="int-ide-workflow-num">2</span>
                <div>
                  <strong>AI calls <code>list_products</code> then <code>get_vulnerabilities</code>:</strong>
                  <p>"Found 3 critical vulnerabilities. The most urgent is CVE-2024-1234 in lodash@4.17.11."</p>
                </div>
              </div>
              <div className="int-ide-workflow-step">
                <span className="int-ide-workflow-num">3</span>
                <div>
                  <strong>AI calls <code>get_mitigation</code> and suggests:</strong>
                  <p><code>npm install lodash@4.17.21</code></p>
                </div>
              </div>
              <div className="int-ide-workflow-step">
                <span className="int-ide-workflow-num">4</span>
                <div>
                  <strong>After you run the fix, ask "Verify my fix":</strong>
                  <p>AI calls <code>verify_fix</code>. Triggers SBOM rescan and confirms the vulnerability is resolved.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  usePageMeta({ title: 'Integrations', description: 'Manage external integrations' });
  const { user } = useAuth();
  const isPro = !!(user?.orgPlan === 'pro' || user?.orgPlan === 'enterprise' || user?.isPlatformAdmin);

  // Trello state
  const [connected, setConnected] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [maskedToken, setMaskedToken] = useState('');
  const [cardsCreated, setCardsCreated] = useState(0);
  const [productBoards, setProductBoards] = useState<ProductBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Board/list pickers
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [boardLists, setBoardLists] = useState<Record<string, TrelloBoardList[]>>({});
  const [products, setProducts] = useState<Product[]>([]);

  // Track which board list fetches are in-flight to avoid duplicates
  const listFetchesRef = useRef<Set<string>>(new Set());

  // New product board form
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [newBoardId, setNewBoardId] = useState('');
  const [newListVuln, setNewListVuln] = useState('');
  const [newListObligations, setNewListObligations] = useState('');
  const [newListDeadlines, setNewListDeadlines] = useState('');
  const [newListGaps, setNewListGaps] = useState('');

  // Create default lists
  const [creatingLists, setCreatingLists] = useState(false);

  // Test card
  const [testListId, setTestListId] = useState('');
  const [testing, setTesting] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showAddKey, setShowAddKey] = useState(false);

  // CI/CD Gate
  const [cicdTab, setCicdTab] = useState<'github' | 'gitlab' | 'bash'>('github');
  const [cicdExpanded, setCicdExpanded] = useState(false);
  const [grcExpanded, setGrcExpanded] = useState(false);

  // IDE Assistant
  const [ideTab, setIdeTab] = useState<'vscode' | 'cursor' | 'claude-desktop' | 'claude-code'>('vscode');
  const [ideExpanded, setIdeExpanded] = useState(false);
  const [ideKeyId, setIdeKeyId] = useState('');

  /** Fetch lists for a specific board – deduped via ref */
  async function loadBoardLists(boardId: string) {
    if (listFetchesRef.current.has(boardId)) return;
    listFetchesRef.current.add(boardId);
    try {
      const r = await fetch(`/api/integrations/trello/boards/${boardId}/lists`, { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        setBoardLists(prev => ({ ...prev, [boardId]: Array.isArray(data) ? data : [] }));
      } else {
        listFetchesRef.current.delete(boardId);
      }
    } catch {
      listFetchesRef.current.delete(boardId);
    }
  }

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/trello', { headers: authHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      setConnected(data.connected);
      setEnabled(data.enabled ?? true);
      if (data.connected) {
        setApiKey(data.apiKey || '');
        setMaskedToken(data.maskedToken || '');
        setProductBoards(data.productBoards || []);
        setCardsCreated(data.cardsCreated || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const r = await fetch('/api/products', { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : data.products || [];
        setProducts(list.map((p: any) => ({ id: p.id, name: p.name })));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchBoards = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/trello/boards', { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        setBoards(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (connected) fetchBoards();
  }, [connected]);

  // Load lists when a board is selected in the add form
  useEffect(() => {
    if (newBoardId) loadBoardLists(newBoardId);
  }, [newBoardId]);

  // Eagerly load lists for all mapped product boards (for test connection dropdown)
  useEffect(() => {
    productBoards.forEach(pb => {
      if (pb.boardId) loadBoardLists(pb.boardId);
    });
  }, [productBoards]);

  const handleConnect = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const r = await fetch('/api/integrations/trello', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ apiKey, apiToken }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Failed to connect'); return; }
      setSuccess('Trello connected successfully');
      setConnected(true);
      setMaskedToken(apiToken.length > 8 ? apiToken.slice(0, 4) + '...' + apiToken.slice(-4) : '****');
      setApiToken('');
      fetchBoards();
      fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Trello? Product board mappings will be removed.')) return;
    try {
      await fetch('/api/integrations/trello', { method: 'DELETE', headers: authHeaders() });
      setConnected(false);
      setApiKey('');
      setMaskedToken('');
      setProductBoards([]);
      setBoards([]);
      setBoardLists({});
      listFetchesRef.current.clear();
      setSuccess('Trello disconnected');
    } catch { setError('Failed to disconnect'); }
  };

  const handleToggleEnabled = async () => {
    try {
      await fetch('/api/integrations/trello/enabled', {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ enabled: !enabled }),
      });
      setEnabled(!enabled);
    } catch { setError('Failed to toggle'); }
  };

  const handleSaveProductBoard = async () => {
    if (!newProductId || !newBoardId) { setError('Select a product and board'); return; }
    setError('');
    setSaving(true);
    try {
      const boardName = boards.find(b => b.id === newBoardId)?.name || null;
      const r = await fetch(`/api/integrations/trello/product-boards/${newProductId}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({
          boardId: newBoardId, boardName,
          listVuln: newListVuln || undefined,
          listObligations: newListObligations || undefined,
          listDeadlines: newListDeadlines || undefined,
          listGaps: newListGaps || undefined,
        }),
      });
      if (!r.ok) { setError('Failed to save board mapping'); return; }
      setSuccess('Product board mapping saved');
      setAddingProduct(false);
      setNewProductId('');
      setNewBoardId('');
      setNewListVuln('');
      setNewListObligations('');
      setNewListDeadlines('');
      setNewListGaps('');
      fetchStatus();
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDeleteProductBoard = async (productId: string) => {
    try {
      await fetch(`/api/integrations/trello/product-boards/${productId}`, { method: 'DELETE', headers: authHeaders() });
      setProductBoards(prev => prev.filter(b => b.productId !== productId));
      setSuccess('Board mapping removed');
    } catch { setError('Failed to remove'); }
  };

  const handleCreateDefaultLists = async () => {
    if (!newBoardId) return;
    setCreatingLists(true);
    setError('');
    try {
      const r = await fetch(`/api/integrations/trello/boards/${newBoardId}/create-default-lists`, {
        method: 'POST', headers: authHeaders(),
      });
      if (!r.ok) { setError('Failed to create default lists'); return; }
      const lists: TrelloBoardList[] = await r.json();
      setBoardLists(prev => ({ ...prev, [newBoardId]: lists }));
      listFetchesRef.current.add(newBoardId);
      // Auto-select the lists into their matching dropdowns
      const vuln = lists.find(l => l.name === 'CRA Vulnerabilities');
      const oblig = lists.find(l => l.name === 'CRA Obligations');
      const dead = lists.find(l => l.name === 'CRA Deadlines');
      const gaps = lists.find(l => l.name === 'CRA Gaps / Stalls');
      if (vuln) setNewListVuln(vuln.id);
      if (oblig) setNewListObligations(oblig.id);
      if (dead) setNewListDeadlines(dead.id);
      if (gaps) setNewListGaps(gaps.id);
      setSuccess('Default lists created on your Trello board');
    } catch { setError('Failed to create default lists'); }
    finally { setCreatingLists(false); }
  };

  const handleTestCard = async () => {
    if (!testListId) { setError('Select a list to send the test card to'); return; }
    setTesting(true);
    setError('');
    try {
      const r = await fetch('/api/integrations/trello/test', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ listId: testListId }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Test failed'); return; }
      setSuccess('Test card sent! Check your Trello board.');
    } catch { setError('Test failed'); }
    finally { setTesting(false); }
  };

  // ── API Key management ──
  const fetchApiKeys = useCallback(async () => {
    try {
      const r = await fetch('/api/settings/api-keys', { headers: authHeaders() });
      if (r.ok) setApiKeys(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchApiKeys(); }, []);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) { setError('Enter a name for the API key'); return; }
    setCreatingKey(true);
    setError('');
    try {
      const r = await fetch('/api/settings/api-keys', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Failed to create API key'); return; }
      setRevealedKey(data.key);
      setNewKeyName('');
      setShowAddKey(false);
      fetchApiKeys();
      setSuccess('API key created. Copy it now. It will not be shown again.');
    } catch { setError('Failed to create API key'); }
    finally { setCreatingKey(false); }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Revoke this API key? Any services using it will lose access immediately.')) return;
    try {
      const r = await fetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE', headers: authHeaders() });
      if (r.ok) { fetchApiKeys(); setSuccess('API key revoked'); }
      else setError('Failed to revoke API key');
    } catch { setError('Failed to revoke API key'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
  };

  const productName = (id: string) => products.find(p => p.id === id)?.name || id.slice(0, 8);

  if (loading) return <div className="page-container"><PageHeader title="Integrations" /><div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div></div>;

  const currentLists = newBoardId ? (boardLists[newBoardId] || []) : [];

  const githubSnippet = `name: CRA Compliance Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  compliance-gate:
    name: CRA Compliance Check
    runs-on: ubuntu-latest
    steps:
      - name: Check CRA compliance status
        env:
          CRANIS2_API_KEY: \${{ secrets.CRANIS2_API_KEY }}
          CRANIS2_PRODUCT_ID: \${{ secrets.CRANIS2_PRODUCT_ID }}
          CRANIS2_THRESHOLD: "high"
        run: |
          RESPONSE=$(curl -sf \\
            -H "X-API-Key: \${CRANIS2_API_KEY}" \\
            "\${CRANIS2_URL:-https://dev.cranis2.dev}/api/v1/products/\${CRANIS2_PRODUCT_ID}/compliance-status?threshold=\${CRANIS2_THRESHOLD}")

          PASS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['pass'])")

          if [ "$PASS" != "True" ]; then
            echo "::error::CRA compliance gate failed"
            exit 1
          fi
          echo "CRA compliance gate passed"`;

  const gitlabSnippet = `cra-compliance-gate:
  stage: compliance
  image: alpine:latest
  before_script:
    - apk add --no-cache curl python3
  script:
    - |
      RESPONSE=$(curl -sf \\
        -H "X-API-Key: \${CRANIS2_API_KEY}" \\
        "\${CRANIS2_URL:-https://dev.cranis2.dev}/api/v1/products/\${CRANIS2_PRODUCT_ID}/compliance-status?threshold=\${CRANIS2_THRESHOLD:-high}")

      PASS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['pass']).lower())")

      if [ "$PASS" != "true" ]; then
        echo "FAIL – compliance gaps found above threshold"
        exit 1
      fi
      echo "PASS – CRA compliance gate passed"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`;

  const bashSnippet = `#!/usr/bin/env bash
# Set these environment variables:
#   CRANIS2_API_KEY      – Your API key
#   CRANIS2_PRODUCT_ID   – Product UUID
#   CRANIS2_THRESHOLD    – "critical", "high" (default), "medium", or "any"

set -euo pipefail
BASE_URL="\${CRANIS2_URL:-https://dev.cranis2.dev}"

RESPONSE=$(curl -sf \\
  -H "X-API-Key: \${CRANIS2_API_KEY}" \\
  "\${BASE_URL}/api/v1/products/\${CRANIS2_PRODUCT_ID}/compliance-status?threshold=\${CRANIS2_THRESHOLD:-high}")

PASS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['pass']).lower())")

if [ "$PASS" = "true" ]; then
  echo "CRA compliance gate: PASS"
  exit 0
else
  echo "CRA compliance gate: FAIL"
  exit 1
fi`;

  return (
    <div className="page-container">
      <PageHeader title="Integrations" />

      {error && <div className="int-banner int-banner-error"><AlertTriangle size={14} /> {error} <button onClick={() => setError('')}><X size={14} /></button></div>}
      {success && <div className="int-banner int-banner-success"><Check size={14} /> {success} <button onClick={() => setSuccess('')}><X size={14} /></button></div>}

      {/* API Keys Card */}
      <div className="int-card">
        <div className="int-card-header">
          <div className="int-card-title">
            <Key size={18} />
            <span>API Keys</span>
            {isPro && <span className="int-badge int-badge-muted">{apiKeys.filter(k => !k.revoked_at).length} active</span>}
            {!isPro && <span className="int-badge int-badge-muted">Pro</span>}
          </div>
          {isPro && !showAddKey && (
            <button className="int-btn-ghost" onClick={() => setShowAddKey(true)}>
              <Plus size={14} /> New Key
            </button>
          )}
        </div>

        <p className="int-desc">
          API keys authenticate external services against the CRANIS2 public API (v1). Use them for CI/CD gates, MCP servers, and custom integrations.
        </p>

        {!isPro && (
          <div className="ai-upgrade-banner">
            <Info size={14} />
            <span>Public API &amp; API keys require the <strong>Pro</strong> plan. <a href="/billing"><Sparkles size={12} style={{ verticalAlign: 'middle' }} /> Upgrade now</a></span>
          </div>
        )}

        {isPro && revealedKey && (
          <div className="int-banner int-banner-success" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            <span>{revealedKey}</span>
            <button onClick={() => copyToClipboard(revealedKey)} title="Copy"><Copy size={14} /></button>
            <button onClick={() => setRevealedKey(null)} title="Dismiss"><X size={14} /></button>
          </div>
        )}

        {isPro && showAddKey && (
          <div className="int-add-form" style={{ marginBottom: '1rem' }}>
            <div className="int-field">
              <label>Key Name</label>
              <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. CI/CD Pipeline, MCP Server" />
            </div>
            <div className="int-add-form-actions">
              <button className="int-btn-ghost" onClick={() => { setShowAddKey(false); setNewKeyName(''); }}>Cancel</button>
              <button className="int-btn-primary" onClick={handleCreateApiKey} disabled={creatingKey || !newKeyName.trim()}>
                {creatingKey ? <><Loader2 size={14} className="spin" /> Creating...</> : 'Create Key'}
              </button>
            </div>
          </div>
        )}

        {isPro && apiKeys.length === 0 && !showAddKey && (
          <p className="int-empty">No API keys yet. Create one to start using the public API.</p>
        )}

        {isPro && apiKeys.map(k => (
          <div key={k.id} className="int-product-board" style={{ opacity: k.revoked_at ? 0.5 : 1 }}>
            <div className="int-product-board-header">
              <span className="int-product-name">{k.name}</span>
              <code style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{k.key_prefix}...</code>
              <span className={`int-badge ${k.revoked_at ? 'int-badge-muted' : 'int-badge-green'}`} style={{ marginLeft: '0.5rem' }}>
                {k.revoked_at ? 'Revoked' : 'Active'}
              </span>
              <span className="int-board-name" style={{ flex: 1, textAlign: 'right' }}>
                {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
              </span>
              {!k.revoked_at && (
                <button className="int-btn-icon" onClick={() => handleRevokeApiKey(k.id)} title="Revoke">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CI/CD Compliance Gate Card */}
      <div className="int-card">
        <div className="int-card-header">
          <div className="int-card-title">
            <Terminal size={18} />
            <span>CI/CD Compliance Gate</span>
            {!isPro && <span className="int-badge int-badge-muted">Pro</span>}
          </div>
          {isPro && (
            <button className="int-btn-ghost" onClick={() => setCicdExpanded(!cicdExpanded)}>
              {cicdExpanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Setup Guide</>}
            </button>
          )}
        </div>

        <p className="int-desc">
          Block releases that don't meet CRA compliance requirements. Add a compliance gate step to your CI/CD pipeline. It calls the CRANIS2 API and fails the build if unresolved gaps exceed your threshold.
        </p>

        {!isPro && (
          <div className="ai-upgrade-banner">
            <Info size={14} />
            <span>CI/CD compliance gate requires the <strong>Pro</strong> plan. <a href="/billing"><Sparkles size={12} style={{ verticalAlign: 'middle' }} /> Upgrade now</a></span>
          </div>
        )}

        {isPro && cicdExpanded && (
          <div className="int-connected">
            <div className="int-section">
              <h3>Prerequisites</h3>
              <ol className="int-cicd-prereqs">
                <li>Create an <strong>API key</strong> above (if you haven't already)</li>
                <li>Find your <strong>Product ID</strong> from the product URL: <code>/products/<strong>{'<product-id>'}</strong></code></li>
                <li>Add both as secrets/variables in your CI/CD platform</li>
              </ol>
            </div>

            <div className="int-section">
              <h3>Configuration</h3>
              <div className="int-cicd-tabs">
                <button className={`int-cicd-tab ${cicdTab === 'github' ? 'active' : ''}`} onClick={() => setCicdTab('github')}>GitHub Actions</button>
                <button className={`int-cicd-tab ${cicdTab === 'gitlab' ? 'active' : ''}`} onClick={() => setCicdTab('gitlab')}>GitLab CI</button>
                <button className={`int-cicd-tab ${cicdTab === 'bash' ? 'active' : ''}`} onClick={() => setCicdTab('bash')}>Bash (Any CI)</button>
              </div>

              {cicdTab === 'github' && (
                <div className="int-cicd-snippet">
                  <div className="int-cicd-snippet-header">
                    <span>Add to <code>.github/workflows/compliance.yml</code></span>
                    <button className="int-btn-ghost" onClick={() => copyToClipboard(githubSnippet)} title="Copy to clipboard"><Copy size={14} /> Copy</button>
                  </div>
                  <pre className="int-cicd-code">{githubSnippet}</pre>
                  <p className="int-hint">
                    Add <code>CRANIS2_API_KEY</code> and <code>CRANIS2_PRODUCT_ID</code> as repository secrets in Settings &gt; Secrets and variables &gt; Actions.
                  </p>
                </div>
              )}

              {cicdTab === 'gitlab' && (
                <div className="int-cicd-snippet">
                  <div className="int-cicd-snippet-header">
                    <span>Add to <code>.gitlab-ci.yml</code></span>
                    <button className="int-btn-ghost" onClick={() => copyToClipboard(gitlabSnippet)} title="Copy to clipboard"><Copy size={14} /> Copy</button>
                  </div>
                  <pre className="int-cicd-code">{gitlabSnippet}</pre>
                  <p className="int-hint">
                    Add <code>CRANIS2_API_KEY</code> and <code>CRANIS2_PRODUCT_ID</code> as CI/CD variables in Settings &gt; CI/CD &gt; Variables.
                  </p>
                </div>
              )}

              {cicdTab === 'bash' && (
                <div className="int-cicd-snippet">
                  <div className="int-cicd-snippet-header">
                    <span>Add to any CI pipeline</span>
                    <button className="int-btn-ghost" onClick={() => copyToClipboard(bashSnippet)} title="Copy to clipboard"><Copy size={14} /> Copy</button>
                  </div>
                  <pre className="int-cicd-code">{bashSnippet}</pre>
                  <p className="int-hint">
                    Works with Jenkins, CircleCI, Bitbucket Pipelines, or any system that runs shell commands. Requires <code>curl</code> and <code>python3</code> (or <code>jq</code>).
                  </p>
                </div>
              )}
            </div>

            <div className="int-section">
              <h3>Threshold Options</h3>
              <table className="int-cicd-table">
                <thead>
                  <tr><th>Value</th><th>Blocks on</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>critical</code></td><td>Only critical gaps</td></tr>
                  <tr><td><code>high</code></td><td>Critical + high gaps (default)</td></tr>
                  <tr><td><code>medium</code></td><td>Critical + high + medium gaps</td></tr>
                  <tr><td><code>any</code></td><td>Any gap at any severity</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* IDE Compliance Assistant Card */}
      <IdeAssistantCard
        isPro={isPro}
        ideTab={ideTab}
        setIdeTab={setIdeTab}
        ideExpanded={ideExpanded}
        setIdeExpanded={setIdeExpanded}
        ideKeyId={ideKeyId}
        setIdeKeyId={setIdeKeyId}
        apiKeys={apiKeys}
        copyToClipboard={copyToClipboard}
      />

      {/* GRC / OSCAL Bridge Card */}
      <div className="int-card">
        <div className="int-card-header">
          <div className="int-card-title">
            <Share2 size={18} />
            <span>GRC / OSCAL Bridge</span>
            {!isPro && <span className="int-badge int-badge-muted">Pro</span>}
            {isPro && <span className="int-badge int-badge-green">Ready</span>}
          </div>
          {isPro && (
            <button className="int-btn-ghost" onClick={() => setGrcExpanded(!grcExpanded)}>
              {grcExpanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Setup Guide</>}
            </button>
          )}
        </div>

        <p className="int-desc">
          Export CRA compliance data in OSCAL 1.1.2 (NIST standard) format. Any OSCAL-compatible GRC tool — ServiceNow, Vanta, Drata, OneTrust — can pull assessment results, obligation statuses, and product metadata via your authenticated API.
        </p>

        {!isPro && (
          <div className="ai-upgrade-banner">
            <Info size={14} />
            <span>OSCAL export requires the <strong>Pro</strong> plan. <a href="/billing"><Sparkles size={12} style={{ verticalAlign: 'middle' }} /> Upgrade now</a></span>
          </div>
        )}

        {isPro && grcExpanded && (
          <>
            <div className="int-section">
              <h3>OSCAL Endpoints</h3>
              <p className="int-hint">All endpoints require an API key with <code>read:compliance</code> scope. Pass it via the <code>X-API-Key</code> header.</p>
              <table className="int-cicd-table">
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>GET /api/v1/oscal/catalog</code></td>
                    <td>19 CRA obligations as OSCAL controls, grouped by article</td>
                  </tr>
                  <tr>
                    <td><code>GET /api/v1/products/:id/oscal/profile</code></td>
                    <td>Which controls apply based on product CRA category</td>
                  </tr>
                  <tr>
                    <td><code>GET /api/v1/products/:id/oscal/assessment-results</code></td>
                    <td>Obligation findings (satisfied/not-satisfied), vulnerability posture</td>
                  </tr>
                  <tr>
                    <td><code>GET /api/v1/products/:id/oscal/component-definition</code></td>
                    <td>Product metadata, SBOM summary, dependency inventory</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="int-section">
              <h3>Quick Test</h3>
              <p className="int-hint">Replace <code>YOUR_API_KEY</code> with an active key from the API Keys section above.</p>
              <pre className="int-cicd-code">{`curl -s -H "X-API-Key: YOUR_API_KEY" \\
  ${window.location.origin}/api/v1/oscal/catalog | python3 -m json.tool`}</pre>
            </div>

            <div className="int-section">
              <h3>GRC Tool Setup</h3>
              <div className="int-ide-workflow">
                <div className="int-ide-workflow-step">
                  <div className="int-ide-workflow-num">1</div>
                  <div>
                    <strong>Create an API key</strong>
                    <p>In the API Keys card above, create a key. It will have <code>read:compliance</code> scope by default.</p>
                  </div>
                </div>
                <div className="int-ide-workflow-step">
                  <div className="int-ide-workflow-num">2</div>
                  <div>
                    <strong>Configure your GRC tool</strong>
                    <p>Set up a scheduled HTTP pull (e.g. daily) from your GRC tool to the assessment-results endpoint. Use the <code>X-API-Key</code> header for authentication.</p>
                  </div>
                </div>
                <div className="int-ide-workflow-step">
                  <div className="int-ide-workflow-num">3</div>
                  <div>
                    <strong>Map OSCAL controls to your framework</strong>
                    <p>Each control ID follows the pattern <code>cra-art-13-6</code>. Map these to your GRC tool's control framework to track CRA compliance alongside other standards.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Trello Card */}
      <div className="int-card">
        <div className="int-card-header">
          <div className="int-card-title">
            <Plug size={18} />
            <span>Trello</span>
            {connected && (
              <span className={`int-badge ${enabled ? 'int-badge-green' : 'int-badge-muted'}`}>
                {enabled ? 'Active' : 'Paused'}
              </span>
            )}
          </div>
          {connected && (
            <div className="int-card-actions">
              <button className="int-btn-ghost" onClick={handleToggleEnabled}>
                {enabled ? 'Pause' : 'Resume'}
              </button>
              <button className="int-btn-danger" onClick={handleDisconnect}>
                <Trash2 size={14} /> Disconnect
              </button>
            </div>
          )}
        </div>

        <p className="int-desc">
          Auto-create Trello cards for compliance events: vulnerability findings, obligation changes, CRA deadlines, and compliance stalls. One board per product.
        </p>

        {!connected ? (
          <div className="int-connect-form">
            <p className="int-hint">
              Get your API key and token from <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener noreferrer">trello.com/power-ups/admin</a>. Generate a token with read/write access to your boards.
            </p>
            <div className="int-field">
              <label>API Key</label>
              <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Your Trello API key" />
            </div>
            <div className="int-field">
              <label>API Token</label>
              <input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="Your Trello API token" />
            </div>
            <button className="int-btn-primary" onClick={handleConnect} disabled={saving || !apiKey || !apiToken}>
              {saving ? <><Loader2 size={14} className="spin" /> Connecting...</> : 'Connect Trello'}
            </button>
          </div>
        ) : (
          <div className="int-connected">
            <div className="int-stats">
              <div className="int-stat"><span className="int-stat-value">{cardsCreated}</span><span className="int-stat-label">Cards created</span></div>
              <div className="int-stat"><span className="int-stat-value">{productBoards.length}</span><span className="int-stat-label">Products mapped</span></div>
              <div className="int-stat"><span className="int-stat-value">{maskedToken}</span><span className="int-stat-label">Token</span></div>
            </div>

            {/* Product Board Mappings */}
            <div className="int-section">
              <div className="int-section-header">
                <h3>Product Boards</h3>
                <button className="int-btn-ghost" onClick={() => { setAddingProduct(true); setNewProductId(''); setNewBoardId(''); }}>
                  <Plus size={14} /> Add Product
                </button>
              </div>

              {productBoards.length === 0 && !addingProduct && (
                <p className="int-empty">No products mapped yet. Add a product to start creating Trello cards.</p>
              )}

              {productBoards.map(pb => (
                <div key={pb.productId} className="int-product-board">
                  <div className="int-product-board-header">
                    <span className="int-product-name">{productName(pb.productId)}</span>
                    <span className="int-board-name">{pb.boardName || pb.boardId}</span>
                    <button className="int-btn-icon" onClick={() => handleDeleteProductBoard(pb.productId)} title="Remove">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="int-list-tags">
                    {pb.listVuln && <span className="int-list-tag int-list-tag-red">Vulnerabilities</span>}
                    {pb.listObligations && <span className="int-list-tag int-list-tag-blue">Obligations</span>}
                    {pb.listDeadlines && <span className="int-list-tag int-list-tag-amber">Deadlines</span>}
                    {pb.listGaps && <span className="int-list-tag int-list-tag-purple">Gaps/Stalls</span>}
                  </div>
                </div>
              ))}

              {addingProduct && (
                <div className="int-add-form">
                  <div className="int-field">
                    <label>Product</label>
                    <select value={newProductId} onChange={e => setNewProductId(e.target.value)}>
                      <option value="">Select product...</option>
                      {products.filter(p => !productBoards.some(pb => pb.productId === p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="int-field">
                    <label>Trello Board</label>
                    <select value={newBoardId} onChange={e => { setNewBoardId(e.target.value); if (e.target.value) loadBoardLists(e.target.value); }}>
                      <option value="">Select board...</option>
                      {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {newBoardId && currentLists.length > 0 && (
                    <div className="int-list-mapping">
                      <p className="int-hint">Map each event type to a Trello list. Leave blank to skip that event type.</p>
                      <div className="int-field-row">
                        <div className="int-field">
                          <label>Vulnerabilities list</label>
                          <select value={newListVuln} onChange={e => setNewListVuln(e.target.value)}>
                            <option value="">None</option>
                            {currentLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div className="int-field">
                          <label>Obligations list</label>
                          <select value={newListObligations} onChange={e => setNewListObligations(e.target.value)}>
                            <option value="">None</option>
                            {currentLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="int-field-row">
                        <div className="int-field">
                          <label>Deadlines list</label>
                          <select value={newListDeadlines} onChange={e => setNewListDeadlines(e.target.value)}>
                            <option value="">None</option>
                            {currentLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div className="int-field">
                          <label>Gaps/Stalls list</label>
                          <select value={newListGaps} onChange={e => setNewListGaps(e.target.value)}>
                            <option value="">None</option>
                            {currentLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {newBoardId && currentLists.length === 0 && !creatingLists && (
                    <div className="int-default-lists-panel">
                      <p className="int-hint"><strong>This board has no lists yet.</strong> CRANIS2 needs lists (columns) on your Trello board to file compliance cards into. Click below to create four default lists:</p>
                      <ul className="int-default-lists-desc">
                        <li><strong>CRA Vulnerabilities</strong> – new CVEs and security issues detected in your dependencies</li>
                        <li><strong>CRA Obligations</strong> – CRA obligation status changes requiring attention</li>
                        <li><strong>CRA Deadlines</strong> – approaching CRA compliance deadlines</li>
                        <li><strong>CRA Gaps / Stalls</strong> – compliance gaps or stalled progress on obligations</li>
                      </ul>
                      <button className="int-btn-primary" onClick={handleCreateDefaultLists}>
                        <Plus size={14} /> Create Default Lists on This Board
                      </button>
                    </div>
                  )}

                  {newBoardId && creatingLists && (
                    <p className="int-hint" style={{ color: 'var(--muted)' }}><Loader2 size={14} className="spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem' }} />Creating lists on your Trello board...</p>
                  )}

                  <div className="int-add-form-actions">
                    <button className="int-btn-ghost" onClick={() => setAddingProduct(false)}>Cancel</button>
                    <button className="int-btn-primary" onClick={handleSaveProductBoard} disabled={saving || !newProductId || !newBoardId}>
                      {saving ? 'Saving...' : 'Save Mapping'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Test Card */}
            <div className="int-section">
              <h3>Test Connection</h3>
              <div className="int-test-row">
                <select value={testListId} onChange={e => setTestListId(e.target.value)} className="int-test-select">
                  <option value="">Select a list...</option>
                  {Object.entries(boardLists).flatMap(([boardId, lists]) =>
                    lists.map(l => (
                      <option key={l.id} value={l.id}>
                        {boards.find(b => b.id === boardId)?.name || boardId} / {l.name}
                      </option>
                    ))
                  )}
                </select>
                <button className="int-btn-primary" onClick={handleTestCard} disabled={testing || !testListId}>
                  {testing ? <><Loader2 size={14} className="spin" /> Sending...</> : <><Send size={14} /> Send Test Card</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
