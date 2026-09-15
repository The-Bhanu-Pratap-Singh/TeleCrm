import fs from 'fs';

let content = fs.readFileSync('src/components/LeadsList.tsx', 'utf8');

// 1. Add imports
content = content.replace(
  "import { Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, CalendarClock } from 'lucide-react';",
  "import { Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, CalendarClock, LayoutGrid, List as ListIcon } from 'lucide-react';\nimport KanbanBoard from './KanbanBoard.tsx';\nimport type { PipelineStage } from '../types.ts';"
);

// 2. Add state for viewMode and stages
content = content.replace(
  "const [searchTerm, setSearchTerm] = useState('');",
  "const [searchTerm, setSearchTerm] = useState('');\n  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');\n  const [stages, setStages] = useState<PipelineStage[]>([]);"
);

// 3. Fetch stages
content = content.replace(
  "fetchUsers();\n  }, [token]);",
  "fetchUsers();\n    fetchStages();\n  }, [token]);\n\n  const fetchStages = () => {\n    fetch('/api/stages', {\n      headers: { 'Authorization': `Bearer ${token}` }\n    })\n    .then(r => r.json())\n    .then(data => { if (Array.isArray(data)) setStages(data); })\n    .catch(console.error);\n  };"
);

// 4. Update the quick update status method (for kanban drag and drop)
content = content.replace(
  "const fetchLeads = () => {",
  `const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    
    try {
      const res = await fetch(\`/api/leads/\${leadId}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ ...lead, status: newStatus })
      });
      if (res.ok) {
        fetchLeads();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update lead status');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update lead status');
    }
  };

  const fetchLeads = () => {`
);

// 5. Add toggle to UI
const searchBarArea = `<div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">`;

const replaceSearchBarArea = `<div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-zinc-200 shadow-sm">
          <button 
            onClick={() => setViewMode('table')}
            className={\`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors \${viewMode === 'table' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-500 hover:text-zinc-900'}\`}
          >
            <ListIcon className="w-4 h-4" /> Table
          </button>
          <button 
            onClick={() => setViewMode('kanban')}
            className={\`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors \${viewMode === 'kanban' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-500 hover:text-zinc-900'}\`}
          >
            <LayoutGrid className="w-4 h-4" /> Kanban
          </button>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
        <div className="flex-1 md:w-64 relative">`;

content = content.replace(searchBarArea, replaceSearchBarArea);
// Fix the closing div for the new structure
content = content.replace(
  `</select>
        </div>
      </div>`,
  `</select>
        </div>
        </div>
      </div>`
);


// 6. Replace the table rendering with conditional rendering
const tableStartRegex = /<div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">/g;

// Since it's hard to use regex for the whole table block, I'll split it.
content = content.replace(
  '<div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">',
  `{viewMode === 'kanban' ? (
        <KanbanBoard 
          leads={filteredLeads} 
          stages={stages} 
          user={user} 
          onUpdateLeadStatus={handleUpdateLeadStatus} 
          onEditLead={(lead) => { setEditingLead(lead); setIsModalOpen(true); }} 
        />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">`
);

content = content.replace(
  '</table>\n        </div>',
  '</table>\n        </div>\n      )}'
);

// 7. Update dynamic options in edit/create lead modal
content = content.replace(
  `<option value="New">New</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="Visiting">Visiting</option>
                        <option value="Scheduled">Scheduled (Install)</option>
                        <option value="Installed">Installed</option>
                        <option value="Closed">Closed</option>`,
  `{stages.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}`
);

fs.writeFileSync('src/components/LeadsList.tsx', content);
