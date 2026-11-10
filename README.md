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

### Staff, assigning and deliveries (smoke test)
All as the CEO (`$CEO` token) unless noted.
```bash
# 1. create a distributor (shows a temporary password once)
curl -s -X POST localhost:4000/v1/staff/users -H "authorization: Bearer $CEO" -H 'content-type: application/json' \
  -d '{"full_name":"Test Distributor","phone":"08055550001","roles":["distributor"]}'

# 2. today's orders and the distributor list
curl -s "localhost:4000/v1/staff/orders?date=YYYY-MM-DD" -H "authorization: Bearer $CEO"
curl -s localhost:4000/v1/staff/distributors -H "authorization: Bearer $CEO"

# 3. assign a PAID delivery order
curl -s -X POST localhost:4000/v1/staff/orders/assign -H "authorization: Bearer $CEO" -H 'content-type: application/json' \
  -d '{"order_ids":["<order id>"],"distributor_id":"<distributor id>"}'

# 4. as the distributor: log in (change the temporary password first with /v1/auth/set-password), then
curl -s "localhost:4000/v1/distributor/deliveries?date=YYYY-MM-DD" -H "authorization: Bearer $DIST"
curl -s -X POST localhost:4000/v1/distributor/deliveries/<delivery id>/start -H "authorization: Bearer $DIST"
curl -s -X POST localhost:4000/v1/distributor/uploads/photo -H "authorization: Bearer $DIST" \
  -H 'content-type: image/jpeg' --data-binary @some-photo.jpg          # returns {"key": "..."}
curl -s -X POST localhost:4000/v1/distributor/deliveries/<delivery id>/confirm -H "authorization: Bearer $DIST" \
  -H 'content-type: application/json' -d '{"photo_keys":["<key>"]}'
```
Confirming without a photo is refused. `GET /v1/files?key=<key>` shows a photo to staff.

## Smoke test: production, inventory, issues, reconciliation

Create a production and a store keeper user first (CEO token, `POST /v1/staff/users`, roles `["production"]` / `["store_keeper"]`).

    # store keeper: add a material, receive stock, count
    POST /v1/staff/inventory/materials   {"name":"flour","unit":"kg","reorder_level":50}
    POST /v1/staff/inventory/receipts    {"items":[{"raw_material_id":"<id>","quantity":200}]}
    POST /v1/staff/inventory/counts      {"counts":[{"raw_material_id":"<id>","counted_quantity":195}]}   # variance is shown
    # production: record the morning run (bread made + flour used)
    POST /v1/staff/production/runs       {"run_type":"morning","outputs":[{"product_id":"<id>","quantity":300}],"materials":[{"raw_material_id":"<id>","quantity":40}]}
    GET  /v1/staff/inventory/materials ; GET /v1/staff/inventory/bread
    # issue on an order, then reconcile
    POST /v1/orders/<order_id>/issues    {"issue_type":"damaged","quantity":3,"note":"crushed in transit"}
    POST /v1/staff/reconciliation/open   {}
    GET  /v1/staff/reconciliation
    POST /v1/staff/reconciliation/<id>/issues/<issue_id>/settle {"resolution":"credited 3 loaves"}
    POST /v1/staff/reconciliation/<id>/close {}
