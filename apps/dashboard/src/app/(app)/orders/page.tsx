'use client';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, errorText } from '@/lib/api';
import { formatDate, formatDateTime, formatNaira, formatNumber, lagosToday, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { useWide } from '@/lib/use-wide';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import {
  Badge, Button, Card, DateField, Drawer, EmptyState, ErrorNote, FilterTabs, ORDER_STATUS, PageHeader, Pager, Select, SearchBox, Skeleton, StatusBadge, Table, Td, useToast,
} from '@/components/ui';

interface Row {
  id: string; order_no: string; business_name: string; fulfilment: 'delivery' | 'pickup'; status: string; placed_at: string; delivery_date: string;
  area: string | null; address: string | null; items: { name: string; quantity: number }[]; bread_count: number; total_kobo: number;
  payment: { method: string; status: string } | null; distributor: { id: string; full_name: string } | null;
}
interface Detail extends Row {
  customer: { id: string; business_name: string; contact_name: string | null; phone: string | null };
  paystack_fee_kobo: number; subtotal_kobo: number; savings_kobo: number;
  timeline: { status: string; at: string; note: string | null }[];
  delivery: { started_at: string | null; delivered_at: string | null; failed_reason: string | null; failure_note: string | null; photos: { key: string; taken_at: string }[] } | null;
}
interface Distributor { id: string; full_name: string; phone: string }

type Tab = 'all' | 'awaiting' | 'assign' | 'active' | 'done' | 'failed';
const GROUP: Record<Exclude<Tab, 'all'>, (o: Row) => boolean> = {
  awaiting: (o) => o.status === 'placed',
  assign: (o) => o.status === 'paid' && o.fulfilment === 'delivery' && !o.distributor,
  active: (o) => ['assigned', 'out_for_delivery', 'ready'].includes(o.status) || (o.status === 'paid' && (o.fulfilment === 'pickup' || !!o.distributor)),
  done: (o) => ['delivered', 'collected'].includes(o.status),
  failed: (o) => o.status === 'delivery_failed',
};
const PAGE = 10;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }).toUpperCase();

export default function OrdersPage() {
  const { user } = useSession();
  const canAssign = !!user?.roles.some((r) => r === 'sales' || r === 'ceo');
  const toast = useToast();
  const wide = useWide();

  const [date, setDate] = useState(lagosToday());
  const [tab, setTab] = useState<Tab>('all');
  const [status, setStatus] = useState('');
  const [fulfilment, setFulfilment] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [distributorId, setDistributorId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ date, limit: '200' });
    if (fulfilment) p.set('fulfilment', fulfilment);
    if (query) p.set('q', query);
    return p.toString();
  }, [date, fulfilment, query]);

  const orders = useQuery<{ data: Row[] }>(`staff/orders?${params}`);
  const distributors = useQuery<{ data: Distributor[] }>(canAssign ? 'staff/distributors' : null);
  const all = useMemo(() => orders.data?.data ?? [], [orders.data]);

  useEffect(() => { setPicked(new Set()); setPage(1); }, [params, tab, status]);

  const counts = useMemo(() => ({
    all: all.length, awaiting: all.filter(GROUP.awaiting).length, assign: all.filter(GROUP.assign).length,
    active: all.filter(GROUP.active).length, done: all.filter(GROUP.done).length, failed: all.filter(GROUP.failed).length,
  }), [all]);
  const filtered = useMemo(() => all.filter((o) => (tab === 'all' || GROUP[tab](o)) && (!status || o.status === status)).sort((a, b) => b.placed_at.localeCompare(a.placed_at)), [all, tab, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const assignable = rows.filter(GROUP.assign);
  const syncedAt = useMemo(() => time(new Date().toISOString()), [orders.data]);
  const refresh = useCallback(() => { void orders.reload(); }, [orders]);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allPicked = assignable.length > 0 && assignable.every((o) => picked.has(o.id));
  const reset = () => { setTab('all'); setStatus(''); setFulfilment(''); setQ(''); setDate(lagosToday()); };

  async function assign(ids: string[], then?: () => void) {
    setAssigning(true);
    try {
      await api('staff/orders/assign', { body: { order_ids: ids, distributor_id: distributorId } });
      toast(`${ids.length} order${ids.length === 1 ? '' : 's'} assigned`);
      setPicked(new Set());
      refresh();
      then?.();
    } catch (e) {
      const probs = e instanceof ApiError && Array.isArray(e.details) ? (e.details as { order_no?: string; reason: string }[]).map((p) => `${p.order_no ?? ''} ${titleCase(p.reason)}`).join('; ') : '';
      toast(errorText(e) + (probs ? ` (${probs})` : ''), 'bad');
    } finally {
      setAssigning(false);
    }
  }

  const panel = openId ? (
    <OrderPanel id={openId} canManage={canAssign} distributors={distributors.data?.data ?? []} onClose={() => setOpenId(null)} onChanged={refresh} />
  ) : null;

  return (
    <>
      <PageHeader title="Orders" subtitle="Manage and track every order for the selected delivery day"
        actions={
          <Button variant="secondary" disabled={filtered.length === 0} onClick={() => downloadCsv(`orders-${date}.csv`, ['Order', 'Customer', 'Type', 'Area', 'Address', 'Bread', 'Total (NGN)', 'Payment', 'Payment status', 'Status', 'Distributor'], filtered.map((o) => [o.order_no, o.business_name, o.fulfilment, o.area, o.address, o.bread_count, o.total_kobo / 100, o.payment?.method, o.payment?.status, o.status, o.distributor?.full_name]))}>
            <Icon name="download" size={16} />Export CSV
          </Button>
        } />

      <div className="mb-4">
        <FilterTabs<Tab> value={tab} onChange={setTab} tabs={[
          { key: 'all', label: 'All orders', count: counts.all }, { key: 'awaiting', label: 'Awaiting payment', count: counts.awaiting },
          { key: 'assign', label: 'To assign', count: counts.assign }, { key: 'active', label: 'In progress', count: counts.active },
          { key: 'done', label: 'Completed', count: counts.done }, { key: 'failed', label: 'Failed', count: counts.failed },
        ]} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search order or customer" />
        <DateField value={date} onChange={(v) => v && setDate(v)} label="Delivery date" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={fulfilment} onChange={(e) => setFulfilment(e.target.value)} aria-label="Filter by delivery or pickup">
          <option value="">All fulfilment</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option>
        </Select>
        <button onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>

      {canAssign && picked.size > 0 && (
        <div className="sticky top-20 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-navy p-3 pl-5 text-white shadow-soft">
          <span className="font-semibold">{picked.size} selected</span>
          <Select value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className="w-56 text-navy" aria-label="Distributor">
            <option value="">Choose distributor</option>
            {(distributors.data?.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
          <Button busy={assigning} disabled={!distributorId} className="bg-orange hover:bg-orange/90" onClick={() => assign([...picked])}>Assign</Button>
          <button className="ml-auto pr-2 text-sm underline" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      {canAssign && distributors.data && distributors.data.data.length === 0 && counts.assign > 0 && (
        <p className="mb-4 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">There are no distributors yet. The CEO can add them under Team.</p>
      )}
      {orders.error && <div className="mb-4"><ErrorNote message={orders.error} onRetry={orders.reload} /></div>}

      <div className={`grid items-start gap-5 ${openId && wide ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'}`}>
        <div>
        <Card className="p-5">
          <h2 className="text-lg font-bold">{date === lagosToday() ? 'Today’s orders' : `Orders for ${formatDate(date)}`}</h2>
          <p className="mb-4 text-xs text-muted">Latest first · Last synced {syncedAt}</p>
          {!orders.data ? <div className="space-y-3 p-1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            : filtered.length === 0 ? <EmptyState title="No orders found" text="Try another day or clear the filters." />
            : (
              <>
                <div className="overflow-hidden rounded-xl"><Table head={[canAssign ? <input key="all" type="checkbox" aria-label="Select all assignable orders on this page" checked={allPicked} disabled={assignable.length === 0} onChange={() => setPicked(allPicked ? new Set() : new Set(assignable.map((o) => o.id)))} /> : '', 'Order', 'Customer', 'Items', 'Total', 'Time', 'Type', 'Status']}>
                  {rows.map((o) => {
                    const can = canAssign && GROUP.assign(o);
                    const [first, ...rest] = o.items;
                    return (
                      <tr key={o.id} className={`cursor-pointer hover:bg-cream/60 ${openId === o.id ? 'bg-brand-soft/40' : ''}`} onClick={() => setOpenId(o.id)}>
                        <Td className="w-10"><input type="checkbox" aria-label={`Select ${o.order_no}`} disabled={!can} checked={picked.has(o.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(o.id)} /></Td>
                        <Td className="font-semibold whitespace-nowrap text-brand">{o.order_no}</Td>
                        <Td><p className="font-semibold">{o.business_name}</p><p className="text-xs text-muted">{o.area ?? (o.fulfilment === 'pickup' ? 'Office pickup' : '—')}</p></Td>
                        <Td className="whitespace-nowrap">{first ? `${first.name} × ${first.quantity}` : '—'}{rest.length > 0 && <span className="ml-1 text-xs text-muted">+{rest.length} more</span>}</Td>
                        <Td className="font-semibold whitespace-nowrap tnum">{formatNaira(o.total_kobo)}</Td>
                        <Td className="whitespace-nowrap text-muted tnum">{time(o.placed_at)}</Td>
                        <Td><Badge tone={o.fulfilment === 'pickup' ? 'orange' : 'neutral'}>{o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</Badge></Td>
                        <Td><StatusBadge status={o.status} /></Td>
                      </tr>
                    );
                  })}
                </Table></div>
              </>
            )}
        </Card>
        <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={setPage} />
        </div>
        {openId && wide && <div className="sticky top-24">{panel}</div>}
      </div>
      {!wide && (
        <Drawer open={!!openId} onClose={() => setOpenId(null)} title="Order details">{panel}</Drawer>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-t border-line px-5 py-4 first:border-t-0"><h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>{children}</div>;
}

function OrderPanel({ id, canManage, distributors, onClose, onChanged }: { id: string; canManage: boolean; distributors: Distributor[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const q = useQuery<Detail>(`staff/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const o = q.data && q.data.id === id ? q.data : null;
  useEffect(() => setPick(''), [id]);

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
  const unassigned = !!o && o.status === 'paid' && o.fulfilment === 'delivery' && !o.distributor;

  return (
    <Card className="max-h-[calc(100vh-8rem)] overflow-auto">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-lg font-bold text-brand">{o?.order_no ?? 'Order'}</p>
          {o && <p className="mt-0.5 text-xs text-muted">{o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'} · {formatDateTime(o.placed_at)}</p>}
          {o && <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={o.status} />{o.payment && <Badge tone={o.payment.status === 'succeeded' ? 'ok' : o.payment.status === 'failed' ? 'bad' : 'warn'}>{o.payment.status === 'succeeded' ? 'Paid' : titleCase(o.payment.status)} · {o.payment.method === 'paystack' ? 'Paystack' : 'Cash'}</Badge>}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="Close details" className="rounded-lg p-1.5 hover:bg-cream-2"><Icon name="close" size={18} /></button>
        </div>
      </div>
      {q.error && <div className="p-4"><ErrorNote message={q.error} onRetry={q.reload} /></div>}
      {!o ? <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-32" /><Skeleton className="h-24" /></div> : (
        <>
          <Section title="Customer">
            <p className="text-lg font-bold">{o.business_name}</p>
            {o.customer.phone && <p className="mt-1 text-sm text-muted">{o.customer.phone}{o.customer.contact_name ? ` · ${o.customer.contact_name}` : ''}</p>}
            <p className="mt-1 flex items-start gap-2 text-sm text-muted"><Icon name="orders" size={15} className="mt-0.5 shrink-0" />{o.fulfilment === 'pickup' ? 'Office pickup' : [o.address, o.area].filter(Boolean).join(', ') || 'No address'}</p>
            {o.customer.phone && <a href={`tel:${o.customer.phone}`} className="mt-2 inline-block text-sm font-semibold text-orange hover:underline">Contact customer ↗</a>}
          </Section>
          <Section title="Items">
            <ul className="space-y-1.5 text-sm">{o.items.map((i) => <li key={i.name} className="flex justify-between"><span>{i.name}</span><b className="tnum">× {formatNumber(i.quantity)}</b></li>)}</ul>
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Bread</dt><dd className="tnum">{formatNaira(o.subtotal_kobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Paystack fee</dt><dd className="tnum">{formatNaira(o.paystack_fee_kobo)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="tnum">{formatNaira(o.total_kobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Payment</dt><dd>{o.payment ? `${o.payment.method === 'paystack' ? 'Paystack' : 'Office cash'} · ${titleCase(o.payment.status)}` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Savings earned</dt><dd className="tnum">{formatNaira(o.savings_kobo)}</dd></div>
            </dl>
          </Section>

          {(o.distributor || o.delivery?.failed_reason || (canManage && (unassigned || o.status === 'assigned' || o.fulfilment === 'pickup'))) && (
            <Section title="Fulfilment">
              {o.distributor && <p className="mb-3 text-sm"><span className="text-muted">Distributor: </span><b>{o.distributor.full_name}</b></p>}
              {o.delivery?.failed_reason && <div className="mb-3"><ErrorNote message={`Delivery failed: ${titleCase(o.delivery.failed_reason)}${o.delivery.failure_note ? ` (${o.delivery.failure_note})` : ''}`} /></div>}
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {o.fulfilment === 'pickup' && o.status === 'paid' && <Button busy={busy} onClick={() => act(`staff/orders/${o.id}/ready`, {}, 'Marked ready for pickup')}>Mark ready for pickup</Button>}
                  {o.fulfilment === 'pickup' && o.status === 'ready' && <Button busy={busy} onClick={() => act(`staff/orders/${o.id}/collected`, {}, 'Marked collected')}>Mark collected</Button>}
                  {unassigned && (
                    <>
                      <Select value={pick} onChange={(e) => setPick(e.target.value)} className="w-48" aria-label="Distributor">
                        <option value="">Choose distributor</option>{distributors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                      </Select>
                      <Button busy={busy} disabled={!pick} onClick={() => act('staff/orders/assign', { order_ids: [o.id], distributor_id: pick }, 'Order assigned')}>Assign</Button>
                    </>
                  )}
                  {o.status === 'assigned' && (
                    <>
                      <Select value={pick} onChange={(e) => setPick(e.target.value)} className="w-48" aria-label="Move to distributor">
                        <option value="">Move to…</option>{distributors.filter((d) => d.id !== o.distributor?.id).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                      </Select>
                      <Button variant="secondary" busy={busy} disabled={!pick} onClick={() => act(`staff/orders/${o.id}/reassign`, { distributor_id: pick }, 'Moved to another distributor')}>Move</Button>
                    </>
                  )}
                </div>
              )}
            </Section>
          )}

          {o.delivery && o.delivery.photos.length > 0 && (
            <Section title="Delivery photo">
              <div className="flex flex-wrap gap-2">
                {o.delivery.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.key} href={`/api/proxy/files?key=${encodeURIComponent(p.key)}`} target="_blank" rel="noreferrer"><img src={`/api/proxy/files?key=${encodeURIComponent(p.key)}`} alt={`Delivery proof taken ${formatDateTime(p.taken_at)}`} className="h-24 w-24 rounded-xl object-cover" /></a>
                ))}
              </div>
            </Section>
          )}

          <Section title="Timeline">
            <ol className="space-y-3">
              {o.timeline.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${i === o.timeline.length - 1 ? 'bg-brand' : 'bg-line'}`} />
                  <div><p className="font-semibold">{ORDER_STATUS[t.status]?.label ?? t.status}</p><p className="text-xs text-muted">{formatDateTime(t.at)}</p>{t.note && <p className="text-xs text-muted">{t.note}</p>}</div>
                </li>
              ))}
            </ol>
          </Section>
        </>
      )}
    </Card>
  );
}
