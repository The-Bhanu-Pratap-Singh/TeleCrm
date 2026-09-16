import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Update currentView type for real if the previous regex failed
code = code.replace(
  "const [currentView, setCurrentView] = useState<'dashboard' | 'leads' | 'users' | 'activity'>('dashboard');",
  "const [currentView, setCurrentView] = useState<'dashboard' | 'leads' | 'users' | 'activity' | 'calendar'>('dashboard');"
);

// Look for handleNavigate
code = code.replace(
  "const handleNavigate = (view: 'dashboard' | 'leads' | 'users' | 'activity') => {",
  "const handleNavigate = (view: 'dashboard' | 'leads' | 'users' | 'activity' | 'calendar') => {"
);

fs.writeFileSync('src/App.tsx', code);
