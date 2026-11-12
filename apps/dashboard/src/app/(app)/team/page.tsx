'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/lib/session';
import { useWide } from '@/lib/use-wide';
import { downloadCsv } from '@/lib/export';
import { Icon } from '@/components/icons';
import { Avatar, Badge, Button, Card, Drawer, EmptyState, ErrorNote, Field, FilterTabs, Input, Modal, PageHeader, Pager, SearchBox, Select, Skeleton, StatCard, Table, Td, useToast } from '@/components/ui';

interface User { id: string; full_name: string; phone: string; is_active: boolean; roles: string[]; distributor_id: string | null; last_login_at: string | null }
const ROLES = [
  { code: 'ceo', label: 'CEO' }, { code: 'sales', label: 'Sales' }, { code: 'accounts', label: 'Accounts' },
  { code: 'production', label: 'Production' }, { code: 'store_keeper', label: 'Store keeper' }, { code: 'distributor', label: 'Distributor (mobile app)' },
];
type Tab = 'all' | 'staff' | 'distributors' | 'off';
type Confirm = { u: User; action: 'reset-password' | 'deactivate' } | null;
const PAGE = 10;
const isDist = (u: User) => u.roles.includes('distributor');

export default function TeamPage() {
  const { user: me } = useSession();
  const toast = useToast();
  const wide = useWide();
  const users = useQuery<{ data: User[] }>('staff/users');
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ name: string; phone: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  async function act(u: User, action: 'reset-password' | 'activate' | 'deactivate') {
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
      setConfirm(null);
    }
  }

  const all = useMemo(() => users.data?.data ?? [], [users.data]);
  const tc = useMemo(() => ({ all: all.length, staff: all.filter((u) => !isDist(u)).length, distributors: all.filter(isDist).length, off: all.filter((u) => !u.is_active).length }), [all]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((u) => (tab === 'all' || (tab === 'staff' ? !isDist(u) : tab === 'distributors' ? isDist(u) : !u.is_active)) && (!role || u.roles.includes(role)) && (!t || u.full_name.toLowerCase().includes(t) || u.phone.includes(t)));
  }, [all, tab, role, q]);
  useEffect(() => setPage(1), [tab, role, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);
  const neverLogged = all.filter((u) => u.is_active && !u.last_login_at).length;
  const picked = all.find((u) => u.id === openId) ?? null;
  const reset = () => { setTab('all'); setRole(''); setQ(''); };

  const panel = picked ? (
    <Card className="max-h-[calc(100vh-8rem)] overflow-auto p-6">
      <div className="flex items-start justify-between"><h2 className="text-lg font-bold">Team member</h2><button onClick={() => setOpenId(null)} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-cream-2"><Icon name="close" size={18} /></button></div>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={picked.full_name} size={60} />
        <div className="min-w-0"><p className="text-xl leading-tight font-bold">{picked.full_name}{picked.id === me?.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p><div className="mt-2">{picked.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Switched off</Badge>}</div></div>
      </div>
      <dl className="mt-5 divide-y divide-line/60 text-sm">
        <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">Phone</dt><dd className="font-semibold"><a href={`tel:${picked.phone}`} className="hover:underline">{picked.phone}</a></dd></div>
        <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">Role</dt><dd className="flex flex-wrap justify-end gap-1">{picked.roles.map((r) => <Badge key={r} tone="brand">{titleCase(r)}</Badge>)}</dd></div>
        <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">Last login</dt><dd className="font-semibold">{picked.last_login_at ? formatDateTime(picked.last_login_at) : 'Never'}</dd></div>
      </dl>
      <div className="mt-5 flex flex-col gap-2">
        <Button variant="secondary" disabled={busyId === picked.id} onClick={() => setConfirm({ u: picked, action: 'reset-password' })}><Icon name="reset" size={16} />Reset password</Button>
        {picked.is_active ? picked.id !== me?.id && <Button variant="secondary" busy={busyId === picked.id} onClick={() => setConfirm({ u: picked, action: 'deactivate' })}>Switch off</Button>
          : <Button busy={busyId === picked.id} onClick={() => act(picked, 'activate')}>Switch on</Button>}
      </div>
    </Card>
  ) : null;

  return (
    <>
      <PageHeader title="Team" subtitle="Staff and distributors who can log in."
        actions={<>
          <Button variant="secondary" disabled={filtered.length === 0} onClick={() => downloadCsv('team.csv', ['Name', 'Phone', 'Roles', 'Last login', 'Status'], filtered.map((u) => [u.full_name, u.phone, u.roles.join('; '), u.last_login_at, u.is_active ? 'active' : 'switched off']))}><Icon name="download" size={16} />Export CSV</Button>
          <Button className="bg-side-2 hover:bg-side" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add team member</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!users.data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />) : (
          <>
            <StatCard label="Team members" value={String(tc.all)} hint={`${tc.staff} staff · ${tc.distributors} distributors`} />
            <StatCard label="Active" value={String(tc.all - tc.off)} hint="Can log in today" />
            <StatCard label="Switched off" value={String(tc.off)} hint={tc.off ? 'Tap to review' : 'Nobody is switched off'} onClick={tc.off ? () => setTab('off') : undefined} />
            <StatCard label="Never logged in" value={String(neverLogged)} hint={neverLogged ? 'Still on a temporary password' : 'Everyone has logged in'} />
          </>
        )}
      </div>

      <div className="mb-4"><FilterTabs<Tab> value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All members', count: tc.all }, { key: 'staff', label: 'Staff', count: tc.staff }, { key: 'distributors', label: 'Distributors', count: tc.distributors }, { key: 'off', label: 'Switched off', count: tc.off }]} /></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1.3fr)_auto]">
        <SearchBox value={q} onChange={setQ} placeholder="Search name or phone" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role"><option value="">All roles</option>{ROLES.map((r) => <option key={r.code} value={r.code}>{r.label.replace(' (mobile app)', '')}</option>)}</Select>
        <button onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold hover:bg-cream-2"><Icon name="reset" size={16} />Reset</button>
      </div>

      {users.error && <div className="mb-4"><ErrorNote message={users.error} onRetry={users.reload} /></div>}
      <div className={`grid items-start gap-5 ${picked && wide ? 'grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-1'}`}>
        <div>
          <Card className="p-5">
            <h2 className="text-lg font-bold">Team directory</h2>
            <p className="mb-4 text-xs text-muted">Select a person to reset their password or switch them off</p>
            {!users.data ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : filtered.length === 0 ? <EmptyState title={all.length === 0 ? 'No team members yet' : 'No one matches'} text={all.length === 0 ? undefined : 'Try another tab or search.'} /> : (
              <div className="overflow-hidden rounded-xl">
                <Table head={['Member', 'Role', 'Last login', 'Status']}>
                  {view.map((u) => (
                    <tr key={u.id} onClick={() => setOpenId(u.id)} className={`cursor-pointer hover:bg-cream/60 ${openId === u.id ? 'bg-orange-soft/50' : ''} ${u.is_active ? '' : 'opacity-60'}`}>
                      <Td><div className="flex items-center gap-3"><Avatar name={u.full_name} /><div><p className="font-semibold">{u.full_name}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p><p className="text-xs text-muted">{u.phone}</p></div></div></Td>
                      <Td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone="brand">{titleCase(r)}</Badge>)}</div></Td>
                      <Td className="whitespace-nowrap text-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}</Td>
                      <Td>{u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Switched off</Badge>}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Card>
          <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={setPage} noun="members" />
        </div>
        {picked && wide && <div className="sticky top-24">{panel}</div>}
      </div>
      {!wide && <Drawer open={!!picked} onClose={() => setOpenId(null)} title="Team member">{panel}</Drawer>}

      <AddModal open={adding} onClose={() => setAdding(false)} onCreated={(s) => { setAdding(false); setSecret(s); void users.reload(); }} />
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.action === 'deactivate' ? `Switch off ${confirm?.u.full_name}?` : `Reset password for ${confirm?.u.full_name}?`}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{confirm?.action === 'deactivate' ? 'They will be logged out and cannot log in until you switch them back on.' : 'A new temporary password is shown once. They must choose their own when they next log in.'}</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant={confirm?.action === 'deactivate' ? 'danger' : 'primary'} busy={!!confirm && busyId === confirm.u.id} onClick={() => confirm && act(confirm.u, confirm.action)}>{confirm?.action === 'deactivate' ? 'Switch off' : 'Reset password'}</Button></div>
        </div>
      </Modal>
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Temporary password" subtitle="Shown only once">
        <div className="space-y-4">
          <p className="text-sm">Give this to <b>{secret?.name}</b> ({secret?.phone}). They must choose their own password when they first log in.</p>
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
    <Modal open={open} onClose={onClose} title="Add team member" subtitle="They get a temporary password to log in with">
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
