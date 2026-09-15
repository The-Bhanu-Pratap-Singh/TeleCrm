import fs from 'fs';

const dashboardCode = `
import { useEffect, useState } from 'react';
import type { User, Lead, ActivityLog } from '../types.ts';
import { Calendar, PhoneCall, CheckCircle, Clock, Activity, TrendingUp } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DashboardProps {
  user: User;
  token: string;
  onNavigate: (view: 'leads') => void;
}

export default function Dashboard({ user, token, onNavigate }: DashboardProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activityFilter, setActivityFilter] = useState<'today' | '7days' | '30days'>('7days');
  
  useEffect(() => {
    fetch('/api/leads', {
      headers: { 'Authorization': \`Bearer \${token}\` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) setLeads(data);
    })
    .catch(console.error);

    if (user.role === 'Admin') {
      fetch('/api/activity', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setActivities(data);
      })
      .catch(console.error);
    }
  }, [token, user.role]);

  const todayStr = new Date().toISOString().split('T')[0];
  
  const todaysFollowUps = leads.filter(l => 
    l.nextFollowUp && l.nextFollowUp.startsWith(todayStr)
  );
  
  const newLeads = leads.filter(l => l.status === 'New');
  const pendingVisits = leads.filter(l => l.status === 'Scheduled' || l.status === 'Visiting');
  const closedOrInstalled = leads.filter(l => l.status === 'Closed' || l.status === 'Installed');

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = [
    { name: 'New', count: statusCounts['New'] || 0 },
    { name: 'Follow-up', count: statusCounts['Follow-up'] || 0 },
    { name: 'Visiting', count: statusCounts['Visiting'] || 0 },
    { name: 'Scheduled', count: statusCounts['Scheduled'] || 0 },
    { name: 'Installed', count: statusCounts['Installed'] || 0 },
    { name: 'Closed', count: statusCounts['Closed'] || 0 },
  ];

  // Lead Performance (Conversion Rate Over Time)
  // Group leads by createdAt Date (YYYY-MM-DD)
  const performanceDataMap: Record<string, { total: number; converted: number }> = {};
  leads.forEach(l => {
    const date = l.createdAt ? l.createdAt.split(' ')[0] : 'Unknown';
    if (!performanceDataMap[date]) {
      performanceDataMap[date] = { total: 0, converted: 0 };
    }
    performanceDataMap[date].total++;
    if (l.status === 'Closed' || l.status === 'Installed') {
      performanceDataMap[date].converted++;
    }
  });

  const performanceData = Object.keys(performanceDataMap).sort().slice(-14).map(date => {
    const data = performanceDataMap[date];
    const conversionRate = data.total > 0 ? (data.converted / data.total) * 100 : 0;
    return {
      date,
      Rate: Math.round(conversionRate),
      Total: data.total
    };
  });

  // Filter Activities
  const filteredActivities = activities.filter(a => {
    if (!a.createdAt) return false;
    const logDate = new Date(a.createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
    
    if (activityFilter === 'today') return diffDays < 1;
    if (activityFilter === '7days') return diffDays < 7;
    return diffDays < 30;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Welcome back, {user.username}</h2>
        <p className="text-sm text-zinc-500 mt-1">Here is what's happening with your leads today.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Today's Follow-ups</p>
            <p className="text-3xl font-semibold text-indigo-600 mt-2">{todaysFollowUps.length}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
            <PhoneCall className="w-6 h-6" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">New Leads</p>
            <p className="text-3xl font-semibold text-emerald-600 mt-2">{newLeads.length}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Pending Visits</p>
            <p className="text-3xl font-semibold text-amber-600 mt-2">{pendingVisits.length}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-full text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Conversions</p>
            <p className="text-3xl font-semibold text-blue-600 mt-2">{closedOrInstalled.length}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-full text-blue-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Summary Chart */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
             Pipeline Summary
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Performance Chart */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" /> Lead Performance (Conversion %)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="Rate" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Conversion %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Follow ups List */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
            <h3 className="font-semibold text-zinc-800">Today's Follow-ups</h3>
            <button onClick={() => onNavigate('leads')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View all</button>
          </div>
          <div className="divide-y divide-zinc-100">
            {todaysFollowUps.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">No follow-ups scheduled for today.</div>
            ) : (
              todaysFollowUps.slice(0, 5).map(l => (
                <div key={l.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                  <div>
                    <p className="font-medium text-sm text-zinc-900">{l.clientName}</p>
                    <p className="text-xs text-zinc-500">{l.contact}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Admin Team Activity Log */}
        {user.role === 'Admin' && (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" /> Team Activity Log
              </h3>
              <select 
                className="text-sm border-zinc-300 rounded-md py-1 pl-2 pr-8 text-zinc-700"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as any)}
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
              {filteredActivities.length === 0 ? (
                <div className="p-6 text-center text-sm text-zinc-500">No recent activities found.</div>
              ) : (
                filteredActivities.map(a => (
                  <div key={a.id} className="p-4 hover:bg-zinc-50">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-zinc-900">{a.username}</p>
                      <p className="text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-zinc-700 mt-1">
                      <span className="font-semibold">{a.action}</span> - {a.leadName ? \`Lead: \${a.leadName}\` : ''}
                    </p>
                    {a.details && <p className="text-xs text-zinc-500 mt-1 italic">"{a.details}"</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/Dashboard.tsx', dashboardCode);
