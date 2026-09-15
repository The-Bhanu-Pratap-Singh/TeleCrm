import fs from 'fs';
let content = fs.readFileSync('src/components/LeadsList.tsx', 'utf8');

// Fix the duplicated modal wrapper
content = content.replace(
  '{isModalOpen && editingLead && (\n        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">\n\n        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">',
  '{isModalOpen && editingLead && (\n        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">'
);

fs.writeFileSync('src/components/LeadsList.tsx', content);
