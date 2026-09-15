
import React, { useEffect, useState } from 'react';
import type { User, Role } from '../types.ts';
import { UserPlus, ShieldAlert, Trash2 } from 'lucide-react';
import AdminPipelineSettings from './AdminPipelineSettings.tsx';

export default function AdminPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([]);
    
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Telecaller');
  
        
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = () => {
    fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(console.error);
      
      };

  useEffect(() => {
    fetchData();
  }, [token]);

  
  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Network error while deleting user');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setSuccess(`User ${data.username} created successfully.`);
      setUsername(''); setPassword('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  
  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Admin Panel</h2>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage users, roles, and pipeline stages.</p>
      </div>

      {error && <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/50">{error}</div>}
      {success && <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Add User Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs h-fit transition-colors">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm sm:text-base flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Add New User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="e.g. john_sales"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                <input 
                  type="password" 
                  required 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
                <select 
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  value={role} 
                  onChange={e => setRole(e.target.value as Role)}
                >
                  <option value="Admin">Admin</option>
                  <option value="Telecaller">Telecaller</option>
                  <option value="Technician">Technician</option>
                  <option value="Social Media Manager">Social Media Manager</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Create User
              </button>
            </form>
          </div>
        </div>

        {/* Users Table / List */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs overflow-hidden h-fit transition-colors">
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm sm:text-base">Active Users</h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{users.length} total</span>
          </div>

          {/* Mobile Card List (< sm) */}
          <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map(u => (
              <div key={u.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    <span>{u.username}</span>
                    {u.role === 'Admin' && <ShieldAlert className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">ID #{u.id}</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {u.role}
                </span>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No active users.</div>
            )}
          </div>

          {/* Desktop Table (>= sm) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 dark:bg-zinc-850 dark:bg-zinc-800/70 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="p-4 w-16">ID</th>
                  <th className="p-4">Username</th>
                  <th className="p-4 text-right">Role</th>
                  <th className="p-4 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {users.map(u => (
                  <tr key={u.id} className="text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs">#{u.id}</td>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2">
                        {u.username}
                        {u.role === 'Admin' && <ShieldAlert className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No active users.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pt-4 sm:pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <AdminPipelineSettings token={token} />
      </div>
    </div>
  );
}
