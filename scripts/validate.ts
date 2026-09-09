// Schema gate for data/portfolio_<study>.csv (spec §3.1).
//
// The failure mode this prevents: a future export drops or renames a column and the site
// silently publishes half-empty rows. Every violation below aborts the build by name, so the
// previously published site stays up instead.
//
// Two multi-study properties live here:
//
//   1. Every study is checked against the SAME 46-column header. That single check is also
//      what guarantees a shared domain taxonomy — a study whose domains diverged would fail
//      here rather than silently misaligning the domain bitmask.
//   2. A study file with a header and zero rows is VALID. A study awaiting its first
//      publications is a supported state (spec §1.1); only an entirely empty portfolio is an
//      error, and prep.ts enforces that across studies.

import { COLUMNS, DOMAINS, MEMBER_COLUMN, URL_COLUMN, YEAR_COLUMN } from '../web/lib/data';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const YEAR_RE = /^\d{4}$/;

export function validateRecords(
  study: string,
  header: readonly string[],
  rows: readonly (readonly string[])[],
): Record<string, string>[] {
  const where = `data/portfolio_${study}.csv`;

  if (header.length !== COLUMNS.length) {
    const missing = COLUMNS.filter((c) => !header.includes(c));
    const unexpected = header.filter((c) => !(COLUMNS as readonly string[]).includes(c));
    throw new ValidationError(
      `${where}: expected ${COLUMNS.length} columns, found ${header.length}.` +
        (missing.length ? ` Missing: ${missing.join(', ')}.` : '') +
        (unexpected.length ? ` Unexpected: ${unexpected.join(', ')}.` : ''),
    );
  }

  for (const [i, expected] of COLUMNS.entries()) {
    if (header[i] !== expected) {
      throw new ValidationError(
        `${where}: column ${i + 1} must be "${expected}", found "${header[i]}". ` +
          'Column names and order are part of the data contract, and are identical for ' +
          'every study — no column name is study-specific (spec §3.1).',
      );
    }
  }

  const records: Record<string, string>[] = [];
  const seenUrls = new Map<string, number>();

  for (const [r, row] of rows.entries()) {
    const line = r + 2; // 1-based, and the header is record 1
    if (row.length !== COLUMNS.length) {
      throw new ValidationError(
        `${where} record ${line} has ${row.length} fields, expected ${COLUMNS.length}.`,
      );
    }

    const record: Record<string, string> = {};
    for (const [c, name] of COLUMNS.entries()) record[name] = row[c] as string;

    const year = record[YEAR_COLUMN] as string;
    if (!YEAR_RE.test(year)) {
      throw new ValidationError(
        `${where} record ${line}: ${YEAR_COLUMN} must be a 4-digit year, got "${year}".`,
      );
    }

    const member = record[MEMBER_COLUMN] as string;
    if (member !== 'yes' && member !== 'no') {
      throw new ValidationError(
        `${where} record ${line}: ${MEMBER_COLUMN} must be "yes" or "no", got "${member}".`,
      );
    }

    for (const domain of DOMAINS) {
      const flag = record[domain] as string;
      if (flag !== '0' && flag !== '1') {
        throw new ValidationError(
          `${where} record ${line}: domain column "${domain}" must be 0 or 1, got "${flag}".`,
        );
      }
    }

    const url = record[URL_COLUMN] as string;
    const firstSeen = seenUrls.get(url);
    if (firstSeen !== undefined) {
      throw new ValidationError(
        `${where} record ${line}: duplicate ${URL_COLUMN} "${url}" (first seen at record ${firstSeen}). ` +
          'URL must be unique within a study. Across studies it may repeat — prep.ts warns ' +
          'about that instead, because `<study>:<URL>` keeps both rows addressable (spec §3.5).',
      );
    }
    seenUrls.set(url, line);

    records.push(record);
  }

  return records;
}
