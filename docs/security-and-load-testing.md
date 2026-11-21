# Security settings and load testing

## What protects the system

**API**
- Passwords are hashed (argon2). Login is limited per phone and per address after failures.
- Access tokens last 15 minutes. Refresh tokens are stored hashed, rotate on every use, and using an old one signs the person out everywhere.
- Every route is closed by default, roles are checked on the server, and a distributor or customer only ever sees their own records.
- Unknown fields in a request are rejected. Uploads must be JPEG, PNG or WebP, are checked by their first bytes, capped at 8 MB, and served only to people allowed to see them.
- Paystack webhooks must carry a valid signature, and a payment is only trusted after the API asks Paystack directly.
- **New:** only listed websites may call the API from a browser (`CORS_ORIGINS`); phone apps and the dashboard's server are unaffected.
- **New:** protective response headers (no framing, no sniffing, strict content policy, HTTPS only in production).
- **New:** request limits. Per IP: `RATE_LIMIT_IP_PER_MIN` (default 1200, high because many people share an address). Per signed-in person: `RATE_LIMIT_USER_PER_MIN` (default 300), with tighter limits for placing orders, paying, reporting issues, uploads and cash receipts, and `RATE_LIMIT_AUTH_PER_MIN` (default 30) for login and sign-up. The Paystack webhook and the health check are never limited. A limited request gets `429` and a `Retry-After` header.
- **New:** in production the API will not start with a missing or weak `JWT_ACCESS_SECRET`, or without a database or Paystack key. It warns about a test Paystack key, a non-HTTPS callback, no `REDIS_URL` and no `TRUST_PROXY`.

**Dashboard**
- Login tokens live only in secure, HTTP-only cookies and never reach the page's JavaScript.
- **New:** a strict content security policy, no framing, and a second check that changing requests come from the dashboard's own site (protection against forged requests).

## What is not covered yet (decide before launch)

- A disabled or role-changed account keeps working for up to 15 minutes until its access token expires (it cannot refresh).
- Photos are stored on the server's disk. Move to private object storage (Spaces) with backups before launch.
- No automatic alerting. Add error tracking and an uptime check.
- No two-step login for staff. Worth adding for CEO and accounts accounts.
- Backups: turn on automatic database backups and **practice restoring one**.
- Run `npm audit` in each app and keep dependencies updated.

## Load test of the cut-off rush

`apps/api/test/load/cutoff.mjs` simulates many customers ordering inside the same few minutes while staff watch the dashboard. It checks speed, errors, and that nobody gets a duplicate order, including when a customer's request is sent twice.

**Run it only against a test or staging copy**, never production. It creates customers called `LOADTEST-*` and real orders. Throw the test database away afterwards.

1. Start the test API with the limits raised (the test sends everything from one computer, real customers do not):
   `RATE_LIMIT_IP_PER_MIN=1000000 RATE_LIMIT_AUTH_PER_MIN=100000 DISABLE_JOBS=1 npm run start:prod`
2. From `apps/api`, with a CEO or sales login on that copy:
   ```
   export LOAD_STAFF_PHONE=0800... LOAD_STAFF_PASSWORD=...
   node test/load/cutoff.mjs prepare --customers 150
   node test/load/cutoff.mjs run --spread 30 --staff 5
   ```
   (`--spread 0` is the harshest case: everyone at the same second.)
3. Read the table and the PASS/FAIL lines. Pass marks: every order accepted, no server errors, no duplicates, placing an order under 1.5 s at the 95th percentile, nobody rate limited.
4. While it runs, open the dashboard and watch the bell and the orders page. They should stay responsive.
5. Try a few sizes (50, 150, 300 customers) and a harsh run, and note where it starts to slow down. Compare with the client's real number of active customers (about 75 pre-loaded) to see how much headroom there is.

If the numbers are poor: check the database indexes first (orders by date and status, notifications by person), then the connection pool size, then whether the API machine is simply too small.
