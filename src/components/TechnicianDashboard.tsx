import { syncLeadToGoogleCalendar } from '../lib/googleAuth.ts';
import React, { useEffect, useState, useMemo } from 'react';
import type { User, Lead } from '../types.ts';
import { ThumbsUp, ThumbsDown, AlertCircle, Calendar, MapPin, PhoneCall, CheckCircle } from 'lucide-react';

interface TechProps {
  user: User;
  token: string;
}

export default function TechnicianDashboard({ user, token }: TechProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/leads', {
        headers: { 'Authorization': `Bearer \${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setLeads(data);
      })
      .catch(console.error);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto-refresh polling
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
      const res = await fetch(`/api/leads/\${leadId}/\${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer \${token}` }
      });
      if (res.ok) {
        const leadsRes = await fetch('/api/leads', { headers: { 'Authorization': `Bearer \${token}` }});
        const data = await leadsRes.json();
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Technician Hub</h2>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage your pending assignments and active jobs.</p>
      </div>

      {pendingLeads.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-semibold mb-4 text-sm sm:text-base animate-pulse">
            <AlertCircle className="w-5 h-5" /> Pending Assignments ({pendingLeads.length})
          </div>
          <div className="space-y-4">
            {pendingLeads.map(lead => (
              <div key={lead.id} className="bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/40 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
                <div className="flex-1">
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">{lead.clientName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{lead.address || 'No address provided'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{lead.visitSchedule || lead.installationSchedule || 'ASAP'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={() => handleTechAction(lead.id, 'decline-tech')}
                    disabled={actionLoading === lead.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Decline
                  </button>
                  <button 
                    onClick={() => handleTechAction(lead.id, 'accept-tech')}
                    disabled={actionLoading === lead.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Accept Job
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Active Jobs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-2xs">
           <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
             <CheckCircle className="w-4 h-4 text-indigo-500" /> Active Jobs ({acceptedLeads.length})
           </h3>
           <div className="space-y-3">
             {acceptedLeads.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No active jobs.</p>
             ) : (
                acceptedLeads.map(lead => (
                  <div key={lead.id} className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/30">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">{lead.clientName}</h4>
                    <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {lead.address}</span>
                      <span className="flex items-center gap-1.5"><PhoneCall className="w-3 h-3" /> {lead.contact}</span>
                    </div>
                  </div>
                ))
             )}
           </div>
        </div>

        {/* Completed Jobs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-2xs">
           <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
             <ThumbsUp className="w-4 h-4 text-emerald-500" /> Completed Jobs ({completedLeads.length})
           </h3>
           <div className="space-y-3">
             {completedLeads.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No completed jobs yet.</p>
             ) : (
                completedLeads.map(lead => (
                  <div key={lead.id} className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">{lead.clientName}</h4>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{lead.actualInstallDate ? `Completed on \${lead.actualInstallDate}` : 'Installed'}</span>
                  </div>
                ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
