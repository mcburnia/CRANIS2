/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import './NotFoundPage.css';

export default function NotFoundPage() {
  usePageMeta({ title: 'Page Not Found', noindex: true });
  const location = useLocation();

  return (
    <div className="nf-container">
      <div className="nf-card">
        <div className="nf-icon">
          <AlertTriangle size={48} />
        </div>
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-message">
          The page <code className="nf-path">{location.pathname}</code> doesn't exist or has been moved.
        </p>
        <div className="nf-actions">
          <Link to="/dashboard" className="nf-btn nf-btn-primary">
            <Home size={16} />
            Go to Dashboard
          </Link>
          <button onClick={() => window.history.back()} className="nf-btn nf-btn-secondary">
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
