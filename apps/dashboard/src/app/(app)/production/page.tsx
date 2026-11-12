'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, formatNumber, lagosToday, shiftDate, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, DateField, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Pager, Select, Skeleton, StatCard, Table, Td, useToast } from '@/components/ui';

interface Product { id: string; code: string; name: string }
interface Material { id: string; name: string; unit: string; in_stock: number; is_active: boolean }
interface Run {
  id: string; run_date: string; run_type: 'morning' | 'night'; note: string | null; recorded_by: string;
  outputs: { product_id: string; name: string; quantity: number }[];
  materials_used: { raw_material_id: string; name: string; unit: string; quantity: number }[];
}
interface Bread { date: string; data: { product_id: string; name: string; produced: number; delivered: number; returned: number; leftover_to_sales: number }[] }
interface Summary { bread_needed: { product_id: string; name: string; quantity: number }[] }

const PAGE = 8;

export default function ProductionPage() {
  const { user } = useSession();
  const canRecord = !!user?.roles.some((r) => r === 'production' || r === 'ceo');
  const canLeftover = !!user?.roles.some((r) => r === 'production' || r === 'ceo' || r === 'sales');
  const [date, setDate] = useState(lagosToday());
  const [recording, setRecording] = useState<'morning' | 'night' | null>(null);
  const [leftover, setLeftover] = useState(false);
  const [page, setPage] = useState(1);

  const runs = useQuery<{ data: Run[] }>(`staff/production/runs?from=${shiftDate(date, -6)}&to=${date}`);
  const bread = useQuery<Bread>(`staff/inventory/bread?date=${date}`);
  const summary = useQuery<Summary>(`staff/orders/summary?date=${date}`);
  const products = useQuery<{ data: Product[] }>('products');

  const today = runs.data?.data.filter((r) => r.run_date === date) ?? [];
  const has = (t: 'morning' | 'night') => today.find((r) => r.run_type === t);
  const refresh = () => { void runs.reload(); void bread.reload(); };
  useEffect(() => setPage(1), [date]);

  const needed = summary.data?.bread_needed ?? [];
  const neededTotal = needed.reduce((n, b) => n + b.quantity, 0);
  const rows = bread.data?.data ?? [];
  const sum = (k: 'produced' | 'delivered' | 'returned' | 'leftover_to_sales') => rows.reduce((n, b) => n + b[k], 0);
  const produced = sum('produced');
  const gap = neededTotal - produced;
  const allRuns = runs.data?.data ?? [];
  const pages = Math.max(1, Math.ceil(allRuns.length / PAGE));
  const view = allRuns.slice((page - 1) * PAGE, page * PAGE);

  return (
    <>
      <PageHeader title="Production" subtitle="Plan the bake, record every run, and watch the bread go out."
        actions={<>
          {canLeftover && <Button variant="secondary" onClick={() => setLeftover(true)}><Icon name="bread" size={16} />Record leftover to sales</Button>}
          <Button variant="secondary" disabled={allRuns.length === 0} onClick={() => downloadCsv(`production-${date}.csv`, ['Date', 'Run', 'Bread made', 'Raw materials used', 'Recorded by'], allRuns.map((r) => [r.run_date, r.run_type, r.outputs.map((o) => `${o.name} ${o.quantity}`).join('; '), r.materials_used.map((m) => `${m.name} ${m.quantity} ${m.unit}`).join('; '), r.recorded_by]))}><Icon name="download" size={16} />Export CSV</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!bread.data || !summary.data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />) : (
          <>
            <StatCard label="Bread needed" value={formatNumber(neededTotal)} hint="Loaves on paid orders" />
            <StatCard label="Bread made" value={formatNumber(produced)} hint={neededTotal === 0 ? 'No paid orders yet' : gap > 0 ? `${formatNumber(gap)} still to bake` : 'Covers all paid orders'} />
            <StatCard label="Delivered" value={formatNumber(sum('delivered'))} hint="Loaves handed over" />
            <StatCard label="Returned" value={formatNumber(sum('returned'))} hint={`${formatNumber(sum('leftover_to_sales'))} leftover passed to sales`} />
          </>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_auto]">
        <DateField value={date} max={lagosToday()} onChange={(v) => v && setDate(v)} label="Production date" />
        <button onClick={() => setDate(lagosToday())} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-bold">Bread movement</h2>
            <p className="mb-4 text-xs text-muted">{formatDate(date)} · Needed, made, delivered, returned and passed to sales</p>
            {bread.error ? <ErrorNote message={bread.error} onRetry={bread.reload} /> : !bread.data ? <Skeleton className="h-24" /> : rows.length === 0 ? <EmptyState title="No bread products" /> : (
              <div className="overflow-hidden rounded-xl">
                <Table head={['Bread', 'Needed', 'Made', 'Delivered', 'Returned', 'Leftover to sales']}>
                  {rows.map((b) => {
                    const need = needed.find((n) => n.product_id === b.product_id)?.quantity ?? 0;
                    return <tr key={b.product_id}><Td className="font-semibold">{b.name}</Td><Td className="tnum">{formatNumber(need)}</Td><Td className="tnum">{formatNumber(b.produced)}{need > b.produced && <span className="ml-2 text-xs font-semibold text-warn">-{formatNumber(need - b.produced)}</span>}</Td><Td className="tnum">{formatNumber(b.delivered)}</Td><Td className="tnum">{formatNumber(b.returned)}</Td><Td className="tnum">{formatNumber(b.leftover_to_sales)}</Td></tr>;
                  })}
                </Table>
              </div>
            )}
          </Card>

          <div>
            <Card className="p-5">
              <h2 className="text-lg font-bold">Production runs</h2>
              <p className="mb-4 text-xs text-muted">The 7 days up to {formatDate(date)}</p>
              {runs.error ? <ErrorNote message={runs.error} onRetry={runs.reload} /> : !runs.data ? <Skeleton className="h-24" />
                : allRuns.length === 0 ? <EmptyState title="No runs recorded" text="Runs appear here after the production team records them." /> : (
                  <div className="overflow-hidden rounded-xl">
                    <Table head={['Date', 'Run', 'Bread made', 'Raw materials used', 'By']}>
                      {view.map((r) => (
                        <tr key={r.id}>
                          <Td className="whitespace-nowrap font-semibold">{formatDate(r.run_date)}</Td><Td><Badge tone={r.run_type === 'morning' ? 'orange' : 'brand'}>{titleCase(r.run_type)}</Badge></Td>
                          <Td>{r.outputs.map((o) => `${o.name} ${formatNumber(o.quantity)}`).join(', ')}</Td>
                          <Td className="text-muted">{r.materials_used.length ? r.materials_used.map((m) => `${m.name} ${m.quantity} ${m.unit}`).join(', ') : '—'}</Td>
                          <Td>{r.recorded_by}</Td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                )}
            </Card>
            <Pager page={page} pages={pages} total={allRuns.length} size={PAGE} onPage={setPage} noun="runs" />
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-24">
          {(['morning', 'night'] as const).map((t) => {
            const run = has(t);
            const total = run?.outputs.reduce((n, o) => n + o.quantity, 0) ?? 0;
            return (
              <Card key={t} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="text-lg leading-tight font-bold">{titleCase(t)} run</h2><p className="text-xs text-muted">{formatDate(date)}</p></div>
                  {run ? <Badge tone="ok">Recorded</Badge> : <Badge tone="warn">Not recorded</Badge>}
                </div>
                {!runs.data ? <Skeleton className="mt-4 h-16" /> : run ? (
                  <div className="mt-4">
                    <ul className="space-y-2 text-sm">{run.outputs.map((o) => <li key={o.product_id} className="flex justify-between"><span>{o.name}</span><b className="tnum">{formatNumber(o.quantity)}</b></li>)}</ul>
                    <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm"><span className="text-muted">Total made</span><b className="tnum">{formatNumber(total)} loaves</b></div>
                    <p className="mt-2 text-xs text-muted">Recorded by {run.recorded_by}{run.note ? ` · ${run.note}` : ''}</p>
                  </div>
                ) : canRecord && date === lagosToday() ? (
                  <div className="mt-4"><p className="mb-3 text-sm text-muted">Nothing recorded yet. Enter what came out of the oven.</p><Button className="w-full bg-side-2 hover:bg-side" onClick={() => setRecording(t)}><Icon name="plus" size={16} />Record {t} run</Button></div>
                ) : <p className="mt-4 text-sm text-muted">Nothing recorded.</p>}
              </Card>
            );
          })}
        </div>
      </div>

      <RunModal type={recording} products={products.data?.data ?? []} onClose={() => setRecording(null)} onDone={() => { setRecording(null); refresh(); }} />
      <LeftoverModal open={leftover} products={products.data?.data ?? []} onClose={() => setLeftover(false)} onDone={() => { setLeftover(false); refresh(); }} />
    </>
  );
}

function Stepper({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const n = Number(value) || 0;
  const btn = 'grid size-10 place-items-center rounded-xl border border-line bg-white hover:bg-cream-2 disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Less ${label}`} disabled={n <= 0} onClick={() => onChange(String(Math.max(0, n - 1)))} className={btn}><Icon name="minus" size={16} /></button>
      <Input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" aria-label={label} className="w-24 text-center font-semibold tnum" />
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(String(n + 1))} className={btn}><Icon name="plus" size={16} /></button>
    </div>
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
  const total = Object.values(out).reduce((n, v) => n + (Number(v) > 0 ? Math.round(Number(v)) : 0), 0);

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
    <Modal open={!!type} onClose={onClose} title={`Record ${type ?? ''} run`} subtitle={`${formatDate(lagosToday())} · Enter what was baked in this run`} wide>
      <form onSubmit={submit} className="space-y-6">
        {error && <ErrorNote message={error} />}
        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Bread made</h3>
          {products.length === 0 ? <Skeleton className="h-16" /> : (
            <ul className="divide-y divide-line/70 rounded-xl border border-line">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-semibold">{p.name}</span>
                  <Stepper label={p.name} value={out[p.id] ?? ''} onChange={(v) => setOut({ ...out, [p.id]: v })} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Raw materials used <span className="font-normal normal-case">(optional)</span></h3>
          {!materials.data ? <Skeleton className="h-16" /> : mats.length === 0 ? <p className="rounded-xl bg-cream/70 px-4 py-3 text-sm text-muted">No raw materials set up yet.</p> : (
            <ul className="divide-y divide-line/70 rounded-xl border border-line">
              {mats.map((m) => {
                const v = Number(used[m.id]) || 0;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div><p className="font-semibold">{m.name}</p><p className={`text-xs ${v > m.in_stock ? 'font-semibold text-bad' : 'text-muted'}`}>{v > m.in_stock ? `More than the ${m.in_stock} ${m.unit} in stock` : `In stock: ${m.in_stock} ${m.unit}`}</p></div>
                    <div className="flex items-center gap-2"><Input type="number" min={0} step="any" inputMode="decimal" value={used[m.id] ?? ''} onChange={(e) => setUsed({ ...used, [m.id]: e.target.value })} placeholder="0" aria-label={`${m.name} used`} className="w-28 text-right tnum" /><span className="w-10 text-sm text-muted">{m.unit}</span></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything the team should know about this run" /></Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div><p className="text-xs text-muted">Total made</p><p className="text-2xl font-bold tnum">{formatNumber(total)} <span className="text-sm font-medium text-muted">loaves</span></p></div>
          <div className="flex items-center gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={total === 0}>Save run</Button></div>
        </div>
        <p className="-mt-2 text-xs text-muted">A recorded run cannot be edited. If something is wrong, tell the CEO.</p>
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
