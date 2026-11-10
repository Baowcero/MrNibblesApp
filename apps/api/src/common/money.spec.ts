import { paystackFeeKobo } from './money.js';

describe('paystackFeeKobo', () => {
  it('charges nothing for an empty amount', () => {
    expect(paystackFeeKobo(0n)).toBe(0n);
  });

  it('waives the flat ₦100 on small orders (₦1,000 order costs ₦15.24)', () => {
    expect(paystackFeeKobo(100_000n)).toBe(1_524n);
  });

  it('adds the flat ₦100 on larger orders (₦5,000 order costs ₦177.68)', () => {
    expect(paystackFeeKobo(500_000n)).toBe(17_768n);
  });

  it('never charges more than ₦2,000', () => {
    expect(paystackFeeKobo(50_000_000n)).toBe(200_000n);
  });

  it('always lets the business receive at least the full subtotal after Paystack takes 1.5%', () => {
    for (const net of [100_000n, 250_000n, 800_000n, 3_000_000n]) {
      const gross = net + paystackFeeKobo(net);
      const flat = gross < 250_000n ? 0n : 10_000n;
      const paystackTakes = (gross * 150n) / 10_000n + flat;
      expect(gross - paystackTakes).toBeGreaterThanOrEqual(net - 2n);
    }
  });
});
