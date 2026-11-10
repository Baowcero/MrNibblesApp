'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Icon } from '@/components/icons';
import { downloadCsv } from '@/lib/export';
import {
  Button, Card, CUSTOMER_STATUS, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Skeleton, StatusBadge, Table, Td, useToast,
} from '@/components/ui';

interface Customer {
  id: string; business_name: string; status: string; source: string; contact_name: string | null; phone: string | null;
  area: string | null; address: string | null; claimed_at: string | null; rejection_note: string | null;
}
interface Page { data: Customer[]; next_cursor: string | null }
interface ImportResult { dry_run: boolean; rows_read: number; created?: number; would_create?: number; already_exist: number; already_exist_names: string[]; duplicates_in_file: number; invalid: { row: number; reason: string }[] }

const TABS = [
  { key: 'pending_approval', label: 'Awaiting approval' }, { key: 'active', label: 'Active' }, { key: 'unclaimed', label: 'Not signed up' },
  { key: 'rejected', label: 'Rejected' }, { key: 'suspended', label: 'Suspended' }, { key: '', label: 'All' },
];

export default function CustomersPage() {
  const toast = useToast();
  const [tab, setTab] = useState('pending_approval');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Customer[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Customer | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (after?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: '50' });
      if (tab) p.set('status', tab);
      if (query) p.set('q', query);
      if (after) p.set('cursor', after);
      const res = await api<Page>(`staff/customers?${p}`);
      setRows((r) => (after ? [...r, ...res.data] : res.data));
      setCursor(res.next_cursor);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [tab, query]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  async function act(c: Customer, action: 'approve' | 'suspend') {
    setBusyId(c.id);
    try {
      await api(`staff/customers/${c.id}/${action}`, { body: {} });
      toast(action === 'approve' ? `${c.business_name} approved` : `${c.business_name} suspended`);
      await load();
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="Approve new sign-ups and manage the customer list"
        actions={<><Button variant="secondary" disabled={rows.length === 0} onClick={() => downloadCsv('customers.csv', ['Business', 'Status', 'Contact', 'Phone', 'Area', 'Address', 'Signed up'], rows.map((c) => [c.business_name, c.status, c.contact_name, c.phone, c.area, c.address, c.claimed_at]))}>Export CSV</Button><Button variant="secondary" onClick={() => setImporting(true)}><Icon name="upload" size={16} />Import names</Button></>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t.key ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-cream-2'}`}>{t.label}</button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Icon name="search" size={16} className="absolute top-3.5 left-4 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business name" className="pl-10" aria-label="Search customers" />
        </div>
      </div>

      {error && <div className="mb-4"><ErrorNote message={error} onRetry={() => load()} /></div>}
      <Card>
        {loading && rows.length === 0 ? <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : rows.length === 0 ? <EmptyState title="No customers here" text={tab === 'pending_approval' ? 'New sign-ups waiting for approval show up in this tab.' : 'Try another tab or a different search.'} />
          : (
            <Table head={['Business', 'Contact', 'Area', 'Status', 'Signed up', '']}>
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td><p className="font-semibold">{c.business_name}</p>{c.rejection_note && <p className="text-xs text-bad">Rejected: {c.rejection_note}</p>}</Td>
                  <Td>{c.contact_name ? <><p>{c.contact_name}</p><p className="text-xs text-muted">{c.phone}</p></> : <span className="text-muted">—</span>}</Td>
                  <Td>{c.area ?? '—'}</Td>
                  <Td><StatusBadge status={c.status} map={CUSTOMER_STATUS} /></Td>
                  <Td className="text-muted">{c.claimed_at ? formatDateTime(c.claimed_at) : '—'}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {['pending_approval', 'rejected', 'suspended'].includes(c.status) && <Button size="sm" busy={busyId === c.id} onClick={() => act(c, 'approve')}>Approve</Button>}
                      {c.status === 'pending_approval' && <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => setRejecting(c)}>Reject</Button>}
                      {c.status === 'active' && <Button size="sm" variant="secondary" busy={busyId === c.id} onClick={() => act(c, 'suspend')}>Suspend</Button>}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        {cursor && <div className="border-t border-line p-4 text-center"><Button variant="ghost" busy={loading} onClick={() => load(cursor)}>Load more</Button></div>}
      </Card>

      <RejectModal customer={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); void load(); }} />
      <ImportModal open={importing} onClose={() => setImporting(false)} onDone={() => { setImporting(false); void load(); }} />
    </>
  );
}

function RejectModal({ customer, onClose, onDone }: { customer: Customer | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setNote(''); setError(null); }, [customer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setBusy(true);
    try {
      await api(`staff/customers/${customer.id}/reject`, { body: { note } });
      toast(`${customer.business_name} rejected`);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!customer} onClose={onClose} title={`Reject ${customer?.business_name ?? ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">The customer sees this reason. Be short and polite.</p>
        {error && <ErrorNote message={error} />}
        <Field label="Reason"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We could not confirm this business" minLength={3} maxLength={300} required /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" busy={busy}>Reject</Button></div>
      </form>
    </Modal>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setCsv(''); setPreview(null); setError(null); } }, [open]);

  async function run(dry: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<ImportResult>('staff/customers/import', { body: { csv, dry_run: dry } });
      if (dry) setPreview(res);
      else { toast(`${res.created ?? 0} customers added`); onDone(); }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import customer names" wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">Paste business names, one per line, or choose a CSV file with a <b>business_name</b> column. Customers sign up later and find their business in this list. Names already in the system are skipped.</p>
        {error && <ErrorNote message={error} />}
        <input type="file" accept=".csv,text/csv,text/plain" aria-label="Choose a CSV file" className="text-sm"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setPreview(null); } }} />
        <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} rows={8} aria-label="Business names"
          placeholder={'business_name\nMama T Bakery\nJoy Store'} className="w-full rounded-2xl border border-line bg-white p-4 text-sm" />
        {preview && (
          <div className="rounded-2xl bg-cream-2 p-4 text-sm">
            <p><b>{preview.would_create}</b> new customers will be added from {preview.rows_read} rows.</p>
            {preview.already_exist > 0 && <p className="mt-1 text-muted">{preview.already_exist} already exist and will be skipped{preview.already_exist_names.length ? `: ${preview.already_exist_names.slice(0, 5).join(', ')}${preview.already_exist > 5 ? '…' : ''}` : ''}</p>}
            {preview.duplicates_in_file > 0 && <p className="mt-1 text-muted">{preview.duplicates_in_file} repeated names in the file were ignored</p>}
            {preview.invalid.length > 0 && <p className="mt-1 text-bad">{preview.invalid.length} rows have problems (row {preview.invalid[0]!.row}: {preview.invalid[0]!.reason})</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!preview ? <Button onClick={() => run(true)} busy={busy} disabled={!csv.trim()}>Preview</Button>
            : <Button onClick={() => run(false)} busy={busy} disabled={!preview.would_create}>Add {preview.would_create} customers</Button>}
        </div>
      </div>
    </Modal>
  );
}
