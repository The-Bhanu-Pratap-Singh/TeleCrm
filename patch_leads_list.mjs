import fs from 'fs';

let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

// 1. Add lucide imports
code = code.replace(
  "import { Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, CalendarClock, LayoutGrid, List as ListIcon, CheckCircle2, FileText, Flame, Upload } from 'lucide-react';",
  "import { Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, CalendarClock, LayoutGrid, List as ListIcon, CheckCircle2, FileText, Flame, Upload, ChevronDown, ChevronUp, Save } from 'lucide-react';"
);

// 2. Add state for expandable notes
const expandedNotesState = `  const [expandedNotesId, setExpandedNotesId] = useState<number | null>(null);
  const [expandedNoteText, setExpandedNoteText] = useState('');
  const [isSavingExpandedNote, setIsSavingExpandedNote] = useState(false);
  
  const toggleExpandedNote = (lead: Lead) => {
    if (expandedNotesId === lead.id) {
      setExpandedNotesId(null);
    } else {
      setExpandedNotesId(lead.id);
      setExpandedNoteText(lead.notes || '');
    }
  };
  
  const saveExpandedNote = async (leadId: number) => {
    setIsSavingExpandedNote(true);
    try {
      const res = await fetch(\`/api/leads/\${leadId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: expandedNoteText })
      });
      if (res.ok) {
        setLeads(leads.map(l => l.id === leadId ? { ...l, notes: expandedNoteText } : l));
        setExpandedNotesId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingExpandedNote(false);
    }
  };
`;
code = code.replace(
  "  const [noteLoading, setNoteLoading] = useState(false);",
  "  const [noteLoading, setNoteLoading] = useState(false);\n" + expandedNotesState
);

// 3. Add toggle button to the actions column
const quickNoteButtonRe = /<button\s*onClick=\{\(\) => \{\s*setNoteLeadId\(lead\.id\);\s*setIsNoteModalOpen\(true\);\s*setNoteText\(''\);\s*\}\}\s*className="text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-1\.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors mr-1"\s*title="Quick Note"\s*>\s*<FileText className="w-4 h-4" \/>\s*<\/button>/g;

const toggleNoteButton = `<button
                          onClick={() => toggleExpandedNote(lead)}
                          className={\`text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors mr-1 \${expandedNotesId === lead.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}\`}
                          title="Expand Notes"
                        >
                          {expandedNotesId === lead.id ? <ChevronUp className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </button>`;
code = code.replace(quickNoteButtonRe, toggleNoteButton);

// 4. Add the expanded row
const expandedRow = `
                  {sortedLeads.map(lead => (
                    <React.Fragment key={lead.id}>
                    <tr className={\`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm transition-colors \${expandedNotesId === lead.id ? 'bg-zinc-50 dark:bg-zinc-800/30 border-l-2 border-indigo-500' : ''}\`}>`;

const trRe = /\{sortedLeads\.map\(lead => \(\s*<tr key=\{lead\.id\} className="hover:bg-zinc-50 dark:hover:bg-zinc-800\/50 text-sm transition-colors">/g;
code = code.replace(trRe, expandedRow);

const endTr = `                    </tr>
                    {expandedNotesId === lead.id && (
                      <tr className="bg-zinc-50/50 dark:bg-zinc-800/30 border-l-2 border-indigo-500">
                        <td colSpan={user.role !== 'Technician' ? 6 : 5} className="px-5 py-4">
                          <div className="flex flex-col gap-2 max-w-3xl ml-auto mr-auto w-full">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Quick Notes</label>
                            <textarea
                              className="w-full h-24 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-shadow"
                              placeholder="Add notes for this lead..."
                              value={expandedNoteText}
                              onChange={e => setExpandedNoteText(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setExpandedNotesId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveExpandedNote(lead.id)}
                                disabled={isSavingExpandedNote}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                              >
                                {isSavingExpandedNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save Note
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}`;

const endTrRe = /<\/tr>\s*\)\)\}/g;
code = code.replace(endTrRe, endTr);

fs.writeFileSync('src/components/LeadsList.tsx', code);
console.log('Patched LeadsList.tsx');
