import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

code = code.replace(
  "import { UserPlus, ShieldAlert, Trash2, Download } from 'lucide-react';",
  "import { UserPlus, ShieldAlert, Trash2, Download, Database, Upload, RefreshCw, HardDriveDownload } from 'lucide-react';\nimport { get, set } from 'idb-keyval';"
);

// Add state variables
code = code.replace(
  "const [error, setError] = useState('');",
  `const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dbHash, setDbHash] = useState('');
  const [dbCount, setDbCount] = useState(0);
  const [lastKnownHash, setLastKnownHash] = useState('');
  const [lastAutoBackupDate, setLastAutoBackupDate] = useState<Date | null>(null);
  const [isImporting, setIsImporting] = useState(false);`
);

// Add useEffect and handler logic
const logicToInsert = `
  useEffect(() => {
    checkDbStatus();
    checkAutoBackup();
    const interval = setInterval(checkDbStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/leads/status-hash', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setDbHash(data.hash);
      setDbCount(data.count);
      
      const savedHash = localStorage.getItem('lastDbHash');
      if (savedHash && savedHash !== data.hash) {
        const [savedCount] = savedHash.split('-').map(Number);
        if (data.count < savedCount) {
          setError(\`Warning: Database record count dropped from \${savedCount} to \${data.count}. Data might be missing.\`);
        }
      }
      localStorage.setItem('lastDbHash', data.hash);
      setLastKnownHash(savedHash || data.hash);
    } catch (e) {
      console.error(e);
    }
  };

  const checkAutoBackup = async () => {
    try {
      const lastBackupStr = localStorage.getItem('lastAutoBackup');
      const lastBackup = lastBackupStr ? new Date(lastBackupStr) : null;
      setLastAutoBackupDate(lastBackup);

      // Perform auto backup if none exists or it's older than 24 hours
      if (!lastBackup || (Date.now() - lastBackup.getTime() > 24 * 60 * 60 * 1000)) {
        await performAutoBackup();
      }
    } catch(e) {
      console.error(e);
    }
  };

  const performAutoBackup = async () => {
    try {
      const res = await fetch('/api/leads/export-json', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (!res.ok) return;
      const data = await res.json();
      await set('auto-leads-backup', data);
      
      const now = new Date();
      localStorage.setItem('lastAutoBackup', now.toISOString());
      setLastAutoBackupDate(now);
      setSuccess('Automated JSON backup saved to local storage.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error('Auto backup failed', e);
    }
  };

  const handleDownloadAutoBackup = async () => {
    try {
      const data = await get('auto-leads-backup');
      if (!data) {
        setError('No auto-backup found in local storage.');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`leads-auto-backup-\${new Date().toISOString().split('T')[0]}.json\`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const leads = JSON.parse(jsonStr);
        
        const res = await fetch('/api/leads/import-json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify(leads)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to import JSON');
        
        setSuccess(\`Successfully restored \${data.count} missing leads!\`);
        checkDbStatus();
        setTimeout(() => setSuccess(''), 5000);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };
`;

code = code.replace("  const handleDownloadBackup = async () => {", logicToInsert + "\n  const handleDownloadBackup = async () => {");

// We need to remove the old success state declaration if it was there
code = code.replace("const [success, setSuccess] = useState('');\n  const [success, setSuccess] = useState('');", "const [success, setSuccess] = useState('');");


// Update UI to add status widget and import button
const backupButtonsHtml = `        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> 
            {isImporting ? 'Importing...' : 'Restore JSON'}
            <input type="file" accept=".json" className="hidden" onChange={handleImportJson} disabled={isImporting} />
          </label>
          <button 
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Export JSON
          </button>
        </div>`;

code = code.replace(
  /<button\s+onClick=\{handleDownloadBackup\}[^>]*>\s*<Download[^>]*\/>[^<]*<\/button>/,
  backupButtonsHtml
);


const statusWidgetHtml = `
      {/* Database Status Widget */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={\`p-2 rounded-full \${dbHash === lastKnownHash ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}\`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Database Integrity Status</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Leads: <span className="font-medium text-zinc-700 dark:text-zinc-300">{dbCount}</span> | Last Check: Just now</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {lastAutoBackupDate ? (
              <span>Last auto-backup: <span className="font-medium text-zinc-700 dark:text-zinc-300">{lastAutoBackupDate.toLocaleString()}</span></span>
            ) : (
              <span>No auto-backup yet</span>
            )}
          </div>
          
          <button 
            onClick={handleDownloadAutoBackup}
            disabled={!lastAutoBackupDate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HardDriveDownload className="w-3.5 h-3.5" /> Retrieve Cache
          </button>
        </div>
      </div>
`;

code = code.replace(
  "{error && <div className=\"text-xs sm:text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/50\">{error}</div>}",
  statusWidgetHtml + "\n      {error && <div className=\"text-xs sm:text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/50\">{error}</div>}"
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
