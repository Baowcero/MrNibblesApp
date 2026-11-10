/**
 * Normalises a Nigerian mobile number to +234XXXXXXXXXX.
 * Accepts 0801..., 234801..., +234801... with spaces or dashes. Returns null if invalid.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  let national: string;
  if (/^\+234\d{10}$/.test(digits)) national = digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else return null;
  return /^[789]\d{9}$/.test(national) ? `+234${national}` : null;
}
