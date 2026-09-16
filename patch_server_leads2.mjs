import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "leads = (leads as any[]).map(l => ({ ...l, notes: JSON.parse(l.notes || '[]') }));",
  "leads = (leads as any[]).map(l => ({ ...l, notes: JSON.parse(l.notes || '[]'), tags: typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : l.tags || [] }));"
);

fs.writeFileSync('server.ts', code);
