import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  "import { eq, inArray, and, or, desc, asc, sql, getTableColumns } from 'drizzle-orm';",
  "import { eq, inArray, and, or, desc, asc, sql, getTableColumns, lt } from 'drizzle-orm';"
);
fs.writeFileSync('server.ts', code);
