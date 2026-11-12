'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, errorText } from '@/lib/api';
import { formatDateTime, formatNumber, lagosToday, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useWide } from '@/lib/use-wide';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, Drawer, EmptyState, ErrorNote, Field, FilterTabs, Input, Modal, PageHeader, Pager, SearchBox, Select, Skeleton, StatCard, Table, Td, useToast } from '@/components/ui';

interface Issue {
  id: string; order_id: string; order_no: string; business_name: string; issue_type: string; quantity: number | null; note: string | null;
  status: 'open' | 'settled'; reporter_role: string; reported_by: string; photo_keys: string[]; created_at: string; settled_at: string | null;
}
interface OrderOpt { id: string; order_no: string; business_name: string }

type Tab = 'all' | 'open' | 'settled';
const PAGE = 10;
const TYPES: Record<string, string> = { missing: 'Missing bread', damaged: 'Damaged bread', wrong_quantity: 'Wrong quantity', other: 'Other' };
const kind = (t: string) => TYPES[t] ?? titleCase(t);
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 10);

export default function IssuesPage() {
  const wide = useWide();
  const [tab, setTab] = useState<Tab>('open');
  const [type, setType] = useState('');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [logging, setLogging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const issues = useQuery<{ data: Issue[] }>('staff/issues');
  const all = useMemo(() => issues.data?.data ?? [], [issues.data]);

  const counts = useMemo(() => ({ all: all.length, open: all.filter((i) => i.status === 'open').length, settled: all.filter((i) => i.status === 'settled').length }), [all]);
  const today = lagosToday();
  const openLoaves = all.filter((i) => i.status === 'open').reduce((n, i) => n + (i.quantity ?? 0), 0);
  const todayCount = all.filter((i) => dayKey(i.created_at) === today).length;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((i) => (tab === 'all' || i.status === tab) && (!type || i.issue_type === type) && (!who || i.reporter_role === who) && (!t || i.order_no.toLowerCase().includes(t) || i.business_name.toLowerCase().includes(t)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [all, tab, type, who, q]);
  useEffect(() => setPage(1), [tab, type, who, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);
  const reset = () => { setTab('open'); setType(''); setWho(''); setQ(''); };
  const picked = all.find((i) => i.id === openId) ?? null;

  const panel = picked ? <IssuePanel issue={picked} onClose={() => setOpenId(null)} /> : null;

  return (
    <>
      <PageHeader title="Order issues" subtitle="Problems reported by customers, distributors and staff. They are settled in the daily reconciliation."
        actions={<>
          <Link href="/reconciliation" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-cream-2"><Icon name="check" size={16} />Go to reconciliation</Link>
          <Button variant="secondary" disabled={filtered.length === 0} onClick={() => downloadCsv('issues.csv', ['Order', 'Customer', 'Problem', 'Loaves', 'Note', 'Reported by', 'Role', 'When', 'Status'], filtered.map((i) => [i.order_no, i.business_name, kind(i.issue_type), i.quantity, i.note, i.reported_by, i.reporter_role, i.created_at, i.status]))}><Icon name="download" size={16} />Export CSV</Button>
          <Button className="bg-side-2 hover:bg-side" onClick={() => setLogging(true)}><Icon name="plus" size={16} />Log an issue</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!issues.data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />) : (
          <>
            <StatCard label="Open issues" value={String(counts.open)} hint={counts.open ? 'Waiting for reconciliation' : 'Nothing waiting'} onClick={counts.open ? () => setTab('open') : undefined} />
            <StatCard label="Settled" value={String(counts.settled)} hint="Closed in reconciliation" />
            <StatCard label="Loaves affected" value={formatNumber(openLoaves)} hint="Across open issues" />
            <StatCard label="Reported today" value={String(todayCount)} hint="Since midnight" />
          </>
        )}
      </div>

      <div className="mb-4"><FilterTabs<Tab> value={tab} onChange={setTab} tabs={[{ key: 'open', label: 'Open', count: counts.open }, { key: 'settled', label: 'Settled', count: counts.settled }, { key: 'all', label: 'All issues', count: counts.all }]} /></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search order or customer" />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by problem"><option value="">All problems</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by reporter"><option value="">All reporters</option><option value="customer">Customer</option><option value="distributor">Distributor</option><option value="sales">Staff</option></Select>
        <button onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>

      {issues.error && <div className="mb-4"><ErrorNote message={issues.error} onRetry={issues.reload} /></div>}
      <div className={`grid items-start gap-5 ${picked && wide ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'}`}>
        <div>
          <Card className="p-5">
            <h2 className="text-lg font-bold">Reported issues</h2>
            <p className="mb-4 text-xs text-muted">Latest first</p>
            {!issues.data ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : filtered.length === 0 ? <EmptyState title={tab === 'open' && counts.open === 0 ? 'No open issues' : 'No issues found'} text="Try another tab or clear the filters." /> : (
                <div className="overflow-hidden rounded-xl">
                  <Table head={['Order', 'Customer', 'Problem', 'Reported by', 'When', 'Status']}>
                    {view.map((i) => (
                      <tr key={i.id} onClick={() => setOpenId(i.id)} className={`cursor-pointer hover:bg-cream/60 ${openId === i.id ? 'bg-brand-soft/40' : ''}`}>
                        <Td className="font-semibold whitespace-nowrap text-brand">{i.order_no}</Td>
                        <Td className="font-semibold">{i.business_name}</Td>
                        <Td><p>{kind(i.issue_type)}{i.quantity ? ` · ${formatNumber(i.quantity)} loaves` : ''}</p>{i.note && <p className="max-w-56 truncate text-xs text-muted">{i.note}</p>}</Td>
                        <Td>{i.reported_by}<p className="text-xs text-muted">{titleCase(i.reporter_role)}</p></Td>
                        <Td className="whitespace-nowrap text-muted">{formatDateTime(i.created_at)}</Td>
                        <Td><Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{titleCase(i.status)}</Badge></Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
          </Card>
          <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={setPage} noun="issues" />
        </div>
        {picked && wide && <div className="sticky top-24">{panel}</div>}
      </div>
      {!wide && <Drawer open={!!picked} onClose={() => setOpenId(null)} title="Issue details">{panel}</Drawer>}

      <LogModal open={logging} onClose={() => setLogging(false)} onDone={() => { setLogging(false); void issues.reload(); }} />
    </>
  );
}

function IssuePanel({ issue: i, onClose }: { issue: Issue; onClose: () => void }) {
  return (
    <Card className="max-h-[calc(100vh-8rem)] overflow-auto">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-lg font-bold text-brand">{i.order_no}</p>
          <p className="mt-0.5 text-xs text-muted">Reported {formatDateTime(i.created_at)}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{titleCase(i.status)}</Badge><Badge tone="neutral">{kind(i.issue_type)}</Badge></div>
        </div>
        <button onClick={onClose} aria-label="Close details" className="rounded-lg p-1.5 hover:bg-cream-2"><Icon name="close" size={18} /></button>
      </div>
      <div className="space-y-4 px-5 py-4 text-sm">
        <div><p className="text-xs font-semibold tracking-wide text-muted uppercase">Customer</p><p className="mt-1 text-base font-bold">{i.business_name}</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-cream/70 px-3 py-2.5"><p className="text-xs text-muted">Loaves affected</p><p className="mt-0.5 font-bold tnum">{i.quantity ? formatNumber(i.quantity) : '—'}</p></div>
          <div className="rounded-xl bg-cream/70 px-3 py-2.5"><p className="text-xs text-muted">Reported by</p><p className="mt-0.5 font-bold">{i.reported_by}</p><p className="text-xs text-muted">{titleCase(i.reporter_role)}</p></div>
        </div>
        <div><p className="text-xs font-semibold tracking-wide text-muted uppercase">Note</p><p className="mt-1">{i.note || <span className="text-muted">No note added.</span>}</p></div>
        {i.photo_keys.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Photos</p>
            <div className="flex flex-wrap gap-2">{i.photo_keys.map((k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={k} href={`/api/proxy/files?key=${encodeURIComponent(k)}`} target="_blank" rel="noreferrer"><img src={`/api/proxy/files?key=${encodeURIComponent(k)}`} alt="Issue photo" className="size-24 rounded-xl object-cover" /></a>
            ))}</div>
          </div>
        )}
        {i.status === 'settled'
          ? <p className="rounded-xl bg-ok-soft px-3 py-2 text-ok">Settled {i.settled_at ? formatDateTime(i.settled_at) : ''}</p>
          : <Link href="/reconciliation" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold hover:bg-cream-2">Settle in reconciliation<Icon name="arrow" size={16} /></Link>}
      </div>
    </Card>
  );
}

function LogModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(lagosToday());
  const orders = useQuery<{ data: OrderOpt[] }>(open ? `staff/orders?date=${date}&limit=200` : null);
  const [orderId, setOrderId] = useState('');
  const [type, setType] = useState('damaged');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setOrderId(''); setType('damaged'); setQty(''); setNote(''); setError(null); } }, [open]);
  const needsQty = type !== 'other';
  const list = useMemo(() => orders.data?.data ?? [], [orders.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`orders/${orderId}/issues`, { body: { issue_type: type, ...(qty ? { quantity: Math.round(Number(qty)) } : {}), ...(note ? { note } : {}) } });
      toast('Issue logged');
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log an order issue" subtitle="Record a problem with an order so it can be settled in reconciliation">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Delivery date"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setOrderId(''); }} /></Field>
        <Field label="Order"><Select value={orderId} onChange={(e) => setOrderId(e.target.value)} required><option value="">{orders.loading ? 'Loading…' : list.length ? 'Choose an order' : 'No orders on this day'}</option>{list.map((o) => <option key={o.id} value={o.id}>{o.order_no} · {o.business_name}</option>)}</Select></Field>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Problem</span>
          <div className="grid grid-cols-2 gap-2">{Object.entries(TYPES).map(([k, v]) => <button type="button" key={k} onClick={() => setType(k)} aria-pressed={type === k} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${type === k ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:bg-cream-2'}`}>{v}</button>)}</div>
        </div>
        {needsQty && <Field label="How many loaves"><Input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>}
        <Field label={type === 'other' ? 'Describe the problem' : 'Note (optional)'}><Input value={note} onChange={(e) => setNote(e.target.value)} minLength={type === 'other' ? 3 : undefined} maxLength={500} required={type === 'other'} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={!orderId}>Log issue</Button></div>
      </form>
    </Modal>
  );
}
