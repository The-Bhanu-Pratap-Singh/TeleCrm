import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// replace all then(res => res[0] || null) with .then(res => res[0] || null)
code = code.replace(/then\(res => res\[0\] \|\| null\)/g, '.then(res => res[0] || null)');

// fix any ..then
code = code.replace(/\.\.then/g, '.then');

fs.writeFileSync('server.ts', code);
console.log('Fixed then dot part 2');
