import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "clientName, contact, address, assignedUserId, requiredProduct,\n      quantity, price, notes, nextFollowUp, visitSchedule,\n      installationSchedule, actualInstallDate, status, priority, priority",
  "clientName, contact, address, assignedUserId, requiredProduct,\n      quantity, price, notes, nextFollowUp, visitSchedule,\n      installationSchedule, actualInstallDate, status, priority"
);

code = code.replace(
  "clientName, contact, address, assignedUserId, requiredProduct,\n      quantity, price, notes, nextFollowUp, visitSchedule,\n      installationSchedule, actualInstallDate, status\n    } = req.body;\n    \n    try {\n      // Access Control",
  "clientName, contact, address, assignedUserId, requiredProduct,\n      quantity, price, notes, nextFollowUp, visitSchedule,\n      installationSchedule, actualInstallDate, status, priority\n    } = req.body;\n    \n    try {\n      // Access Control"
);

code = code.replace(
  "clientName, contact, address, assignedUserId, requiredProduct,\n          quantity, price, notes: Array.isArray(notes) ? JSON.stringify(notes) : notes, nextFollowUp, visitSchedule,\n          installationSchedule, actualInstallDate, status\n        })",
  "clientName, contact, address, assignedUserId, requiredProduct,\n          quantity, price, notes: Array.isArray(notes) ? JSON.stringify(notes) : notes, nextFollowUp, visitSchedule,\n          installationSchedule, actualInstallDate, status, priority\n        })"
);

fs.writeFileSync('server.ts', code);
