import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Add Warning Modal state
const stateInsert = `
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionExp, setSessionExp] = useState<number | null>(null);
`;
code = code.replace("  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);", "  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n" + stateInsert);

// Modify verifySession to setSessionExp
const verifyOld = "setUser(userData);";
const verifyNew = "setUser(userData);\n          if (userData.exp) setSessionExp(userData.exp);";
code = code.replace(verifyOld, verifyNew);

// Add session checker useEffect
const sessionChecker = `
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
`;
code = code.replace("  useEffect(() => {\n    const handleAuthError", sessionChecker + "\n  useEffect(() => {\n    const handleAuthError");

// Add Modal UI at the end inside <main> or root div
const modalUI = `
      {/* Session Warning Modal */}
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
`;
code = code.replace("    </div>\n  );\n}", modalUI + "\n    </div>\n  );\n}");

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx with session warning');
