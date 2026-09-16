import fs from 'fs';

let code = fs.readFileSync('src/types.ts', 'utf-8');

const replacements = `  status: LeadStatus;
  pendingTechId?: number;
  techAssignmentStatus?: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;`;

code = code.replace(/  status: LeadStatus;\n  createdAt: string;/m, replacements);

fs.writeFileSync('src/types.ts', code);
