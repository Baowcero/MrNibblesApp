# Backend: what is left (10 Nov 2026)

Built and working: auth, booking rules, orders, Paystack and cash payments, change payment method, staff users, customer approval, CSV customer import,
assigning and distributor deliveries with photo proof, offline sync, production and inventory, order issues, daily reconciliation,
notifications and booking reminders, customer savings, CEO overview, login rate limit.

## Still to build
- Spaces photo storage (photos are on local disk now). Needs the client's Spaces keys.
- Real push delivery. Code is ready; needs the Firebase service account JSON (Chronicles will set up Firebase).
- Paystack events through a queue (BullMQ). Processed inline today, which is fine at 50 to 70 customers.
- Endpoint tests (supertest) for the main flows, and a pass over error cases.
- Deploy: production env file, migrations on the server, process manager, HTTPS, backups, log monitoring.

## Waiting on the client
- Paystack live keys (in process) and the live webhook URL.
- Distributor list (names and phone numbers). On hold.
- Raw material units. On hold (set later with PUT /staff/inventory/materials/:id).
- Paystack fee rule (1.5% + 100 naira, waived under 2,500, capped at 2,000): Chronicles to confirm with the client.
- Customer email: customers can add an email at sign-up or later (PATCH /v1/auth/me); Paystack receipts go there. Without one, an address is made from the phone number.

## Known edge cases
- A customer who pays an old Paystack link after switching the order to cash needs a manual refund (rare).
- Notifications and reminders run inside the API process: run a single API instance until they move to BullMQ.
- Customers cannot attach photos to an issue yet (only distributors can).
