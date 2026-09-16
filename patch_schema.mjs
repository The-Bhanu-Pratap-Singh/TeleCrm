import fs from 'fs';

let code = fs.readFileSync('src/db/schema.ts', 'utf-8');
code = code.replace(
  "declinedTechIds: text('declined_tech_ids'), // JSON array of IDs",
  "declinedTechIds: text('declined_tech_ids'), // JSON array of IDs\n  techAssignedAt: timestamp('tech_assigned_at'), // For SLA tracking"
);
fs.writeFileSync('src/db/schema.ts', code);
