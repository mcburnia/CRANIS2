// Helper: Convert Neo4j DateTime or string to ISO string
export function toISOString(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val.toStandardDate) return val.toStandardDate().toISOString();
  if (val.year) {
    const y = val.year.low ?? val.year;
    const m = val.month.low ?? val.month;
    const d = val.day.low ?? val.day;
    return new Date(y, m - 1, d).toISOString();
  }
  return String(val);
}
