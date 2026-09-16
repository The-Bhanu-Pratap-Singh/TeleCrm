import fs from 'fs';

let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const replacement = `
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {lead.status}
                        </span>
                        
                        {lead.techAssignmentStatus === 'Pending' && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/40 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Tech Pending
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

code = code.replace(/                        <span className="inline-flex items-center px-2 py-0\.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950\/60 text-indigo-700 dark:text-indigo-300">\n                          \{lead\.status\}\n                        <\/span>/, replacement);

fs.writeFileSync('src/components/LeadsList.tsx', code);
