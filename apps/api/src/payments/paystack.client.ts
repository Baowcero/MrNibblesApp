import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error.js';

const BASE_URL = 'https://api.paystack.co';

export function paystackSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || key.includes('xxx')) {
    throw new AppError(503, 'payments_unavailable', 'Online payment is not available right now. Please try again later.');
  }
  return key;
}

/** Paystack signs every webhook: HMAC SHA-512 of the raw request body with the secret key. */
export function isValidSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!rawBody || !signature) return false;
  const expected = createHmac('sha512', paystackSecret()).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type PaystackInitData = { authorization_url: string; access_code: string; reference: string };
export type PaystackVerifyData = {
  status: string; // 'success' | 'failed' | 'abandoned' | ...
  reference: string;
  amount: number; // kobo
  currency: string;
  metadata?: { payment_id?: string; order_id?: string } | null;
};

@Injectable()
export class PaystackClient {
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${paystackSecret()}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError(502, 'paystack_unreachable', 'Could not reach Paystack. Please try again.');
    }
    const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !body?.status) {
      throw new AppError(502, 'paystack_error', body?.message ?? 'Paystack could not complete the request');
    }
    return body.data as T;
  }

  initialize(input: {
    email: string;
    amountKobo: number;
    reference: string;
    callbackUrl?: string;
    metadata: Record<string, string>;
  }) {
    return this.call<PaystackInitData>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: 'NGN',
        reference: input.reference,
        channels: ['card', 'bank_transfer'],
        callback_url: input.callbackUrl || undefined,
        metadata: input.metadata,
      }),
    });
  }

  verify(reference: string) {
    return this.call<PaystackVerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);
  }
}
