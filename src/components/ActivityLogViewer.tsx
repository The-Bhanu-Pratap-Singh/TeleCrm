import { useEffect, useState } from 'react';
import { Activity, Clock, User, FileText, ChevronRight } from 'lucide-react';
import type { ActivityLog } from '../types.ts';

export default function ActivityLogViewer({ token }: { token: string }) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activity', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) setActivities(data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading activity history...</div>;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" /> Security & Audit Log
        </h3>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[70vh] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No activities recorded yet.</div>
        ) : (
          activities.map(activity => (
            <div key={activity.id} className="p-4 sm:p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors flex gap-4">
              <div className="mt-1">
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {activity.username} <span className="text-zinc-500 dark:text-zinc-400 font-normal">performed</span> {activity.action}
                  </p>
                  <p className="text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(activity.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                {activity.leadName && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 mt-1.5 mb-1 bg-zinc-100 dark:bg-zinc-800/50 w-fit px-2 py-1 rounded-md">
                    <User className="w-3.5 h-3.5" />
                    <span>Lead: <strong>{activity.leadName}</strong></span>
                  </div>
                )}
                {activity.details && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 bg-zinc-50 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                    {activity.details}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
