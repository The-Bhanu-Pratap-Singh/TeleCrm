import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "clientName, contact, address, assignedUserId, requiredProduct,\n          quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,\n          installationSchedule, actualInstallDate, status\n        })",
  "clientName, contact, address, assignedUserId, requiredProduct,\n          quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,\n          installationSchedule, actualInstallDate, status, priority\n        })"
);

fs.writeFileSync('server.ts', code);
