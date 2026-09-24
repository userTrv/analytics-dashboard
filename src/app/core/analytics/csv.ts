export type CsvCell = string | number | boolean | null | undefined;

const NEEDS_QUOTES = /[",\r\n]/;
/** Spreadsheet apps execute cells starting with these characters as formulas. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * RFC 4180 cell escaping, plus a guard against CSV formula injection: text cells that
 * start with = + - @ are prefixed with an apostrophe. Numbers are written as-is.
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Prepends a UTF-8 BOM so Excel detects the encoding of non-ASCII labels. */
export function csvBlob(csv: string): Blob {
  return new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
}
