'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useWide } from '@/lib/use-wide';
import { Icon } from '@/components/icons';
import { downloadCsv } from '@/lib/export';
import {
  Avatar, Badge, Button, Card, CUSTOMER_STATUS, StatCard, Drawer, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Pager, SearchBox, Select, Skeleton, StatusBadge, Table, Td, useToast, type Tone,
} from '@/components/ui';

interface Customer {
  id: string; business_name: string; status: string; source: string; contact_name: string | null; phone: string | null; email: string | null;
  area: string | null; address: string | null; claimed_at: string | null; created_at: string; rejection_note: string | null;
  orders_count: number; total_paid_kobo: number; last_order_at: string | null;
}
interface Page { data: Customer[]; next_cursor: string | null }
interface Summary { total: number; active: number; pending_approval: number; unclaimed: number; suspended: number; rejected: number; new_this_month: number; new_today: number; ordered_last_30_days: number; returning_rate: number; savings_members: number }
interface Profile extends Customer {
  last_login_at: string | null; approved_at: string | null; avg_order_kobo: number; savings_kobo: number; issues_count: number;
  locations: { id: string; label: string; address: string; area: string; is_default: boolean }[];
  recent_orders: { id: string; order_no: string; status: string; placed_at: string; delivery_date: string; fulfilment: string; bread_count: number; total_kobo: number; payment_method: string | null; payment_status: string | null }[];
}
interface ImportResult { dry_run: boolean; rows_read: number; created?: number; would_create?: number; already_exist: number; already_exist_names: string[]; duplicates_in_file: number; invalid: { row: number; reason: string }[] }

const PAGE = 10;
const STATUS_OPTIONS = [
  { key: '', label: 'All customers' }, { key: 'pending_approval', label: 'Awaiting approval' }, { key: 'active', label: 'Active' },
  { key: 'unclaimed', label: 'Not signed up' }, { key: 'suspended', label: 'Suspended' }, { key: 'rejected', label: 'Rejected' },
];
const SINCE = [{ key: '', label: 'All time' }, { key: '7', label: 'Signed up in 7 days' }, { key: '30', label: 'Signed up in 30 days' }, { key: '365', label: 'Signed up this year' }];

/** How a customer buys, from paid orders only. */
function segment(n: number): { label: string; tone: Tone } {
  if (n === 0) return { label: 'No orders', tone: 'neutral' };
  if (n === 1) return { label: 'New', tone: 'brand' };
  if (n < 6) return { label: 'Returning', tone: 'orange' };
  return { label: 'Regular', tone: 'ok' };
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : '—');

export default function CustomersPage() {
  const wide = useWide();
  const [status, setStatus] = useState('');
  const [since, setSince] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Customer[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Customer | null>(null);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const summary = useQuery<Summary>('staff/customers/summary');

  const load = useCallback(async (after?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (status) p.set('status', status);
      if (query) p.set('q', query);
      if (after) p.set('cursor', after);
      const res = await api<Page>(`staff/customers?${p}`);
      setRows((r) => (after ? [...r, ...res.data] : res.data));
      setCursor(res.next_cursor);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [status, query, since]);
  const refresh = useCallback(() => { void load(); void summary.reload(); }, [load, summary]);

  const list = useMemo(() => {
    const cutoff = since ? Date.now() - Number(since) * 86_400_000 : 0;
    return rows
      .filter((c) => !cutoff || new Date(c.created_at).getTime() >= cutoff)
      .sort((a, b) => (b.last_order_at ?? '').localeCompare(a.last_order_at ?? '') || b.created_at.localeCompare(a.created_at));
  }, [rows, since]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice((page - 1) * PAGE, page * PAGE);
  const reset = () => { setQ(''); setStatus(''); setSince(''); };

  const sm = summary.data;
  const panel = openId ? <ProfilePanel id={openId} onClose={() => setOpenId(null)} onChanged={refresh} onReject={(c) => setRejecting(c)} /> : null;

  return (
    <>
      <PageHeader title="Customers" subtitle="Know the people who keep coming back to your table."
        actions={<>
          <Button variant="secondary" onClick={() => setImporting(true)}><Icon name="upload" size={16} />Import names</Button>
          <Button variant="secondary" disabled={list.length === 0} onClick={() => downloadCsv('customers.csv', ['Business', 'Status', 'Contact', 'Phone', 'Email', 'Area', 'Address', 'Paid orders', 'Total paid (NGN)', 'Last order', 'Signed up'], list.map((c) => [c.business_name, c.status, c.contact_name, c.phone, c.email, c.area, c.address, c.orders_count, c.total_paid_kobo / 100, c.last_order_at, c.claimed_at]))}><Icon name="download" size={16} />Export customers</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total customers" value={sm ? formatNumber(sm.total) : '…'} hint={sm ? `+${sm.new_this_month} this month` : undefined} />
        <StatCard label="Returning customer rate" value={sm ? `${(sm.returning_rate * 100).toFixed(1)}%` : '…'} hint={sm ? `${sm.ordered_last_30_days} ordered in the last 30 days` : undefined} />
        <StatCard label="Awaiting approval" value={sm ? formatNumber(sm.pending_approval) : '…'} hint={sm ? `${sm.new_today} new today · tap to review` : undefined} onClick={() => setStatus('pending_approval')} />
        <StatCard label="Savings members" value={sm ? formatNumber(sm.savings_members) : '…'} hint={sm && sm.total ? `${((sm.savings_members / sm.total) * 100).toFixed(1)}% of all customers` : undefined} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search business name" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">{STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</Select>
        <Select value={since} onChange={(e) => setSince(e.target.value)} aria-label="Filter by sign-up date">{SINCE.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</Select>
        <button onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>

      {error && <div className="mb-4"><ErrorNote message={error} onRetry={() => load()} /></div>}
      <div className={`grid items-start gap-5 ${openId && wide ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'}`}>
        <div>
          <Card className="p-5">
            <h2 className="text-lg font-bold">Customer directory</h2>
            <p className="mb-4 text-xs text-muted">Sorted by most recent order</p>
            {loading && rows.length === 0 ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : list.length === 0 ? <EmptyState title="No customers here" text={status === 'pending_approval' ? 'New sign-ups waiting for approval show up here.' : 'Try a different filter or search.'} />
              : (
                <div className="overflow-hidden rounded-xl">
                  <Table head={['Customer', 'Paid orders', 'Total paid', 'Last order', 'Segment', 'Status']}>
                    {view.map((c) => {
                      const seg = segment(c.orders_count);
                      return (
                        <tr key={c.id} className={`cursor-pointer hover:bg-cream/60 ${openId === c.id ? 'bg-orange-soft/50' : ''}`} onClick={() => setOpenId(c.id)}>
                          <Td><p className="font-semibold">{c.business_name}</p><p className="text-xs text-muted">{c.email ?? c.phone ?? 'Has not signed up'}</p></Td>
                          <Td className="tnum">{formatNumber(c.orders_count)}</Td>
                          <Td className="whitespace-nowrap tnum">{formatNaira(c.total_paid_kobo)}</Td>
                          <Td className="whitespace-nowrap">{day(c.last_order_at)}</Td>
                          <Td><Badge tone={seg.tone}>{seg.label}</Badge></Td>
                          <Td><StatusBadge status={c.status} map={CUSTOMER_STATUS} /></Td>
                        </tr>
                      );
                    })}
                  </Table>
                </div>
              )}
          </Card>
          <Pager page={page} pages={pages} total={list.length} size={PAGE} onPage={setPage} noun="customers" />
          {cursor && <div className="pt-2 text-center"><Button variant="ghost" busy={loading} onClick={() => load(cursor)}>Load more customers</Button></div>}
        </div>
        {openId && wide && <div className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-5 overflow-auto">{panel}</div>}
      </div>
      {!wide && <Drawer open={!!openId} onClose={() => setOpenId(null)} title="Customer profile"><div className="space-y-5">{panel}</div></Drawer>}

      <RejectModal customer={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); refresh(); }} />
      <ImportModal open={importing} onClose={() => setImporting(false)} onDone={() => { setImporting(false); refresh(); }} />
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-muted">{k}</span><b className="text-right tnum">{v}</b></div>;
}

function ProfilePanel({ id, onClose, onChanged, onReject }: { id: string; onClose: () => void; onChanged: () => void; onReject: (c: Customer) => void }) {
  const toast = useToast();
  const q = useQuery<Profile>(`staff/customers/${id}`);
  const [busy, setBusy] = useState(false);
  const c = q.data && q.data.id === id ? q.data : null;

  async function act(action: 'approve' | 'suspend') {
    if (!c) return;
    setBusy(true);
    try {
      await api(`staff/customers/${c.id}/${action}`, { body: {} });
      toast(action === 'approve' ? `${c.business_name} approved` : `${c.business_name} suspended`);
      await q.reload();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setBusy(false);
    }
  }

  if (!c) {
    return (
      <Card className="p-6">
        {q.error ? <ErrorNote message={q.error} onRetry={q.reload} /> : <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-32" /><Skeleton className="h-24" /></div>}
      </Card>
    );
  }
  const seg = segment(c.orders_count);
  const paid = c.recent_orders.filter((o) => !['placed', 'delivery_failed'].includes(o.status)).length;
  const failed = c.recent_orders.filter((o) => o.status === 'delivery_failed').length;
  const place = c.locations.find((l) => l.is_default) ?? c.locations[0];
  const contactHref = c.email ? `mailto:${c.email}` : c.phone ? `tel:${c.phone}` : null;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">Customer profile</h2>
          <button onClick={onClose} aria-label="Close profile" className="rounded-lg p-1 text-muted hover:bg-cream-2"><Icon name="close" size={18} /></button>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Avatar name={c.business_name} size={64} />
          <div className="min-w-0">
            <p className="text-xl leading-tight font-bold">{c.business_name}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge tone={seg.tone}>{seg.label}</Badge><StatusBadge status={c.status} map={CUSTOMER_STATUS} /></div>
          </div>
        </div>
        {c.rejection_note && <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">Rejected: {c.rejection_note}</p>}
        <div className="mt-5 space-y-1 text-sm text-muted">
          {c.contact_name && <p>{c.contact_name}</p>}
          {c.email && <p>{c.email}</p>}
          {c.phone && <p>{c.phone}</p>}
        </div>
        <div className="mt-3 divide-y divide-line/60">
          <Line k="Customer since" v={formatDate(c.created_at.slice(0, 10))} />
          <Line k="Paid orders / Total paid" v={`${c.orders_count} / ${formatNaira(c.total_paid_kobo)}`} />
          <Line k="Average order" v={formatNaira(c.avg_order_kobo)} />
          <Line k="Savings balance" v={formatNaira(c.savings_kobo)} />
        </div>
        {place && <p className="mt-3 text-sm text-muted">{place.address}, {place.area}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {contactHref && <a href={contactHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-cream-2"><Icon name="mail" size={16} />Contact customer</a>}
          {['pending_approval', 'rejected', 'suspended'].includes(c.status) && <Button busy={busy} onClick={() => act('approve')}>Approve</Button>}
          {c.status === 'pending_approval' && <Button variant="secondary" disabled={busy} onClick={() => onReject(c)}>Reject</Button>}
          {c.status === 'active' && <Button variant="secondary" busy={busy} onClick={() => act('suspend')}>Suspend</Button>}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold">Order history</h2>
        <p className="mb-4 text-xs text-muted">{paid} paid{failed ? ` · ${failed} failed` : ''}</p>
        {c.recent_orders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
          <ul className="space-y-4">
            {c.recent_orders.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3">
                <div><p className="text-sm text-muted">{o.order_no}</p><p className="text-xs text-muted">{day(o.placed_at)} · {o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</p></div>
                <div className="flex flex-col items-end gap-1.5"><b className="text-sm tnum">{formatNaira(o.total_kobo)}</b><StatusBadge status={o.status} /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function RejectModal({ customer, onClose, onDone }: { customer: Customer | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setNote(''); setError(null); }, [customer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setBusy(true);
    try {
      await api(`staff/customers/${customer.id}/reject`, { body: { note } });
      toast(`${customer.business_name} rejected`);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!customer} onClose={onClose} title={`Reject ${customer?.business_name ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">The customer sees this reason. Be short and polite.</p>
        {error && <ErrorNote message={error} />}
        <Field label="Reason"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We could not confirm this business" minLength={3} maxLength={300} required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" busy={busy}>Reject</Button></div>
      </form>
    </Modal>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setCsv(''); setPreview(null); setError(null); } }, [open]);

  async function run(dry: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<ImportResult>('staff/customers/import', { body: { csv, dry_run: dry } });
      if (dry) setPreview(res);
      else { toast(`${res.created ?? 0} customers added`); onDone(); }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import customer names" wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">Paste business names, one per line, or choose a CSV file with a <b>business_name</b> column. Customers sign up later and find their business in this list. Names already in the system are skipped.</p>
        {error && <ErrorNote message={error} />}
        <input type="file" accept=".csv,text/csv,text/plain" aria-label="Choose a CSV file" className="text-sm"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setPreview(null); } }} />
        <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} rows={8} aria-label="Business names"
          placeholder={'business_name\nMama T Bakery\nJoy Store'} className="w-full rounded-2xl border border-line bg-white p-4 text-sm" />
        {preview && (
          <div className="rounded-2xl bg-cream-2 p-4 text-sm">
            <p><b>{preview.would_create}</b> new customers will be added from {preview.rows_read} rows.</p>
            {preview.already_exist > 0 && <p className="mt-1 text-muted">{preview.already_exist} already exist and will be skipped{preview.already_exist_names.length ? `: ${preview.already_exist_names.slice(0, 5).join(', ')}${preview.already_exist > 5 ? '…' : ''}` : ''}</p>}
            {preview.duplicates_in_file > 0 && <p className="mt-1 text-muted">{preview.duplicates_in_file} repeated names in the file were ignored</p>}
            {preview.invalid.length > 0 && <p className="mt-1 text-bad">{preview.invalid.length} rows have problems (row {preview.invalid[0]!.row}: {preview.invalid[0]!.reason})</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!preview ? <Button onClick={() => run(true)} busy={busy} disabled={!csv.trim()}>Preview</Button>
            : <Button onClick={() => run(false)} busy={busy} disabled={!preview.would_create}>Add {preview.would_create} customers</Button>}
        </div>
      </div>
    </Modal>
  );
}
