/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect } from 'react';
import {
  Shield, FileText, Package, AlertTriangle, GitBranch,
  Users, Loader2, Activity,
} from 'lucide-react';
import { timeAgo } from './shared';

interface ActivityEntry {
  id: string;
  productId: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const ENTITY_ICONS: Record<string, typeof Shield> = {
  obligation: Shield,
  technical_file_section: FileText,
  product: Package,
  repository: GitBranch,
  stakeholder: Users,
  vulnerability_scan: AlertTriangle,
};

function activityDotClass(entityType: string): string {
  switch (entityType) {
    case 'obligation': return 'pal-dot-purple';
    case 'technical_file_section': return 'pal-dot-amber';
    case 'product':
    case 'stakeholder': return 'pal-dot-blue';
    case 'repository':
    case 'vulnerability_scan': return 'pal-dot-green';
    default: return 'pal-dot-blue';
  }
}

function formatDiffValue(val: any): string {
  if (val === null || val === undefined) return '–';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export default function ActivityTab({ productId }: { productId: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const limit = 50;
  const token = localStorage.getItem('session_token');

  const fetchActivities = async (newOffset: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(newOffset) });
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity_type', entityFilter);
      const res = await fetch(`/api/products/${productId}/activity?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (append) {
        setActivities(prev => [...prev, ...data.activities]);
      } else {
        setActivities(data.activities);
      }
      setTotal(data.total);
      setOffset(newOffset);
      if (data.filters) {
        setAvailableActions(data.filters.actions || []);
        setAvailableEntities(data.filters.entityTypes || []);
      }
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchActivities(0, false); }, [productId, actionFilter, entityFilter]);

  const handleLoadMore = () => {
    fetchActivities(offset + limit, true);
  };

  const formatActionLabel = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const formatEntityLabel = (et: string) =>
    et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (loading) {
    return (
      <div className="pd-placeholder">
        <Loader2 size={24} className="spin" />
        <h3>Loading activity…</h3>
      </div>
    );
  }

  return (
    <div className="pal-container">
      {/* Filters */}
      {(availableActions.length > 0 || availableEntities.length > 0) && (
        <div className="pal-filters">
          {availableActions.length > 0 && (
            <select
              className="pal-filter-select"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">All actions</option>
              {availableActions.map(a => (
                <option key={a} value={a}>{formatActionLabel(a)}</option>
              ))}
            </select>
          )}
          {availableEntities.length > 0 && (
            <select
              className="pal-filter-select"
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
            >
              <option value="">All types</option>
              {availableEntities.map(et => (
                <option key={et} value={et}>{formatEntityLabel(et)}</option>
              ))}
            </select>
          )}
          <span className="pal-total">{total} event{total !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="pd-placeholder">
          <Activity size={32} />
          <h3>No activity yet</h3>
          <p>Changes to obligations, technical file sections, scans, and other product data will appear here as an audit trail.</p>
        </div>
      ) : (
        <div className="pal-timeline">
          {activities.map(entry => {
            const Icon = ENTITY_ICONS[entry.entityType] || Activity;
            return (
              <div key={entry.id} className="pal-entry">
                <div className={`pal-dot ${activityDotClass(entry.entityType)}`}>
                  <Icon size={12} />
                </div>
                <div className="pal-entry-content">
                  <div className="pal-entry-header">
                    <span className="pal-summary">{entry.summary}</span>
                    <span className="pal-time">{timeAgo(entry.createdAt)}</span>
                  </div>
                  {entry.userEmail && (
                    <span className="pal-user">{entry.userEmail}</span>
                  )}
                  {(entry.oldValues || entry.newValues) && (
                    <div className="pal-diff">
                      {Object.keys({ ...entry.oldValues, ...entry.newValues }).map(key => {
                        const oldVal = entry.oldValues?.[key];
                        const newVal = entry.newValues?.[key];
                        if (oldVal === newVal) return null;
                        return (
                          <span key={key} className="pal-diff-item">
                            <span className="pal-diff-key">{key}:</span>
                            {oldVal !== undefined && (
                              <span className="pal-diff-old">{formatDiffValue(oldVal)}</span>
                            )}
                            {oldVal !== undefined && newVal !== undefined && (
                              <span className="pal-diff-arrow">→</span>
                            )}
                            {newVal !== undefined && (
                              <span className="pal-diff-new">{formatDiffValue(newVal)}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {activities.length < total && (
        <div className="pal-load-more">
          <button className="pd-sync-btn" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? <><Loader2 size={14} className="spin" /> Loading…</> : <>Load more ({total - activities.length} remaining)</>}
          </button>
        </div>
      )}
    </div>
  );
}
