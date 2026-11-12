'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatNaira, lagosToday } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, DateField, EmptyState, ErrorNote, Field, FilterTabs, Input, Modal, PageHeader, Pager, SearchBox, Select, Skeleton, StatCard, StatusBadge, Table, Td, useToast } from '@/components/ui';

interface Row { id: string; order_no: string; business_name: string; fulfilment: string; status: string; placed_at: string; total_kobo: number; payment: { method: string; status: string } | null }
interface Recon { money_paid_kobo: Record<string, number>; delivered_but_unpaid: { order_id: string; order_no: string; business_name: string; total_kobo: number; method: string | null }[] }

type Tab = 'all' | 'paid' | 'cash' | 'paystack' | 'failed';
const PAGE = 10;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }).toUpperCase();
const is = {
  paid: (o: Row) => o.payment?.status === 'succeeded',
  cash: (o: Row) => o.payment?.method === 'office_cash' && o.payment.status === 'pending',
  paystack: (o: Row) => o.payment?.method === 'paystack' && o.payment.status === 'pending',
  failed: (o: Row) => o.payment?.status === 'failed',
};

export default function PaymentsPage() {
  const { user } = useSession();
  const toast = useToast();
  const [date, setDate] = useState(lagosToday());
  const [tab, setTab] = useState<Tab>('all');
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const orders = useQuery<{ data: Row[] }>(`staff/orders?date=${date}&limit=200`);
  const recon = useQuery<Recon>(`staff/reconciliation?date=${date}`);
  const [cash, setCash] = useState<Row | null>(null);
  const [manual, setManual] = useState(false);
  const canRecord = !!user?.roles.some((r) => r === 'accounts' || r === 'ceo');

  const all = useMemo(() => orders.data?.data ?? [], [orders.data]);
  const counts = useMemo(() => ({ all: all.length, paid: all.filter(is.paid).length, cash: all.filter(is.cash).length, paystack: all.filter(is.paystack).length, failed: all.filter(is.failed).length }), [all]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((o) => (tab === 'all' || is[tab](o)) && (!method || o.payment?.method === method) && (!t || o.order_no.toLowerCase().includes(t) || o.business_name.toLowerCase().includes(t)))
      .sort((a, b) => b.placed_at.localeCompare(a.placed_at));
  }, [all, tab, method, q]);
  useEffect(() => setPage(1), [date, tab, method, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);
  const waiting = counts.cash + counts.paystack;
  const refresh = () => { void orders.reload(); void recon.reload(); };
  const reset = () => { setTab('all'); setMethod(''); setQ(''); setDate(lagosToday()); };
  const paystackPaid = all.filter((o) => is.paid(o) && o.payment?.method === 'paystack').length;
  const cashPaid = all.filter((o) => is.paid(o) && o.payment?.method === 'office_cash').length;

  return (
    <>
      <PageHeader title="Payments" subtitle="Track every naira in, from Paystack and cash paid at the office."
        actions={<>
          {canRecord && <Button variant="secondary" onClick={() => setManual(true)}><Icon name="wallet" size={16} />Record cash by order number</Button>}
          <Button variant="secondary" disabled={filtered.length === 0} onClick={() => downloadCsv(`payments-${date}.csv`, ['Order', 'Customer', 'Method', 'Payment status', 'Total (NGN)', 'Order status'], filtered.map((o) => [o.order_no, o.business_name, o.payment?.method, o.payment?.status, o.total_kobo / 100, o.status]))}><Icon name="download" size={16} />Export CSV</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!recon.data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />) : (
          <>
            <StatCard label="Paystack received" value={formatNaira(recon.data.money_paid_kobo.paystack ?? 0)} hint={`${paystackPaid} paid orders`} />
            <StatCard label="Cash received" value={formatNaira(recon.data.money_paid_kobo.office_cash ?? 0)} hint={`${cashPaid} paid orders`} />
            <StatCard label="Orders paid" value={String(counts.paid)} hint={`of ${counts.all} orders on this day`} />
            <StatCard label="Waiting for payment" value={String(waiting)} hint={`${counts.cash} cash · ${counts.paystack} Paystack${counts.cash ? ' · tap for cash' : ''}`} onClick={counts.cash ? () => setTab('cash') : undefined} />
          </>
        )}
      </div>

      <div className="mb-4">
        <FilterTabs<Tab> value={tab} onChange={setTab} tabs={[
          { key: 'all', label: 'All payments', count: counts.all }, { key: 'paid', label: 'Paid', count: counts.paid },
          { key: 'cash', label: 'Cash to collect', count: counts.cash }, { key: 'paystack', label: 'Awaiting Paystack', count: counts.paystack }, { key: 'failed', label: 'Failed', count: counts.failed },
        ]} />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search order or customer" />
        <DateField value={date} onChange={(v) => v && setDate(v)} label="Date" />
        <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Filter by method"><option value="">All methods</option><option value="paystack">Paystack</option><option value="office_cash">Office cash</option></Select>
        <button onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>
      {(orders.error || recon.error) && <div className="mb-4"><ErrorNote message={(orders.error || recon.error)!} onRetry={refresh} /></div>}

      <Card className="p-5">
        <h2 className="text-lg font-bold">{date === lagosToday() ? 'Today’s payments' : `Payments for ${date}`}</h2>
        <p className="mb-4 text-xs text-muted">Latest first · Orders by delivery date</p>
        {!orders.data ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : filtered.length === 0 ? (
          <EmptyState title={tab === 'cash' ? 'No cash payments waiting' : 'No payments found'} text={tab === 'cash' ? 'Customers who choose to pay at the office appear here until you record the cash.' : 'Try another day or clear the filters.'} />
        ) : (
          <div className="overflow-hidden rounded-xl">
            <Table head={['Order', 'Customer', 'Method', 'Amount', 'Time', 'Payment', 'Order status', '']}>
              {view.map((o) => (
                <tr key={o.id}>
                  <Td className="font-semibold whitespace-nowrap text-brand">{o.order_no}</Td>
                  <Td className="font-semibold">{o.business_name}</Td>
                  <Td>{o.payment ? (o.payment.method === 'paystack' ? 'Paystack' : 'Office cash') : '—'}</Td>
                  <Td className="font-semibold whitespace-nowrap tnum">{formatNaira(o.total_kobo)}</Td>
                  <Td className="whitespace-nowrap text-muted tnum">{time(o.placed_at)}</Td>
                  <Td>{is.paid(o) ? <Badge tone="ok">Paid</Badge> : is.failed(o) ? <Badge tone="bad">Failed</Badge> : <Badge tone="warn">Pending</Badge>}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td className="text-right">{is.cash(o) && canRecord && <Button size="sm" onClick={() => setCash(o)}>Record cash</Button>}</Td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>
      <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={setPage} noun="payments" />
      {recon.data && recon.data.delivered_but_unpaid.length > 0 && <p className="mt-4 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">{recon.data.delivered_but_unpaid.length} delivered order(s) are not marked paid. Check them in the reconciliation.</p>}

      <CashModal orderNo={cash?.order_no ?? null} amount={cash?.total_kobo} open={!!cash} onClose={() => setCash(null)} onDone={() => { setCash(null); toast('Cash recorded'); refresh(); }} />
      <CashModal orderNo={null} open={manual} onClose={() => setManual(false)} onDone={() => { setManual(false); toast('Cash recorded'); refresh(); }} />
    </>
  );
}

function CashModal({ orderNo, amount, open, onClose, onDone }: { orderNo: string | null; amount?: number; open: boolean; onClose: () => void; onDone: () => void }) {
  const [no, setNo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setNo(orderNo ?? ''); setNote(''); setError(null); } }, [open, orderNo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('staff/payments/cash', { body: { order_no: no.trim().toUpperCase(), ...(note ? { note } : {}) } });
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record cash payment">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        {amount !== undefined && <p className="text-sm">Confirm you have received <b className="font-display text-xl">{formatNaira(amount)}</b> in cash. This cannot be undone.</p>}
        <Field label="Order number"><Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="MN-261110-AB12" readOnly={orderNo !== null} required /></Field>
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy}>Cash received</Button></div>
      </form>
    </Modal>
  );
}
