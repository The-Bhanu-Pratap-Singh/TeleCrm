/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, ClipboardList, LogOut, Loader2, Menu, X, Plus, Activity, Calendar } from 'lucide-react';
import Login from './components/Login.tsx';
import Dashboard from './components/Dashboard.tsx';
import TechnicianDashboard from './components/TechnicianDashboard.tsx';
import LeadsList from './components/LeadsList.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import CalendarAppView from './components/CalendarAppView.tsx';
import ActivityLogViewer from './components/ActivityLogViewer.tsx';
import ThemeToggle from './components/ThemeToggle.tsx';
import { io, Socket } from 'socket.io-client';
import ChatWidget from './components/ChatWidget.tsx';
import NotificationBell from './components/NotificationBell.tsx';
import type { User } from './types.ts';

export default function App() {
  const [token, setToken] = useState<string | null>(''); // Kept state to prevent prop errors, but unused for auth
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'leads' | 'users' | 'activity' | 'calendar'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionExp, setSessionExp] = useState<number | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);


  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          if (userData.exp) setSessionExp(userData.exp);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Session verification failed', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verifySession();
  }, []);


  useEffect(() => {
    if (!user) return;
    const newSocket = io({
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, [user]);

  const handleLogin = (newToken: string, newUser: User) => {
    setUser(newUser);
    // Note: token is handled via HttpOnly cookie now.
  };



  useEffect(() => {
    if (!sessionExp) return;
    const interval = setInterval(() => {
      const timeLeft = (sessionExp * 1000) - Date.now();
      if (timeLeft <= 2 * 60 * 1000 && timeLeft > 0 && !showSessionWarning) {
        setShowSessionWarning(true);
      } else if (timeLeft <= 0) {
        handleLogout();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionExp, showSessionWarning]);

  const handleExtendSession = async () => {
    try {
      const res = await fetch('/api/users/refresh', { method: 'POST' });
      if (res.ok) {
        // re-verify to get new exp
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const userData = await meRes.json();
          setUser(userData);
          if (userData.exp) setSessionExp(userData.exp);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setShowSessionWarning(false);
  };

  useEffect(() => {
    const handleAuthError = () => {
      handleLogout();
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setIsMobileMenuOpen(false);
  };

  const handleNavigate = (view: 'dashboard' | 'leads' | 'users' | 'activity' | 'calendar') => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const handleAddLeadGlobal = () => {
    if (currentView !== 'leads') {
      setCurrentView('leads');
    }
    // Give it a tiny tick to mount LeadsList if it wasn't mounted
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-add-lead-modal'));
    }, 50);
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors duration-200">
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-900 dark:bg-zinc-950 text-white z-40 flex items-center justify-between px-4 border-b border-zinc-800 dark:border-zinc-850 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -ml-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 dark:hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">Hanger Hub</h1>
            <p className="text-[11px] text-zinc-400 font-medium">TeleCRM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {user && socket && <NotificationBell user={user} socket={socket} token={token} />}
        </div>
        
        <div className="flex items-center gap-1.5">
          <ThemeToggle variant="icon" />
          <div className="text-right ml-1">
            <p className="text-xs font-semibold text-white truncate max-w-[100px]">{user.username}</p>
            <p className="text-[10px] text-indigo-400 font-medium">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop Persistent + Mobile Slide-over Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 flex flex-col border-r border-zinc-800/60 dark:border-zinc-850 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-zinc-800 dark:border-zinc-850 md:border-none">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Hanger Hub</h1>
            <p className="text-xs md:text-sm text-zinc-400 mt-0.5">TeleCRM System</p>
          </div>

          <div className="flex items-center gap-2">
            {user && socket && <NotificationBell user={user} socket={socket} />}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 md:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 mt-4 overflow-y-auto">
          <button 
            onClick={() => handleNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            <span>Dashboard</span>
          </button>
          
          <button 
            onClick={() => handleNavigate('leads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'leads' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <ClipboardList className="w-5 h-5 flex-shrink-0" />
            <span>Leads Pipeline</span>
          </button>

          <button 
            onClick={() => handleNavigate('calendar')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              currentView === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <Calendar className="w-5 h-5 flex-shrink-0" />
            <span>Calendar</span>
          </button>


          {user.role === 'Admin' && (
            <>
              <button 
                onClick={() => handleNavigate('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  currentView === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span>Admin & Users</span>
              </button>
              <button 
                onClick={() => handleNavigate('activity')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  currentView === 'activity' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Activity className="w-5 h-5 flex-shrink-0" />
                <span>Security & Audit Log</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-800 dark:border-zinc-850 bg-zinc-950/40 dark:bg-zinc-950/80">
          {/* Global Theme Toggle in Sidebar */}
          <div className="mb-3">
            <ThemeToggle variant="sidebar" />
          </div>

          <div className="mb-3 px-3 py-2 bg-zinc-800/60 dark:bg-zinc-900/70 rounded-lg border border-zinc-700/40 dark:border-zinc-800/80">
            <p className="text-sm font-semibold text-white truncate">{user.username}</p>
            <span className="inline-block text-[11px] font-medium text-indigo-400 mt-0.5">{user.role}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 dark:hover:bg-zinc-900 transition-colors border border-zinc-800/80 dark:border-zinc-800"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden pt-16 md:pt-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto w-full">
            {currentView === 'dashboard' && user.role !== 'Technician' && <Dashboard user={user} token={token} onNavigate={setCurrentView} />}
            {currentView === 'dashboard' && user.role === 'Technician' && <TechnicianDashboard user={user} token={token} />}
            {currentView === 'leads' && <LeadsList user={user} token={token} />}
            {currentView === 'users' && user.role === 'Admin' && <AdminPanel token={token} />}
            {currentView === 'activity' && user.role === 'Admin' && <ActivityLogViewer token={token} />}
            {currentView === 'calendar' && <CalendarAppView user={user} token={token} />}
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar for quick 1-tap switching */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 dark:border-zinc-850 z-30 flex items-center justify-around px-2 py-1.5 shadow-lg safe-area-inset-bottom">
          <button
            onClick={() => handleNavigate('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'dashboard' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => handleNavigate('leads')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'leads' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ClipboardList className="w-5 h-5 mb-0.5" />
            <span>Leads</span>
          </button>

          <button
            onClick={() => handleNavigate('calendar')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'calendar' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span>Calendar</span>
          </button>


          {user.role === 'Admin' && (
            <>
              <button
                onClick={() => handleNavigate('users')}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
                  currentView === 'users' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Users className="w-5 h-5 mb-0.5" />
                <span>Admin</span>
              </button>
              <button
                onClick={() => handleNavigate('activity')}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
                  currentView === 'activity' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Activity className="w-5 h-5 mb-0.5" />
                <span>Audit Log</span>
              </button>
            </>
          )}
        </nav>
        
        {/* Global Floating Action Button for Mobile */}
        {user.role !== 'Technician' && (
          <button
            onClick={handleAddLeadGlobal}
            className="md:hidden fixed bottom-20 right-4 z-40 flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
            aria-label="Add New Lead"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </main>


        {/* Session Warning Modal */}
        {user && socket && <ChatWidget user={user} socket={socket} token={token} />}

      {showSessionWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Session Expiring Soon</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Your secure session will expire in less than 2 minutes. Would you like to stay logged in?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                Logout Now
              </button>
              <button onClick={handleExtendSession} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
