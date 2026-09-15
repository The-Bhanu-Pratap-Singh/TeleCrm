import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// Add import getTableColumns
if (!code.includes('getTableColumns')) {
  code = code.replace(/import { eq, inArray, and, desc, asc, sql } from 'drizzle-orm';/, "import { eq, inArray, and, desc, asc, sql, getTableColumns } from 'drizzle-orm';");
}

code = code.replace(/\.\.\.schema\.leads/g, '...getTableColumns(schema.leads)');
fs.writeFileSync('server.ts', code);
console.log('Fixed getTableColumns');
