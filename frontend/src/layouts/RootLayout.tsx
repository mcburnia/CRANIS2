/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { HelpPanelProvider } from '../context/HelpPanelContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <HelpPanelProvider>
        <Outlet />
      </HelpPanelProvider>
    </AuthProvider>
  );
}
