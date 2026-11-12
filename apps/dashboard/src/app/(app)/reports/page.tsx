'use client';
import { useMemo, useState } from 'react';
import { formatNaira, formatNumber, lagosToday, shiftDate } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Button, Card, DateField, EmptyState, ErrorNote, FilterTabs, Kpi, PageHeader, PanelHead, Skeleton, Table, Td, pctChange } from '@/components/ui';

interface Day { date: string; revenue_kobo: number; orders: number; loaves: number }
interface Totals { revenue_kobo: number; orders: number; loaves: number; avg_order_kobo: number; customers: number }
interface Report {
  range: { from: string; to: string; days: number; previous_from: string; previous_to: string };
  current: Totals & { new_customers: number };
  previous: Totals;
  daily: Day[]; previous_daily: Day[];
  by_product: { name: string; loaves: number; revenue_kobo: number; share: number }[];
  by_method: { method: string; orders: number; revenue_kobo: number }[];
  by_area: { area: string; orders: number; revenue_kobo: number }[];
  top_customers: { id: string; name: string; orders: number; revenue_kobo: number }[];
  awaiting_payment: { orders: number; amount_kobo: number };
}

type Tab = 'overview' | 'sales' | 'items' | 'customers';
const PRESETS = [{ key: '7', label: 'Last 7 days' }, { key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }, { key: 'custom', label: 'Custom range' }];
const short = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function niceCeil(n: number) {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const f = n / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Line chart with the previous period as a dashed line. Values are plain numbers; `fmt` formats the axis. */
function TrendChart({ labels, cur, prev, fmt, name }: { labels: string[]; cur: number[]; prev: number[]; fmt: (n: number) => string; name: string }) {
  const W = 640, H = 220, L = 52, R = 12, T = 10, B = 26;
  const max = niceCeil(Math.max(...cur, ...prev, 1));
  const x = (i: number) => L + (cur.length <= 1 ? 0 : (i / (cur.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const every = Math.max(1, Math.ceil(labels.length / 7));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name}: current period compared with the previous period`} className="w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : '3 4'} />
          <text x={L - 8} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{fmt(max * t)}</text>
        </g>
      ))}
      {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{l}</text>)}
      <path d={path(prev)} fill="none" stroke="var(--color-muted)" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="5 5" />
      <path d={`${path(cur)} L${x(cur.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="var(--color-brand)" fillOpacity="0.08" />
      <path d={path(cur)} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" />
      {cur.length <= 31 && cur.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--color-brand)"><title>{`${labels[i]}: ${fmt(v)}`}</title></circle>)}
    </svg>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-brand" />This period</span>
      <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-muted/60" />Previous period</span>
    </div>
  );
}

const PRESET_LABEL: Record<string, string> = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', custom: 'Custom range' };

/** The date-range button in the page header. Opens a small panel with presets and custom dates. */
function RangePicker({ preset, setPreset, from, to, setFrom, setTo, label }: { preset: string; setPreset: (p: string) => void; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className="inline-flex h-10 items-center gap-2.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-cream-2">
        <Icon name="calendar" size={17} />{label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Choose date range" className="absolute right-0 z-50 mt-2 w-72 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-soft">
            <div className="grid gap-1.5">
              {Object.entries(PRESET_LABEL).map(([k, l]) => (
                <button key={k} onClick={() => { setPreset(k); if (k !== 'custom') setOpen(false); }} aria-pressed={preset === k}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${preset === k ? 'bg-navy text-white' : 'hover:bg-cream-2'}`}>{l}</button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="grid gap-2 border-t border-line pt-3">
                <DateField value={from} onChange={(v) => v && setFrom(v)} label="From" />
                <DateField value={to} onChange={(v) => v && setTo(v)} label="To" />
                <Button size="sm" onClick={() => setOpen(false)}>Apply</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(shiftDate(lagosToday(), -29));
  const [to, setTo] = useState(lagosToday());

  const range = useMemo(() => {
    if (preset === 'custom') return { from, to };
    const end = lagosToday();
    return { from: shiftDate(end, -(Number(preset) - 1)), to: end };
  }, [preset, from, to]);
  const valid = range.from <= range.to;
  const rep = useQuery<Report>(valid ? `staff/reports/sales?from=${range.from}&to=${range.to}` : null);
  const r = rep.data;

  const takeaway = useMemo(() => {
    if (!r || r.current.orders === 0) return null;
    const best = [...r.daily].sort((a, b) => b.revenue_kobo - a.revenue_kobo)[0]!;
    const delta = pctChange(r.current.revenue_kobo, r.previous.revenue_kobo);
    const top = r.by_product[0];
    const cust = r.top_customers[0];
    const parts = [
      delta === null ? `Revenue for this period is ${formatNaira(r.current.revenue_kobo)}.` : `Revenue is ${formatNaira(r.current.revenue_kobo)}, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}% on the previous period.`,
      `${short(best.date)} was the strongest day at ${formatNaira(best.revenue_kobo)}.`,
      top ? `${top.name} led sales with ${formatNumber(top.loaves)} loaves (${Math.round(top.share * 100)}% of revenue).` : '',
      cust ? `${cust.name} is the top customer with ${formatNaira(cust.revenue_kobo)}.` : '',
    ];
    return parts.filter(Boolean).join(' ');
  }, [r]);

  const rangeLabel = `${short(range.from)} – ${short(range.to)} ${range.to.slice(0, 4)}`;
  const labels = r?.daily.map((d) => short(d.date)) ?? [];
  const D = (cur: number, prev: number, invert = false) => ({ pct: pctChange(cur, prev), invert });

  return (
    <>
      <PageHeader title="Reports" subtitle="The bigger picture behind every plate."
        actions={
          <>
            <RangePicker preset={preset} setPreset={setPreset} from={from} to={to} setFrom={setFrom} setTo={setTo} label={rangeLabel} />
            <Button variant="secondary" disabled={!r} onClick={() => r && downloadCsv(`sales-${r.range.from}-to-${r.range.to}.csv`, ['Date', 'Revenue (NGN)', 'Orders', 'Loaves'], r.daily.map((d) => [d.date, d.revenue_kobo / 100, d.orders, d.loaves]))}>
              <Icon name="download" size={16} />Export report
            </Button>
          </>
        } />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs<Tab> value={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'sales', label: 'Sales' }, { key: 'items', label: 'Items' }, { key: 'customers', label: 'Customers' }]} />
        {r && <p className="text-sm text-muted">Compared with {short(r.range.previous_from)} – {short(r.range.previous_to)} · Delivery date, paid orders only</p>}
      </div>

      {!valid && <ErrorNote message="The start date must be on or before the end date." />}
      {rep.error && <div className="mb-4"><ErrorNote message={rep.error} onRetry={rep.reload} /></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {!r ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <Kpi label="Revenue" icon="wallet" value={formatNaira(r.current.revenue_kobo, { compact: true })} delta={D(r.current.revenue_kobo, r.previous.revenue_kobo)} hint="vs previous" />
            <Kpi label="Orders" icon="orders" value={formatNumber(r.current.orders)} delta={D(r.current.orders, r.previous.orders)} hint="vs previous" />
            <Kpi label="Loaves sold" icon="bread" value={formatNumber(r.current.loaves)} delta={D(r.current.loaves, r.previous.loaves)} hint="vs previous" />
            <Kpi label="Average order" icon="chart" value={formatNaira(r.current.avg_order_kobo)} delta={D(r.current.avg_order_kobo, r.previous.avg_order_kobo)} hint="vs previous" />
            <Kpi label="Customers ordering" icon="people" value={formatNumber(r.current.customers)} delta={D(r.current.customers, r.previous.customers)} hint={`${r.current.new_customers} new`} />
          </>
        )}
      </div>

      {r && r.current.orders === 0 && <Card><EmptyState title="No sales in this range" text="Pick a longer range or another period." /></Card>}

      {r && r.current.orders > 0 && (tab === 'overview' || tab === 'sales') && (
        <div className="mb-5 grid gap-5 xl:grid-cols-2">
          <Card>
            <PanelHead title="Revenue trend" action={<Legend />} />
            <div className="p-4"><TrendChart name="Revenue" labels={labels} cur={r.daily.map((d) => d.revenue_kobo)} prev={r.previous_daily.map((d) => d.revenue_kobo)} fmt={(n) => formatNaira(n, { compact: true }).replace(/\.0M/, 'M').replace(/,000$/, 'k')} /></div>
          </Card>
          <Card>
            <PanelHead title="Orders trend" action={<Legend />} />
            <div className="p-4"><TrendChart name="Orders" labels={labels} cur={r.daily.map((d) => d.orders)} prev={r.previous_daily.map((d) => d.orders)} fmt={(n) => String(Math.round(n))} /></div>
          </Card>
        </div>
      )}

      {r && r.current.orders > 0 && (tab === 'overview' || tab === 'items') && (
        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <PanelHead title="Product performance" />
            <Table head={['Product', 'Loaves', 'Revenue', 'Share']}>
              {r.by_product.map((p) => (
                <tr key={p.name}>
                  <Td className="font-semibold">{p.name}</Td>
                  <Td className="tnum">{formatNumber(p.loaves)}</Td>
                  <Td className="whitespace-nowrap tnum">{formatNaira(p.revenue_kobo)}</Td>
                  <Td className="w-48"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-cream"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.round(p.share * 100)}%` }} /></div><span className="w-10 text-right text-xs text-muted tnum">{Math.round(p.share * 100)}%</span></div></Td>
                </tr>
              ))}
            </Table>
          </Card>
          {tab === 'overview' && (
            <div className="space-y-5">
              <Card>
                <PanelHead title="Payments" />
                <div className="space-y-3 p-5 text-sm">
                  {r.by_method.map((m) => <div key={m.method} className="flex justify-between"><span>{m.method === 'paystack' ? 'Paystack (card/transfer)' : 'Office cash'} <span className="text-muted">· {m.orders} orders</span></span><b className="tnum">{formatNaira(m.revenue_kobo)}</b></div>)}
                  <div className="flex justify-between border-t border-line pt-3"><span className="text-muted">Still awaiting payment <span>· {r.awaiting_payment.orders} orders</span></span><b className="text-warn tnum">{formatNaira(r.awaiting_payment.amount_kobo)}</b></div>
                </div>
              </Card>
              {takeaway && (
                <div className="rounded-2xl bg-side p-5 text-white">
                  <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">Key takeaway</p>
                  <p className="mt-2 text-sm leading-relaxed">{takeaway}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {r && r.current.orders > 0 && tab === 'sales' && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <PanelHead title="By delivery area" />
            <Table head={['Area', 'Orders', 'Revenue']}>
              {r.by_area.map((a) => <tr key={a.area}><Td className="font-semibold">{a.area}</Td><Td className="tnum">{a.orders}</Td><Td className="tnum">{formatNaira(a.revenue_kobo)}</Td></tr>)}
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <PanelHead title="Day by day" />
            <div className="max-h-96 overflow-auto">
              <Table head={['Date', 'Orders', 'Loaves', 'Revenue']}>
                {[...r.daily].reverse().map((d) => <tr key={d.date}><Td>{short(d.date)}</Td><Td className="tnum">{d.orders}</Td><Td className="tnum">{formatNumber(d.loaves)}</Td><Td className="tnum">{formatNaira(d.revenue_kobo)}</Td></tr>)}
              </Table>
            </div>
          </Card>
        </div>
      )}

      {r && r.current.orders > 0 && tab === 'customers' && (
        <Card className="overflow-hidden">
          <PanelHead title="Top customers" />
          <Table head={['#', 'Customer', 'Orders', 'Revenue']}>
            {r.top_customers.map((c, i) => <tr key={c.id}><Td className="w-10 text-muted tnum">{i + 1}</Td><Td className="font-semibold">{c.name}</Td><Td className="tnum">{c.orders}</Td><Td className="tnum">{formatNaira(c.revenue_kobo)}</Td></tr>)}
          </Table>
        </Card>
      )}
    </>
  );
}
