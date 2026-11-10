'use client';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Skeleton, Table, Td, useToast } from '@/components/ui';

interface User { id: string; full_name: string; phone: string; is_active: boolean; roles: string[]; distributor_id: string | null; last_login_at: string | null }
const ROLES = [
  { code: 'ceo', label: 'CEO' }, { code: 'sales', label: 'Sales' }, { code: 'accounts', label: 'Accounts' },
  { code: 'production', label: 'Production' }, { code: 'store_keeper', label: 'Store keeper' }, { code: 'distributor', label: 'Distributor (mobile app)' },
];

export default function TeamPage() {
  const { user: me } = useSession();
  const toast = useToast();
  const users = useQuery<{ data: User[] }>('staff/users');
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ name: string; phone: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(u: User, action: 'reset-password' | 'activate' | 'deactivate') {
    if (action === 'deactivate' && !window.confirm(`Switch off ${u.full_name}? They will be logged out and cannot log in.`)) return;
    if (action === 'reset-password' && !window.confirm(`Reset the password for ${u.full_name}? A new temporary password is shown once.`)) return;
    setBusyId(u.id);
    try {
      const res = await api<{ temporary_password?: string }>(`staff/users/${u.id}/${action}`, { body: {} });
      if (res.temporary_password) setSecret({ name: u.full_name, phone: u.phone, password: res.temporary_password });
      else toast(action === 'activate' ? `${u.full_name} switched on` : `${u.full_name} switched off`);
      await users.reload();
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setBusyId(null);
    }
  }

  const rows = users.data?.data ?? [];
  return (
    <>
      <PageHeader title="Team" subtitle="Staff and distributors who can log in" actions={<Button onClick={() => setAdding(true)}>Add team member</Button>} />
      {users.error && <div className="mb-4"><ErrorNote message={users.error} onRetry={users.reload} /></div>}
      <Card>
        {!users.data ? <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : rows.length === 0 ? <EmptyState title="No team members yet" /> : (
          <Table head={['Name', 'Phone', 'Role', 'Last login', 'Status', '']}>
            {rows.map((u) => (
              <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                <Td className="font-semibold">{u.full_name}{u.id === me?.id && <span className="ml-2 text-xs text-muted">(you)</span>}</Td>
                <Td>{u.phone}</Td>
                <Td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone="brand">{titleCase(r)}</Badge>)}</div></Td>
                <Td className="text-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}</Td>
                <Td>{u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Switched off</Badge>}</Td>
                <Td><div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" disabled={busyId === u.id} onClick={() => act(u, 'reset-password')}>Reset password</Button>
                  {u.is_active ? u.id !== me?.id && <Button size="sm" variant="secondary" busy={busyId === u.id} onClick={() => act(u, 'deactivate')}>Switch off</Button>
                    : <Button size="sm" busy={busyId === u.id} onClick={() => act(u, 'activate')}>Switch on</Button>}
                </div></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <AddModal open={adding} onClose={() => setAdding(false)} onCreated={(s) => { setAdding(false); setSecret(s); void users.reload(); }} />
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Temporary password">
        <div className="space-y-4">
          <p className="text-sm">Give this to <b>{secret?.name}</b> ({secret?.phone}). It is shown <b>only once</b>. They must choose their own password when they first log in.</p>
          <p className="rounded-2xl bg-cream-2 px-4 py-4 text-center font-mono text-2xl font-bold tracking-wider select-all">{secret?.password}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={async () => { await navigator.clipboard?.writeText(secret?.password ?? '').catch(() => undefined); toast('Copied'); }}>Copy</Button>
            <Button onClick={() => setSecret(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function AddModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: { name: string; phone: string; password: string }) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setName(''); setPhone(''); setRoles([]); setError(null); } }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ full_name: string; phone: string; temporary_password: string }>('staff/users', { body: { full_name: name, phone, roles } });
      onCreated({ name: res.full_name, phone: res.phone, password: res.temporary_password });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add team member">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required /></Field>
        <Field label="Phone number"><Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" required /></Field>
        <fieldset><legend className="mb-1.5 text-sm font-semibold">Role</legend>
          <div className="grid gap-2 sm:grid-cols-2">{ROLES.map((r) => (
            <label key={r.code} className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2.5 text-sm"><input type="checkbox" checked={roles.includes(r.code)} onChange={(e) => setRoles(e.target.checked ? [...roles, r.code] : roles.filter((x) => x !== r.code))} />{r.label}</label>
          ))}</div>
        </fieldset>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={roles.length === 0}>Create</Button></div>
      </form>
    </Modal>
  );
}
