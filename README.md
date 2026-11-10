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
