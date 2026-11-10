'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, errorText } from '@/lib/api';
import { formatDate, formatDateTime, formatNaira, formatNumber, lagosToday, shiftDate, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import {
  Badge, Button, Card, Drawer, EmptyState, ErrorNote, Input, ORDER_STATUS, PageHeader, Select, Skeleton, StatusBadge, Table, Td, useToast,
} from '@/components/ui';

interface Row {
  id: string; order_no: string; business_name: string; fulfilment: 'delivery' | 'pickup'; status: string; delivery_date: string;
  area: string | null; address: string | null; items: { name: string; quantity: number }[]; bread_count: number; total_kobo: number;
  payment: { method: string; status: string } | null; distributor: { id: string; full_name: string } | null;
}
interface Detail extends Row {
  paystack_fee_kobo: number; subtotal_kobo: number; savings_kobo: number;
  timeline: { status: string; at: string; note: string | null }[];
  delivery: { started_at: string | null; delivered_at: string | null; failed_reason: string | null; failure_note: string | null; photos: { key: string; taken_at: string }[] } | null;
}
interface Summary { orders_by_status: Record<string, number>; bread_needed: { product_id: string; name: string; quantity: number }[] }
interface Distributor { id: string; full_name: string; phone: string }

export default function OrdersPage() {
  const { user } = useSession();
  const canAssign = !!user?.roles.some((r) => r === 'sales' || r === 'ceo');
  const toast = useToast();

  const [date, setDate] = useState(lagosToday());
  const [status, setStatus] = useState('');
  const [fulfilment, setFulfilment] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [distributorId, setDistributorId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ date, limit: '200' });
    if (status) p.set('status', status);
    if (fulfilment) p.set('fulfilment', fulfilment);
    if (query) p.set('q', query);
    return p.toString();
  }, [date, status, fulfilment, query]);

  const orders = useQuery<{ data: Row[] }>(`staff/orders?${params}`);
  const summary = useQuery<Summary>(`staff/orders/summary?date=${date}`);
  const distributors = useQuery<{ data: Distributor[] }>(canAssign ? 'staff/distributors' : null);

  useEffect(() => setPicked(new Set()), [params]);
  const rows = orders.data?.data ?? [];
  const assignable = rows.filter((o) => o.status === 'paid' && o.fulfilment === 'delivery' && !o.distributor);
  const refresh = useCallback(() => { void orders.reload(); void summary.reload(); }, [orders, summary]);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allPicked = assignable.length > 0 && assignable.every((o) => picked.has(o.id));

  async function assign() {
    setAssigning(true);
    try {
      await api('staff/orders/assign', { body: { order_ids: [...picked], distributor_id: distributorId } });
      toast(`${picked.size} order${picked.size === 1 ? '' : 's'} assigned`);
      setPicked(new Set());
      refresh();
    } catch (e) {
      const probs = e instanceof ApiError && Array.isArray(e.details) ? (e.details as { order_no?: string; reason: string }[]).map((p) => `${p.order_no ?? ''} ${titleCase(p.reason)}`).join('; ') : '';
      toast(errorText(e) + (probs ? ` (${probs})` : ''), 'bad');
    } finally {
      setAssigning(false);
    }
  }

  const sm = summary.data;
  return (
    <>
      <PageHeader title="Orders" subtitle={formatDate(date)}
        actions={
          <>
          <Button variant="secondary" disabled={rows.length === 0} onClick={() => downloadCsv(`orders-${date}.csv`, ['Order', 'Customer', 'Type', 'Area', 'Address', 'Bread', 'Total (NGN)', 'Payment', 'Payment status', 'Status', 'Distributor'], rows.map((o) => [o.order_no, o.business_name, o.fulfilment, o.area, o.address, o.bread_count, o.total_kobo / 100, o.payment?.method, o.payment?.status, o.status, o.distributor?.full_name]))}>Export CSV</Button>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
            <button aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-2 hover:bg-cream-2"><Icon name="left" size={18} /></button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Delivery date" className="bg-transparent px-1 text-sm font-semibold" />
            <button aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-2 hover:bg-cream-2"><Icon name="right" size={18} /></button>
            <Button size="sm" variant="ghost" onClick={() => setDate(lagosToday())}>Today</Button>
          </div>
          </>
        } />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="mb-3 text-sm font-semibold text-muted">Orders by status</p>
          {!sm ? <Skeleton className="h-8" /> : Object.keys(sm.orders_by_status).length === 0 ? <p className="text-sm text-muted">No orders for this day.</p> : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(sm.orders_by_status).map(([s, n]) => (
                <button key={s} onClick={() => setStatus(status === s ? '' : s)} aria-pressed={status === s} className={`rounded-full ${status === s ? 'ring-2 ring-navy' : ''}`}>
                  <Badge tone={ORDER_STATUS[s]?.tone}>{ORDER_STATUS[s]?.label ?? s}: {n}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-muted">Bread to prepare (paid orders)</p>
          {!sm ? <Skeleton className="h-8" /> : sm.bread_needed.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
            <ul className="space-y-1 text-sm">{sm.bread_needed.map((b) => <li key={b.product_id} className="flex justify-between"><span>{b.name}</span><b className="font-display text-lg">{formatNumber(b.quantity)}</b></li>)}</ul>
          )}
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Icon name="search" size={16} className="absolute top-3.5 left-4 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no. or customer" className="pl-10" aria-label="Search orders" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48" aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={fulfilment} onChange={(e) => setFulfilment(e.target.value)} className="w-40" aria-label="Filter by delivery or pickup">
          <option value="">Delivery and pickup</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option>
        </Select>
      </div>

      {canAssign && picked.size > 0 && (
        <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-3xl bg-navy p-4 text-white shadow-soft">
          <span className="font-semibold">{picked.size} selected</span>
          <Select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className="w-56 text-navy" aria-label="Distributor">
            <option value="">Choose distributor</option>
            {(distributors.data?.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
          <Button busy={assigning} disabled={!distributorId} className="bg-orange hover:bg-orange/90" onClick={assign}>Assign</Button>
          <button className="ml-auto text-sm underline" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      {canAssign && distributors.data && distributors.data.data.length === 0 && assignable.length > 0 && (
        <p className="mb-4 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">There are no distributors yet. The CEO can add them under Team.</p>
      )}

      {orders.error && <div className="mb-4"><ErrorNote message={orders.error} onRetry={orders.reload} /></div>}
      <Card>
        {!orders.data ? <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : rows.length === 0 ? <EmptyState title="No orders found" text="Try another day or clear the filters." />
          : (
            <Table head={[canAssign ? <input key="all" type="checkbox" aria-label="Select all assignable orders" checked={allPicked} disabled={assignable.length === 0} onChange={() => setPicked(allPicked ? new Set() : new Set(assignable.map((o) => o.id)))} /> : '', 'Order', 'Customer', 'Area', 'Loaves', 'Total', 'Distributor', 'Status']}>
              {rows.map((o) => {
                const can = canAssign && assignable.includes(o);
                return (
                  <tr key={o.id} className="cursor-pointer hover:bg-cream/60" onClick={() => setOpenId(o.id)}>
                    <Td className="w-10" ><input type="checkbox" aria-label={`Select ${o.order_no}`} disabled={!can} checked={picked.has(o.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(o.id)} /></Td>
                    <Td className="font-semibold whitespace-nowrap">{o.order_no}</Td>
                    <Td>{o.business_name}{o.fulfilment === 'pickup' && <span className="ml-2"><Badge tone="orange">Pickup</Badge></span>}</Td>
                    <Td>{o.area ?? '—'}</Td>
                    <Td>{formatNumber(o.bread_count)}</Td>
                    <Td className="whitespace-nowrap">{formatNaira(o.total_kobo)}</Td>
                    <Td>{o.distributor?.full_name ?? <span className="text-muted">—</span>}</Td>
                    <Td><StatusBadge status={o.status} /></Td>
                  </tr>
                );
              })}
            </Table>
          )}
      </Card>

      <OrderDrawer id={openId} canManage={canAssign} distributors={distributors.data?.data ?? []} onClose={() => setOpenId(null)} onChanged={refresh} />
    </>
  );
}

function OrderDrawer({ id, canManage, distributors, onClose, onChanged }: { id: string | null; canManage: boolean; distributors: Distributor[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const q = useQuery<Detail>(id ? `staff/orders/${id}` : null);
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const o = id ? q.data : null;

  async function act(path: string, body: unknown, msg: string) {
    setBusy(true);
    try {
      await api(path, { body });
      toast(msg);
      await q.reload();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={!!id} onClose={onClose} title={o?.order_no ?? 'Order'}>
      {q.error && <ErrorNote message={q.error} onRetry={q.reload} />}
      {!o ? <Skeleton className="h-64" /> : (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><div><p className="text-lg font-bold">{o.business_name}</p><p className="text-sm text-muted">{o.fulfilment === 'pickup' ? 'Office pickup' : [o.address, o.area].filter(Boolean).join(', ') || 'No address'}</p></div><StatusBadge status={o.status} /></div>

          <Card className="p-4">
            <ul className="space-y-1 text-sm">{o.items.map((i) => <li key={i.name} className="flex justify-between"><span>{i.name}</span><b>× {formatNumber(i.quantity)}</b></li>)}</ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Bread</dt><dd>{formatNaira(o.subtotal_kobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Paystack fee (paid by customer)</dt><dd>{formatNaira(o.paystack_fee_kobo)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatNaira(o.total_kobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Payment</dt><dd>{o.payment ? `${o.payment.method === 'paystack' ? 'Paystack' : 'Office cash'} · ${o.payment.status}` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Savings earned</dt><dd>{formatNaira(o.savings_kobo)}</dd></div>
            </dl>
          </Card>

          {o.distributor && <p className="text-sm"><span className="text-muted">Distributor: </span><b>{o.distributor.full_name}</b></p>}
          {o.delivery?.failed_reason && <ErrorNote message={`Delivery failed: ${titleCase(o.delivery.failed_reason)}${o.delivery.failure_note ? ` (${o.delivery.failure_note})` : ''}`} />}

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {o.fulfilment === 'pickup' && o.status === 'paid' && <Button busy={busy} onClick={() => act(`staff/orders/${o.id}/ready`, {}, 'Marked ready for pickup')}>Mark ready for pickup</Button>}
              {o.fulfilment === 'pickup' && o.status === 'ready' && <Button busy={busy} onClick={() => act(`staff/orders/${o.id}/collected`, {}, 'Marked collected')}>Mark collected</Button>}
              {o.status === 'assigned' && (
                <>
                  <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="w-48" aria-label="Move to distributor">
                    <option value="">Move to…</option>{distributors.filter((d) => d.id !== o.distributor?.id).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </Select>
                  <Button variant="secondary" busy={busy} disabled={!moveTo} onClick={() => act(`staff/orders/${o.id}/reassign`, { distributor_id: moveTo }, 'Moved to another distributor')}>Move</Button>
                </>
              )}
            </div>
          )}

          {o.delivery && o.delivery.photos.length > 0 && (
            <div>
              <h3 className="mb-2 font-bold">Delivery photo</h3>
              <div className="flex flex-wrap gap-2">
                {o.delivery.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.key} href={`/api/proxy/files?key=${encodeURIComponent(p.key)}`} target="_blank" rel="noreferrer"><img src={`/api/proxy/files?key=${encodeURIComponent(p.key)}`} alt={`Delivery proof taken ${formatDateTime(p.taken_at)}`} className="h-28 w-28 rounded-2xl object-cover" /></a>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 font-bold">Timeline</h3>
            <ol className="space-y-2 border-l-2 border-line pl-4">
              {o.timeline.map((t, i) => (
                <li key={i} className="text-sm"><b>{ORDER_STATUS[t.status]?.label ?? t.status}</b><span className="ml-2 text-muted">{formatDateTime(t.at)}</span>{t.note && <p className="text-muted">{t.note}</p>}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Drawer>
  );
}
