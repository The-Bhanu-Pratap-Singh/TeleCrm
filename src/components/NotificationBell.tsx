import React, { useState, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import type { User } from '../types.ts';

interface Notification {
  id: number;
  title: string;
  message: string;
  read: number;
  createdAt: string;
}

export default function NotificationBell({ user, socket, token }: { user: User, socket: any, token: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewNotif = (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    };
    
    socket.on('new_notification', handleNewNotif);
    return () => socket.off('new_notification', handleNewNotif);
  }, [socket]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      setNotifications([]);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-zinc-900"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Notifications</h3>
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  No new notifications
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {notifications.map(n => (
                    <div key={n.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-0.5">{n.title}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-zinc-400 mt-2">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
