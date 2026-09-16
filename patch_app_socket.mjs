import fs from 'fs';

let app = fs.readFileSync('src/App.tsx', 'utf-8');

// Imports
const imports = `import { io, Socket } from 'socket.io-client';
import ChatWidget from './components/ChatWidget.tsx';
import NotificationBell from './components/NotificationBell.tsx';`;
app = app.replace("import ThemeToggle from './components/ThemeToggle.tsx';", "import ThemeToggle from './components/ThemeToggle.tsx';\n" + imports);

// State
const states = `  const [socket, setSocket] = useState<Socket | null>(null);`;
app = app.replace("const [sessionExp, setSessionExp] = useState<number | null>(null);", "const [sessionExp, setSessionExp] = useState<number | null>(null);\n" + states);

// Initialize Socket in useEffect where user is set
const initSocketCode = `
  useEffect(() => {
    if (!user) return;
    
    // Get token from cookie manually for socket auth (since httpOnly is true, we actually can't read it from client side...)
    // Wait, if it's httpOnly we CANNOT read it. 
    // We should rely on standard cookies sent by browser or change server to not require token in payload if cookie is present.
    // Let's modify socket connect to just use default settings (it sends cookies automatically if withCredentials: true)
    const newSocket = io({
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, [user]);
`;
app = app.replace("  const handleLogin = (newToken: string, userData: User) => {", initSocketCode + "\n  const handleLogin = (newToken: string, userData: User) => {");

// Add notification bell in the sidebar (Header replacement on mobile, and Sidebar on desktop)
const bellHtml = `
          <div className="flex items-center gap-2">
            {user && socket && <NotificationBell user={user} socket={socket} />}
            <button
`;
app = app.replace("          <button\n            onClick={() => setIsMobileMenuOpen(false)}", bellHtml + "            onClick={() => setIsMobileMenuOpen(false)}");

// Add global ChatWidget
const chatHtml = `
        {/* Session Warning Modal */}
        {user && socket && <ChatWidget user={user} socket={socket} />}
`;
app = app.replace("      {/* Session Warning Modal */}", chatHtml);

fs.writeFileSync('src/App.tsx', app);
console.log('Patched App.tsx for socket.io');
