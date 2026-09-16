import fs from 'fs';

const fixFile = (file) => {
  let code = fs.readFileSync(file, 'utf-8');
  // Just wipe out the bad fetch call arguments entirely for the GET requests
  code = code.replace(/fetch\('([^']+)', {\n\s*` }\n\s*}\)/g, "fetch('$1')");
  fs.writeFileSync(file, code);
};

fixFile('src/components/NotificationBell.tsx');
fixFile('src/components/ChatWidget.tsx');

let bell = fs.readFileSync('src/components/NotificationBell.tsx', 'utf-8');
bell = bell.replace(/fetch\('\/api\/notifications\/read', {\n\s*method: 'POST',\n\s*` }\n\s*}\)/g, "fetch('/api/notifications/read', { method: 'POST' })");
fs.writeFileSync('src/components/NotificationBell.tsx', bell);

console.log('Fixed fetch syntax');
