/** All money is whole kobo (bigint). ₦1 = 100 kobo. */
export const SAVINGS_PER_BREAD_KOBO = 1_000n; // ₦10 per bread

const BPS = 10_000n;
const FEE_BPS = 150n; // 1.5%
const FLAT_KOBO = 10_000n; // ₦100
const FLAT_WAIVED_BELOW_KOBO = 250_000n; // flat fee waived for payments under ₦2,500
const FEE_CAP_KOBO = 200_000n; // ₦2,000

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/**
 * Paystack fee that the customer pays on top of the order, so Mr Nibbles receives the full subtotal.
 * Follows Paystack's own "pass fees to customers" formula for Nigeria:
 *   1.5% + ₦100, ₦100 waived under ₦2,500, fee capped at ₦2,000.
 * Confirm against paystack.com/pricing before launch, since Paystack can change its rates.
 */
export function paystackFeeKobo(netKobo: bigint): bigint {
  if (netKobo <= 0n) return 0n;
  const grossWithoutFlat = ceilDiv(netKobo * BPS, BPS - FEE_BPS) + 1n;
  if (grossWithoutFlat < FLAT_WAIVED_BELOW_KOBO) return grossWithoutFlat - netKobo;
  const grossWithFlat = ceilDiv((netKobo + FLAT_KOBO) * BPS, BPS - FEE_BPS) + 1n;
  const fee = grossWithFlat - netKobo;
  return fee > FEE_CAP_KOBO ? FEE_CAP_KOBO : fee;
}
