import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])",
  "email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || []), updatedAt: sql`CURRENT_TIMESTAMP`"
);

fs.writeFileSync('server.ts', code);
