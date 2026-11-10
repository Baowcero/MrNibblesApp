'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, errorText } from '@/lib/api';
import { formatDateTime, formatNumber, lagosToday, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Skeleton, Table, Td, useToast } from '@/components/ui';

interface Issue {
  id: string; order_id: string; order_no: string; business_name: string; issue_type: string; quantity: number | null; note: string | null;
  status: 'open' | 'settled'; reporter_role: string; reported_by: string; photo_keys: string[]; created_at: string; settled_at: string | null;
}
interface OrderOpt { id: string; order_no: string; business_name: string }

export default function IssuesPage() {
  const [status, setStatus] = useState<'open' | 'settled'>('open');
  const [logging, setLogging] = useState(false);
  const issues = useQuery<{ data: Issue[] }>(`staff/issues?status=${status}`);
  const rows = issues.data?.data ?? [];

  return (
    <>
      <PageHeader title="Order issues" subtitle="Problems reported by customers, distributors and staff. They are settled in the daily reconciliation."
        actions={<><Link href="/reconciliation" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-soft">Go to reconciliation</Link><Button onClick={() => setLogging(true)}>Log an issue</Button></>} />
      <div className="mb-4 flex gap-2">
        {(['open', 'settled'] as const).map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={`rounded-full px-4 py-2 text-sm font-semibold ${status === s ? 'bg-navy text-white' : 'bg-white hover:bg-cream-2'}`}>{titleCase(s)}</button>)}
      </div>
      {issues.error && <div className="mb-4"><ErrorNote message={issues.error} onRetry={issues.reload} /></div>}
      <Card>
        {!issues.data ? <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : rows.length === 0 ? <EmptyState title={status === 'open' ? 'No open issues' : 'Nothing settled yet'} /> : (
            <Table head={['Order', 'Customer', 'Problem', 'Reported by', 'When', 'Status']}>
              {rows.map((i) => (
                <tr key={i.id}>
                  <Td className="font-semibold whitespace-nowrap">{i.order_no}</Td>
                  <Td>{i.business_name}</Td>
                  <Td><p className="font-semibold">{titleCase(i.issue_type)}{i.quantity ? ` · ${formatNumber(i.quantity)} loaves` : ''}</p>{i.note && <p className="text-xs text-muted">{i.note}</p>}
                    {i.photo_keys.length > 0 && <div className="mt-1 flex gap-1">{i.photo_keys.map((k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={k} href={`/api/proxy/files?key=${encodeURIComponent(k)}`} target="_blank" rel="noreferrer"><img src={`/api/proxy/files?key=${encodeURIComponent(k)}`} alt="Issue photo" className="size-12 rounded-lg object-cover" /></a>
                    ))}</div>}
                  </Td>
                  <Td>{i.reported_by}<p className="text-xs text-muted">{titleCase(i.reporter_role)}</p></Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(i.created_at)}</Td>
                  <Td><Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{titleCase(i.status)}</Badge></Td>
                </tr>
              ))}
            </Table>
          )}
      </Card>
      <LogModal open={logging} onClose={() => setLogging(false)} onDone={() => { setLogging(false); void issues.reload(); }} />
    </>
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
    <Modal open={open} onClose={onClose} title="Log an order issue">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Delivery date"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setOrderId(''); }} /></Field>
        <Field label="Order"><Select value={orderId} onChange={(e) => setOrderId(e.target.value)} required><option value="">{orders.loading ? 'Loading…' : list.length ? 'Choose an order' : 'No orders on this day'}</option>{list.map((o) => <option key={o.id} value={o.id}>{o.order_no} · {o.business_name}</option>)}</Select></Field>
        <Field label="Problem"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="missing">Missing bread</option><option value="damaged">Damaged bread</option><option value="wrong_quantity">Wrong quantity</option><option value="other">Other</option></Select></Field>
        {needsQty && <Field label="How many loaves"><Input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>}
        <Field label={type === 'other' ? 'Describe the problem' : 'Note (optional)'}><Input value={note} onChange={(e) => setNote(e.target.value)} minLength={type === 'other' ? 3 : undefined} maxLength={500} required={type === 'other'} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={!orderId}>Log issue</Button></div>
      </form>
    </Modal>
  );
}
