import fs from 'fs';
const file = 'src/components/LeadsList.tsx';
let code = fs.readFileSync(file, 'utf-8');

// 1. Add sort dropdown
const sortDropdown = `
          {/* Sort By */}
          <select 
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="priority">Sort by Priority (Hotness)</option>
            <option value="followUp">Sort by Next Follow-up</option>
            <option value="recent">Sort by Most Recent</option>
          </select>
`;

code = code.replace('{/* Assignee Filter (Admins/Managers) */}', sortDropdown + '\n          {/* Assignee Filter (Admins/Managers) */}');

// 2. Add Fire Icon to imports
code = code.replace('FileText } from \'lucide-react\';', 'FileText, Flame, Upload } from \'lucide-react\';');
code = code.replace('import type { PipelineStage } from \'../types.ts\';', 'import type { PipelineStage } from \'../types.ts\';\nimport Papa from \'papaparse\';');

// 3. Add Import Button
const importBtn = `
            {!isTechnician && (
              <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer">
                <Upload className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="hidden sm:inline">Import</span> CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
              </label>
            )}
`;
code = code.replace('<Download className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />', '<Download className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />');
code = code.replace('</button>\n            {!isTechnician && (', '</button>\n' + importBtn + '\n            {!isTechnician && (');

// 4. Add CSV Import Logic function
const importLogic = `
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/leads/bulk-import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${token}\`
            },
            body: JSON.stringify({ leads: results.data })
          });
          if (res.ok) {
            alert('Leads imported successfully');
            fetchLeads();
          } else {
            alert('Failed to import leads');
          }
        } catch (err) {
          console.error(err);
          alert('Error importing leads');
        }
      }
    });
    // Reset file input
    e.target.value = '';
  };
`;
code = code.replace('const handleExportCSV = () => {', importLogic + '\n  const handleExportCSV = () => {');

// 5. Add Score Display in Table View
const scoreDisplayTable = `
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 mb-1">
                          {calculateHotness(lead) >= 50 ? <Flame className="w-4 h-4 text-rose-500" /> : calculateHotness(lead) >= 30 ? <Flame className="w-4 h-4 text-orange-400" /> : <Flame className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />}
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{calculateHotness(lead)}</span>
                        </div>
                        <span className={\`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap \${
                          lead.status === 'New' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          lead.status === 'Contacted' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          lead.status === 'Interested' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          lead.status === 'Scheduled' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          lead.status === 'Installed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }\`}>
                          {lead.status}
                        </span>
                      </td>
`;
// Target exact block in Table to replace
const targetTableStatus = `                      <td className="px-5 py-3.5">
                        <span className={\`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap \${
                          lead.status === 'New' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          lead.status === 'Contacted' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          lead.status === 'Interested' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          lead.status === 'Scheduled' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          lead.status === 'Installed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }\`}>
                          {lead.status}
                        </span>
                      </td>`;
if(code.includes(targetTableStatus)) {
    code = code.replace(targetTableStatus, scoreDisplayTable);
} else {
    console.log("Could not find table status block");
}

fs.writeFileSync(file, code);
console.log('Patched UI logic');
