import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

const replacement = `
      let conditions = [];
      if (!includeArchived) {
        conditions.push(eq(schema.leads.isArchived, 0));
      }
      
      if (role === 'Technician') {
        conditions.push(or(
          eq(schema.leads.assignedUserId, id),
          eq(schema.leads.pendingTechId, id)
        ));
      } else if (role !== 'Admin') {
        conditions.push(eq(schema.leads.assignedUserId, id));
      }
`;

code = code.replace(/      let conditions = \[\];\n      if \(\!includeArchived\) \{\n        conditions\.push\(eq\(schema\.leads\.isArchived, 0\)\);\n      \}\n      \n      if \(role === 'Technician'\) \{\n        conditions\.push\(inArray\(schema\.leads\.status, \["Scheduled", "Installed"\]\)\);\n      \} else if \(role \!\=\= 'Admin'\) \{\n        conditions\.push\(eq\(schema\.leads\.assignedUserId, id\)\);\n      \}/m, replacement);

fs.writeFileSync('server.ts', code);
