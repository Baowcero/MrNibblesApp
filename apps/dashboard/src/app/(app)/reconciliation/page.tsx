'use client';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, formatNaira, formatNumber, lagosToday, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, DateField, EmptyState, ErrorNote, Field, FilterTabs, Input, Modal, ORDER_STATUS, PageHeader, Pager, Select, Skeleton, StatCard, Table, Td, useToast } from '@/components/ui';

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

type Tab = 'issues' | 'unpaid' | 'recorded';
const PAGE = 8;

export default function ReconciliationPage() {
  const toast = useToast();
  const [date, setDate] = useState(lagosToday());
  const [tab, setTab] = useState<Tab>('issues');
  const [page, setPage] = useState(1);
  const view = useQuery<View>(`staff/reconciliation?date=${date}`);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState<View['open_issues'][number] | null>(null);
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState(false);
  const v = view.data;
  const rec = v?.reconciliation;
  const isOpen = rec?.status === 'open';
  useEffect(() => setPage(1), [tab, date]);

  async function open() {
    setBusy(true);
    try { await api('staff/reconciliation/open', { body: { date } }); await view.reload(); } catch (e) { toast(errorText(e), 'bad'); } finally { setBusy(false); }
  }

  const list = v ? (tab === 'issues' ? v.open_issues : tab === 'unpaid' ? v.delivered_but_unpaid : v.items) : [];
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const from = (page - 1) * PAGE;

  function exportCsv() {
    if (!v) return;
    if (tab === 'issues') downloadCsv(`open-issues-${date}.csv`, ['Order', 'Customer', 'Problem', 'Loaves', 'Note', 'Reported'], v.open_issues.map((i) => [i.order_no, i.business_name, titleCase(i.issue_type), i.quantity, i.note, i.reported]));
    else if (tab === 'unpaid') downloadCsv(`delivered-not-paid-${date}.csv`, ['Order', 'Customer', 'Total (NGN)', 'Method'], v.delivered_but_unpaid.map((o) => [o.order_no, o.business_name, o.total_kobo / 100, o.method]));
    else downloadCsv(`reconciliation-${date}.csv`, ['Type', 'Order', 'Loaves', 'Amount (NGN)', 'Resolution', 'Note'], v.items.map((i) => [i.item_type, i.order_no, i.quantity, i.amount_kobo ? i.amount_kobo / 100 : null, i.resolution, i.note]));
  }

  const state = !rec ? { label: 'Not started', tone: 'neutral' as const } : isOpen ? { label: 'Open', tone: 'warn' as const } : { label: 'Closed', tone: 'ok' as const };

  return (
    <>
      <PageHeader title="Daily reconciliation" subtitle="Settle issues, record returns and check payments, then close the day."
        actions={<Button variant="secondary" disabled={!v || list.length === 0} onClick={exportCsv}><Icon name="download" size={16} />Export CSV</Button>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_auto]">
        <DateField value={date} max={lagosToday()} onChange={(x) => x && setDate(x)} label="Reconciliation date" />
        <button onClick={() => setDate(lagosToday())} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>
      {view.error && <div className="mb-4"><ErrorNote message={view.error} onRetry={view.reload} /></div>}

      {!v ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div> : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Orders" value={formatNumber(v.orders.total)} hint={`${formatNumber(v.orders.loaves_delivered)} of ${formatNumber(v.orders.loaves_ordered)} loaves delivered`} />
            <StatCard label="Paystack" value={formatNaira(v.money_paid_kobo.paystack ?? 0, { compact: true })} hint="Received" />
            <StatCard label="Office cash" value={formatNaira(v.money_paid_kobo.office_cash ?? 0, { compact: true })} hint="Recorded" />
            <StatCard label="Bread returned" value={formatNumber(v.bread.returned)} hint={`${formatNumber(v.bread.leftover_to_sales)} leftover passed to sales`} />
          </div>

          <div className="mb-4"><FilterTabs<Tab> value={tab} onChange={setTab} tabs={[{ key: 'issues', label: 'Open issues', count: v.open_issues.length }, { key: 'unpaid', label: 'Delivered, not paid', count: v.delivered_but_unpaid.length }, { key: 'recorded', label: 'Recorded today', count: v.items.length }]} /></div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <Card className="p-5">
                <h2 className="text-lg font-bold">{tab === 'issues' ? 'Open issues' : tab === 'unpaid' ? 'Delivered but not paid' : 'Recorded for the day'}</h2>
                <p className="mb-4 text-xs text-muted">{tab === 'issues' ? 'From any day, until settled' : tab === 'unpaid' ? 'Check these with the customer or accounts' : 'Settled issues, returns and payment mismatches'}</p>
                {list.length === 0 ? <EmptyState title={tab === 'issues' ? 'No open issues' : tab === 'unpaid' ? 'Everything delivered is paid' : 'Nothing recorded yet'} text={tab === 'recorded' ? 'Settled issues, returns and payment mismatches show here.' : undefined} /> : (
                  <div className="overflow-hidden rounded-xl">
                    {tab === 'issues' && (
                      <Table head={['Order', 'Customer', 'Problem', 'Reported', '']}>
                        {v.open_issues.slice(from, from + PAGE).map((i) => (
                          <tr key={i.id}>
                            <Td className="font-semibold whitespace-nowrap text-brand">{i.order_no}</Td><Td className="font-semibold">{i.business_name}</Td>
                            <Td><p>{titleCase(i.issue_type)}{i.quantity ? ` · ${i.quantity} loaves` : ''}</p>{i.note && <p className="max-w-56 truncate text-xs text-muted">{i.note}</p>}</Td>
                            <Td className="whitespace-nowrap text-muted">{formatDate(i.reported)}</Td>
                            <Td className="text-right">{isOpen ? <Button size="sm" onClick={() => setSettling(i)}>Settle</Button> : <span className="text-xs text-muted">{rec ? 'Day closed' : 'Start the day first'}</span>}</Td>
                          </tr>
                        ))}
                      </Table>
                    )}
                    {tab === 'unpaid' && (
                      <Table head={['Order', 'Customer', 'Total', 'Method']}>
                        {v.delivered_but_unpaid.slice(from, from + PAGE).map((o) => <tr key={o.order_id}><Td className="font-semibold whitespace-nowrap text-brand">{o.order_no}</Td><Td className="font-semibold">{o.business_name}</Td><Td className="tnum">{formatNaira(o.total_kobo)}</Td><Td>{o.method ? (o.method === 'paystack' ? 'Paystack' : 'Office cash') : '—'}</Td></tr>)}
                      </Table>
                    )}
                    {tab === 'recorded' && (
                      <Table head={['Type', 'Order', 'Detail', 'Resolution']}>
                        {v.items.slice(from, from + PAGE).map((i) => (
                          <tr key={i.id}>
                            <Td><Badge tone={i.item_type === 'issue' ? 'ok' : i.item_type === 'return' ? 'orange' : 'warn'}>{titleCase(i.item_type)}</Badge></Td>
                            <Td className="font-semibold whitespace-nowrap text-brand">{i.order_no ?? '—'}</Td>
                            <Td className="tnum">{i.quantity ? `${i.quantity} loaves` : i.amount_kobo ? formatNaira(i.amount_kobo) : '—'}</Td>
                            <Td>{i.resolution}{i.note && <p className="text-xs text-muted">{i.note}</p>}</Td>
                          </tr>
                        ))}
                      </Table>
                    )}
                  </div>
                )}
              </Card>
              <Pager page={page} pages={pages} total={list.length} size={PAGE} onPage={setPage} noun="items" />
            </div>

            <div className="space-y-5 xl:sticky xl:top-24">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="text-lg font-bold">Day status</h2><p className="text-xs text-muted">{formatDate(date)}</p></div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Open issues</dt><dd className="font-semibold tnum">{v.open_issues.length}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Delivered, not paid</dt><dd className="font-semibold tnum">{v.delivered_but_unpaid.length}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Items recorded</dt><dd className="font-semibold tnum">{v.items.length}</dd></div>
                </dl>
                {rec?.status === 'closed' && rec.note && <p className="mt-3 rounded-xl bg-cream/70 px-3 py-2 text-sm text-muted">Note: {rec.note}</p>}
                <div className="mt-5 flex flex-col gap-2">
                  {!rec && <Button busy={busy} className="bg-side-2 hover:bg-side" onClick={open}>Start reconciliation</Button>}
                  {isOpen && <>
                    <Button variant="secondary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add return or payment mismatch</Button>
                    <Button className="bg-side-2 hover:bg-side" onClick={() => setClosing(true)}>Close the day</Button>
                  </>}
                  {rec?.status === 'closed' && <p className="text-sm text-muted">This day is closed. Nothing more can be added.</p>}
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="text-lg font-bold">Orders by status</h2>
                <p className="mb-3 text-xs text-muted">Delivery date {formatDate(date)}</p>
                {Object.keys(v.orders.by_status).length === 0 ? <p className="text-sm text-muted">No orders on this day.</p> : (
                  <ul className="space-y-2.5 text-sm">{Object.entries(v.orders.by_status).map(([st, n]) => <li key={st} className="flex items-center justify-between"><Badge tone={ORDER_STATUS[st]?.tone}>{ORDER_STATUS[st]?.label ?? st}</Badge><b className="tnum">{n}</b></li>)}</ul>
                )}
              </Card>
            </div>
          </div>
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
    <Modal open={!!issue} onClose={onClose} title={`Settle ${issue?.order_no ?? ''}`} subtitle={issue?.business_name}>
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
    <Modal open={open} onClose={onClose} title="Add to reconciliation" subtitle="Record a return or a payment that does not match">
      <form onSubmit={(e) => { e.preventDefault(); void a.run(() => api(`staff/reconciliation/${reconId}/items`, { body: { item_type: type, order_id: orderId, resolution, ...(type === 'return' ? { quantity: Math.round(Number(qty)) } : { amount_kobo: Math.round(Number(naira) * 100) }) } })); }} className="space-y-4">
        {a.error && <ErrorNote message={a.error} />}
        <div>
          <span className="mb-1.5 block text-sm font-semibold">What happened</span>
          <div className="grid grid-cols-2 gap-2">{([['return', 'Bread came back'], ['payment_mismatch', 'Payment does not match']] as const).map(([k, l]) => <button type="button" key={k} onClick={() => setType(k)} aria-pressed={type === k} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${type === k ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:bg-cream-2'}`}>{l}</button>)}</div>
        </div>
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
    <Modal open={open} onClose={onClose} title="Close the day" subtitle="Lock this day once everything is settled">
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
