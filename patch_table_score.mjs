import fs from 'fs';
const file = 'src/components/LeadsList.tsx';
let code = fs.readFileSync(file, 'utf-8');

const targetTableStatus = `                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {lead.status}
                        </span>`;
const scoreDisplayTable = `                        <div className="flex items-center gap-1.5 mb-1">
                          {calculateHotness(lead) >= 50 ? <Flame className="w-4 h-4 text-rose-500" /> : calculateHotness(lead) >= 30 ? <Flame className="w-4 h-4 text-orange-400" /> : <Flame className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />}
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Score: {calculateHotness(lead)}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {lead.status}
                        </span>`;

if (code.includes(targetTableStatus)) {
    code = code.replace(targetTableStatus, scoreDisplayTable);
    fs.writeFileSync(file, code);
    console.log('Patched Table Score');
} else {
    console.log('Target not found');
}
