import fs from 'fs';

let code = fs.readFileSync('src/components/ActivityLogViewer.tsx', 'utf-8');
code = code.replace("Complete Activity Log", "Security & Audit Log");
fs.writeFileSync('src/components/ActivityLogViewer.tsx', code);

let app = fs.readFileSync('src/App.tsx', 'utf-8');
app = app.replace(
  /<span>Activity Log<\/span>/g,
  "<span>Security & Audit Log</span>"
);
app = app.replace(
  /<span>Activity<\/span>/g,
  "<span>Audit Log</span>"
);
fs.writeFileSync('src/App.tsx', app);

console.log('Renamed to Security & Audit Log');
