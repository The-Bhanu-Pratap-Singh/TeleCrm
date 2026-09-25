import React, { useEffect, useState, useMemo } from 'react';
import type { User, Lead, Attendance } from '../types.ts';
import { ThumbsUp, ThumbsDown, AlertCircle, Calendar, MapPin, PhoneCall, CheckCircle, Clock, Timer, LogIn, LogOut } from 'lucide-react';

interface TechProps {
  user: User;
  token: string;
}

export default function TechnicianDashboard({ user, token }: TechProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [punchLoading, setPunchLoading] = useState(false);

  // Live timer for SLA countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = () => {
    fetch('/api/attendance/today', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (data?.attendance) setAttendance(data.attendance);
    })
    .catch(console.error);
  };

  const handlePunch = async (action: 'punch-in' | 'punch-out') => {
    try {
      setPunchLoading(true);
      const res = await fetch(`/api/attendance/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAttendance();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPunchLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/leads', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setLeads(data);
      })
      .catch(console.error);
    };
    
    fetchData();
    fetchAttendance();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const pendingLeads = useMemo(() => {
    return leads.filter(l => l.pendingTechId === user.id && l.techAssignmentStatus === 'Pending');
  }, [leads, user.id]);

  const acceptedLeads = useMemo(() => {
    return leads.filter(l => l.assignedUserId === user.id && (!l.techAssignmentStatus || l.techAssignmentStatus === 'Accepted') && ['Scheduled', 'Site Visit Scheduled', 'Installation Scheduled'].includes(l.status));
  }, [leads, user.id]);

  const completedLeads = useMemo(() => {
    return leads.filter(l => l.assignedUserId === user.id && l.status === 'Installed');
  }, [leads, user.id]);

  const handleTechAction = async (leadId: number, action: 'accept-tech' | 'decline-tech') => {
    try {
      setActionLoading(leadId);
      const res = await fetch(`/api/leads/${leadId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
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

  // Calculate remaining seconds for 30-min SLA
  const getSlaRemaining = (assignedAt: string | Date | undefined) => {
    if (!assignedAt) return null;
    const startTime = new Date(assignedAt).getTime();
    const elapsed = now - startTime;
    const remainingMs = (30 * 60 * 1000) - elapsed;
    if (remainingMs <= 0) return { expired: true, text: 'SLA Expired (Auto-Reassigning...)' };

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
      expired: false,
      urgent: minutes < 5,
      text: `${minutes}m ${seconds.toString().padStart(2, '0')}s remaining`
    };
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Technician Hub</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage your pending assignments and active field jobs.</p>
        </div>

        {/* Technician Punch-In/Out Quick Control */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {attendance?.punchIn ? (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Punched In {new Date(attendance.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {attendance.punchOut && (
                  <p className="text-[11px] text-zinc-400 mt-0.5">Out at {new Date(attendance.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </div>
              {!attendance.punchOut && (
                <button
                  onClick={() => handlePunch('punch-out')}
                  disabled={punchLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" /> Punch Out
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => handlePunch('punch-in')}
              disabled={punchLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" /> Punch In for Today
            </button>
          )}
        </div>
      </div>

      {pendingLeads.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-sm sm:text-base">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-bounce" />
              <span>Pending Task Acceptance ({pendingLeads.length})</span>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full">
              30-Min SLA Auto-Escalation Active
            </span>
          </div>

          <div className="space-y-4">
            {pendingLeads.map(lead => {
              const sla = getSlaRemaining(lead.techAssignedAt);
              return (
                <div key={lead.id} className="bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm transition-all">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{lead.clientName}</h4>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {lead.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
                      <div className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-zinc-400" />
                        <span>{lead.address || 'No address provided'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
                        <span>Schedule: {lead.visitSchedule || lead.installationSchedule || 'Immediate'}</span>
                      </div>
                    </div>

                    {/* Live SLA Countdown Badge */}
                    {sla && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          sla.expired 
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 animate-pulse'
                            : sla.urgent 
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          <Timer className="w-3.5 h-3.5" />
                          <span>SLA Timer: {sla.text}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0">
                    <button 
                      onClick={() => handleTechAction(lead.id, 'decline-tech')}
                      disabled={actionLoading === lead.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> Decline
                    </button>
                    <button 
                      onClick={() => handleTechAction(lead.id, 'accept-tech')}
                      disabled={actionLoading === lead.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Accept Job
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Active Jobs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xs">
           <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
             <CheckCircle className="w-4 h-4 text-indigo-500" /> Active Assigned Jobs ({acceptedLeads.length})
           </h3>
           <div className="space-y-3">
             {acceptedLeads.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">No active jobs in progress.</p>
             ) : (
                acceptedLeads.map(lead => (
                  <div key={lead.id} className="p-3.5 border border-zinc-200/70 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{lead.clientName}</h4>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-zinc-400" /> {lead.address || 'No address specified'}</span>
                      <span className="flex items-center gap-1.5"><PhoneCall className="w-3 h-3 text-zinc-400" /> {lead.contact}</span>
                      {lead.installationSchedule && (
                        <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                          <Calendar className="w-3 h-3" /> Scheduled: {new Date(lead.installationSchedule).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
             )}
           </div>
        </div>

        {/* Completed Jobs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xs">
           <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
             <ThumbsUp className="w-4 h-4 text-emerald-500" /> Completed Installations ({completedLeads.length})
           </h3>
           <div className="space-y-3">
             {completedLeads.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">No completed installations yet.</p>
             ) : (
                completedLeads.map(lead => (
                  <div key={lead.id} className="p-3.5 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20">
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-1">{lead.clientName}</h4>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{lead.requiredProduct || 'Ceiling Hangers'}</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {lead.actualInstallDate ? `Installed ${lead.actualInstallDate}` : 'Completed'}
                      </span>
                    </div>
                  </div>
                ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
