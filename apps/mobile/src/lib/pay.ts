import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api } from './api';

/** Opens Paystack, then asks the server whether the payment went through. The server checks with Paystack, never the phone. */
export async function payWithPaystack(orderId: string): Promise<boolean> {
  // Paystack sends the customer back to the app through this link (works in Expo Go and in the built app).
  const returnUrl = Linking.createURL('payment-return');
  const init = await api<{ authorization_url: string }>(`orders/${orderId}/pay`, { method: 'POST', body: { return_url: returnUrl } });
  // An auth session closes by itself when the page redirects to returnUrl; the customer can still close it manually.
  await WebBrowser.openAuthSessionAsync(init.authorization_url, returnUrl);
  return verifyPayment(orderId);
}

export async function verifyPayment(orderId: string): Promise<boolean> {
  const r = await api<{ paid: boolean }>(`orders/${orderId}/pay/verify`, { method: 'POST', body: {} });
  return r.paid;
}

/** After Paystack closes, the payment can take a few seconds to be confirmed. Ask the server a few times before giving up. */
export async function waitForPayment(orderId: string, cancelled: () => boolean, tries = 5, gapMs = 4000): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, gapMs));
    if (cancelled()) return false;
    try { if (await verifyPayment(orderId)) return true; } catch { /* try again on the next round */ }
  }
  return false;
}
