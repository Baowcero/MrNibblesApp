#!/usr/bin/env node
/**
 * Load test for the booking cut-off rush: many customers ordering in the same minutes while staff watch the dashboard.
 * No packages needed (Node 20+).
 *
 *   1) node test/load/cutoff.mjs prepare --customers 150     creates and approves test customers (once)
 *   2) node test/load/cutoff.mjs run --spread 30 --staff 5   the rush
 *
 * ONLY RUN THIS AGAINST A TEST OR STAGING COPY. It creates customers named LOADTEST-* and real orders.
 * Start that API with the limits raised, because the test sends everything from one computer while real customers
 * come from many addresses:
 *   RATE_LIMIT_IP_PER_MIN=1000000 RATE_LIMIT_AUTH_PER_MIN=100000 DISABLE_JOBS=1 npm run start:prod
 *
 * Settings (environment):  LOAD_API_URL (default http://localhost:4000)
 *   LOAD_STAFF_PHONE, LOAD_STAFF_PASSWORD   a CEO/sales login on that copy (to approve customers and to act as the dashboard)
 * Options:  --customers N   --spread SECONDS (all customers start inside this window; 0 = everyone at once)
 *           --staff N (dashboard viewers polling during the rush)   --p95 MS (pass mark for placing an order, default 1500)
 *           --replay PERCENT (share of customers that send the same order twice, like a retry on bad signal, default 15)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.LOAD_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const USERS_FILE = fileURLToPath(new URL('./load-users.json', import.meta.url));
const [mode, ...rest] = process.argv.slice(2);
const opt = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? Number(rest[i + 1]) : fallback; };

const host = new URL(BASE).hostname;
const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
if (!local && process.env.LOAD_ALLOW_REMOTE !== '1') {
  console.error(`Refusing to load-test ${BASE}. It is not a local or private address.\nIf it really is a staging server, set LOAD_ALLOW_REMOTE=1. Never point this at production.`);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = []; // { label, status, ms, code }

async function call(label, method, path, { token, body, headers = {}, record = true } = {}) {
  const t0 = performance.now();
  let status = 0, json = null, retryAfter = 0;
  try {
    const res = await fetch(`${BASE}/v1/${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    retryAfter = Number(res.headers.get('retry-after') ?? 0);
    json = await res.json().catch(() => null);
  } catch (e) { status = 0; json = { error: { code: `network: ${e.cause?.code ?? e.message}` } }; }
  const ms = performance.now() - t0;
  if (record) stats.push({ label, status, ms, code: json?.error?.code });
  return { status, json, ms, retryAfter };
}

/** Like call, but waits and tries again when told to slow down. Used for set-up steps. */
async function patient(label, method, path, o = {}) {
  for (let i = 0; i < 8; i++) {
    const r = await call(label, method, path, { ...o, record: false });
    if (r.status !== 429) return r;
    await sleep(Math.max(1, r.retryAfter) * 1000);
  }
  throw new Error(`${label}: still rate limited`);
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const n = i++; await fn(items[n], n); } }));
}

const pct = (xs, p) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : 0);
const staffLogin = async () => {
  const phone = process.env.LOAD_STAFF_PHONE, password = process.env.LOAD_STAFF_PASSWORD;
  if (!phone || !password) { console.error('Set LOAD_STAFF_PHONE and LOAD_STAFF_PASSWORD (a CEO or sales login on the TEST copy).'); process.exit(2); }
  const r = await patient('staff login', 'POST', 'auth/login', { body: { phone, password } });
  if (r.status !== 200) { console.error(`Staff login failed (${r.status}): ${r.json?.error?.message}`); process.exit(2); }
  return r.json.access_token;
};

// ------------------------------------------------------------------ prepare
async function prepare() {
  const n = opt('customers', 100);
  const run = Date.now().toString(36).slice(-5).toUpperCase();
  const staff = await staffLogin();
  const areas = (await patient('areas', 'GET', 'areas')).json?.data ?? [];
  if (!areas[0]) { console.error('No areas found. Seed the database first.'); process.exit(2); }

  const users = [];
  const used = new Set();
  console.log(`Creating ${n} test customers (run ${run})...`);
  await pool(Array.from({ length: n }, (_, i) => i + 1), 5, async (i) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      let phone; do { phone = `080${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`; } while (used.has(phone)); used.add(phone);
      const password = 'LoadTest123';
      const r = await patient('signup', 'POST', 'auth/signup', { body: { phone, password, full_name: `Load Test ${i}`, business_name: `LOADTEST-${run}-${i}`, address: '12 Test Street, Ogbomoso', area_id: areas[i % areas.length].id } });
      if (r.status === 201 || r.status === 200) { users.push({ phone, password }); return; }
      if (r.status !== 409) { console.error(`signup ${i} failed (${r.status}): ${r.json?.error?.message}`); return; }
    }
  });

  console.log(`Approving ${users.length} customers...`);
  let approved = 0, cursor;
  do {
    const q = `staff/customers?status=pending_approval&q=LOADTEST-${run}&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const page = (await patient('list', 'GET', q, { token: staff })).json;
    await pool(page?.data ?? [], 5, async (c) => { const r = await patient('approve', 'POST', `staff/customers/${c.id}/approve`, { token: staff, body: {} }); if (r.status < 300) approved++; });
    cursor = page?.next_cursor;
  } while (cursor);

  await writeFile(USERS_FILE, JSON.stringify({ run, base: BASE, users }, null, 2));
  console.log(`Done: ${users.length} created, ${approved} approved. Saved to test/load/load-users.json (do not commit it).`);
  if (approved < users.length) console.log('Some were not approved. Approve the rest on the dashboard (search LOADTEST) before running.');
}

// ------------------------------------------------------------------ run
async function run() {
  const file = JSON.parse(await readFile(USERS_FILE, 'utf8').catch(() => { console.error('Run "prepare" first.'); process.exit(2); }));
  const want = opt('customers', file.users.length);
  const spread = opt('spread', 30) * 1000;
  const staffN = opt('staff', 5);
  const replayShare = opt('replay', 15) / 100;
  const p95Limit = opt('p95', 1500);
  const users = file.users.slice(0, want);
  const staffToken = staffN > 0 ? await staffLogin() : null;

  console.log(`Logging in ${users.length} customers...`);
  const sessions = [];
  await pool(users, 20, async (u, i) => {
    const r = await patient('login', 'POST', 'auth/login', { body: { phone: u.phone, password: u.password } });
    if (r.status === 200) sessions.push({ i, token: r.json.access_token });
    else console.error(`login failed for ${u.phone}: ${r.json?.error?.message}`);
  });
  if (sessions.length === 0) { console.error('No customers could log in. Are they approved?'); process.exit(2); }

  const products = (await patient('products', 'GET', 'products', { token: sessions[0].token })).json?.data ?? [];
  if (products.length === 0) { console.error('No products. Seed the database first.'); process.exit(2); }

  console.log(`Starting the rush: ${sessions.length} customers over ${spread / 1000}s, ${staffN} dashboard viewers.`);
  const orderIds = new Map(); // order id -> customer index
  const problems = [];
  let rushOver = false;
  const t0 = performance.now();

  const staffLoops = Array.from({ length: staffN }, async () => {
    await sleep(Math.random() * 2000);
    while (!rushOver) {
      await call('dashboard: notifications', 'GET', 'notifications', { token: staffToken });
      await call('dashboard: overview', 'GET', 'staff/overview', { token: staffToken });
      await call('dashboard: orders', 'GET', 'staff/orders?limit=100', { token: staffToken });
      await sleep(5000); // faster than the real 20 s, on purpose
    }
  });

  await Promise.all(sessions.map(async (s) => {
    await sleep(spread ? Math.random() * spread : 0);
    const t = s.token;
    await call('open app: booking status', 'GET', 'booking/status', { token: t });
    const me = (await call('open app: me', 'GET', 'me', { token: t })).json;
    await call('open app: products', 'GET', 'products', { token: t });
    await sleep(200 + Math.random() * 1500); // choosing bread

    const picks = [...products].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * Math.min(3, products.length)));
    const items = picks.map((p) => ({ product_id: p.id, quantity: 5 + Math.floor(Math.random() * 56) }));
    const pickup = Math.random() < 0.3 || !me?.locations?.[0];
    const order = { items, payment_method: 'office_cash', fulfilment: pickup ? 'pickup' : 'delivery', ...(pickup ? {} : { location_id: me.locations[0].id }) };

    await call('quote', 'POST', 'orders/quote', { token: t, body: { items, payment_method: order.payment_method } });
    const key = `load-${file.run}-${s.i}-${Math.random().toString(36).slice(2, 10)}`;
    const placed = await call('PLACE ORDER', 'POST', 'orders', { token: t, body: order, headers: { 'idempotency-key': key } });
    const id = placed.json?.id ?? placed.json?.order?.id;
    if (placed.status >= 200 && placed.status < 300 && id) {
      if (orderIds.has(id)) problems.push(`Order ${id} was handed to two different customers`);
      orderIds.set(id, s.i);
      if (Math.random() < replayShare) {
        const again = await call('PLACE ORDER (retry, same key)', 'POST', 'orders', { token: t, body: order, headers: { 'idempotency-key': key } });
        const id2 = again.json?.id ?? again.json?.order?.id;
        if (id2 !== id) problems.push(`Retry of customer ${s.i} created a second order (${id} vs ${id2}, status ${again.status})`);
      }
      await call('order detail', 'GET', `orders/${id}`, { token: t });
      if (Math.random() < 0.5) await call('notifications', 'GET', 'notifications', { token: t });
    }
  }));
  rushOver = true;
  await Promise.all(staffLoops);
  const seconds = (performance.now() - t0) / 1000;

  // ---------------------------------------------------------------- report
  const labels = [...new Set(stats.map((s) => s.label))];
  console.log(`\nRush finished in ${seconds.toFixed(1)}s, ${stats.length} requests (${(stats.length / seconds).toFixed(1)}/s)\n`);
  console.log('request'.padEnd(34), 'count'.padStart(6), 'p50'.padStart(7), 'p95'.padStart(7), 'p99'.padStart(7), '  failures');
  for (const l of labels) {
    const rows = stats.filter((s) => s.label === l);
    const ms = rows.map((r) => r.ms);
    const bad = rows.filter((r) => r.status === 0 || r.status >= 400);
    const codes = [...new Set(bad.map((r) => `${r.status} ${r.code ?? ''}`.trim()))].join(', ');
    console.log(l.padEnd(34), String(rows.length).padStart(6), `${pct(ms, 50).toFixed(0)}ms`.padStart(7), `${pct(ms, 95).toFixed(0)}ms`.padStart(7), `${pct(ms, 99).toFixed(0)}ms`.padStart(7), bad.length ? `  ${bad.length} (${codes})` : '  none');
  }

  const place = stats.filter((s) => s.label === 'PLACE ORDER');
  const placedOk = place.filter((s) => s.status >= 200 && s.status < 300).length;
  const serverErrors = stats.filter((s) => s.status === 0 || s.status >= 500).length;
  const limited = stats.filter((s) => s.status === 429).length;
  const p95 = pct(place.map((s) => s.ms), 95);

  const checks = [
    [`Every customer's order was accepted (${placedOk}/${sessions.length})`, placedOk === sessions.length],
    [`No server errors or dropped connections (${serverErrors})`, serverErrors === 0],
    ['No duplicate orders (including retries with the same key)', problems.length === 0],
    [`Placing an order p95 under ${p95Limit} ms (${p95.toFixed(0)} ms)`, p95 <= p95Limit],
    [`Nobody was rate limited (${limited}). If not 0, raise RATE_LIMIT_* on the test server`, limited === 0],
  ];
  console.log('');
  for (const [text, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  problems.slice(0, 10).forEach((p) => console.log(`      ${p}`));
  console.log(`\nIn the dashboard you should now see ${placedOk} "New order" notifications for sales. Check that the bell and the orders page still load quickly.`);
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

if (mode === 'prepare') await prepare();
else if (mode === 'run') await run();
else { console.log('Usage:\n  node test/load/cutoff.mjs prepare --customers 150\n  node test/load/cutoff.mjs run --spread 30 --staff 5'); process.exit(1); }
