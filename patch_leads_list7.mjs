import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const trRe = /<tr className=\{\`hover:bg-zinc-50 dark:hover:bg-zinc-800\/50 text-sm transition-colors border-l-4 \$\{getPriorityColor\(lead\.priority\)\.split\(' '\)\[0\]\} \$\{expandedNotesId === lead\.id \? 'bg-zinc-50 dark:bg-zinc-800\/30 border-indigo-500' : ''\}\`\}>/g;
const newTr = `<tr className={\`group hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:shadow-sm hover:-translate-y-0.5 text-sm transition-all duration-200 border-l-4 \${getPriorityColor(lead.priority).split(' ')[0]} \${expandedNotesId === lead.id ? 'bg-zinc-50 dark:bg-zinc-800/30 border-indigo-500' : ''}\`}>`;

code = code.replace(trRe, newTr);

fs.writeFileSync('src/components/LeadsList.tsx', code);
