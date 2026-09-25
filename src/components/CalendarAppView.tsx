import React, { useEffect, useState, useMemo } from 'react';
import { User } from '../types.ts';
import CalendarView from './CalendarView.tsx';
import { Calendar as CalendarIcon, Link as LinkIcon, Unlink, RefreshCw, CheckCircle, Filter } from 'lucide-react';
import { initAuth, googleSignIn, logoutGoogle, syncLeadToGoogleCalendar, getAccessToken } from '../lib/googleAuth.ts';

export default function CalendarAppView({ user, token }: { user: User, token: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Installations' | 'Visits' | 'Follow-ups'>('All');

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        let data = await res.json();
        // Role based filtering:
        // Telecallers see leads assigned to them
        // Technicians see assigned or pending technician tasks
        // Admins see master schedule
        if (user.role === 'Telecaller') {
          data = data.filter((l: any) => l.assignedUserId === user.id);
        } else if (user.role === 'Technician') {
          data = data.filter((l: any) => l.assignedUserId === user.id || l.pendingTechId === user.id);
        }
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    
    // Initialize Google Auth
    const unsubscribe = initAuth(
      (googleUser, accessToken) => {
        setGoogleConnected(true);
        setGcalLoading(false);
      },
      () => {
        setGoogleConnected(false);
        setGcalLoading(false);
      }
    );
    return () => unsubscribe();
  }, [token, user]);

  const handleConnect = async () => {
    try {
      await googleSignIn();
      setGoogleConnected(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async () => {
    await logoutGoogle();
    setGoogleConnected(false);
  };

  const handleSyncToGoogle = async () => {
    try {
      setSyncingAll(true);
      for (const lead of leads) {
        if (lead.visitSchedule || lead.installationSchedule || lead.nextFollowUp) {
          await syncLeadToGoogleCalendar(lead);
        }
      }
      setSyncSuccess(`Synchronized ${leads.length} leads to Google Calendar!`);
      setTimeout(() => setSyncSuccess(''), 4000);
    } catch (e) {
      console.error('Google Calendar batch sync error:', e);
    } finally {
      setSyncingAll(false);
    }
  };

  // Filter leads based on selected category filter
  const displayedLeads = useMemo(() => {
    if (categoryFilter === 'Installations') {
      return leads.filter(l => !!l.installationSchedule);
    }
    if (categoryFilter === 'Visits') {
      return leads.filter(l => !!l.visitSchedule);
    }
    if (categoryFilter === 'Follow-ups') {
      return leads.filter(l => !!l.nextFollowUp);
    }
    return leads;
  }, [leads, categoryFilter]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-500" />
            {user.role === 'Admin' ? 'Master Team Calendar' : 'Your Schedule Calendar'}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {user.role === 'Admin' ? 'Master view of all site visits, installations, and telecaller follow-ups.' : 
             user.role === 'Telecaller' ? 'Your assigned client follow-ups, calls, and meetings.' : 
             'Your confirmed installation jobs and scheduled client site visits.'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {gcalLoading ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking Google Sync...
            </div>
          ) : googleConnected ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSyncToGoogle}
                disabled={syncingAll}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
                title="Synchronize all events to your Google Calendar account"
              >
                {syncingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{syncingAll ? 'Syncing...' : 'Sync to Google'}</span>
              </button>

              <button 
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Google Synced
              </button>
            </div>
          ) : (
            <button 
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors shadow-xs"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-3.5 h-3.5" alt="Google" />
              <span>Link Google Calendar</span>
            </button>
          )}
        </div>
      </div>

      {syncSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-zinc-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {(['All', 'Installations', 'Visits', 'Follow-ups'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          Showing {displayedLeads.length} schedule record{displayedLeads.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden p-2 sm:p-4 shadow-xs">
        {loading ? (
          <div className="h-full flex items-center justify-center min-h-[400px]">
            <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <CalendarView leads={displayedLeads} />
        )}
      </div>
    </div>
  );
}
