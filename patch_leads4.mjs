import fs from 'fs';

let content = fs.readFileSync('src/components/LeadsList.tsx', 'utf8');

// I need to fix the div structure. Let's just do a clean replacement of the whole header section.
const regex = /<div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">[\s\S]*?{!isTechnician && \([\s\S]*?<\/button>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/div>/m;
const replacement = `<div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
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
        
        <div className="flex flex-wrap gap-4 w-full md:w-auto justify-end">
          <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
             <input 
               type="text" 
               placeholder="Search clients..." 
               className="pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
          <select 
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="All">All Statuses</option>
            {stages.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          {(user.role === 'Admin') && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          {!isTechnician && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Lead
            </button>
          )}
        </div>
      </div>`;

content = content.replace(regex, replacement);

// Remove that rogue </div> around line 306. 
// Wait, the rogue </div> is right after `)}` (the end of the viewMode ternary).
content = content.replace(
  '</table>\n        </div>\n      )}\n      </div>',
  '</table>\n        </div>\n      )}'
);

fs.writeFileSync('src/components/LeadsList.tsx', content);
