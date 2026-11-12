'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, lagosToday } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FilterTabs, Input, Modal, PageHeader, Pager, SearchBox, Skeleton, StatCard, Table, Td, useToast } from '@/components/ui';

interface Material { id: string; name: string; unit: string; in_stock: number; reorder_level: number | null; below_reorder_level: boolean; is_active: boolean }
interface Count { raw_material_id: string; name: string; unit: string; counted: number; expected: number; variance: number; counted_by: string }

type Dialog = null | { kind: 'receive' } | { kind: 'count' } | { kind: 'add' } | { kind: 'adjust'; m: Material } | { kind: 'edit'; m: Material };
type Tab = 'all' | 'reorder' | 'ok' | 'off';
const PAGE = 10;

export default function InventoryPage() {
  const { user } = useSession();
  const canEdit = !!user?.roles.some((r) => r === 'store_keeper' || r === 'ceo');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const today = lagosToday();
  const materials = useQuery<{ data: Material[] }>('staff/inventory/materials');
  const counts = useQuery<{ date: string; data: Count[] }>(`staff/inventory/counts?date=${today}`);
  const all = useMemo(() => materials.data?.data ?? [], [materials.data]);
  const refresh = () => { void materials.reload(); void counts.reload(); };
  const done = () => { setDialog(null); refresh(); };

  const active = all.filter((m) => m.is_active);
  const reorder = active.filter((m) => m.below_reorder_level);
  const tc = useMemo(() => ({ all: all.length, reorder: reorder.length, ok: active.length - reorder.length, off: all.length - active.length }), [all, active, reorder]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((m) => (tab === 'all' || (tab === 'reorder' ? m.is_active && m.below_reorder_level : tab === 'ok' ? m.is_active && !m.below_reorder_level : !m.is_active)) && (!t || m.name.toLowerCase().includes(t)));
  }, [all, tab, q]);
  useEffect(() => setPage(1), [tab, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);
  const cdata = counts.data?.data ?? [];
  const off = cdata.filter((c) => c.variance !== 0).length;
  const reset = () => { setTab('all'); setQ(''); };

  return (
    <>
      <PageHeader title="Inventory" subtitle="Raw materials. Stock is worked out from everything received, used and adjusted."
        actions={<>
          <Button variant="secondary" disabled={all.length === 0} onClick={() => downloadCsv('inventory.csv', ['Material', 'Unit', 'In stock', 'Reorder level', 'Status'], all.map((m) => [m.name, m.unit, m.in_stock, m.reorder_level, !m.is_active ? 'switched off' : m.below_reorder_level ? 'reorder now' : 'ok']))}><Icon name="download" size={16} />Export CSV</Button>
          {canEdit && (<>
            <Button variant="secondary" onClick={() => setDialog({ kind: 'add' })}><Icon name="plus" size={16} />Add material</Button>
            <Button variant="secondary" onClick={() => setDialog({ kind: 'receive' })}><Icon name="box" size={16} />Receive stock</Button>
            <Button className="bg-side-2 hover:bg-side" onClick={() => setDialog({ kind: 'count' })}><Icon name="check" size={16} />Daily count</Button>
          </>)}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!materials.data || !counts.data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />) : (
          <>
            <StatCard label="Materials in use" value={String(active.length)} hint={tc.off ? `${tc.off} switched off` : 'All switched on'} />
            <StatCard label="Need reordering" value={String(reorder.length)} hint={reorder.length ? 'Tap to see which' : 'Everything is above its level'} onClick={reorder.length ? () => setTab('reorder') : undefined} />
            <StatCard label="Counted today" value={`${cdata.length}/${active.length}`} hint={cdata.length >= active.length && active.length ? 'Count complete' : 'Materials counted so far'} />
            <StatCard label="Count differences" value={String(off)} hint={cdata.length === 0 ? 'No count yet today' : off ? 'Check these against the records' : 'Everything matches'} />
          </>
        )}
      </div>

      <div className="mb-4"><FilterTabs<Tab> value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All materials', count: tc.all }, { key: 'reorder', label: 'Reorder now', count: tc.reorder }, { key: 'ok', label: 'In stock', count: tc.ok }, { key: 'off', label: 'Switched off', count: tc.off }]} /></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,3fr)_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search materials" />
        <button onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>

      {materials.error && <div className="mb-4"><ErrorNote message={materials.error} onRetry={materials.reload} /></div>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <Card className="p-5">
            <h2 className="text-lg font-bold">Raw materials</h2>
            <p className="mb-4 text-xs text-muted">Current stock against each reorder level</p>
            {!materials.data ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : filtered.length === 0 ? <EmptyState title={all.length === 0 ? 'No raw materials yet' : 'No materials match'} text={all.length === 0 ? 'Add the materials the bakery uses, then receive stock.' : 'Try another tab or search.'} /> : (
                <div className="overflow-hidden rounded-xl">
                  <Table head={['Material', 'In stock', 'Reorder level', 'Status', '']}>
                    {view.map((m) => (
                      <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                        <Td className="font-semibold capitalize">{m.name}</Td>
                        <Td><span className="font-bold tnum">{m.in_stock}</span> <span className="text-muted">{m.unit}</span></Td>
                        <Td className="tnum">{m.reorder_level ?? '—'}</Td>
                        <Td>{!m.is_active ? <Badge>Switched off</Badge> : m.below_reorder_level ? <Badge tone="bad">Reorder now</Badge> : <Badge tone="ok">OK</Badge>}</Td>
                        <Td>{canEdit && <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'adjust', m })}>Adjust</Button><Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'edit', m })}>Edit</Button></div>}</Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
          </Card>
          <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={setPage} noun="materials" />
        </div>

        <Card className="p-5 xl:sticky xl:top-24">
          <h2 className="text-lg font-bold">Today&apos;s count</h2>
          <p className="mb-4 text-xs text-muted">{formatDate(today)} · Compared with the records</p>
          {counts.error ? <ErrorNote message={counts.error} onRetry={counts.reload} /> : !counts.data ? <Skeleton className="h-24" />
            : cdata.length === 0 ? <EmptyState title="Not counted yet today" text={canEdit ? 'Press Daily count to record what is on the shelves.' : undefined} /> : (
              <ul className="divide-y divide-line/70">
                {cdata.map((c) => (
                  <li key={c.raw_material_id} className="flex items-center justify-between gap-3 py-3">
                    <div><p className="font-semibold capitalize">{c.name}</p><p className="text-xs text-muted tnum">Counted {c.counted} · Expected {c.expected} {c.unit} · {c.counted_by}</p></div>
                    {c.variance === 0 ? <Badge tone="ok">Matches</Badge> : <Badge tone={c.variance < 0 ? 'bad' : 'warn'}>{c.variance > 0 ? '+' : ''}{c.variance} {c.unit}</Badge>}
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <ReceiveModal open={dialog?.kind === 'receive'} materials={all.filter((m) => m.is_active)} onClose={() => setDialog(null)} onDone={done} />
      <CountModal open={dialog?.kind === 'count'} materials={all.filter((m) => m.is_active)} onClose={() => setDialog(null)} onDone={done} />
      <AddModal open={dialog?.kind === 'add'} onClose={() => setDialog(null)} onDone={done} />
      <AdjustModal material={dialog?.kind === 'adjust' ? dialog.m : null} onClose={() => setDialog(null)} onDone={done} />
      <EditModal material={dialog?.kind === 'edit' ? dialog.m : null} onClose={() => setDialog(null)} onDone={done} />
    </>
  );
}

/** Shared by the dialogs: runs the request, shows errors inside the dialog, toasts on success. */
function useSubmit(onDone: () => void, success: string) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try { await fn(); toast(success); onDone(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return { busy, error, run, reset: () => setError(null) };
}

function QuantityList({ materials, values, setValues, label }: { materials: Material[]; values: Record<string, string>; setValues: (v: Record<string, string>) => void; label: string }) {
  return (
    <ul className="max-h-[50vh] divide-y divide-line/70 overflow-auto rounded-xl border border-line">
      {materials.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div><p className="font-semibold capitalize">{m.name}</p><p className="text-xs text-muted">{label === 'count' ? `Expected ${m.in_stock} ${m.unit}` : `In stock: ${m.in_stock} ${m.unit}`}</p></div>
          <div className="flex items-center gap-2"><Input type="number" min={0} step="any" inputMode="decimal" value={values[m.id] ?? ''} onChange={(e) => setValues({ ...values, [m.id]: e.target.value })} placeholder="0" aria-label={`${m.name} ${label}`} className="w-28 text-right tnum" /><span className="w-10 text-sm text-muted">{m.unit}</span></div>
        </li>
      ))}
    </ul>
  );
}

function ReceiveModal({ open, materials, onClose, onDone }: { open: boolean; materials: Material[]; onClose: () => void; onDone: () => void }) {
  const s = useSubmit(onDone, 'Stock received');
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setV({}); s.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = Object.entries(v).filter(([, q]) => Number(q) > 0).map(([raw_material_id, q]) => ({ raw_material_id, quantity: Number(q) }));
  return (
    <Modal open={open} onClose={onClose} title="Receive stock" subtitle="Enter what was delivered. Leave the rest empty." wide>
      <form onSubmit={(e) => { e.preventDefault(); void s.run(() => api('staff/inventory/receipts', { body: { items } })); }} className="space-y-4">
        {s.error && <ErrorNote message={s.error} />}
        <QuantityList materials={materials} values={v} setValues={setV} label="receive" />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy} disabled={items.length === 0}>Save</Button></div>
      </form>
    </Modal>
  );
}

function CountModal({ open, materials, onClose, onDone }: { open: boolean; materials: Material[]; onClose: () => void; onDone: () => void }) {
  const s = useSubmit(onDone, 'Count saved');
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setV({}); s.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = Object.entries(v).filter(([, q]) => q !== '' && Number(q) >= 0).map(([raw_material_id, q]) => ({ raw_material_id, counted_quantity: Number(q) }));
  return (
    <Modal open={open} onClose={onClose} title="Daily stock count" subtitle={`${formatDate(lagosToday())} · Count what is on the shelves`} wide>
      <form onSubmit={(e) => { e.preventDefault(); void s.run(() => api('staff/inventory/counts', { body: { counts } })); }} className="space-y-4">
        {s.error && <ErrorNote message={s.error} />}
        <p className="text-sm text-muted">Count what is on the shelves. Zero is a valid count. A material can be counted once a day; fix mistakes with Adjust.</p>
        <QuantityList materials={materials} values={v} setValues={setV} label="count" />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy} disabled={counts.length === 0}>Save count</Button></div>
      </form>
    </Modal>
  );
}

function AddModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const s = useSubmit(onDone, 'Material added');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [level, setLevel] = useState('');
  useEffect(() => { if (open) { setName(''); setUnit(''); setLevel(''); s.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Add raw material">
      <form onSubmit={(e) => { e.preventDefault(); void s.run(() => api('staff/inventory/materials', { body: { name, unit, ...(level ? { reorder_level: Number(level) } : {}) } })); }} className="space-y-4">
        {s.error && <ErrorNote message={s.error} />}
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required /></Field>
        <Field label="Unit (kg, bag, litre…)"><Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} required /></Field>
        <Field label="Reorder level (optional)"><Input type="number" min={0} step="any" value={level} onChange={(e) => setLevel(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>Add</Button></div>
      </form>
    </Modal>
  );
}

function AdjustModal({ material, onClose, onDone }: { material: Material | null; onClose: () => void; onDone: () => void }) {
  const s = useSubmit(onDone, 'Adjustment saved');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { setQty(''); setReason(''); s.reset(); }, [material]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={!!material} onClose={onClose} title={`Adjust ${material?.name ?? ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); void s.run(() => api('staff/inventory/adjustments', { body: { raw_material_id: material!.id, quantity: Number(qty), reason } })); }} className="space-y-4">
        {s.error && <ErrorNote message={s.error} />}
        <p className="text-sm text-muted">Now in stock: <b>{material?.in_stock} {material?.unit}</b>. Use a minus sign to remove stock (for example -5 for spoilage). Every adjustment is recorded with the reason.</p>
        <Field label={`Change (${material?.unit ?? ''})`}><Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={200} placeholder="e.g. damaged bag" required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy} disabled={!Number(qty)}>Save</Button></div>
      </form>
    </Modal>
  );
}

function EditModal({ material, onClose, onDone }: { material: Material | null; onClose: () => void; onDone: () => void }) {
  const s = useSubmit(onDone, 'Saved');
  const [unit, setUnit] = useState('');
  const [level, setLevel] = useState('');
  const [active, setActive] = useState(true);
  useEffect(() => { if (material) { setUnit(material.unit); setLevel(material.reorder_level?.toString() ?? ''); setActive(material.is_active); s.reset(); } }, [material]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={!!material} onClose={onClose} title={`Edit ${material?.name ?? ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); void s.run(() => api(`staff/inventory/materials/${material!.id}`, { method: 'PUT', body: { unit, ...(level !== '' ? { reorder_level: Number(level) } : {}), is_active: active } })); }} className="space-y-4">
        {s.error && <ErrorNote message={s.error} />}
        <Field label="Unit"><Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} required /></Field>
        <Field label="Reorder level"><Input type="number" min={0} step="any" value={level} onChange={(e) => setLevel(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />In use</label>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>Save</Button></div>
      </form>
    </Modal>
  );
}
