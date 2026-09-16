import fs from 'fs';

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const importAdd = `import { useTheme } from '../context/ThemeContext.tsx';
import { ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';`;
code = code.replace("import { useTheme } from '../context/ThemeContext.tsx';", importAdd);

const hooksAdd = `
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const pendingLeads = useMemo(() => {
    return leads.filter(l => l.pendingTechId === user.id && l.techAssignmentStatus === 'Pending');
  }, [leads, user.id]);

  const handleTechAction = async (leadId: number, action: 'accept-tech' | 'decline-tech') => {
    try {
      setActionLoading(leadId);
      const res = await fetch(\`/api/leads/\${leadId}/\${action}\`, {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (res.ok) {
        // Refresh leads
        const leadsRes = await fetch('/api/leads', { headers: { 'Authorization': \`Bearer \${token}\` }});
        const data = await leadsRes.json();
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };
`;
code = code.replace("const [isExporting, setIsExporting] = useState(false);", hooksAdd);


const uiAdd = `
      {/* Pending Tech Assignments */}
      {user.role === 'Technician' && pendingLeads.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-semibold mb-4 text-sm sm:text-base">
            <AlertCircle className="w-5 h-5" /> Pending Assignments ({pendingLeads.length})
          </div>
          <div className="space-y-4">
            {pendingLeads.map(lead => (
              <div key={lead.id} className="bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/40 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div>
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">{lead.clientName}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{lead.address || 'No address provided'} • {lead.contact}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => handleTechAction(lead.id, 'decline-tech')}
                    disabled={actionLoading === lead.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Decline
                  </button>
                  <button 
                    onClick={() => handleTechAction(lead.id, 'accept-tech')}
                    disabled={actionLoading === lead.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Accept Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid Overview */}`;

code = code.replace("{/* Grid Overview */}", uiAdd);

fs.writeFileSync('src/components/Dashboard.tsx', code);
