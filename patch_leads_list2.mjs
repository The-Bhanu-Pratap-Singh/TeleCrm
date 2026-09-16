import fs from 'fs';

let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

// 1. Add Printer to lucide imports
code = code.replace(
  "ChevronUp, Save } from 'lucide-react';",
  "ChevronUp, Save, Printer } from 'lucide-react';"
);

// 2. Add priority colors and helper
const priorityHelper = `
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'High': return 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400';
      case 'Low': return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400';
      default: return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
    }
  };
`;
// Insert it inside LeadsList
code = code.replace(
  "const handleSelectAll",
  priorityHelper + "\n  const handleSelectAll"
);

// 3. Summary Cards
const summaryCards = `
      {/* Summary Cards */}
      <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {['New', 'Follow Up', 'Qualified', 'Closed'].map(status => {
          const count = leads.filter(l => l.status === status).length;
          return (
            <div key={status} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-colors">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{status} Leads</span>
              <span className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{count}</span>
            </div>
          );
        })}
      </div>
`;
code = code.replace(
  '<div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">',
  summaryCards + '\n      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">'
);

// 4. Print Button
const printButton = `
            <button
              onClick={() => window.print()}
              className="no-print flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
`;
code = code.replace(
  '{!isTechnician && (\n              <button\n                onClick={() => openModal()}\n                className="hidden md:flex flex-1',
  printButton + '{!isTechnician && (\n              <button\n                onClick={() => openModal()}\n                className="hidden md:flex flex-1'
);

// 5. Row Priority Indicator
const trRe = /<tr className=\{\`hover:bg-zinc-50 dark:hover:bg-zinc-800\/50 text-sm transition-colors \$\{expandedNotesId === lead\.id \? 'bg-zinc-50 dark:bg-zinc-800\/30 border-l-2 border-indigo-500' : ''\}\`\}>/g;
const newTr = `<tr className={\`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm transition-colors border-l-4 \${getPriorityColor(lead.priority).split(' ')[0]} \${expandedNotesId === lead.id ? 'bg-zinc-50 dark:bg-zinc-800/30 border-indigo-500' : ''}\`}>`;
code = code.replace(trRe, newTr);

// Priority badge inside Client Info column
const clientInfoRe = /<div className="font-semibold text-zinc-900 dark:text-zinc-100">\{lead\.clientName\}<\/div>/g;
const newClientInfo = `<div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {lead.clientName}
                          <span className={\`no-print px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider \${getPriorityColor(lead.priority)}\`}>
                            {lead.priority || 'Medium'}
                          </span>
                        </div>`;
code = code.replace(clientInfoRe, newClientInfo);

// 6. Priority Input in Edit Modal
const statusInputRe = /<div>\s*<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1\.5 uppercase tracking-wider">Status<\/label>/g;
const priorityInput = `
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">Priority</label>
                  <select
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    value={editingLead.priority || 'Medium'}
                    onChange={e => setEditingLead({ ...editingLead, priority: e.target.value })}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
`;
code = code.replace(statusInputRe, priorityInput + '\n                <div>\n                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">Status</label>');

fs.writeFileSync('src/components/LeadsList.tsx', code);
