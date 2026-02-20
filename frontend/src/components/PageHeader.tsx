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
