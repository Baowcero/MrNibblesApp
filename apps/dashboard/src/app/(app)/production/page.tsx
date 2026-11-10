'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, formatNumber, lagosToday, shiftDate, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Skeleton, Table, Td, useToast } from '@/components/ui';

interface Product { id: string; code: string; name: string }
interface Material { id: string; name: string; unit: string; in_stock: number; is_active: boolean }
interface Run {
  id: string; run_date: string; run_type: 'morning' | 'night'; note: string | null; recorded_by: string;
  outputs: { product_id: string; name: string; quantity: number }[];
  materials_used: { raw_material_id: string; name: string; unit: string; quantity: number }[];
}
interface Bread { date: string; data: { product_id: string; name: string; produced: number; delivered: number; returned: number; leftover_to_sales: number }[] }
interface Summary { bread_needed: { product_id: string; name: string; quantity: number }[] }

export default function ProductionPage() {
  const { user } = useSession();
  const canRecord = !!user?.roles.some((r) => r === 'production' || r === 'ceo');
  const canLeftover = !!user?.roles.some((r) => r === 'production' || r === 'ceo' || r === 'sales');
  const [date, setDate] = useState(lagosToday());
  const [recording, setRecording] = useState<'morning' | 'night' | null>(null);
  const [leftover, setLeftover] = useState(false);

  const runs = useQuery<{ data: Run[] }>(`staff/production/runs?from=${shiftDate(date, -6)}&to=${date}`);
  const bread = useQuery<Bread>(`staff/inventory/bread?date=${date}`);
  const summary = useQuery<Summary>(`staff/orders/summary?date=${date}`);
  const products = useQuery<{ data: Product[] }>('products');

  const today = runs.data?.data.filter((r) => r.run_date === date) ?? [];
  const has = (t: 'morning' | 'night') => today.find((r) => r.run_type === t);
  const refresh = () => { void runs.reload(); void bread.reload(); };

  return (
    <>
      <PageHeader title="Production" subtitle={formatDate(date)}
        actions={
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
            <button aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-2 hover:bg-cream-2"><Icon name="left" size={18} /></button>
            <input type="date" value={date} max={lagosToday()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="bg-transparent px-1 text-sm font-semibold" />
            <button aria-label="Next day" disabled={date >= lagosToday()} onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-2 hover:bg-cream-2 disabled:opacity-30"><Icon name="right" size={18} /></button>
          </div>
        } />

      <div className="grid gap-4 lg:grid-cols-3">
        {(['morning', 'night'] as const).map((t) => {
          const run = has(t);
          return (
            <Card key={t} className="p-5">
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{titleCase(t)} run</h2>{run ? <Badge tone="ok">Recorded</Badge> : <Badge tone="warn">Not recorded</Badge>}</div>
              {!runs.data ? <Skeleton className="mt-4 h-16" /> : run ? (
                <div className="mt-3 space-y-2 text-sm">
                  {run.outputs.map((o) => <p key={o.product_id} className="flex justify-between"><span>{o.name}</span><b className="font-display text-xl">{formatNumber(o.quantity)}</b></p>)}
                  <p className="text-xs text-muted">Recorded by {run.recorded_by}</p>
                </div>
              ) : canRecord && date === lagosToday() ? <Button className="mt-4" onClick={() => setRecording(t)}>Record {t} run</Button>
                : <p className="mt-3 text-sm text-muted">Nothing recorded.</p>}
            </Card>
          );
        })}
        <Card className="p-5">
          <h2 className="text-lg font-bold">Bread needed</h2>
          <p className="text-xs text-muted">From paid orders for this day</p>
          {!summary.data ? <Skeleton className="mt-3 h-16" /> : summary.data.bread_needed.length === 0 ? <p className="mt-3 text-sm text-muted">No paid orders yet.</p> : (
            <ul className="mt-3 space-y-1 text-sm">{summary.data.bread_needed.map((b) => <li key={b.product_id} className="flex justify-between"><span>{b.name}</span><b className="font-display text-xl">{formatNumber(b.quantity)}</b></li>)}</ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between p-6 pb-2">
          <div><h2 className="text-lg font-bold">Bread movement</h2><p className="text-xs text-muted">Made, delivered, returned and passed to sales</p></div>
          {canLeftover && <Button variant="secondary" size="sm" onClick={() => setLeftover(true)}>Record leftover to sales</Button>}
        </div>
        {bread.error ? <div className="p-6"><ErrorNote message={bread.error} onRetry={bread.reload} /></div> : !bread.data ? <div className="p-6"><Skeleton className="h-20" /></div> : (
          <Table head={['Bread', 'Produced', 'Delivered', 'Returned', 'Leftover to sales']}>
            {bread.data.data.map((b) => <tr key={b.product_id}><Td className="font-semibold">{b.name}</Td><Td>{formatNumber(b.produced)}</Td><Td>{formatNumber(b.delivered)}</Td><Td>{formatNumber(b.returned)}</Td><Td>{formatNumber(b.leftover_to_sales)}</Td></tr>)}
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="p-6 pb-2 text-lg font-bold">Last 7 days</h2>
        {runs.error ? <div className="p-6"><ErrorNote message={runs.error} onRetry={runs.reload} /></div> : !runs.data ? <div className="p-6"><Skeleton className="h-24" /></div>
          : runs.data.data.length === 0 ? <EmptyState title="No runs recorded" text="Runs appear here after the production team records them." /> : (
            <Table head={['Date', 'Run', 'Bread made', 'Raw materials used', 'By']}>
              {runs.data.data.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{formatDate(r.run_date)}</Td><Td>{titleCase(r.run_type)}</Td>
                  <Td>{r.outputs.map((o) => `${o.name} ${formatNumber(o.quantity)}`).join(', ')}</Td>
                  <Td className="text-muted">{r.materials_used.length ? r.materials_used.map((m) => `${m.name} ${m.quantity} ${m.unit}`).join(', ') : '—'}</Td>
                  <Td>{r.recorded_by}</Td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <RunModal type={recording} products={products.data?.data ?? []} onClose={() => setRecording(null)} onDone={() => { setRecording(null); refresh(); }} />
      <LeftoverModal open={leftover} products={products.data?.data ?? []} onClose={() => setLeftover(false)} onDone={() => { setLeftover(false); refresh(); }} />
    </>
  );
}

function RunModal({ type, products, onClose, onDone }: { type: 'morning' | 'night' | null; products: Product[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const materials = useQuery<{ data: Material[] }>(type ? 'staff/inventory/materials' : null);
  const [out, setOut] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (type) { setOut({}); setUsed({}); setNote(''); setError(null); } }, [type]);

  const mats = useMemo(() => (materials.data?.data ?? []).filter((m) => m.is_active), [materials.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('staff/production/runs', {
        body: {
          run_type: type,
          outputs: Object.entries(out).filter(([, v]) => Number(v) > 0).map(([product_id, v]) => ({ product_id, quantity: Math.round(Number(v)) })),
          materials: Object.entries(used).filter(([, v]) => Number(v) > 0).map(([raw_material_id, v]) => ({ raw_material_id, quantity: Number(v) })),
          note: note.trim() || undefined,
        },
      });
      toast(`${titleCase(type ?? '')} run recorded`);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!type} onClose={onClose} title={`Record ${type ?? ''} run`} wide>
      <form onSubmit={submit} className="space-y-5">
        {error && <ErrorNote message={error} />}
        <div>
          <h3 className="mb-2 font-bold">Bread made</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => <Field key={p.id} label={p.name}><Input type="number" min={0} inputMode="numeric" value={out[p.id] ?? ''} onChange={(e) => setOut({ ...out, [p.id]: e.target.value })} placeholder="0" /></Field>)}
          </div>
        </div>
        <div>
          <h3 className="mb-1 font-bold">Raw materials used <span className="text-sm font-normal text-muted">(optional)</span></h3>
          {!materials.data ? <Skeleton className="h-16" /> : mats.length === 0 ? <p className="text-sm text-muted">No raw materials set up yet.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {mats.map((m) => <Field key={m.id} label={`${m.name} (${m.unit})`}><Input type="number" min={0} step="any" inputMode="decimal" value={used[m.id] ?? ''} onChange={(e) => setUsed({ ...used, [m.id]: e.target.value })} placeholder={`In stock: ${m.in_stock}`} /></Field>)}
            </div>
          )}
        </div>
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
        <p className="text-xs text-muted">A recorded run cannot be edited. If something is wrong, tell the CEO.</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={!Object.values(out).some((v) => Number(v) > 0)}>Save run</Button></div>
      </form>
    </Modal>
  );
}

function LeftoverModal({ open, products, onClose, onDone }: { open: boolean; products: Product[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setProductId(products[0]?.id ?? ''); setQty(''); setError(null); } }, [open, products]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('staff/inventory/bread/leftover', { body: { product_id: productId, quantity: Math.round(Number(qty)) } });
      toast('Leftover recorded');
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Leftover bread to sales">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Bread"><Select value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="How many loaves"><Input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={!productId || !(Number(qty) > 0)}>Save</Button></div>
      </form>
    </Modal>
  );
}
