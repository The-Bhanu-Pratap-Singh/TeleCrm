import fs from 'fs';
const file = 'src/components/LeadsList.tsx';
let code = fs.readFileSync(file, 'utf-8');

// Insert calculateHotness
const hotnessFunc = `
  const calculateHotness = (lead: Lead): number => {
    let score = 0;
    // Status scoring
    const s = lead.status.toLowerCase();
    if (s.includes('negotiation')) score += 30;
    else if (s.includes('scheduled')) score += 20;
    else if (s.includes('quoted')) score += 15;
    else if (s.includes('interested') && !s.includes('not')) score += 10;
    else if (s.includes('not interested') || s.includes('lost') || s.includes('rejected')) score -= 50;

    // Follow-up scoring
    if (lead.nextFollowUp) {
      const d = new Date(lead.nextFollowUp);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffDays = (d.getTime() - today.getTime()) / (1000 * 3600 * 24);
      if (diffDays <= 0) score += 40; // Overdue or today
      else if (diffDays <= 2) score += 20;
      else if (diffDays <= 7) score += 10;
    }

    // Activity scoring
    if (lead.notes && lead.notes.length > 0) {
      score += Math.min(30, lead.notes.length * 10);
    }
    
    return Math.max(0, Math.min(100, score)); // clamp 0-100
  };
`;

if (!code.includes('calculateHotness')) {
    code = code.replace('  const [searchTerm, setSearchTerm] = useState(\'\');', '  const [sortBy, setSortBy] = useState<\'priority\' | \'followUp\' | \'recent\'>(\'priority\');\n  const [searchTerm, setSearchTerm] = useState(\'\');');
    code = code.replace('  const sortedLeads = [...filteredLeads].sort((a, b) => {', hotnessFunc + '\n  const sortedLeads = [...filteredLeads].sort((a, b) => {');
    
    // Replace hardcoded sort logic
    const oldSort = `  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (!a.nextFollowUp) return 1;
    if (!b.nextFollowUp) return -1;
    return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
  });`;
    const newSort = `  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'priority') {
      return calculateHotness(b) - calculateHotness(a);
    } else if (sortBy === 'recent') {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    } else {
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
    }
  });`;
    code = code.replace(oldSort, newSort);
    fs.writeFileSync(file, code);
    console.log('Patched scoring logic');
}
