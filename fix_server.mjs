import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/\)then\(res => res\[0\] \|\| null\)/g, ').then(res => res[0] || null)');
fs.writeFileSync('server.ts', code);
console.log('Fixed then dot');
