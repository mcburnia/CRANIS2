import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: 'green' | 'amber' | 'blue' | 'red';
  sub?: string;
}

export default function StatCard({ label, value, color = 'blue', sub }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
