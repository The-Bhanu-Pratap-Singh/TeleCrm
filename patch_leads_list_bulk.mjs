import fs from 'fs';

let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const hooks = `  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkTechId, setBulkTechId] = useState('');
  
  const handleBulkUpdate = async () => {
    if (selectedLeadIds.length === 0) return;
    const updates: any = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkTechId) updates.assignedUserId = Number(bulkTechId);
    
    if (Object.keys(updates).length === 0) return;
    
    try {
      const res = await fetch('/api/leads/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ leadIds: selectedLeadIds, updates })
      });
      if (res.ok) {
        setSelectedLeadIds([]);
        setBulkStatus('');
        setBulkTechId('');
        fetchLeads();
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  const isSlaBreached = (lead: Lead) => {
    if (lead.techAssignmentStatus !== 'Pending' || !lead.techAssignedAt) return false;
    const assignedAt = new Date(lead.techAssignedAt).getTime();
    return (Date.now() - assignedAt) > 30 * 60 * 1000; // 30 minutes
  };
`;

code = code.replace("  const [showArchived, setShowArchived] = useState(false);", "  const [showArchived, setShowArchived] = useState(false);\n" + hooks);

const bulkBar = `
      {selectedLeadIds.length > 0 && user.role !== 'Technician' && (
        <div className="no-print sticky top-0 z-50 mb-4 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 shadow-md flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
            {selectedLeadIds.length} lead(s) selected
          </span>
          <div className="flex gap-2">
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Update Status...</option>
              {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select
              value={bulkTechId}
              onChange={e => setBulkTechId(e.target.value)}
              className="text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Assign Tech...</option>
              {users.filter(u => u.role === 'Technician').map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <button
              onClick={handleBulkUpdate}
              disabled={!bulkStatus && !bulkTechId}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Apply Updates
            </button>
            <button
              onClick={() => setSelectedLeadIds([])}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
`;

code = code.replace("{/* Summary Cards */}", bulkBar + "\n      {/* Summary Cards */}");

const badgeReplacement = `
                        {lead.techAssignmentStatus === 'Pending' && (
                          <div className={\`mt-1 inline-flex items-center px-2 py-0.5 rounded \${isSlaBreached(lead) ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 animate-pulse' : 'bg-amber-50 dark:bg-amber-900/40 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}\`}>
                            {isSlaBreached(lead) ? '⚠️ SLA Breached (30m+)' : 'Tech Pending'}
                          </div>
                        )}
                        {lead.techAssignmentStatus === 'Declined' && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/40 text-[10px] font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                            Tech Declined
                          </div>
                        )}
                        {lead.techAssignmentStatus === 'Accepted' && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Tech Confirmed
                          </div>
                        )}
`;

code = code.replace(/                        \{lead\.techAssignmentStatus === 'Pending' && \([\s\S]*?Tech Confirmed\n                          <\/div>\n                        \)\}/m, badgeReplacement);

fs.writeFileSync('src/components/LeadsList.tsx', code);
