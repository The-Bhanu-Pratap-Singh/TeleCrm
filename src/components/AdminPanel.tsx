import React, { useEffect, useState, useMemo } from 'react';
import type { User, Role } from '../types.ts';
import { UserPlus, ShieldAlert, Trash2, Download, Database, Upload, HardDriveDownload } from 'lucide-react';
import { get, set } from 'idb-keyval';
import AdminPipelineSettings from './AdminPipelineSettings.tsx';
import LeadMap from './LeadMap.tsx';
import CalendarView from './CalendarView.tsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function AdminPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Telecaller');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [dbHash, setDbHash] = useState('');
  const [dbCount, setDbCount] = useState(0);
  const [lastKnownHash, setLastKnownHash] = useState('');
  const [lastAutoBackupDate, setLastAutoBackupDate] = useState<Date | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'users'|'pipeline'|'performance'|'map'|'calendar'>('users');
  const [leads, setLeads] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer \${token}` }});
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads', { headers: { 'Authorization': `Bearer \${token}` }});
      if (res.ok) setLeads(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/leads/status-hash', { headers: { 'Authorization': `Bearer \${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDbHash(data.hash);
        setDbCount(data.count);
        const savedHash = localStorage.getItem('lastDbHash');
        if (savedHash && savedHash !== data.hash) {
          const [savedCount] = savedHash.split('-').map(Number);
          if (data.count < savedCount) {
             setError(`Warning: Database record count dropped from \${savedCount} to \${data.count}. Data might be missing.`);
          }
        }
        setLastKnownHash(data.hash);
        localStorage.setItem('lastDbHash', data.hash);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLeads();
    checkDbStatus();
    get('lastAutoBackupDate').then(val => {
       if (val) setLastAutoBackupDate(new Date(val as number));
    });
    const interval = setInterval(() => {
       checkDbStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer \${token}` },
        body: JSON.stringify({ username, password, role })
      });
      if (res.ok) {
        setUsername('');
        setPassword('');
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/\${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer \${token}` }
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/leads/export-json', { headers: { 'Authorization': `Bearer \${token}` } });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hanger_hub_backup_\${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setError('');
    setSuccess('');
    
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      
      const res = await fetch('/api/leads/import-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer \${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setSuccess('Database successfully restored from JSON.');
        fetchLeads();
        checkDbStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'Import failed');
      }
    } catch (err: any) {
      setError('Invalid JSON file or import failed.');
    }
    setIsImporting(false);
  };

  const handleDownloadAutoBackup = async () => {
     try {
       const cachedBackup = await get('autoBackupData');
       if (cachedBackup) {
          const blob = new Blob([JSON.stringify(cachedBackup, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `hanger_hub_auto_cache_\${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
       }
     } catch(e) {
       console.error(e);
     }
  };

  const techStats = useMemo(() => {
    const techs = users.filter(u => u.role === 'Technician');
    return techs.map(tech => {
      const techLeads = leads.filter(l => l.assignedUserId === tech.id);
      const totalAssigned = techLeads.length;
      const totalInstalled = techLeads.filter(l => l.status === 'Installed').length;
      
      let totalTime = 0;
      let acceptedCount = 0;
      techLeads.forEach(l => {
         if (l.techAssignedAt && l.techAssignmentStatus === 'Accepted') {
            const assignedTime = new Date(l.techAssignedAt).getTime();
            const updatedTime = new Date(l.updatedAt || Date.now()).getTime();
            totalTime += Math.max(0, updatedTime - assignedTime) / (1000 * 60);
            acceptedCount++;
         }
      });
      
      const avgAcceptTime = acceptedCount > 0 ? Math.round(totalTime / acceptedCount) : 0;
      
      return {
         name: tech.username,
         totalAssigned,
         totalInstalled,
         conversionRate: totalAssigned > 0 ? Math.round((totalInstalled / totalAssigned) * 100) : 0,
         avgAcceptTime
      };
    });
  }, [leads, users]);

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Technician Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
           <h4 className="font-semibold mb-4 text-zinc-700 dark:text-zinc-300">Total Installations</h4>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={techStats}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                 <XAxis dataKey="name" tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <YAxis tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <RechartsTooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5'}} />
                 <Bar dataKey="totalInstalled" fill="#10b981" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
           <h4 className="font-semibold mb-4 text-zinc-700 dark:text-zinc-300">Avg Time to Accept (mins)</h4>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={techStats}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                 <XAxis dataKey="name" tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <YAxis tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <RechartsTooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5'}} />
                 <Bar dataKey="avgAcceptTime" fill="#6366f1" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Admin Panel</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage users, roles, and pipeline stages.</p>
        </div>
        
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> 
            {isImporting ? 'Importing...' : 'Restore JSON'}
            <input type="file" accept=".json" className="hidden" onChange={handleImportJson} disabled={isImporting} />
          </label>
          <button 
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-px -mb-6 scrollbar-hide">
        <div className="flex gap-6">
          <button onClick={() => setActiveTab('users')} className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'users' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Users & Roles</button>
          <button onClick={() => setActiveTab('pipeline')} className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'pipeline' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Pipeline Settings</button>
          <button onClick={() => setActiveTab('performance')} className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'performance' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Performance Metrics</button>
          <button onClick={() => setActiveTab('map')} className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'map' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Dispatch Map</button>
          <button onClick={() => setActiveTab('calendar')} className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'calendar' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Calendar View</button>
        </div>
      </div>
      
      <div className="pt-6">

      {/* Database Status Widget */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full \${dbHash === lastKnownHash ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Database Integrity Status</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Leads: <span className="font-medium text-zinc-700 dark:text-zinc-300">{dbCount}</span> | Last Check: Just now</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {lastAutoBackupDate ? (
              <span>Last auto-backup: <span className="font-medium text-zinc-700 dark:text-zinc-300">{lastAutoBackupDate.toLocaleString()}</span></span>
            ) : (
              <span>No auto-backup yet</span>
            )}
          </div>
          
          <button 
            onClick={handleDownloadAutoBackup}
            disabled={!lastAutoBackupDate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HardDriveDownload className="w-3.5 h-3.5" /> Retrieve Cache
          </button>
        </div>
      </div>

      {error && <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/50 mb-6">{error}</div>}
      {success && <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50 mb-6">{success}</div>}

      {activeTab === 'users' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Add User Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-fit transition-colors">
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
                  onChange={e => setRole(e.target.value as any)}
                >
                  <option value="Admin">Admin</option>
                  <option value="Telecaller">Telecaller</option>
                  <option value="Technician">Technician</option>
                  <option value="Social Media Manager">Social Media Manager</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Create User
              </button>
            </form>
          </div>
        </div>

        {/* Users Table / List */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden h-fit transition-colors">
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm sm:text-base">Active Users</h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{users.length} total</span>
          </div>

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

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 dark:bg-zinc-850 dark:bg-zinc-800/70 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="p-4 w-16">ID</th>
                  <th className="p-4">Username</th>
                  <th className="p-4 text-right">Role</th>
                  <th className="p-4 text-right">Workload</th>
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
                      {u.role === 'Technician' ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium" title="Assigned Tasks">{u.assignedCount || 0} Active</span>
                          {u.pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded" title="Pending Acceptance">{u.pendingCount} Pending</span>}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">-</span>
                      )}
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
                    <td colSpan={5} className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No active users.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
          <AdminPipelineSettings token={token} />
        </div>
      )}

      {activeTab === 'performance' && renderPerformanceTab()}

      {activeTab === 'map' && <LeadMap leads={leads.filter(l => ['Scheduled', 'Site Visit Scheduled', 'Installation Scheduled'].includes(l.status))} />}

      {activeTab === 'calendar' && <CalendarView leads={leads} />}

      </div>
    </div>
  );
}
