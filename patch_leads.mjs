import fs from 'fs';

let content = fs.readFileSync('src/components/LeadsList.tsx', 'utf8');

// 1. Update default sort
content = content.replace(
  "const [sortBy, setSortBy] = useState<'createdAt' | 'nextFollowUp' | 'status'>('createdAt');",
  "const [sortBy, setSortBy] = useState<'createdAt' | 'nextFollowUp' | 'status'>('nextFollowUp');"
);

// 2. Update sortedLeads logic to push nulls/undefined to bottom
const oldSortLogic = `
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'nextFollowUp') {
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
    }
    return a.status.localeCompare(b.status);
  });
`;

if (content.includes("const sortedLeads = [...filteredLeads].sort")) {
  // It probably already exists, let's just write a regex to replace the whole block
  content = content.replace(/const sortedLeads = \[\.\.\.filteredLeads\]\.sort\([\s\S]*?\}\);\n/m, `  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'nextFollowUp') {
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
    }
    return a.status.localeCompare(b.status);
  });\n`);
}

// 3. Update table headers to include assigned user
content = content.replace(
  '<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>',
  '<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assigned To</th><th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>'
);

// 4. Update table rows to include assigned user
content = content.replace(
  '<td className="px-6 py-4 whitespace-nowrap">',
  '<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">{lead.assignedUserName || "Unassigned"}</td><td className="px-6 py-4 whitespace-nowrap">'
);

// 5. Restrict Assign To select to Admin ONLY
content = content.replace(
  "{(user.role === 'Admin' || user.role === 'Social Media Manager' || user.role === 'Telecaller') && (",
  "{(user.role === 'Admin') && ("
);

fs.writeFileSync('src/components/LeadsList.tsx', content);
