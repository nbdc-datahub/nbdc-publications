// RFC-4180 CSV writer. Shared by the browser (filtered / search / selected exports) and by
// scripts/prep.ts (the prebuilt unfiltered export), so all four downloads are byte-consistent.

const NEEDS_QUOTING = /["\r\n,]/;

export function csvField(value: string): string {
  return NEEDS_QUOTING.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const out: string[] = [header.map(csvField).join(',')];
  for (const row of rows) out.push(row.map(csvField).join(','));
  return `${out.join('\n')}\n`;
}
