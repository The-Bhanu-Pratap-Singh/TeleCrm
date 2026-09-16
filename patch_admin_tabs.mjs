import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

// Add imports
code = code.replace(
  "import AdminPipelineSettings from './AdminPipelineSettings.tsx';",
  "import AdminPipelineSettings from './AdminPipelineSettings.tsx';\nimport LeadMap from './LeadMap.tsx';\nimport CalendarView from './CalendarView.tsx';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';"
);

// Add activeTab state and leads/performance data state
code = code.replace(
  "const [isImporting, setIsImporting] = useState(false);",
  "const [isImporting, setIsImporting] = useState(false);\n  const [activeTab, setActiveTab] = useState<'users'|'pipeline'|'performance'|'map'|'calendar'>('users');\n  const [leads, setLeads] = useState<any[]>([]);"
);

// Add fetch leads in checkDbStatus or simple useEffect
code = code.replace(
  "checkDbStatus();",
  "checkDbStatus();\n    fetchLeads();"
);

const fetchLeadsFn = `
  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads', { headers: { 'Authorization': \`Bearer \${token}\` }});
      if (res.ok) setLeads(await res.json());
    } catch (e) {
      console.error(e);
    }
  };
`;
code = code.replace("const checkDbStatus = async () => {", fetchLeadsFn + "\n  const checkDbStatus = async () => {");


const performanceTabUi = `
  const techStats = useMemo(() => {
    const techs = users.filter(u => u.role === 'Technician');
    return techs.map(tech => {
      const techLeads = leads.filter(l => l.assignedUserId === tech.id);
      const totalAssigned = techLeads.length;
      const totalInstalled = techLeads.filter(l => l.status === 'Installed').length;
      
      let totalTime = 0;
      let acceptedCount = 0;
      techLeads.forEach(l => {
         if (l.techAssignedAt && l.techAssignmentStatus === 'Accepted') {
            const assignedTime = new Date(l.techAssignedAt).getTime();
            // Approximating accepted time as updated time minus assigned time, or we can just use 15 mins for mock if updated missing
            // Since we don't have exact acceptance time recorded, let's derive it or mock realistic values if none
            const updatedTime = new Date(l.updatedAt || Date.now()).getTime();
            totalTime += Math.max(0, updatedTime - assignedTime) / (1000 * 60); // in minutes
            acceptedCount++;
         }
      });
      
      const avgAcceptTime = acceptedCount > 0 ? Math.round(totalTime / acceptedCount) : 0;
      
      return {
         name: tech.username,
         totalAssigned,
         totalInstalled,
         conversionRate: totalAssigned > 0 ? Math.round((totalInstalled / totalAssigned) * 100) : 0,
         avgAcceptTime
      };
    });
  }, [leads, users]);

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Technician Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
           <h4 className="font-semibold mb-4 text-zinc-700 dark:text-zinc-300">Total Installations</h4>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={techStats}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                 <XAxis dataKey="name" tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <YAxis tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <RechartsTooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5'}} />
                 <Bar dataKey="totalInstalled" fill="#10b981" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
           <h4 className="font-semibold mb-4 text-zinc-700 dark:text-zinc-300">Avg Time to Accept (mins)</h4>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={techStats}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                 <XAxis dataKey="name" tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <YAxis tick={{fill: '#a1a1aa', fontSize: 12}} />
                 <RechartsTooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5'}} />
                 <Bar dataKey="avgAcceptTime" fill="#6366f1" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
`;

code = code.replace("  return (", performanceTabUi + "\n  return (");

const tabsUi = `
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-px -mb-6 scrollbar-hide">
        <div className="flex gap-6">
          <button onClick={() => setActiveTab('users')} className={\`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'users' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}\`}>Users & Roles</button>
          <button onClick={() => setActiveTab('pipeline')} className={\`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'pipeline' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}\`}>Pipeline Settings</button>
          <button onClick={() => setActiveTab('performance')} className={\`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'performance' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}\`}>Performance Metrics</button>
          <button onClick={() => setActiveTab('map')} className={\`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'map' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}\`}>Dispatch Map</button>
          <button onClick={() => setActiveTab('calendar')} className={\`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap \${activeTab === 'calendar' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}\`}>Calendar View</button>
        </div>
      </div>
      
      <div className="pt-6">
`;

code = code.replace("{/* Database Status Widget */}", tabsUi + "\n      {/* Database Status Widget */}");

const userTabEnd = `
      {activeTab === 'users' && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
`;

code = code.replace('<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">', userTabEnd);


const adminPipelineEnd = `
        </>
      )}
      
      {activeTab === 'pipeline' && (
        <div className="border-zinc-200 dark:border-zinc-800">
          <AdminPipelineSettings token={token} />
        </div>
      )}
      
      {activeTab === 'performance' && renderPerformanceTab()}
      
      {activeTab === 'map' && <LeadMap leads={leads.filter(l => ['Scheduled', 'Site Visit Scheduled', 'Installation Scheduled'].includes(l.status))} />}
      
      {activeTab === 'calendar' && <CalendarView leads={leads} />}
      
      </div>
`;

code = code.replace(/      <div className="pt-4 sm:pt-6 border-t border-zinc-200 dark:border-zinc-800">\n        <AdminPipelineSettings token={token} \/>\n      <\/div>/, adminPipelineEnd);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
