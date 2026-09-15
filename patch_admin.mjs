import fs from 'fs';

const content = `
import React, { useEffect, useState } from 'react';
import type { User, Role, PipelineStage } from '../types.ts';
import { UserPlus, ShieldAlert, List, Plus, Trash2, GripVertical, Save } from 'lucide-react';

export default function AdminPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Telecaller');
  
  const [newStageName, setNewStageName] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = () => {
    fetch('/api/users', { headers: { 'Authorization': \`Bearer \${token}\` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(console.error);
      
    fetch('/api/stages', { headers: { 'Authorization': \`Bearer \${token}\` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStages(data); })
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ username, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setSuccess(\`User \${data.username} created successfully.\`);
      setUsername(''); setPassword('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ name: newStageName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create stage');
      setNewStageName('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteStage = async (id: number) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(\`/api/stages/\${id}\`, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete stage');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const moveStage = async (index: number, direction: -1 | 1) => {
    const newStages = [...stages];
    if (index + direction < 0 || index + direction >= newStages.length) return;
    
    // Swap
    const temp = newStages[index];
    newStages[index] = newStages[index + direction];
    newStages[index + direction] = temp;
    
    // Update orderIndex
    const reordered = newStages.map((s, i) => ({ ...s, orderIndex: i }));
    setStages(reordered);
    
    // Save to backend
    try {
      await fetch('/api/stages/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ stages: reordered })
      });
    } catch (err) {
      console.error(err);
      fetchData(); // Reset on error
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Admin Panel</h2>
        <p className="text-sm text-zinc-500 mt-1">Manage users, roles, and pipeline stages.</p>
      </div>

      {error && <div className="text-sm text-red-600 p-3 bg-red-50 rounded-lg border border-red-100">{error}</div>}
      {success && <div className="text-sm text-emerald-600 p-3 bg-emerald-50 rounded-lg border border-emerald-100">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Users Column */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm h-fit">
            <h3 className="font-semibold text-zinc-800 flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4" /> Add New User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Username</label>
                <input type="text" required className="w-full px-3 py-2 border rounded-lg text-sm" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Password</label>
                <input type="password" required className="w-full px-3 py-2 border rounded-lg text-sm" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Role</label>
                <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={role} onChange={e => setRole(e.target.value as Role)}>
                  <option value="Admin">Admin</option>
                  <option value="Telecaller">Telecaller</option>
                  <option value="Technician">Technician</option>
                  <option value="Social Media Manager">Social Media Manager</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Create User</button>
            </form>
          </div>
        </div>

        {/* Users Table */}
        <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h3 className="font-semibold text-zinc-800">Active Users</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <th className="p-4">ID</th>
                <th className="p-4">Username</th>
                <th className="p-4">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {users.map(u => (
                <tr key={u.id} className="text-sm hover:bg-zinc-50">
                  <td className="p-4 text-zinc-500">#{u.id}</td>
                  <td className="p-4 font-medium text-zinc-900 flex items-center gap-2">
                    {u.username}
                    {u.role === 'Admin' && <ShieldAlert className="w-3 h-3 text-indigo-500" />}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800">{u.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t">
        {/* Stages Manager */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm h-fit">
          <h3 className="font-semibold text-zinc-800 flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4" /> Add Pipeline Stage
          </h3>
          <form onSubmit={handleCreateStage} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Stage Name</label>
              <input type="text" required className="w-full px-3 py-2 border rounded-lg text-sm" value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="e.g. Qualified" />
            </div>
            <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Add Stage</button>
          </form>
        </div>

        {/* Stages List */}
        <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
              <List className="w-4 h-4" /> Pipeline Stages
            </h3>
            <span className="text-xs text-zinc-500">Use arrows to reorder</span>
          </div>
          <div className="divide-y divide-zinc-200">
            {stages.map((stage, i) => (
              <div key={stage.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <button type="button" disabled={i === 0} onClick={() => moveStage(i, -1)} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">▲</button>
                    <button type="button" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">▼</button>
                  </div>
                  <span className="font-medium text-sm text-zinc-900">{stage.name}</span>
                </div>
                <button type="button" onClick={() => handleDeleteStage(stage.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {stages.length === 0 && (
              <div className="p-6 text-center text-sm text-zinc-500">No stages configured.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/AdminPanel.tsx', content);
