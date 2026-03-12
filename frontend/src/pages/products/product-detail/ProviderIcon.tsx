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
