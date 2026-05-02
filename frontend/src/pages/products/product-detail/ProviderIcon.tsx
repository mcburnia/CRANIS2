/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Github } from 'lucide-react';
import CodebergIcon from './CodebergIcon';
import GitLabIcon from './GitLabIcon';
import ForgeIcon from './ForgeIcon';

export default function ProviderIcon({ provider, size = 16 }: { provider: string; size?: number }) {
  switch (provider) {
    case 'codeberg': return <CodebergIcon size={size} />;
    case 'gitlab': return <GitLabIcon size={size} />;
    case 'gitea':
    case 'forgejo': return <ForgeIcon size={size} />;
    default: return <Github size={size} />;
  }
}
