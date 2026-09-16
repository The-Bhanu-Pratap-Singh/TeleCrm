import React, { useEffect, useState, useMemo } from 'react';
import { User } from '../types.ts';
import CalendarView from './CalendarView.tsx';
import { Calendar as CalendarIcon, Link as LinkIcon, Unlink, RefreshCw } from 'lucide-react';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from '../lib/googleAuth.ts';

export default function CalendarAppView({ user, token }: { user: User, token: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(true);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        let data = await res.json();
        // Role based filtering
        if (user.role === 'Telecaller') {
          data = data.filter((l: any) => l.telecallerId === user.id);
        } else if (user.role === 'Technician') {
          data = data.filter((l: any) => l.assignedUserId === user.id);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-500" />
            Team Calendar
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {user.role === 'Admin' ? 'Master calendar of all team activities.' : 
             user.role === 'Telecaller' ? 'Your scheduled follow-ups and meetings.' : 
             'Your confirmed installations and site visits.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {gcalLoading ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-lg text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Checking sync...
            </div>
          ) : googleConnected ? (
            <button 
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
            >
              <Unlink className="w-4 h-4" /> Google Calendar Synced
            </button>
          ) : (
            <button 
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden p-2 sm:p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center min-h-[400px]">
            <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <CalendarView leads={leads} />
        )}
      </div>
    </div>
  );
}
