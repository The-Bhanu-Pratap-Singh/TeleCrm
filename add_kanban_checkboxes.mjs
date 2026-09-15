import fs from 'fs';

// 1. Update KanbanBoard.tsx
let kanban = fs.readFileSync('src/components/KanbanBoard.tsx', 'utf-8');

kanban = kanban.replace(
  'onEditLead: (lead: Lead) => void;',
  'onEditLead: (lead: Lead) => void;\n  selectedLeadIds: number[];\n  onToggleSelect: (leadId: number, selected: boolean) => void;'
);

kanban = kanban.replace(
  'onEditLead }: KanbanBoardProps)',
  'onEditLead, selectedLeadIds, onToggleSelect }: KanbanBoardProps)'
);

// We need to add the checkbox.
const checkboxJSX = `
<div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
  {user.role !== 'Technician' && (
    <input 
      type="checkbox"
      checked={selectedLeadIds.includes(lead.id)}
      onChange={(e) => onToggleSelect(lead.id, e.target.checked)}
      className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
    />
  )}
</div>
`;

kanban = kanban.replace(
  /className={\`bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg shadow-xs border transition-colors(.*?)`}/s,
  (match, p1) => {
    return 'className={`relative bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg shadow-xs border transition-colors' + p1 + '`}';
  }
);

kanban = kanban.replace(
  '<div className="flex justify-between items-start mb-1.5 gap-2">',
  checkboxJSX + '\n                              <div className="flex justify-between items-start mb-1.5 gap-2 pr-6">'
);

fs.writeFileSync('src/components/KanbanBoard.tsx', kanban);


// 2. Update LeadsList.tsx to pass those props
let list = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');
list = list.replace(
  'onEditLead={openModal}',
  'onEditLead={openModal}\n          selectedLeadIds={selectedLeadIds}\n          onToggleSelect={handleSelectLead}'
);

fs.writeFileSync('src/components/LeadsList.tsx', list);
