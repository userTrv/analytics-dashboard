import { csvCell, toCsv } from './csv';

describe('CSV export', () => {
  it('leaves plain values alone and writes empty cells for missing values', () => {
    expect(csvCell('Europe')).toBe('Europe');
    expect(csvCell(1234.5)).toBe('1234.5');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('Home, kitchen')).toBe('"Home, kitchen"');
    expect(csvCell('The "Pro" model')).toBe('"The ""Pro"" model"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises spreadsheet formula injection in text cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 'b'], [1, null]])).toBe('a,b\r\n1,');
  });
});
