import fs from 'fs';

// --- patch ChatWidget.tsx ---
let chatCode = fs.readFileSync('src/components/ChatWidget.tsx', 'utf-8');

chatCode = chatCode.replace(
  "export default function ChatWidget({ user, socket }: { user: UserType, socket: any }) {",
  "export default function ChatWidget({ user, socket, token }: { user: UserType, socket: any, token: string }) {"
);

chatCode = chatCode.replace(
  "fetch('/api/chat')",
  "fetch('/api/chat', { headers: { 'Authorization': `Bearer ${token}` } })"
);
fs.writeFileSync('src/components/ChatWidget.tsx', chatCode);

// --- patch NotificationBell.tsx ---
let notifCode = fs.readFileSync('src/components/NotificationBell.tsx', 'utf-8');

notifCode = notifCode.replace(
  "export default function NotificationBell({ user, socket }: { user: User, socket: any }) {",
  "export default function NotificationBell({ user, socket, token }: { user: User, socket: any, token: string }) {"
);

notifCode = notifCode.replace(
  "fetch('/api/notifications')",
  "fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } })"
);

notifCode = notifCode.replace(
  "await fetch('/api/notifications/read', { method: 'POST' });",
  "await fetch('/api/notifications/read', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });"
);

fs.writeFileSync('src/components/NotificationBell.tsx', notifCode);

// --- patch App.tsx ---
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

appCode = appCode.replace(
  "{user && socket && <ChatWidget user={user} socket={socket} />}",
  "{user && socket && <ChatWidget user={user} socket={socket} token={token} />}"
);

appCode = appCode.replace(
  "{user && socket && <NotificationBell user={user} socket={socket} />}",
  "{user && socket && <NotificationBell user={user} socket={socket} token={token} />}"
);

fs.writeFileSync('src/App.tsx', appCode);

