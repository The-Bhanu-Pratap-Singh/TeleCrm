import fs from 'fs';

let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

// Update search logic
const filterRe = /const matchesSearch = \n\s*lead\.clientName\.toLowerCase\(\)\.includes\(searchLower\) \|\|\n\s*lead\.contact\.toLowerCase\(\)\.includes\(searchLower\);/g;
const newFilter = `const matchesSearch = 
      lead.clientName.toLowerCase().includes(searchLower) || 
      lead.contact.toLowerCase().includes(searchLower) ||
      (lead.email || '').toLowerCase().includes(searchLower);`;
code = code.replace(filterRe, newFilter);
if (code.includes('const matchesSearch = \n      lead.clientName')) {
   // great
} else {
    // try different spacing
    code = code.replace(/const matchesSearch = \s*lead\.clientName\.toLowerCase\(\)\.includes\(searchLower\) || \s*lead\.contact\.toLowerCase\(\)\.includes\(searchLower\);/g, newFilter);
}

// 2. Debounce in Expandable Notes
// The current save logic:
// onChange={e => setExpandedNoteText(e.target.value)}
// We need to auto-save it on debounce.

// Wait, the prompt says: "Implement a debounce function in the 'Expandable Notes' feature so that updates to lead notes are automatically saved to the database without requiring a separate save button click."

// Let's add useEffect for auto saving the expanded notes.
const debounceLogic = `
  const [debouncedNoteText, setDebouncedNoteText] = useState(expandedNoteText);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedNoteText(expandedNoteText);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [expandedNoteText]);

  useEffect(() => {
    if (expandedNotesId && debouncedNoteText !== null && debouncedNoteText !== leads.find(l => l.id === expandedNotesId)?.notes) {
      saveExpandedNote(expandedNotesId, debouncedNoteText);
    }
  }, [debouncedNoteText]);

  // wait, saveExpandedNote signature needs to change to take noteText
  const saveExpandedNote = async (leadId: number, noteTextToSave: string) => {
    setIsSavingExpandedNote(true);
    try {
      const res = await fetch(\`/api/leads/\${leadId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteTextToSave })
      });
      if (res.ok) {
        setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, notes: noteTextToSave } : l));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingExpandedNote(false);
    }
  };
`;

// Let's see how toggleExpandedNote and saveExpandedNote are currently implemented.
