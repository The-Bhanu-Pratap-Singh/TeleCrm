import { syncLeadToGoogleCalendar } from '../lib/googleAuth.ts';

import React, { useEffect, useState, useMemo } from 'react';
import type { User, Lead, ActivityLog, Attendance, Task } from '../types.ts';
import { Calendar, PhoneCall, CheckCircle, Clock, Activity, TrendingUp, Users, CalendarClock, Download, CheckSquare, Users as UsersIcon, Target, ClipboardList } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext.tsx';
import { ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';

interface DashboardProps {

  user: User;
  token: string;
  onNavigate: (view: 'leads') => void;
}

export default function Dashboard({ user, token, onNavigate }: DashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const pendingLeads = useMemo(() => {
    return leads.filter(l => l.pendingTechId === user.id && l.techAssignmentStatus === 'Pending');
  }, [leads, user.id]);

  const handleTechAction = async (leadId: number, action: 'accept-tech' | 'decline-tech') => {
    try {
      setActionLoading(leadId);
      const res = await fetch(`/api/leads/${leadId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Refresh leads
        const leadsRes = await fetch('/api/leads', { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await leadsRes.json();
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };


  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('dashboard-report.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      console.error('EXPORT_ERROR:', err);
      alert('Failed to generate PDF: ' + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  const [activityFilter, setActivityFilter] = useState<'today' | '7days' | '30days'>('7days');
  const [stages, setStages] = useState<{name: string, orderIndex: number}[]>([]);
  
  useEffect(() => {
    const fetchAllData = () => {
      fetch('/api/stages', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setStages(data); })
        .catch(console.error);
      
      fetch('/api/leads', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setLeads(data);
      })
      .catch(console.error);

      if (user.role === 'Admin') {
        fetch('/api/activity', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setActivities(data);
        })
        .catch(console.error);
      }
    };
    
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000);
    return () => clearInterval(interval);
  }, [token, user.role]);

  const todayStr = new Date().toISOString().split('T')[0];
  
  const todaysFollowUps = leads.filter(l => 
    l.nextFollowUp && l.nextFollowUp.startsWith(todayStr)
  );

  const activeFollowUps = leads.filter(l => l.nextFollowUp && new Date(l.nextFollowUp) >= new Date(todayStr));
  
  const newLeads = leads.filter(l => l.status === 'New');
  const closedOrInstalled = leads.filter(l => l.status === 'Closed' || l.status === 'Installed');

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = stages.map(stage => ({
    name: stage.name,
    count: statusCounts[stage.name] || 0
  }));

  // KPIs sparkline data
  const sparklineData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayLeads = leads.filter(l => l.createdAt && l.createdAt.startsWith(dateStr));
      const dayFollowups = leads.filter(l => l.nextFollowUp && l.nextFollowUp.startsWith(dateStr));
      const dayConverted = dayLeads.filter(l => l.status === 'Closed' || l.status === 'Installed');
      
      data.push({
        date: dateStr,
        leads: dayLeads.length,
        followups: dayFollowups.length,
        rate: dayLeads.length > 0 ? Math.round((dayConverted.length / dayLeads.length) * 100) : 0
      });
    }
    return data;
  }, [leads]);

  const totalConversionRate = leads.length > 0 ? Math.round((closedOrInstalled.length / leads.length) * 100) : 0;

  // Lead Performance (Conversion Rate Over Time)
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

  const upcomingFollowUps = leads.filter(l => {
    if (!l.nextFollowUp) return false;
    const d = new Date(l.nextFollowUp);
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    return d >= tomorrow && d <= nextWeek;
  }).sort((a, b) => new Date(a.nextFollowUp!).getTime() - new Date(b.nextFollowUp!).getTime());

  return (
    <div className="space-y-4 sm:space-y-6" ref={dashboardRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Welcome back, {user.username}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Here is what's happening with your leads today.</p>
        </div>
        <button 
          onClick={exportPDF} 
          disabled={isExporting}
          className="no-print flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isExporting ? <span className="animate-spin text-sm">...</span> : <Download className="w-4 h-4" />}
          {isExporting ? 'Generating...' : 'Export Report'}
        </button>
      </div>

      {/* KPI Summary Cards with Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5"><Users className="w-4 h-4 text-indigo-500" /> Total Leads</p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">{leads.length}</p>
            </div>
          </div>
          <div className="h-16 mt-2 -mx-2 -mb-5 z-0 opacity-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-500" /> Avg Conversion</p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">{totalConversionRate}%</p>
            </div>
          </div>
          <div className="h-16 mt-2 -mx-2 -mb-5 z-0 opacity-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-amber-500" /> Active Follow-ups</p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">{activeFollowUps.length}</p>
            </div>
          </div>
          <div className="h-16 mt-2 -mx-2 -mb-5 z-0 opacity-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="colorFollowups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="followups" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorFollowups)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pipeline Summary Chart */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
          <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 mb-3 sm:mb-4 flex items-center gap-2">
             Pipeline Summary
          </h3>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 15, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#e4e4e7'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }} />
                <Tooltip 
                  cursor={{ fill: isDark ? '#27272a' : '#f4f4f5' }}
                  contentStyle={{ 
                    backgroundColor: isDark ? '#18181b' : '#ffffff', 
                    borderColor: isDark ? '#3f3f46' : '#e4e4e7', 
                    color: isDark ? '#f4f4f5' : '#09090b',
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                    fontSize: '12px' 
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Performance Chart */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
          <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 mb-3 sm:mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" /> Lead Performance (Conversion %)
          </h3>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 5, right: 15, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#e4e4e7'} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#18181b' : '#ffffff', 
                    borderColor: isDark ? '#3f3f46' : '#e4e4e7', 
                    color: isDark ? '#f4f4f5' : '#09090b',
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                    fontSize: '12px' 
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: isDark ? '#d4d4d8' : '#52525b' }} />
                <Line type="monotone" dataKey="Rate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Conversion %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today's Follow ups List */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-rose-500" /> Today's Follow-ups
            </h3>
            <button onClick={() => onNavigate('leads')} className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">View all</button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
            {todaysFollowUps.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">No follow-ups scheduled for today.</div>
            ) : (
              todaysFollowUps.slice(0, 5).map(l => (
                <div key={l.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{l.clientName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{l.contact}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 whitespace-nowrap flex-shrink-0">
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-500" /> Upcoming (Next 7 Days)
            </h3>
            <button onClick={() => onNavigate('leads')} className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">View all</button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
            {upcomingFollowUps.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">No upcoming follow-ups in the next 7 days.</div>
            ) : (
              upcomingFollowUps.slice(0, 5).map(l => (
                <div key={l.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{l.clientName}</p>
                    <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{new Date(l.nextFollowUp!).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 whitespace-nowrap flex-shrink-0">
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Admin Team Activity Log */}
        {user.role === 'Admin' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" /> Team Activity Log
              </h3>
              <select 
                className="text-xs sm:text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg py-1 px-2 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as any)}
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
              {filteredActivities.length === 0 ? (
                <div className="p-6 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">No recent activities found.</div>
              ) : (
                filteredActivities.map(a => (
                  <div key={a.id} className="p-3 sm:p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{a.username}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                      <span className="font-semibold">{a.action}</span> {a.leadName ? `• Lead: ${a.leadName}` : ''}
                    </p>
                    {a.details && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic line-clamp-2">"{a.details}"</p>}
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
