import fs from 'fs';

let app = fs.readFileSync('src/App.tsx', 'utf-8');

const initSocketCode = `
  useEffect(() => {
    if (!user) return;
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

app = app.replace("  const handleLogin = (newToken: string, newUser: User) => {", initSocketCode + "\n  const handleLogin = (newToken: string, newUser: User) => {");

fs.writeFileSync('src/App.tsx', app);
console.log('Fixed socket init in App.tsx');
