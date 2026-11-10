'use client';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, formatNaira, formatNumber, lagosToday, shiftDate, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, ORDER_STATUS, PageHeader, Select, Skeleton, Stat, Table, Td, useToast } from '@/components/ui';

interface View {
  date: string;
  reconciliation: { id: string; status: 'open' | 'closed'; closed_at: string | null; note: string | null } | null;
  orders: { total: number; by_status: Record<string, number>; loaves_ordered: number; loaves_delivered: number };
  money_paid_kobo: Record<string, number>;
  delivered_but_unpaid: { order_id: string; order_no: string; business_name: string; total_kobo: number; method: string | null }[];
  bread: { produced: number; returned: number; leftover_to_sales: number };
  items: { id: string; item_type: string; order_no: string | null; issue_id: string | null; quantity: number | null; amount_kobo: number | null; resolution: string | null; note: string | null }[];
  open_issues: { id: string; order_no: string; business_name: string; issue_type: string; quantity: number | null; note: string | null; reported: string }[];
}
interface OrderOpt { id: string; order_no: string; business_name: string }

export default function ReconciliationPage() {
  const toast = useToast();
  const [date, setDate] = useState(lagosToday());
  const view = useQuery<View>(`staff/reconciliation?date=${date}`);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState<View['open_issues'][number] | null>(null);
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState(false);
  const v = view.data;
  const rec = v?.reconciliation;
  const isOpen = rec?.status === 'open';

  async function open() {
    setBusy(true);
    try { await api('staff/reconciliation/open', { body: { date } }); await view.reload(); } catch (e) { toast(errorText(e), 'bad'); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Daily reconciliation" subtitle={`${formatDate(date)}. Settle issues, record returns and check payments, then close the day.`}
        actions={
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
            <button aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-2 hover:bg-cream-2"><Icon name="left" size={18} /></button>
            <input type="date" value={date} max={lagosToday()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="bg-transparent px-1 text-sm font-semibold" />
            <button aria-label="Next day" disabled={date >= lagosToday()} onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-2 hover:bg-cream-2 disabled:opacity-30"><Icon name="right" size={18} /></button>
          </div>
        } />
      {view.error && <div className="mb-4"><ErrorNote message={view.error} onRetry={view.reload} /></div>}

      {!v ? <Skeleton className="h-64" /> : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {!rec && <Button busy={busy} onClick={open}>Start reconciliation</Button>}
            {rec && <Badge tone={isOpen ? 'warn' : 'ok'}>{isOpen ? 'Open' : 'Closed'}</Badge>}
            {isOpen && <><Button variant="secondary" onClick={() => setAdding(true)}>Add return or payment mismatch</Button><Button variant="secondary" onClick={() => setClosing(true)}>Close the day</Button></>}
            {rec?.status === 'closed' && rec.note && <span className="text-sm text-muted">Note: {rec.note}</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Orders" value={formatNumber(v.orders.total)} hint={`${formatNumber(v.orders.loaves_delivered)} of ${formatNumber(v.orders.loaves_ordered)} loaves delivered`} />
            <Stat label="Paystack" value={formatNaira(v.money_paid_kobo.paystack ?? 0, { compact: true })} tone="brand" />
            <Stat label="Office cash" value={formatNaira(v.money_paid_kobo.office_cash ?? 0, { compact: true })} />
            <Stat label="Bread returned" value={formatNumber(v.bread.returned)} hint={`${formatNumber(v.bread.leftover_to_sales)} leftover passed to sales`} tone={v.bread.returned ? 'orange' : undefined} />
          </div>

          <Card className="mt-6">
            <h2 className="p-6 pb-2 text-lg font-bold">Open issues <span className="text-sm font-normal text-muted">(any day, until settled)</span></h2>
            {v.open_issues.length === 0 ? <EmptyState title="No open issues" /> : (
              <Table head={['Order', 'Customer', 'Problem', 'Reported', '']}>
                {v.open_issues.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-semibold">{i.order_no}</Td><Td>{i.business_name}</Td>
                    <Td><b>{titleCase(i.issue_type)}</b>{i.quantity ? ` · ${i.quantity} loaves` : ''}{i.note && <p className="text-xs text-muted">{i.note}</p>}</Td>
                    <Td className="text-muted">{formatDate(i.reported)}</Td>
                    <Td className="text-right">{isOpen ? <Button size="sm" onClick={() => setSettling(i)}>Settle</Button> : <span className="text-xs text-muted">{rec ? 'Day closed' : 'Start the day first'}</span>}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="p-6 pb-2 text-lg font-bold">Delivered but not paid</h2>
            {v.delivered_but_unpaid.length === 0 ? <EmptyState title="Everything delivered is paid" /> : (
              <Table head={['Order', 'Customer', 'Total', 'Method']}>
                {v.delivered_but_unpaid.map((o) => <tr key={o.order_id}><Td className="font-semibold">{o.order_no}</Td><Td>{o.business_name}</Td><Td>{formatNaira(o.total_kobo)}</Td><Td>{o.method ? (o.method === 'paystack' ? 'Paystack' : 'Office cash') : '—'}</Td></tr>)}
              </Table>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="p-6 pb-2 text-lg font-bold">Recorded today</h2>
            {v.items.length === 0 ? <EmptyState title="Nothing recorded yet" text="Settled issues, returns and payment mismatches show here." /> : (
              <Table head={['Type', 'Order', 'Detail', 'Resolution']}>
                {v.items.map((i) => (
                  <tr key={i.id}>
                    <Td><Badge tone={i.item_type === 'issue' ? 'ok' : i.item_type === 'return' ? 'orange' : 'warn'}>{titleCase(i.item_type)}</Badge></Td>
                    <Td className="font-semibold">{i.order_no ?? '—'}</Td>
                    <Td>{i.quantity ? `${i.quantity} loaves` : i.amount_kobo ? formatNaira(i.amount_kobo) : '—'}</Td>
                    <Td>{i.resolution}{i.note && <p className="text-xs text-muted">{i.note}</p>}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <p className="mt-4 text-xs text-muted">Orders today by status: {Object.entries(v.orders.by_status).map(([s, n]) => `${ORDER_STATUS[s]?.label ?? s} ${n}`).join(', ') || 'none'}</p>
        </>
      )}

      {rec && <>
        <SettleModal reconId={rec.id} issue={settling} onClose={() => setSettling(null)} onDone={() => { setSettling(null); void view.reload(); }} />
        <AddModal reconId={rec.id} date={date} open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void view.reload(); }} />
        <CloseModal reconId={rec.id} open={closing} unpaid={v?.delivered_but_unpaid.length ?? 0} openIssues={v?.open_issues.length ?? 0} onClose={() => setClosing(false)} onDone={() => { setClosing(false); void view.reload(); }} />
      </>}
    </>
  );
}

function useAction(onDone: () => void, success: string) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { busy, error, clear: () => setError(null), async run(fn: () => Promise<unknown>) { setBusy(true); setError(null); try { await fn(); toast(success); onDone(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } } };
}

function SettleModal({ reconId, issue, onClose, onDone }: { reconId: string; issue: View['open_issues'][number] | null; onClose: () => void; onDone: () => void }) {
  const a = useAction(onDone, 'Issue settled');
  const [resolution, setResolution] = useState('');
  useEffect(() => { setResolution(''); a.clear(); }, [issue]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={!!issue} onClose={onClose} title={`Settle ${issue?.order_no ?? ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); void a.run(() => api(`staff/reconciliation/${reconId}/issues/${issue!.id}/settle`, { body: { resolution } })); }} className="space-y-4">
        {a.error && <ErrorNote message={a.error} />}
        <p className="text-sm"><b>{issue && titleCase(issue.issue_type)}</b>{issue?.quantity ? ` · ${issue.quantity} loaves` : ''} for {issue?.business_name}. The reporter is notified.</p>
        <Field label="How was it settled?"><Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. 3 loaves replaced next delivery" minLength={3} maxLength={300} required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={a.busy}>Mark settled</Button></div>
      </form>
    </Modal>
  );
}

function AddModal({ reconId, date, open, onClose, onDone }: { reconId: string; date: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const a = useAction(onDone, 'Recorded');
  const orders = useQuery<{ data: OrderOpt[] }>(open ? `staff/orders?date=${date}&limit=200` : null);
  const [type, setType] = useState<'return' | 'payment_mismatch'>('return');
  const [orderId, setOrderId] = useState('');
  const [qty, setQty] = useState('');
  const [naira, setNaira] = useState('');
  const [resolution, setResolution] = useState('');
  useEffect(() => { if (open) { setType('return'); setOrderId(''); setQty(''); setNaira(''); setResolution(''); a.clear(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = orders.data?.data ?? [];
  return (
    <Modal open={open} onClose={onClose} title="Add to reconciliation">
      <form onSubmit={(e) => { e.preventDefault(); void a.run(() => api(`staff/reconciliation/${reconId}/items`, { body: { item_type: type, order_id: orderId, resolution, ...(type === 'return' ? { quantity: Math.round(Number(qty)) } : { amount_kobo: Math.round(Number(naira) * 100) }) } })); }} className="space-y-4">
        {a.error && <ErrorNote message={a.error} />}
        <Field label="What happened"><Select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="return">Bread came back (return)</option><option value="payment_mismatch">Payment does not match</option></Select></Field>
        <Field label="Order"><Select value={orderId} onChange={(e) => setOrderId(e.target.value)} required><option value="">{list.length ? 'Choose an order' : 'No orders on this day'}</option>{list.map((o) => <option key={o.id} value={o.id}>{o.order_no} · {o.business_name}</option>)}</Select></Field>
        {type === 'return' ? <Field label="Loaves returned"><Input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
          : <Field label="Amount that does not match (₦)"><Input type="number" min={1} step="any" inputMode="decimal" value={naira} onChange={(e) => setNaira(e.target.value)} required /></Field>}
        <Field label="Resolution"><Input value={resolution} onChange={(e) => setResolution(e.target.value)} minLength={3} maxLength={300} placeholder={type === 'return' ? 'e.g. returned to the salesperson' : 'e.g. customer paid the balance in cash'} required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={a.busy} disabled={!orderId}>Save</Button></div>
      </form>
    </Modal>
  );
}

function CloseModal({ reconId, open, unpaid, openIssues, onClose, onDone }: { reconId: string; open: boolean; unpaid: number; openIssues: number; onClose: () => void; onDone: () => void }) {
  const a = useAction(onDone, 'Day closed');
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setNote(''); a.clear(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Close the day">
      <form onSubmit={(e) => { e.preventDefault(); void a.run(() => api(`staff/reconciliation/${reconId}/close`, { body: note ? { note } : {} })); }} className="space-y-4">
        {a.error && <ErrorNote message={a.error} />}
        <p className="text-sm text-muted">Once closed, nothing more can be added to this day.</p>
        {(openIssues > 0 || unpaid > 0) && <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">{openIssues > 0 && `${openIssues} issue${openIssues === 1 ? '' : 's'} still open will carry over to the next day. `}{unpaid > 0 && `${unpaid} delivered order${unpaid === 1 ? ' is' : 's are'} not marked paid.`}</p>}
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={a.busy}>Close day</Button></div>
      </form>
    </Modal>
  );
}
