import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import type { User } from '../types';
import {
  Button, Input, Select, Modal, PageHeader, Alert, Spinner, Table, Td, Badge,
} from '../components/ui';

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STUDENT' });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const data = await usersApi.list(params);
      setUsers(data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, roleFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await usersApi.create(form);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'STUDENT' });
      load();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role });
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setEditError('');
    try {
      await usersApi.update(editUser.id, editForm);
      setEditUser(null);
      load();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await usersApi.remove(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Users"
        subtitle="Manage platform users"
        action={<Button onClick={() => setShowCreate(true)}>+ New User</Button>}
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      <div className="flex gap-3 mb-5">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-36">
          <option value="">All roles</option>
          <option value="STUDENT">Student</option>
          <option value="TEACHER">Teacher</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Name', 'Email', 'Role', 'Actions']}>
          {users.map(u => (
            <tr key={u.id} className="hover:bg-gray-50">
              <Td className="font-medium">{u.name}</Td>
              <Td className="text-gray-500">{u.email}</Td>
              <Td><Badge value={u.role} /></Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(u.id)}>Delete</Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {showCreate && (
        <Modal
          title="New User"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
            </>
          }
        >
          {createError && <Alert type="error">{createError}</Alert>}
          <form onSubmit={handleCreate} className="space-y-3">
            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal
          title={`Edit — ${editUser.name}`}
          onClose={() => setEditUser(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </>
          }
        >
          {editError && <Alert type="error">{editError}</Alert>}
          <form onSubmit={handleEdit} className="space-y-3">
            <Input label="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            <Input label="Email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
            <Select label="Role" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </form>
        </Modal>
      )}
    </div>
  );
}
