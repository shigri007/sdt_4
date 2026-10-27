/** Builds the text of a CSV report file (UTF-8 with byte-order mark, CRLF line endings). */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const cell = (val: unknown) => {
    let text = String(val ?? '');
    // Stop spreadsheet apps from running typed text as a formula (CSV injection).
    if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const columns = Object.keys(rows[0]);
  const lines = [columns.map(cell).join(','), ...rows.map(row => columns.map(col => cell(row[col])).join(','))];
  // The byte-order mark lets Excel show Chinese names correctly.
  return '﻿' + lines.join('\r\n');
}

/** Downloads a CSV file. A Blob keeps the whole file intact, unlike a data: link, which stops at the first "#". */
export function downloadCsv(rows: Array<Record<string, unknown>>, fileName: string): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
