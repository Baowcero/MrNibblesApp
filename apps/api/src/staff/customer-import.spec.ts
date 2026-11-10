import { extractNames, nameKey, parseCsv } from './customer-import.js';

describe('customer CSV', () => {
  it('reads quotes, commas and Windows line endings', () => {
    const rows = parseCsv('﻿business_name,area\r\n"Mama T, Bakery",Taki\r\n"Say ""Hi"" Shop",Akala\r\n');
    expect(rows).toEqual([['business_name', 'area'], ['Mama T, Bakery', 'Taki'], ['Say "Hi" Shop', 'Akala']]);
  });

  it('uses the named column, or the first column when there is no header', () => {
    expect(extractNames(parseCsv('area,Business Name\nTaki,Mama T\nAkala,Joy Store')).map((x) => x.name)).toEqual(['Mama T', 'Joy Store']);
    expect(extractNames(parseCsv('Mama T\nJoy Store')).map((x) => x.name)).toEqual(['Mama T', 'Joy Store']);
  });

  it('reports row numbers as they appear in the file', () => {
    expect(extractNames(parseCsv('name\nA\nB'))[1]).toEqual({ row: 3, name: 'B' });
  });

  it('matches names ignoring case and extra spaces', () => {
    expect(nameKey('  Mama   T ')).toBe(nameKey('mama t'));
  });
});
