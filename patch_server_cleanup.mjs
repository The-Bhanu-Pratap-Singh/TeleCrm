import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const cleanupLogic = `
  // Automated Cleanup Policy for Leads
  const runCleanup = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const res = await db.update(schema.leads)
        .set({ isArchived: 1 })
        .where(
          and(
            inArray(schema.leads.status, ['Closed-Lost', 'Inactive']),
            lt(schema.leads.updatedAt, thirtyDaysAgo),
            eq(schema.leads.isArchived, 0)
          )
        )
        .returning({ id: schema.leads.id });
        
      if (res.length > 0) {
        console.log("Archived " + res.length + " old leads.");
      }
    } catch (e) {
      console.error('Cleanup policy error:', e);
    }
  };
  
  // Run on start and every hour
  runCleanup();
  setInterval(runCleanup, 60 * 60 * 1000);
`;

code = code.replace("async function startServer() {", "async function startServer() {\n" + cleanupLogic);

if (!code.includes('import { eq, desc, asc, sql, and, lt, inArray }')) {
    code = code.replace(
      "import { eq, desc, asc, sql",
      "import { eq, desc, asc, sql, and, lt, inArray"
    );
}

const queryLogicRe = /if \(role === 'Admin'\) \{\s*leads = await query\.orderBy\(desc\(schema\.leads\.id\)\);\s*\} else if \(role === 'Technician'\) \{\s*leads = await query\s*\.where\(inArray\(schema\.leads\.status, \["Scheduled", "Installed"\]\)\)\s*\.orderBy\(asc\(schema\.leads\.installationSchedule\)\)\s*;\s*\} else \{\s*\/\/ Telecaller \/ Social Media\s*leads = await query\.where\(eq\(schema\.leads\.assignedUserId, id\)\)\.orderBy\(desc\(schema\.leads\.id\)\);\s*\}/g;

const newQueryLogic = `
      let conditions = [];
      if (!includeArchived) {
        conditions.push(eq(schema.leads.isArchived, 0));
      }
      
      if (role === 'Technician') {
        conditions.push(inArray(schema.leads.status, ["Scheduled", "Installed"]));
      } else if (role !== 'Admin') {
        conditions.push(eq(schema.leads.assignedUserId, id));
      }
      
      if (conditions.length > 0) {
        query.where(and(...conditions));
      }
      
      if (role === 'Technician') {
        leads = await query.orderBy(asc(schema.leads.installationSchedule));
      } else {
        leads = await query.orderBy(desc(schema.leads.id));
      }
`;

code = code.replace(
  "}).from(schema.leads).leftJoin(schema.users, eq(schema.leads.assignedUserId, schema.users.id));",
  "}).from(schema.leads).leftJoin(schema.users, eq(schema.leads.assignedUserId, schema.users.id));\n      // Filter out archived unless explicitly requested (e.g., query param)\n      const includeArchived = req.query.archived === 'true';"
);

code = code.replace(queryLogicRe, newQueryLogic);

fs.writeFileSync('server.ts', code);
