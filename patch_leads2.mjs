import fs from 'fs';

let content = fs.readFileSync('src/components/LeadsList.tsx', 'utf8');

// Add sortedLeads logic right after filteredLeads definition
const sortBlock = `
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (!a.nextFollowUp) return 1;
    if (!b.nextFollowUp) return -1;
    return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
  });
`;

content = content.replace(
  'const matchesStatus = statusFilter === \'All\' || lead.status === statusFilter;\n    return matchesSearch && matchesStatus;\n  });',
  `const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;\n    return matchesSearch && matchesStatus;\n  });\n\n${sortBlock}`
);

content = content.replace(
  '{filteredLeads.map(lead => (',
  '{sortedLeads.map(lead => ('
);

content = content.replace(
  '{filteredLeads.length === 0 && (',
  '{sortedLeads.length === 0 && ('
);

fs.writeFileSync('src/components/LeadsList.tsx', content);
