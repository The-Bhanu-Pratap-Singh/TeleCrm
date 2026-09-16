import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

// 1. Add map import
if (!code.includes('import LeadMap')) {
    code = code.replace(
      "import Papa from 'papaparse';",
      "import Papa from 'papaparse';\nimport LeadMap from './LeadMap.tsx';"
    );
}

// 2. Add Map view mode toggle
const toggleRe = /<button \s*onClick=\{\(\) => setViewMode\('kanban'\)\}\s*className=\{`flex-1 sm:flex-none px-3 py-1\.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1\.5 transition-colors \$\{viewMode === 'kanban' \? 'bg-indigo-50 dark:bg-indigo-950\/70 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'\}\`\}\s*>\s*<LayoutGrid className="w-4 h-4" \/> Kanban\s*<\/button>/g;

const newToggle = `<button 
              onClick={() => setViewMode('kanban')}
              className={\`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors \${viewMode === 'kanban' ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}\`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={\`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors \${viewMode === 'map' ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}\`}
            >
              <MapPin className="w-4 h-4" /> Map
            </button>`;

code = code.replace(toggleRe, newToggle);

// Also we need MapPin from lucide-react in LeadsList
code = code.replace(
  "import { Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, CalendarClock, LayoutGrid, List as ListIcon, CheckCircle2, FileText, Flame, Upload, ChevronDown, ChevronUp, Save, Printer } from 'lucide-react';",
  "import { Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, CalendarClock, LayoutGrid, List as ListIcon, CheckCircle2, FileText, Flame, Upload, ChevronDown, ChevronUp, Save, Printer, MapPin } from 'lucide-react';"
);

// We need to change viewMode definition:
code = code.replace(
  "const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');",
  "const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'map'>('table');"
);

// Render the Map
const renderRe = /\{viewMode === 'kanban' \? \(\s*<div className="no-print">\s*<KanbanBoard/g;
const newRender = `{viewMode === 'map' ? (
            <div className="no-print mt-6">
              <LeadMap leads={filteredLeads} />
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="no-print">
              <KanbanBoard`;

code = code.replace(renderRe, newRender);

fs.writeFileSync('src/components/LeadsList.tsx', code);
