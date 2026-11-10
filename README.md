# Mr Nibbles

Bakery ordering and delivery platform for Mr Nibbles, Ogbomoso.

| Folder | What | Stack |
| --- | --- | --- |
| `apps/api` | Backend | NestJS, Prisma, PostgreSQL, Redis (BullMQ) |
| `apps/mobile` | Customer and distributor app (iOS and Android) | Expo, React Native |
| `apps/dashboard` | Staff web dashboard (CEO, Sales, Accounts, Production, Store keeper) | Next.js |
| `docs` | Brief, schema, API spec, flows | Markdown |

## Setup
1. `cp .env.example apps/api/.env`
2. `npm run install:all`
3. `npm run db:up` (needs Docker; or use any local PostgreSQL and Redis)
4. `npm run prisma:migrate` then `npm run prisma:seed`
5. `npm run api`, `npm run dashboard`, `npm run mobile`

## Rules to remember
- Money is stored in kobo (BigInt). No SMS: push notifications only (Firebase).
- Booking closes 8:30 AM Mon to Fri (Africa/Lagos). No cancellations, no refunds.
- Customers sign up themselves and staff approve them before they can order.
- Ledger tables are append-only (enforced by `constraints.sql`).

## API smoke test (auth)
With the API running (`npm run api`, port 4000):

```bash
curl localhost:4000/v1/health
curl "localhost:4000/v1/areas" | head -c 300
curl "localhost:4000/v1/auth/signup/businesses?q=zin"

# sign up as a new customer (pending approval)
curl -X POST localhost:4000/v1/auth/signup -H 'content-type: application/json' -d '{
  "phone":"08012345678","password":"Bread2026","full_name":"Test Customer",
  "business_name":"Test Shop","address":"12 Test Street","area_id":"<an id from /v1/areas>"}'

# log in, then call /v1/me with the access_token
curl -X POST localhost:4000/v1/auth/login -H 'content-type: application/json' \
  -d '{"phone":"08012345678","password":"Bread2026"}'
curl localhost:4000/v1/me -H "authorization: Bearer <access_token>"
```
Staff accounts do not exist yet; the first CEO account is created by the seed script from SEED_CEO_PHONE and SEED_CEO_PASSWORD in apps/api/.env.

### Orders (smoke test)
```bash
TOKEN=<access_token>          # a customer whose status is active (approve one first, see below)
curl localhost:4000/v1/booking/status -H "authorization: Bearer $TOKEN"
curl localhost:4000/v1/products -H "authorization: Bearer $TOKEN"
curl -X POST localhost:4000/v1/orders/quote -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"payment_method":"paystack","items":[{"product_id":"<id>","quantity":40}]}'
curl -X POST localhost:4000/v1/orders -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"fulfilment":"delivery","location_id":"<from /v1/me>","payment_method":"office_cash","items":[{"product_id":"<id>","quantity":40}]}'
```
Approve a customer as CEO: `POST /v1/staff/customers/<customer id>/approve` (list them with `GET /v1/staff/customers?status=pending_approval`).

### Paystack (test mode)
1. Put the test secret key (`sk_test_...`) in `apps/api/.env` as `PAYSTACK_SECRET_KEY`, restart the API.
2. Create an order with `"payment_method":"paystack"`, then `POST /v1/orders/<id>/pay` returns `authorization_url`. Open it in a browser and pay with a Paystack test card.
3. Then call `POST /v1/orders/<id>/pay/verify`: the order becomes `paid` (works without the webhook).
4. Webhook: expose the API with `ngrok http 4000`, and set `https://<ngrok-id>.ngrok-free.app/v1/webhooks/paystack` as the test webhook URL in the Paystack dashboard.
5. Cash: `POST /v1/staff/payments/cash` with `{"order_no":"MN-..."}` as accounts or CEO, for an order placed with `office_cash`.
