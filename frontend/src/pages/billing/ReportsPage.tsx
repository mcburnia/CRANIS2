import { FileBarChart, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Billing Reports" />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          <FileBarChart size={28} color="var(--accent)" />
        </div>
        <h2 style={{ color: 'var(--text)', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          No billing reports yet
        </h2>
        <p style={{ color: 'var(--muted)', maxWidth: 420, lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          Billing reports and invoices will appear here once your subscription generates its first billing cycle.
        </p>
        <Link
          to="/billing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          View subscription details <ArrowRight size={14} />
        </Link>
      </div>
    </>
  );
}
