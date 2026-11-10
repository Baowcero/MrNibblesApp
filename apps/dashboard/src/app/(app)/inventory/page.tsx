'use client';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDate, lagosToday } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Skeleton, Table, Td, useToast } from '@/components/ui';

interface Material { id: string; name: string; unit: string; in_stock: number; reorder_level: number | null; below_reorder_level: boolean; is_active: boolean }
interface Count { raw_material_id: string; name: string; unit: string; counted: number; expected: number; variance: number; counted_by: string }

type Dialog = null | { kind: 'receive' } | { kind: 'count' } | { kind: 'add' } | { kind: 'adjust'; m: Material } | { kind: 'edit'; m: Material };

export default function InventoryPage() {
  const { user } = useSession();
  const canEdit = !!user?.roles.some((r) => r === 'store_keeper' || r === 'ceo');
  const [dialog, setDialog] = useState<Dialog>(null);
  const today = lagosToday();
  const materials = useQuery<{ data: Material[] }>('staff/inventory/materials');
  const counts = useQuery<{ date: string; data: Count[] }>(`staff/inventory/counts?date=${today}`);
  const rows = materials.data?.data ?? [];
  const refresh = () => { void materials.reload(); void counts.reload(); };
  const done = () => { setDialog(null); refresh(); };

  return (
    <>
      <PageHeader title="Inventory" subtitle="Raw materials. Stock is worked out from everything received, used and adjusted."
        actions={canEdit && (<>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'add' })}>Add material</Button>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'receive' })}>Receive stock</Button>
          <Button onClick={() => setDialog({ kind: 'count' })}>Daily count</Button>
        </>)} />

      {materials.error && <div className="mb-4"><ErrorNote message={materials.error} onRetry={materials.reload} /></div>}
      <Card>
        {!materials.data ? <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : rows.length === 0 ? <EmptyState title="No raw materials yet" text="Add the materials the bakery uses, then receive stock." /> : (
            <Table head={['Material', 'In stock', 'Reorder level', 'Status', '']}>
              {rows.map((m) => (
                <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                  <Td className="font-semibold capitalize">{m.name}</Td>
                  <Td><span className="font-display text-xl font-bold">{m.in_stock}</span> <span className="text-muted">{m.unit}</span></Td>
                  <Td>{m.reorder_level ?? '—'}</Td>
                  <Td>{!m.is_active ? <Badge>Switched off</Badge> : m.below_reorder_level ? <Badge tone="bad">Reorder now</Badge> : <Badge tone="ok">OK</Badge>}</Td>
                  <Td>{canEdit && <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'adjust', m })}>Adjust</Button><Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'edit', m })}>Edit</Button></div>}</Td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <Card className="mt-6">
        <div className="p-6 pb-2"><h2 className="text-lg font-bold">Today&apos;s count</h2><p className="text-xs text-muted">{formatDate(today)}. Compared with what the records say should be there.</p></div>
        {counts.error ? <div className="p-6"><ErrorNote message={counts.error} onRetry={counts.reload} /></div> : !counts.data ? <div className="p-6"><Skeleton className="h-20" /></div>
          : counts.data.data.length === 0 ? <EmptyState title="Not counted yet today" text={canEdit ? 'Press Daily count to record what is on the shelves.' : undefined} /> : (
            <Table head={['Material', 'Counted', 'Expected', 'Difference', 'Counted by']}>
              {counts.data.data.map((c) => (
                <tr key={c.raw_material_id}>
                  <Td className="font-semibold capitalize">{c.name}</Td><Td>{c.counted} {c.unit}</Td><Td>{c.expected} {c.unit}</Td>
                  <Td>{c.variance === 0 ? <Badge tone="ok">Matches</Badge> : <Badge tone={c.variance < 0 ? 'bad' : 'warn'}>{c.variance > 0 ? '+' : ''}{c.variance} {c.unit}</Badge>}</Td>
                  <Td>{c.counted_by}</Td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <ReceiveModal open={dialog?.kind === 'receive'} materials={rows.filter((m) => m.is_active)} onClose={() => setDialog(null)} onDone={done} />
      <CountModal open={dialog?.kind === 'count'} materials={rows.filter((m) => m.is_active)} onClose={() => setDialog(null)} onDone={done} />
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
    <div className="grid max-h-[50vh] gap-3 overflow-auto sm:grid-cols-2">
      {materials.map((m) => (
        <Field key={m.id} label={`${m.name} (${m.unit})`}>
          <Input type="number" min={0} step="any" inputMode="decimal" value={values[m.id] ?? ''} onChange={(e) => setValues({ ...values, [m.id]: e.target.value })} placeholder={label === 'count' ? `Expected ${m.in_stock}` : '0'} />
        </Field>
      ))}
    </div>
  );
}

function ReceiveModal({ open, materials, onClose, onDone }: { open: boolean; materials: Material[]; onClose: () => void; onDone: () => void }) {
  const s = useSubmit(onDone, 'Stock received');
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setV({}); s.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = Object.entries(v).filter(([, q]) => Number(q) > 0).map(([raw_material_id, q]) => ({ raw_material_id, quantity: Number(q) }));
  return (
    <Modal open={open} onClose={onClose} title="Receive stock" wide>
      <form onSubmit={(e) => { e.preventDefault(); void s.run(() => api('staff/inventory/receipts', { body: { items } })); }} className="space-y-4">
        {s.error && <ErrorNote message={s.error} />}
        <p className="text-sm text-muted">Enter what was delivered. Leave the rest empty.</p>
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
    <Modal open={open} onClose={onClose} title="Daily stock count" wide>
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
