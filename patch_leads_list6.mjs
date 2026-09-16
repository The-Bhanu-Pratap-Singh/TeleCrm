import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const csvExportRe = /const headers = \['ID', 'Client Name', 'Contact', 'Product', 'Quantity', 'Price', 'Status', 'Next Follow-up', 'Install Date'\];\s*const rows = filteredLeads\.map\(l => \[\s*l\.id,\s*`"\$\{l\.clientName\}"`,\s*`"\$\{l\.contact\}"`,\s*`"\$\{l\.requiredProduct \|\| ''\}"`,\s*`"\$\{l\.quantity \|\| ''\}"`,\s*`"\$\{l\.price \|\| ''\}"`,\s*l\.status,\s*l\.nextFollowUp \|\| '',\s*l\.actualInstallDate \|\| ''\s*\]\);/g;

const newCsvExport = `const headers = ['ID', 'Client Name', 'Contact', 'Email', 'Tags', 'Product', 'Quantity', 'Price', 'Status', 'Next Follow-up', 'Install Date'];
    const rows = filteredLeads.map(l => [
      l.id,
      \`"\${l.clientName}"\`,
      \`"\${l.contact}"\`,
      \`"\${l.email || ''}"\`,
      \`"\${(l.tags || []).join(', ')}"\`,
      \`"\${l.requiredProduct || ''}"\`,
      \`"\${l.quantity || ''}"\`,
      \`"\${l.price || ''}"\`,
      l.status,
      l.nextFollowUp || '',
      l.actualInstallDate || ''
    ]);`;
    
code = code.replace(csvExportRe, newCsvExport);
fs.writeFileSync('src/components/LeadsList.tsx', code);
