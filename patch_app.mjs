import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Add CalendarAppView import
if (!code.includes('CalendarAppView')) {
  code = code.replace(
    "import AdminPanel from './components/AdminPanel.tsx';",
    "import AdminPanel from './components/AdminPanel.tsx';\nimport CalendarAppView from './components/CalendarAppView.tsx';"
  );
  code = code.replace(
    "import { LayoutDashboard, Users, ClipboardList, LogOut, Loader2, Menu, X, Plus, Activity } from 'lucide-react';",
    "import { LayoutDashboard, Users, ClipboardList, LogOut, Loader2, Menu, X, Plus, Activity, Calendar } from 'lucide-react';"
  );
}

// Update currentView type
code = code.replace(
  "useState<'dashboard' | 'leads' | 'users' | 'activity'>",
  "useState<'dashboard' | 'leads' | 'users' | 'activity' | 'calendar'>"
);

// Add Sidebar Nav item
if (!code.includes("handleNavigate('calendar')")) {
  const sidebarItem = `
          <button 
            onClick={() => handleNavigate('calendar')}
            className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
              currentView === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-900 hover:text-white'
            }\`}
          >
            <Calendar className="w-5 h-5 flex-shrink-0" />
            <span>Calendar</span>
          </button>
`;
  code = code.replace(
    /(<button[^>]+onClick=\{\(\) => handleNavigate\('leads'\)\}[^>]+>[\s\S]+?<\/button>)/,
    `$1\n${sidebarItem}`
  );
}

// Add Mobile Nav item
if (!code.includes("handleNavigate('calendar')") || true) { // Just in case it's missed
  const mobileItem = `
          <button
            onClick={() => handleNavigate('calendar')}
            className={\`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors \${
              currentView === 'calendar' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
            }\`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span>Calendar</span>
          </button>
`;
  code = code.replace(
    /(<button[^>]+onClick=\{\(\) => handleNavigate\('leads'\)\}[^>]+className=\{`flex flex-col[\s\S]+?<\/button>)/,
    `$1\n${mobileItem}`
  );
}

// Add Main View Router
if (!code.includes("<CalendarAppView")) {
  code = code.replace(
    /\{currentView === 'activity' && user\.role === 'Admin' && <ActivityLogViewer \/>\}/,
    `{currentView === 'activity' && user.role === 'Admin' && <ActivityLogViewer />}\n            {currentView === 'calendar' && <CalendarAppView user={user} token={token} />}`
  );
}

fs.writeFileSync('src/App.tsx', code);
