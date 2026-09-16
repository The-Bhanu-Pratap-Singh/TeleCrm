import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

code = code.replace(
  "{/* Database Status Widget */}",
  "{activeTab === 'users' && (<div className=\"space-y-6\">\n      {/* Database Status Widget */}"
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
