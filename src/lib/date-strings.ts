// Pure Y-M-D calendar-date string helpers, zero dependencies — safe to import
// from client components. lib/events.ts (server-only, imports db/telegram)
// and lib/calendar-grid.ts (client-safe grid/layout math) both build on
// these so there's exactly one implementation.

export function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDate(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return fmtDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
