import fs from 'fs';

let chat = fs.readFileSync('src/components/ChatWidget.tsx', 'utf-8');
chat = chat.replace(/fetch\('([^']+)', {\n\s*` }\n\s*}\)/g, "fetch('$1')");
// Just replace any stray backticks that are alone on a line inside a fetch
chat = chat.replace(/\{\s*` \}\s*\}/g, "{}");
fs.writeFileSync('src/components/ChatWidget.tsx', chat);

let bell = fs.readFileSync('src/components/NotificationBell.tsx', 'utf-8');
bell = bell.replace(/\{\s*` \}\s*\}/g, "{}");
fs.writeFileSync('src/components/NotificationBell.tsx', bell);
