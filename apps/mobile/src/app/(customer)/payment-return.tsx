import { Redirect } from 'expo-router';

/** Paystack's page sends the customer here when they finish paying. The order screen is already waiting and confirms the payment, so just go back to the app. */
export default function PaymentReturn() {
  return <Redirect href="/" />;
}
