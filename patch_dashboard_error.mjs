import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');
code = code.replace(
  "alert('Failed to generate PDF');",
  "console.error('EXPORT_ERROR:', err);\n      alert('Failed to generate PDF: ' + (err.message || String(err)));"
);
fs.writeFileSync('src/components/Dashboard.tsx', code);
