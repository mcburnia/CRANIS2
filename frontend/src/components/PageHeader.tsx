/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  timestamp?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, timestamp, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {timestamp && <div className="timestamp">{timestamp}</div>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
