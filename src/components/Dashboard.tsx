import React, { useEffect, useState, useMemo } from 'react';
import type { User, Lead, ActivityLog, Attendance, Task } from '../types.ts';
import { 
  Calendar, PhoneCall, CheckCircle, Clock, Activity, TrendingUp, 
  Users, CalendarClock, Download, CheckSquare, Target, ClipboardList,
  ThumbsUp, ThumbsDown, AlertCircle, LogIn, LogOut, Timer, AlertTriangle,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { useTheme } from '../context/ThemeContext.tsx';

interface DashboardProps {
  user: User;
  token: string;
  onNavigate: (view: 'leads' | 'calendar') => void;
}

interface TeamMemberAttendance {
  user: { id: number; username: string; role: string };
  status: string;
  attendance: Attendance | null;
  activeMinutes: number;
  totalTasks: number;
  completedTasks: number;
  activityCount: number;
}

interface AttendanceSummary {
  attendance: Attendance | null;
  tasks: Task[];
  overdueCount: number;
  dueTodayCount: number;
  completedFollowUpsToday: number;
  overdueLeads: Lead[];
  dueTodayLeads: Lead[];
}

export default function Dashboard({ user, token, onNavigate }: DashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stages, setStages] = useState<{name: string, orderIndex: number}[]>([]);
  
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Attendance & Live Session State
  const [now, setNow] = useState(Date.now());
  const [punchLoading, setPunchLoading] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [teamAttendance, setTeamAttendance] = useState<TeamMemberAttendance[]>([]);
  const [activityFilter, setActivityFilter] = useState<'today' | '7days' | '30days'>('7days');

  // Live timer for active session duration
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendanceSummary = async () => {
    try {
      const res = await fetch('/api/attendance/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAttendanceSummary(data);
      }
    } catch (e) {
      console.error('Failed to fetch attendance summary', e);
    }
  };

  const fetchTeamAttendance = async () => {
    if (user.role !== 'Admin') return;
    try {
      const res = await fetch('/api/attendance/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamAttendance(data);
      }
    } catch (e) {
      console.error('Failed to fetch team attendance', e);
    }
  };

  const handlePunch = async (action: 'punch-in' | 'punch-out') => {
    try {
      setPunchLoading(true);
      const res = await fetch(`/api/attendance/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchAttendanceSummary();
        if (user.role === 'Admin') await fetchTeamAttendance();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPunchLoading(false);
    }
  };

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

      fetchAttendanceSummary();
      fetchTeamAttendance();
    };
    
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000);
    return () => clearInterval(interval);
  }, [token, user.role]);

  // Calculate live session duration
  const activeSessionDuration = useMemo(() => {
    const att = attendanceSummary?.attendance;
    if (!att || !att.punchIn) return null;
    const start = new Date(att.punchIn).getTime();
    const end = att.punchOut ? new Date(att.punchOut).getTime() : now;
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));

    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;

    return {
      formatted: `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`,
      isPunchedOut: !!att.punchOut
    };
  }, [attendanceSummary?.attendance, now]);

  const todayStr = new Date().toISOString().split('T')[0];
  
  const todaysFollowUps = leads.filter(l => 
    l.nextFollowUp && l.nextFollowUp.startsWith(todayStr)
  );

  const overdueFollowUps = leads.filter(l => {
    if (!l.nextFollowUp || ['Closed', 'Closed-Lost', 'Installed'].includes(l.status || '')) return false;
    return l.nextFollowUp.split('T')[0] < todayStr;
  });

  const activeFollowUps = leads.filter(l => l.nextFollowUp && new Date(l.nextFollowUp) >= new Date(todayStr));
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
    const diffDays = (Date.now() - logDate.getTime()) / (1000 * 3600 * 24);
    
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
      pdf.save('telecrm-dashboard-report.pdf');
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF: ' + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6" ref={dashboardRef}>
      {/* Top Header & Attendance Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Welcome back, {user.username}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
              {user.role}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time TeleCRM operations, daily attendance, and lead pipeline tracking.
          </p>
        </div>

        {/* User Attendance & Active Hours Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {attendanceSummary?.attendance?.punchIn ? (
            <div className="flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-zinc-400">Shift Started</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {new Date(attendanceSummary.attendance.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {activeSessionDuration?.isPunchedOut ? 'Total Duration' : 'Active Hours'}
                </span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                  {activeSessionDuration?.formatted}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Not clocked in today</span>
            </div>
          )}

          {/* Punch Actions */}
          {attendanceSummary?.attendance?.punchIn && !attendanceSummary?.attendance?.punchOut ? (
            <button
              onClick={() => handlePunch('punch-out')}
              disabled={punchLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
              title="End shift and record punch-out timestamp"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Punch Out</span>
            </button>
          ) : (
            <button
              onClick={() => handlePunch('punch-in')}
              disabled={punchLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
              title="Record punch-in timestamp for today"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{attendanceSummary?.attendance?.punchOut ? 'Re-Punch In' : 'Punch In'}</span>
            </button>
          )}

          <button 
            onClick={exportPDF} 
            disabled={isExporting}
            className="no-print flex items-center justify-center gap-1.5 px-3.5 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
          >
            {isExporting ? <span className="animate-spin text-xs">...</span> : <Download className="w-3.5 h-3.5" />}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Critical Overdue Follow-ups Alert Banner (Red Indicator) */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 flex-shrink-0 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm sm:text-base">
                  Action Required: {overdueFollowUps.length} Overdue Follow-up{overdueFollowUps.length > 1 ? 's' : ''} Detected
                </h4>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 uppercase">
                  Overdue
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                These leads passed their scheduled reminder without an interaction note. Call or reschedule immediately.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('leads')}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors flex-shrink-0 shadow-xs"
          >
            <span>Review Overdue Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Due Today Quick Alert Banner */}
      {todaysFollowUps.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                {todaysFollowUps.length} Lead Follow-up{todaysFollowUps.length > 1 ? 's' : ''} Due Today
              </span>
              <span className="text-xs text-amber-700 dark:text-amber-400 ml-2 hidden sm:inline">
                Keep client engagement prompt to maintain high conversion.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('leads')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0"
          >
            View Today's Leads &rarr;
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Leads */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Total Leads
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">{leads.length}</p>
            </div>
          </div>
          <div className="h-12 mt-2 -mx-2 -mb-5 z-0 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <Area type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} fillOpacity={0.2} fill="#6366f1" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Conversion Rate */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Avg Conversion
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">{totalConversionRate}%</p>
            </div>
          </div>
          <div className="h-12 mt-2 -mx-2 -mb-5 z-0 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fillOpacity={0.2} fill="#10b981" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Follow-ups */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-amber-500" /> Active Follow-ups
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">{activeFollowUps.length}</p>
            </div>
          </div>
          <div className="h-12 mt-2 -mx-2 -mb-5 z-0 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <Area type="monotone" dataKey="followups" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.2} fill="#f59e0b" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Follow-ups Completed Today */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors overflow-hidden relative">
          <div className="flex items-center justify-between z-10">
            <div className="min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Follow-ups Done Today
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">
                {attendanceSummary?.completedFollowUpsToday || 0}
              </p>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Distinct leads contacted or updated today
          </div>
        </div>
      </div>

      {/* Admin Real-Time Team Monitoring Dashboard */}
      {user.role === 'Admin' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Real-Time Team Monitoring & Attendance
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Live staff login status, exact punch-in/out timestamps, active session hours, and task progress.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg">
              Date: {todayStr}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Login Status</th>
                  <th className="py-2.5 px-3">Punch-In</th>
                  <th className="py-2.5 px-3">Punch-Out</th>
                  <th className="py-2.5 px-3">Active Hours</th>
                  <th className="py-2.5 px-3">Tasks Completed</th>
                  <th className="py-2.5 px-3">Today's Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {teamAttendance.map(member => {
                  const hours = Math.floor(member.activeMinutes / 60);
                  const mins = member.activeMinutes % 60;
                  const isActive = member.status === 'Active (Punched In)';
                  const isOut = member.status === 'Punched Out';

                  return (
                    <tr key={member.user.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {member.user.username}
                      </td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800">
                          {member.user.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isActive 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : isOut
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : isOut ? 'bg-amber-500' : 'bg-zinc-400'}`}></span>
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                        {member.attendance?.punchIn ? new Date(member.attendance.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                        {member.attendance?.punchOut ? new Date(member.attendance.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-3 font-medium text-zinc-800 dark:text-zinc-200 font-mono text-xs">
                        {member.activeMinutes > 0 ? `${hours}h ${mins}m` : '0h 0m'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-zinc-900 dark:text-white">{member.completedTasks}</span>
                        <span className="text-zinc-400 text-xs"> / {member.totalTasks}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                          {member.activityCount} actions
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pipeline Summary & Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pipeline Summary Chart */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors">
          <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 mb-3 sm:mb-4 flex items-center gap-2">
             <ClipboardList className="w-4 h-4 text-indigo-500" /> Pipeline Stage Breakdown
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

      {/* Follow-up Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today's Follow-ups */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" /> Today's Follow-ups ({todaysFollowUps.length})
            </h3>
            <button onClick={() => onNavigate('leads')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">View all</button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
            {todaysFollowUps.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No follow-ups due today.</div>
            ) : (
              todaysFollowUps.map(l => (
                <div key={l.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{l.clientName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{l.contact}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex-shrink-0">
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming (Next 7 Days) */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-500" /> Upcoming (Next 7 Days)
            </h3>
            <button onClick={() => onNavigate('calendar')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Calendar</button>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
            {upcomingFollowUps.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No upcoming follow-ups scheduled.</div>
            ) : (
              upcomingFollowUps.map(l => (
                <div key={l.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{l.clientName}</p>
                    <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {new Date(l.nextFollowUp!).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Activity Feed (Admin only) */}
        {user.role === 'Admin' ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-2">
              <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" /> Recent Team Activity
              </h3>
              <select 
                className="text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg py-1 px-2 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as any)}
              >
                <option value="today">Today</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
              </select>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
              {filteredActivities.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No recent activities.</div>
              ) : (
                filteredActivities.slice(0, 10).map(a => (
                  <div key={a.id} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{a.username}</span>
                      <span className="text-[10px] text-zinc-400">{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 mt-0.5">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">{a.action}</span>
                      {a.details ? ` — ${a.details}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Overdue summary box for telecallers */
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-semibold text-sm sm:text-base text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" /> Overdue Queue ({overdueFollowUps.length})
              </h3>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[320px] overflow-y-auto">
              {overdueFollowUps.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400">
                  Awesome! All follow-ups are up to date.
                </div>
              ) : (
                overdueFollowUps.map(l => (
                  <div key={l.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 bg-rose-50/40 dark:bg-rose-950/20">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{l.clientName}</p>
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Due: {l.nextFollowUp}</p>
                    </div>
                    <button
                      onClick={() => onNavigate('leads')}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Handle
                    </button>
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
