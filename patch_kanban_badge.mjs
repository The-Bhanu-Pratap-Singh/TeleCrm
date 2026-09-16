import fs from 'fs';

let code = fs.readFileSync('src/components/KanbanBoard.tsx', 'utf-8');

const replacement = `
                              {lead.requiredProduct && (
                                <div className="mt-2.5 ml-5 inline-flex items-center px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-700/60 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700 max-w-full truncate">
                                  {lead.requiredProduct}
                                </div>
                              )}
                              
                              {lead.techAssignmentStatus === 'Pending' && (
                                <div className="mt-1.5 ml-5 inline-flex items-center px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/40 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  Tech Pending Acceptance
                                </div>
                              )}
                              {lead.techAssignmentStatus === 'Declined' && (
                                <div className="mt-1.5 ml-5 inline-flex items-center px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/40 text-[10px] font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                                  Tech Declined (Reassigning)
                                </div>
                              )}
                              {lead.techAssignmentStatus === 'Accepted' && (
                                <div className="mt-1.5 ml-5 inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  Tech Confirmed
                                </div>
                              )}
`;

code = code.replace(/                              \{lead\.requiredProduct && \(\n                                <div className="mt-2\.5 ml-5 inline-flex items-center px-2 py-0\.5 rounded bg-zinc-50 dark:bg-zinc-700\/60 text-\[10px\] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700 max-w-full truncate">\n                                  \{lead\.requiredProduct\}\n                                <\/div>\n                              \)\}/, replacement);

fs.writeFileSync('src/components/KanbanBoard.tsx', code);
