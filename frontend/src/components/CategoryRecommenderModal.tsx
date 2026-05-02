/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * CategoryRecommenderModal
 * Shows CRA category recommendation with deterministic breakdown and AI augmentation
 * Users can accept, override, or dismiss
 */

import { useState } from 'react';
import { Sparkles, Check, X, AlertCircle } from 'lucide-react';
import type { CategoryRecommendationResponse } from '../types/category-recommendation';
import './styles/category-recommender.css';

interface CategoryRecommenderModalProps {
  productId: string;
  productName: string;
  currentCategory?: string;
  onClose: () => void;
  onAccept: (category: string) => void;
}

export default function CategoryRecommenderModal({
  productId,
  productName,
  currentCategory: _currentCategory,
  onClose,
  onAccept,
}: CategoryRecommenderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<CategoryRecommendationResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const getRecommendation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/category-recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('session_token')}`,
        },
        body: JSON.stringify({ attributeValues: {} }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendation');
      }

      const data = await response.json();
      setRecommendation(data);
      setSelectedCategory(data.recommendation.recommendedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'accepted' | 'overridden' | 'dismissed') => {
    if (!recommendation || (action !== 'dismissed' && !selectedCategory)) {
      return;
    }

    setSubmitting(true);
    try {
      const actionUrl = recommendation.actionUrl;
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('session_token')}`,
        },
        body: JSON.stringify({
          action,
          finalCategory: action === 'overridden' ? selectedCategory : recommendation.recommendation.recommendedCategory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record action');
      }

      if (action === 'accepted') {
        onAccept(recommendation.recommendation.recommendedCategory);
      } else if (action === 'overridden') {
        onAccept(selectedCategory || '');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabels: { [key: string]: { name: string; description: string } } = {
    default: { name: 'Default Class', description: 'No additional CRA obligations' },
    important_i: { name: 'Important Class I', description: 'Enhanced security requirements' },
    important_ii: { name: 'Important Class II', description: 'High risk, conformity assessment required' },
    critical: { name: 'Critical Class', description: 'Highest risk, notified body certification' },
  };

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div className="cr-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="cr-modal-header">
          <h2>
            <Sparkles size={20} /> CRA Category Recommender
          </h2>
          <p className="cr-modal-subtitle">{productName}</p>
          <button className="cr-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="cr-modal-body">
          {!recommendation && !loading && !error && (
            <div className="cr-initial-state">
              <p>Get an AI-assisted recommendation based on your product's characteristics.</p>
              <button className="cr-get-recommendation-btn" onClick={getRecommendation}>
                <Sparkles size={16} /> Get Recommendation
              </button>
            </div>
          )}

          {loading && (
            <div className="cr-loading">
              <div className="cr-spinner"></div>
              <p>Analysing your product...</p>
            </div>
          )}

          {error && (
            <div className="cr-error">
              <AlertCircle size={20} />
              <p>{error}</p>
              <button onClick={() => { setError(null); setRecommendation(null); }}>Try Again</button>
            </div>
          )}

          {recommendation && (
            <div className="cr-recommendation">
              {/* Deterministic Breakdown */}
              <section className="cr-section">
                <h3>Risk Assessment Breakdown</h3>
                <div className="cr-score-gauge">
                  <div className="cr-gauge-bar">
                    <div
                      className="cr-gauge-fill"
                      style={{
                        width: `${recommendation.recommendation.totalScore * 100}%`,
                        background: `hsl(${(1 - recommendation.recommendation.totalScore) * 120}, 70%, 50%)`,
                      }}
                    ></div>
                  </div>
                  <p className="cr-score-label">
                    Risk Score: {(recommendation.recommendation.totalScore * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="cr-attributes">
                  {recommendation.recommendation.attributeScores.map((attr: any) => (
                    <div key={attr.attributeKey} className="cr-attribute">
                      <div className="cr-attr-header">
                        <strong>{attr.attributeName}</strong>
                        <span className="cr-attr-score">{(attr.score * 100).toFixed(0)}%</span>
                      </div>
                      <p className="cr-attr-selected">{attr.selectedLabel}</p>
                      <p className="cr-attr-reasoning">{attr.reasoning}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* AI Augmentation */}
              {recommendation.aiAugmentation && (
                <section className="cr-section cr-ai-section">
                  <h3>
                    <Sparkles size={16} /> AI Assessment
                  </h3>
                  <div className="cr-ai-card">
                    <p className="cr-ai-reason">{recommendation.aiAugmentation.explainedReason}</p>
                    <div className="cr-ai-confidence">
                      <span>Confidence:</span>
                      <strong>{(recommendation.aiAugmentation.finalConfidence * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                </section>
              )}

              {/* Recommended Category */}
              <section className="cr-section">
                <h3>Recommended Category</h3>
                <div className={`cr-category-card cr-category-${recommendation.recommendation.recommendedCategory}`}>
                  <h4>{categoryLabels[recommendation.recommendation.recommendedCategory]?.name}</h4>
                  <p>{categoryLabels[recommendation.recommendation.recommendedCategory]?.description}</p>
                </div>
              </section>

              {/* Category Selector (for override) */}
              <section className="cr-section">
                <h3>Category Selection</h3>
                <div className="cr-category-selector">
                  {Object.entries(categoryLabels).map(([key, { name, description }]) => (
                    <label key={key} className={`cr-category-option ${selectedCategory === key ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="category"
                        value={key}
                        checked={selectedCategory === key}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      />
                      <div className="cr-option-content">
                        <strong>{name}</strong>
                        <span>{description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* Disclosure */}
              <p className="cr-disclosure">
                This recommendation uses deterministic rules aligned with CRA Articles 3–4 and probabilistic
                AI assessment for transparency and auditability (ISO 42001). All choices are logged.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {recommendation && (
          <div className="cr-modal-footer">
            <button className="cr-btn-dismiss" onClick={() => handleAction('dismissed')} disabled={submitting}>
              Dismiss
            </button>
            {selectedCategory !== recommendation.recommendation.recommendedCategory && (
              <button
                className="cr-btn-override"
                onClick={() => handleAction('overridden')}
                disabled={submitting || !selectedCategory}
              >
                Override
              </button>
            )}
            <button
              className="cr-btn-accept"
              onClick={() => handleAction('accepted')}
              disabled={submitting}
            >
              <Check size={16} /> Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
