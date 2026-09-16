import fs from 'fs';

const authImport = `import { syncLeadToGoogleCalendar } from '../lib/googleAuth.ts';\n`;

const patchFile = (filename, updateLogicSearch, updateLogicReplace) => {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf-8');
  
  if (!code.includes('syncLeadToGoogleCalendar')) {
    code = authImport + code;
  }
  
  if (updateLogicSearch && updateLogicReplace && code.includes(updateLogicSearch)) {
    code = code.replace(updateLogicSearch, updateLogicReplace);
  }
  
  fs.writeFileSync(filename, code);
};

patchFile('src/components/Dashboard.tsx',
  "setLeads(leads.map(l => l.id === editingLead.id ? savedLead : l));",
  "setLeads(leads.map(l => l.id === editingLead.id ? savedLead : l));\n        syncLeadToGoogleCalendar(savedLead);"
);

patchFile('src/components/TechnicianDashboard.tsx',
  "setLeads(leads.map(l => l.id === leadId ? updated : l));",
  "setLeads(leads.map(l => l.id === leadId ? updated : l));\n        syncLeadToGoogleCalendar(updated);"
);

patchFile('src/components/LeadsList.tsx',
  "const saved = await res.json();",
  "const saved = await res.json();\n        syncLeadToGoogleCalendar(saved);"
);

console.log("Patched sync logic");
