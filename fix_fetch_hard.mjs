import fs from 'fs';

let chat = fs.readFileSync('src/components/ChatWidget.tsx', 'utf-8');
chat = chat.replace("fetch('/api/chat', {\n      ` }\n    })", "fetch('/api/chat')");
fs.writeFileSync('src/components/ChatWidget.tsx', chat);

let bell = fs.readFileSync('src/components/NotificationBell.tsx', 'utf-8');
bell = bell.replace("fetch('/api/notifications', {\n      ` }\n    })", "fetch('/api/notifications')");
bell = bell.replace("fetch('/api/notifications/read', {\n        method: 'POST',\n        ` }\n      });", "fetch('/api/notifications/read', { method: 'POST' });");
fs.writeFileSync('src/components/NotificationBell.tsx', bell);

console.log('Fixed fetch syntax manually');
