'use client';
import Link from 'next/link';
import { useQuery } from '@/lib/use-query';
import { formatDate, formatNaira, formatNumber, titleCase } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorNote, PageHeader, Skeleton, Stat, StatusBadge, Table, Td } from '@/components/ui';

interface Overview {
  date: string;
  today: { orders: number; loaves: number; by_status: Record<string, number>; payments_received: { amount_kobo: number; paystack_fees_kobo: number }; bread_produced: number; runs_recorded: string[] };
  last_7_days: { date: string; orders: number; loaves: number; paid_kobo: number }[];
  customers: { active: number; pending_approval: number; unclaimed: number; suspended: number };
  attention: { open_issues: number; pending_approvals: number; low_stock: { id: string; name: string; unit: string | null; in_stock: number; reorder_level: number }[] };
}
interface OrderRow { id: string; order_no: string; business_name: string; status: string; bread_count: number; total_kobo: number; area: string | null }

export default function OverviewPage() {
  const ov = useQuery<Overview>('staff/overview');
  const recent = useQuery<{ data: OrderRow[] }>('staff/orders?limit=8');
  const d = ov.data;
  const max = Math.max(1, ...(d?.last_7_days.map((x) => x.loaves) ?? [1]));

  return (
    <>
      <PageHeader title="Overview" subtitle={d ? `Deliveries for ${formatDate(d.date)}` : undefined} />
      {ov.error && <ErrorNote message={ov.error} onRetry={ov.reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!d ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />) : (
          <>
            <Stat label="Orders today" value={formatNumber(d.today.orders)} hint={`${formatNumber(d.today.loaves)} loaves ordered`} />
            <Stat label="Paid today" value={formatNaira(d.today.payments_received.amount_kobo, { compact: true })} hint={`Paystack fees ${formatNaira(d.today.payments_received.paystack_fees_kobo)}`} tone="brand" />
            <Stat label="Bread produced" value={formatNumber(d.today.bread_produced)} hint={d.today.runs_recorded.length ? `${d.today.runs_recorded.map(titleCase).join(' and ')} run recorded` : 'No run recorded yet'} />
            <Stat label="Open issues" value={d.attention.open_issues} hint="Settled in the daily reconciliation" tone={d.attention.open_issues ? 'orange' : undefined} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-bold">Loaves ordered, last 7 days</h2>
          {!d ? <Skeleton className="mt-4 h-48" /> : (
            <div className="mt-6 flex h-48 items-end gap-3" role="img" aria-label="Bar chart of loaves ordered per day">
              {d.last_7_days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-semibold">{formatNumber(day.loaves)}</span>
                  <div className={`w-full rounded-t-xl ${day.date === d.date ? 'bg-orange' : 'bg-brand'}`} style={{ height: `${Math.max(4, (day.loaves / max) * 130)}px` }} />
                  <span className="text-xs text-muted">{formatDate(day.date).split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold">Needs attention</h2>
          {!d ? <Skeleton className="mt-4 h-32" /> : (
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between"><Link href="/customers" className="font-semibold text-brand">Customers awaiting approval</Link><Badge tone={d.attention.pending_approvals ? 'warn' : 'neutral'}>{d.attention.pending_approvals}</Badge></li>
              <li className="flex items-center justify-between"><Link href="/issues" className="font-semibold text-brand">Open order issues</Link><Badge tone={d.attention.open_issues ? 'warn' : 'neutral'}>{d.attention.open_issues}</Badge></li>
              <li><p className="mb-1 font-semibold">Low stock</p>
                {d.attention.low_stock.length === 0 ? <p className="text-muted">Nothing is below its reorder level.</p> : (
                  <ul className="space-y-1">{d.attention.low_stock.map((m) => (
                    <li key={m.id} className="flex justify-between"><span className="capitalize">{m.name}</span><span className="text-bad">{m.in_stock} {m.unit ?? ''} left</span></li>
                  ))}</ul>
                )}
              </li>
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between p-6 pb-2">
          <h2 className="text-lg font-bold">Today&apos;s orders</h2>
          <Link href="/orders" className="text-sm font-semibold text-brand">See all</Link>
        </div>
        {recent.error ? <div className="p-6"><ErrorNote message={recent.error} onRetry={recent.reload} /></div>
          : !recent.data ? <div className="p-6"><Skeleton className="h-32" /></div>
          : recent.data.data.length === 0 ? <EmptyState title="No orders for today yet" text="Orders appear here as customers place them." />
          : (
            <Table head={['Order', 'Customer', 'Area', 'Loaves', 'Total', 'Status']}>
              {recent.data.data.map((o) => (
                <tr key={o.id}>
                  <Td className="font-semibold">{o.order_no}</Td><Td>{o.business_name}</Td><Td>{o.area ?? '—'}</Td>
                  <Td>{formatNumber(o.bread_count)}</Td><Td>{formatNaira(o.total_kobo)}</Td><Td><StatusBadge status={o.status} /></Td>
                </tr>
              ))}
            </Table>
          )}
      </Card>
    </>
  );
}
