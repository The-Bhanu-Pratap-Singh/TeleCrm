import fs from 'fs';
let server = fs.readFileSync('server.ts', 'utf-8');

// Replace the Socket Auth Middleware
const authOld = `  // Socket Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error'));
      socket.data.user = decoded;
      next();
    });
  });`;

const authNew = `  // Socket Auth Middleware
  io.use((socket, next) => {
    // Parse cookies from headers
    const cookieHeader = socket.request.headers.cookie;
    if (!cookieHeader) return next(new Error('Authentication error: No cookies'));
    
    // Quick parser for token
    const tokenMatch = cookieHeader.match(/(?:^|;\\s*)token=([^;]*)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    if (!token) return next(new Error('Authentication error: No token'));
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      socket.data.user = decoded;
      next();
    });
  });`;

server = server.replace(authOld, authNew);
fs.writeFileSync('server.ts', server);
console.log('Patched server socket auth to use cookies');
