import * as WebBrowser from 'expo-web-browser';
import { api } from './api';

/** Opens Paystack, then asks the server whether the payment went through. The server checks with Paystack, never the phone. */
export async function payWithPaystack(orderId: string): Promise<boolean> {
  const init = await api<{ authorization_url: string }>(`orders/${orderId}/pay`, { method: 'POST', body: {} });
  await WebBrowser.openBrowserAsync(init.authorization_url);
  return verifyPayment(orderId);
}

export async function verifyPayment(orderId: string): Promise<boolean> {
  const r = await api<{ paid: boolean }>(`orders/${orderId}/pay/verify`, { method: 'POST', body: {} });
  return r.paid;
}
