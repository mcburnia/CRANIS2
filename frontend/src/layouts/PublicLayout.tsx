/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Outlet } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import HelpPanel from '../components/HelpPanel';
import { useHelpPanel } from '../context/HelpPanelContext';
import './PublicLayout.css';

export default function PublicLayout() {
  const { isOpen, toggle } = useHelpPanel();

  return (
    <div className="public-layout">
      <div className="public-layout-content">
        <Outlet />
      </div>
      <HelpPanel />
      {!isOpen && (
        <button
          className="help-fab"
          onClick={toggle}
          title="Open user guide"
          aria-label="Open user guide"
        >
          <HelpCircle size={22} />
        </button>
      )}
    </div>
  );
}
