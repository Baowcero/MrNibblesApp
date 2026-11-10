import { createHmac } from 'node:crypto';
import { isValidSignature } from './paystack.client.js';

describe('isValidSignature', () => {
  const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'MN-1' } }));

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit';
  });

  it('accepts the signature Paystack would send', () => {
    const signature = createHmac('sha512', 'sk_test_unit').update(body).digest('hex');
    expect(isValidSignature(body, signature)).toBe(true);
  });

  it('rejects a wrong, empty or missing signature, or a changed body', () => {
    const signature = createHmac('sha512', 'sk_test_unit').update(body).digest('hex');
    expect(isValidSignature(body, 'abc')).toBe(false);
    expect(isValidSignature(body, undefined)).toBe(false);
    expect(isValidSignature(undefined, signature)).toBe(false);
    expect(isValidSignature(Buffer.from('{"event":"charge.success","data":{"reference":"MN-2"}}'), signature)).toBe(false);
  });
});
