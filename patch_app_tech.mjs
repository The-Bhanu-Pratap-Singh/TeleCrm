import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  "import Dashboard from './components/Dashboard.tsx';",
  "import Dashboard from './components/Dashboard.tsx';\nimport TechnicianDashboard from './components/TechnicianDashboard.tsx';"
);

code = code.replace(
  "{currentView === 'dashboard' && <Dashboard user={user} token={token} onNavigate={setCurrentView} />}",
  "{currentView === 'dashboard' && user.role !== 'Technician' && <Dashboard user={user} token={token} onNavigate={setCurrentView} />}\n            {currentView === 'dashboard' && user.role === 'Technician' && <TechnicianDashboard user={user} token={token} />}"
);

fs.writeFileSync('src/App.tsx', code);
