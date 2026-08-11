// RFC-4180 CSV parser (build-time only — the browser never parses CSV).
//
// This MUST be a real parser, not a line splitter: in the 2026-07-06 snapshot 57 abstracts
// contain embedded newlines and 70 fields contain embedded quotes, so 1,848 records occupy
// 2,037 physical lines (spec §3.1). Splitting on '\n' silently shreds the data.

export interface ParsedCsv {
  header: string[];
  rows: string[][];
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i] as string;

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === ',') {
      endField();
      i += 1;
    } else if (c === '\r') {
      endRow();
      i += text[i + 1] === '\n' ? 2 : 1;
    } else if (c === '\n') {
      endRow();
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }

  // Flush a final record that had no trailing newline.
  if (field !== '' || row.length > 0) endRow();

  const header = rows.shift() ?? [];
  return { header, rows };
}
