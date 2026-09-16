import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const searchFilterRe = /const matchesSearch = \n\s*lead\.clientName\.toLowerCase\(\)\.includes\(searchLower\) \|\|\n\s*lead\.contact\.toLowerCase\(\)\.includes\(searchLower\);/g;
if (code.match(searchFilterRe)) {
    code = code.replace(
      searchFilterRe,
      "const matchesSearch = \n      lead.clientName.toLowerCase().includes(searchLower) || \n      lead.contact.toLowerCase().includes(searchLower) ||\n      (lead.email || '').toLowerCase().includes(searchLower);"
    );
} else {
    code = code.replace(
      /const matchesSearch = \s*lead\.clientName\.toLowerCase\(\)\.includes\(searchLower\) \|\| \s*lead\.contact\.toLowerCase\(\)\.includes\(searchLower\);/g,
      "const matchesSearch = \n      lead.clientName.toLowerCase().includes(searchLower) || \n      lead.contact.toLowerCase().includes(searchLower) ||\n      (lead.email || '').toLowerCase().includes(searchLower);"
    );
}

const oldSaveLogic = `  const toggleExpandedNote = (lead: Lead) => {
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
  };`;

const newSaveLogic = `  const toggleExpandedNote = (lead: Lead) => {
    if (expandedNotesId === lead.id) {
      setExpandedNotesId(null);
    } else {
      setExpandedNotesId(lead.id);
      setExpandedNoteText(typeof lead.notes === 'string' ? lead.notes : JSON.stringify(lead.notes || []));
    }
  };

  const autoSaveTimerRef2 = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (expandedNotesId !== null && expandedNoteText !== undefined) {
      if (autoSaveTimerRef2.current) {
        clearTimeout(autoSaveTimerRef2.current);
      }
      autoSaveTimerRef2.current = setTimeout(async () => {
        setIsSavingExpandedNote(true);
        try {
          const res = await fetch(\`/api/leads/\${expandedNotesId}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: expandedNoteText })
          });
          if (res.ok) {
            setLeads(prev => prev.map(l => l.id === expandedNotesId ? { ...l, notes: expandedNoteText } : l));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsSavingExpandedNote(false);
        }
      }, 500);
    }
    return () => {
      if (autoSaveTimerRef2.current) clearTimeout(autoSaveTimerRef2.current);
    };
  }, [expandedNoteText, expandedNotesId]);
`;

code = code.replace(oldSaveLogic, newSaveLogic);

// Remove the Save button from the expanded view
const saveButtonRe = /<div className="flex justify-end gap-2">\s*<button\s*onClick=\{\(\) => setExpandedNotesId\(null\)\}\s*className="px-3 py-1\.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"\s*>\s*Cancel\s*<\/button>\s*<button\s*onClick=\{\(\) => saveExpandedNote\(lead\.id\)\}\s*disabled=\{isSavingExpandedNote\}\s*className="flex items-center gap-1\.5 px-3 py-1\.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"\s*>\s*\{isSavingExpandedNote \? <Loader2 className="w-3\.5 h-3\.5 animate-spin" \/> : <Save className="w-3\.5 h-3\.5" \/>\}\s*Save Note\s*<\/button>\s*<\/div>/g;

const newFooter = `<div className="flex justify-between items-center gap-2">
                              <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                                {isSavingExpandedNote ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Auto-saved</>}
                              </div>
                              <button
                                onClick={() => setExpandedNotesId(null)}
                                className="px-3 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                Close
                              </button>
                            </div>`;

code = code.replace(saveButtonRe, newFooter);


// Now for tags display
// We'll replace the clientName block to also show email and tags

const clientInfoRe = /<div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">\s*\{lead\.clientName\}\s*<span className=\{\`no-print px-1\.5 py-0\.5 rounded text-\[10px\] font-bold uppercase tracking-wider \$\{getPriorityColor\(lead\.priority\)\}\`\}>\s*\{lead\.priority \|\| 'Medium'\}\s*<\/span>\s*<\/div>\s*<div className="text-zinc-500 dark:text-zinc-400 text-xs">\{lead\.contact\}<\/div>/g;

const newClientInfo = `<div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {lead.clientName}
                          <span className={\`no-print px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider \${getPriorityColor(lead.priority)}\`}>
                            {lead.priority || 'Medium'}
                          </span>
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{lead.contact} {lead.email ? \`• \${lead.email}\` : ''}</div>
                        {lead.tags && lead.tags.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-1.5">
                             {lead.tags.map(tag => (
                               <span key={tag} className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium">
                                 {tag}
                               </span>
                             ))}
                           </div>
                        )}`;

code = code.replace(clientInfoRe, newClientInfo);


fs.writeFileSync('src/components/LeadsList.tsx', code);
