'use client';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, formatNaira, lagosToday, shiftDate } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Skeleton, Stat, StatusBadge, Table, Td, useToast } from '@/components/ui';

interface Row { id: string; order_no: string; business_name: string; fulfilment: string; status: string; total_kobo: number; payment: { method: string; status: string } | null }
interface Recon { money_paid_kobo: Record<string, number>; delivered_but_unpaid: { order_id: string; order_no: string; business_name: string; total_kobo: number; method: string | null }[] }

export default function PaymentsPage() {
  const { user } = useSession();
  const toast = useToast();
  const [date, setDate] = useState(lagosToday());
  const orders = useQuery<{ data: Row[] }>(`staff/orders?date=${date}&limit=200`);
  const recon = useQuery<Recon>(`staff/reconciliation?date=${date}`);
  const [cash, setCash] = useState<Row | null>(null);
  const [manual, setManual] = useState(false);
  const canRecord = !!user?.roles.some((r) => r === 'accounts' || r === 'ceo');

  const rows = orders.data?.data ?? [];
  const pendingCash = rows.filter((o) => o.payment?.method === 'office_cash' && o.payment.status === 'pending');
  const waitingPaystack = rows.filter((o) => o.payment?.method === 'paystack' && o.payment.status === 'pending');
  const paidCount = rows.filter((o) => o.payment?.status === 'succeeded').length;
  const refresh = () => { void orders.reload(); void recon.reload(); };

  return (
    <>
      <PageHeader title="Payments" subtitle={`${formatDate(date)}. Orders are paid with Paystack or in cash at the office.`}
        actions={<>
          <Button variant="secondary" disabled={rows.length === 0} onClick={() => downloadCsv(`payments-${date}.csv`, ['Order', 'Customer', 'Method', 'Payment status', 'Total (NGN)', 'Order status'], rows.map((o) => [o.order_no, o.business_name, o.payment?.method, o.payment?.status, o.total_kobo / 100, o.status]))}>Export CSV</Button>
          {canRecord && <Button variant="secondary" onClick={() => setManual(true)}>Record cash by order number</Button>}
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
            <button aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-2 hover:bg-cream-2"><Icon name="left" size={18} /></button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="bg-transparent px-1 text-sm font-semibold" />
            <button aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-2 hover:bg-cream-2"><Icon name="right" size={18} /></button>
          </div>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!recon.data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <Stat label="Paystack received" value={formatNaira(recon.data.money_paid_kobo.paystack ?? 0)} tone="brand" />
            <Stat label="Cash received" value={formatNaira(recon.data.money_paid_kobo.office_cash ?? 0)} />
            <Stat label="Orders paid" value={paidCount} hint={`${rows.length} orders in total`} />
            <Stat label="Waiting for payment" value={pendingCash.length + waitingPaystack.length} hint={`${pendingCash.length} cash, ${waitingPaystack.length} Paystack`} tone={pendingCash.length + waitingPaystack.length ? 'orange' : undefined} />
          </>
        )}
      </div>
      {(orders.error || recon.error) && <div className="mt-4"><ErrorNote message={(orders.error || recon.error)!} onRetry={refresh} /></div>}

      <Card className="mt-6">
        <h2 className="p-6 pb-2 text-lg font-bold">Cash to collect</h2>
        {!orders.data ? <div className="p-6"><Skeleton className="h-20" /></div> : pendingCash.length === 0 ? <EmptyState title="No cash payments waiting" text="Customers who choose to pay at the office appear here until you record the cash." /> : (
          <Table head={['Order', 'Customer', 'Amount', '']}>
            {pendingCash.map((o) => <tr key={o.id}><Td className="font-semibold">{o.order_no}</Td><Td>{o.business_name}</Td><Td className="font-display text-lg font-bold">{formatNaira(o.total_kobo)}</Td><Td className="text-right">{canRecord ? <Button size="sm" onClick={() => setCash(o)}>Record cash</Button> : <Badge tone="warn">Waiting</Badge>}</Td></tr>)}
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="p-6 pb-2 text-lg font-bold">All orders</h2>
        {!orders.data ? <div className="p-6"><Skeleton className="h-24" /></div> : rows.length === 0 ? <EmptyState title="No orders for this day" /> : (
          <Table head={['Order', 'Customer', 'Method', 'Payment', 'Total', 'Order status']}>
            {rows.map((o) => (
              <tr key={o.id}>
                <Td className="font-semibold">{o.order_no}</Td><Td>{o.business_name}</Td>
                <Td>{o.payment ? (o.payment.method === 'paystack' ? 'Paystack' : 'Office cash') : '—'}</Td>
                <Td>{o.payment?.status === 'succeeded' ? <Badge tone="ok">Paid</Badge> : o.payment?.status === 'failed' ? <Badge tone="bad">Failed</Badge> : <Badge tone="warn">Pending</Badge>}</Td>
                <Td>{formatNaira(o.total_kobo)}</Td><Td><StatusBadge status={o.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
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
