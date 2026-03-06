import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/PageHeader';
import { Plug, Trash2, Check, AlertTriangle, Plus, X, Send, Loader2 } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
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

export default function IntegrationsPage() {
  usePageMeta({ title: 'Integrations', description: 'Manage external integrations' });

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

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

  // New product board form
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [newBoardId, setNewBoardId] = useState('');
  const [newListVuln, setNewListVuln] = useState('');
  const [newListObligations, setNewListObligations] = useState('');
  const [newListDeadlines, setNewListDeadlines] = useState('');
  const [newListGaps, setNewListGaps] = useState('');

  // Test card
  const [testListId, setTestListId] = useState('');
  const [testing, setTesting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/trello', { headers });
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
      const r = await fetch('/api/products', { headers });
      if (r.ok) {
        const data = await r.json();
        setProducts(data.map((p: any) => ({ id: p.id, name: p.name })));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchBoards = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/trello/boards', { headers });
      if (r.ok) {
        const data = await r.json();
        setBoards(data);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchBoardLists = useCallback(async (boardId: string) => {
    if (boardLists[boardId]) return;
    try {
      const r = await fetch(`/api/integrations/trello/boards/${boardId}/lists`, { headers });
      if (r.ok) {
        const data = await r.json();
        setBoardLists(prev => ({ ...prev, [boardId]: data }));
      }
    } catch { /* ignore */ }
  }, [boardLists]);

  useEffect(() => {
    fetchStatus();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (connected) fetchBoards();
  }, [connected]);

  const handleConnect = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const r = await fetch('/api/integrations/trello', {
        method: 'PUT',
        headers,
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
      await fetch('/api/integrations/trello', { method: 'DELETE', headers });
      setConnected(false);
      setApiKey('');
      setMaskedToken('');
      setProductBoards([]);
      setBoards([]);
      setSuccess('Trello disconnected');
    } catch { setError('Failed to disconnect'); }
  };

  const handleToggleEnabled = async () => {
    try {
      await fetch('/api/integrations/trello/enabled', {
        method: 'PUT', headers,
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
        method: 'PUT', headers,
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
      await fetch(`/api/integrations/trello/product-boards/${productId}`, { method: 'DELETE', headers });
      setProductBoards(prev => prev.filter(b => b.productId !== productId));
      setSuccess('Board mapping removed');
    } catch { setError('Failed to remove'); }
  };

  const handleTestCard = async () => {
    if (!testListId) { setError('Select a list to send the test card to'); return; }
    setTesting(true);
    setError('');
    try {
      const r = await fetch('/api/integrations/trello/test', {
        method: 'POST', headers,
        body: JSON.stringify({ listId: testListId }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Test failed'); return; }
      setSuccess('Test card sent! Check your Trello board.');
    } catch { setError('Test failed'); }
    finally { setTesting(false); }
  };

  const productName = (id: string) => products.find(p => p.id === id)?.name || id.slice(0, 8);

  if (loading) return <div className="page-container"><PageHeader title="Integrations" /><div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div></div>;

  return (
    <div className="page-container">
      <PageHeader title="Integrations" />

      {error && <div className="int-banner int-banner-error"><AlertTriangle size={14} /> {error} <button onClick={() => setError('')}><X size={14} /></button></div>}
      {success && <div className="int-banner int-banner-success"><Check size={14} /> {success} <button onClick={() => setSuccess('')}><X size={14} /></button></div>}

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
                    <select value={newBoardId} onChange={e => { setNewBoardId(e.target.value); if (e.target.value) fetchBoardLists(e.target.value); }}>
                      <option value="">Select board...</option>
                      {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {newBoardId && boardLists[newBoardId] && (
                    <div className="int-list-mapping">
                      <p className="int-hint">Map each event type to a Trello list. Leave blank to skip that event type.</p>
                      <div className="int-field-row">
                        <div className="int-field">
                          <label>Vulnerabilities list</label>
                          <select value={newListVuln} onChange={e => setNewListVuln(e.target.value)}>
                            <option value="">None</option>
                            {boardLists[newBoardId].map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div className="int-field">
                          <label>Obligations list</label>
                          <select value={newListObligations} onChange={e => setNewListObligations(e.target.value)}>
                            <option value="">None</option>
                            {boardLists[newBoardId].map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="int-field-row">
                        <div className="int-field">
                          <label>Deadlines list</label>
                          <select value={newListDeadlines} onChange={e => setNewListDeadlines(e.target.value)}>
                            <option value="">None</option>
                            {boardLists[newBoardId].map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div className="int-field">
                          <label>Gaps/Stalls list</label>
                          <select value={newListGaps} onChange={e => setNewListGaps(e.target.value)}>
                            <option value="">None</option>
                            {boardLists[newBoardId].map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
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
                  {/* Also load lists for mapped boards */}
                  {productBoards.map(pb => {
                    if (!boardLists[pb.boardId]) fetchBoardLists(pb.boardId);
                    return null;
                  })}
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
