import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('accepts the common Nigerian formats', () => {
    expect(normalizePhone('08012345678')).toBe('+2348012345678');
    expect(normalizePhone('2348012345678')).toBe('+2348012345678');
    expect(normalizePhone('+234 801 234 5678')).toBe('+2348012345678');
    expect(normalizePhone('0701-234-5678')).toBe('+2347012345678');
  });

  it('rejects numbers that are not valid mobile numbers', () => {
    expect(normalizePhone('0123456789')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+2341234567890')).toBeNull();
    expect(normalizePhone('abcdefghijk')).toBeNull();
  });
});
