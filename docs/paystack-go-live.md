# Paystack go-live checklist

Work through this top to bottom. Do the whole "Rehearsal" section on a staging copy with **test keys** before touching live keys.

## 1. What we need from the client

- [ ] Paystack business account is **activated for live payments** (business verification done, settlement bank account added). Without it, live keys do not work.
- [ ] **Live secret key** (`sk_live_...`) from Paystack dashboard, Settings, API Keys & Webhooks. Shared securely (password manager), never by chat or email, never committed.
- [ ] Agreement on **who pays the Paystack fee**. The app adds a fee line for card/transfer orders and none for cash. Confirm the rule in `apps/api/src/common/money.ts` matches what was agreed and Paystack's current published fees.
- [ ] Agreement on the refund wording shown in the app ("Paid orders cannot be cancelled or refunded") and who handles refunds.
- [ ] Who watches payments each day (accounts), and who to call when one goes wrong.

## 2. Server settings (production)

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` (the API refuses to start with a weak or missing key) |
| `PAYSTACK_SECRET_KEY` | the live key |
| `PAYSTACK_CALLBACK_URL` | `https://<api-domain>/v1/payments/return` |
| `JWT_ACCESS_SECRET` | random, 32+ characters (`openssl rand -base64 48`) |
| `TRUST_PROXY` | `1` when behind one load balancer or proxy |
| `REDIS_URL` | set, so rate limits are shared if you run more than one API |
| `CORS_ORIGINS` | empty, unless a browser calls the API directly |

- [ ] The API is reachable over **HTTPS** with a valid certificate.
- [ ] In the Paystack dashboard (live mode) set the **Webhook URL** to `https://<api-domain>/v1/webhooks/paystack`.
- [ ] Leave Paystack's own **Callback URL** setting empty. The API sends one with every payment.
- [ ] Start the API and read the log: there must be no `TEST key` warning.

## 3. Rehearsal on staging (test keys)

Use Paystack's published test cards and test bank options. For each case, check the order status in the app **and** on the dashboard, and the notifications.

- [ ] Successful card payment: browser returns to the app by itself, "Payment received" screen, order is `paid`, sales and accounts get a notification.
- [ ] Declined card: order stays unpaid, the customer can try again.
- [ ] Customer closes the Paystack page without paying: order stays unpaid, "I have paid" says not yet.
- [ ] Customer pays, then closes the page **before** it returns to the app: the order still becomes paid (webhook), and opening the order shows paid.
- [ ] Customer taps **Pay** twice (two attempts) and pays one of them: the order is paid once, never twice.
- [ ] Bank transfer option (if enabled on the account).
- [ ] Webhook delivered twice (resend from the Paystack dashboard): nothing changes the second time.
- [ ] Webhook with a wrong signature (`curl` it): rejected with 401 and saved as invalid.
- [ ] Amount mismatch: the order is not marked paid and an error is logged.
- [ ] Cash order: unaffected, accounts can record it, and it cannot be paid by card.
- [ ] Stop the API for a minute during a payment, start it again: Paystack's retry settles the order.
- [ ] Phone testing: the return page opens the app on both iOS and Android.

## 4. Go-live day

1. [ ] Deploy with the live key and the live webhook URL.
2. [ ] Place **one small real order yourself** with a real card.
3. [ ] In the Paystack dashboard: the transaction shows success, and the webhook log shows the event with a `200`.
4. [ ] In our dashboard: the order is paid, the payment appears in Payments, the notification arrived.
5. [ ] Check the settlement shows up in the client's bank on the expected day.
6. [ ] Only then tell customers to start paying.

## 5. Every day afterwards

- [ ] Accounts compares Paystack's successful transactions with paid orders in the dashboard (Payments). Counts and totals must match.
- [ ] Look at Paystack's webhook log for failed deliveries and resend them.
- [ ] A customer says they paid but the order is unpaid:
  1. Ask them to open the order and tap **I have paid, check now**.
  2. If it stays unpaid, find the transaction in the Paystack dashboard by the order number (it starts the reference).
  3. If Paystack shows success, resend the webhook from the Paystack dashboard. The order settles itself.
  4. If Paystack shows no success, the customer did not pay. Ask them to pay again.

## 6. Known limits

- The in-app "I have paid" check only looks at the **latest** payment attempt. If a customer pays an earlier attempt, the **webhook** still settles it (it finds the order from the payment details), so it is safe, just not instant. Making the app check every attempt is a small improvement worth doing.
- Failed webhooks rely on Paystack's retries. A proper job queue for payment events is still to be added.
- Refunds are done in the Paystack dashboard. The app does not record them yet.
