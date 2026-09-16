import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

// 1. Add Download icon import
code = code.replace(
  "import { UserPlus, ShieldAlert, Trash2 } from 'lucide-react';",
  "import { UserPlus, ShieldAlert, Trash2, Download } from 'lucide-react';"
);

// 2. Add handleDownloadBackup function
const funcToInsert = `  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/leads/export-json', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (!res.ok) throw new Error('Failed to download backup');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`leads-backup-\${new Date().toISOString().split('T')[0]}.json\`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message);
    }
  };
`;

code = code.replace(
  "const handleCreateUser = async (e: React.FormEvent) => {",
  funcToInsert + "\n  const handleCreateUser = async (e: React.FormEvent) => {"
);

// 3. Add button in the header
const oldHeader = `      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Admin Panel</h2>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage users, roles, and pipeline stages.</p>
      </div>`;

const newHeader = `      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Admin Panel</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage users, roles, and pipeline stages.</p>
        </div>
        <button 
          onClick={handleDownloadBackup}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          <Download className="w-4 h-4" /> Download JSON Backup
        </button>
      </div>`;

code = code.replace(oldHeader, newHeader);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
