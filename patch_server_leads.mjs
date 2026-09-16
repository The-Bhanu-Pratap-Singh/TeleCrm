import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// For GET /api/leads
code = code.replace(
  "priority: schema.leads.priority",
  "priority: schema.leads.priority,\n          email: schema.leads.email,\n          tags: schema.leads.tags"
);

// For POST /api/leads
code = code.replace(
  "installationSchedule, actualInstallDate, status, priority",
  "installationSchedule, actualInstallDate, status, priority, email, tags"
);

code = code.replace(
  "installationSchedule, actualInstallDate, status: status || 'New', priority: priority || 'Medium'\n        })",
  "installationSchedule, actualInstallDate, status: status || 'New', priority: priority || 'Medium',\n          email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])\n        })"
);

// For PUT /api/leads/:id
code = code.replace(
  "installationSchedule, actualInstallDate, status, priority\n    } = req.body;",
  "installationSchedule, actualInstallDate, status, priority, email, tags\n    } = req.body;"
);

code = code.replace(
  "installationSchedule, actualInstallDate, status, priority\n        })",
  "installationSchedule, actualInstallDate, status, priority,\n          email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])\n        })"
);

fs.writeFileSync('server.ts', code);
