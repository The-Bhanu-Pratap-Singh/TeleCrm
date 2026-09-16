import fs from 'fs';
let server = fs.readFileSync('server.ts', 'utf-8');

// Imports
server = server.replace(
  "import { createServer as createViteServer } from 'vite';",
  "import { createServer as createViteServer } from 'vite';\nimport { createServer } from 'http';\nimport { Server } from 'socket.io';"
);

// Endpoints
const chatEndpoints = `
  // --- Chat API ---
  app.get('/api/chat', authenticateToken, async (req: any, res: Response) => {
    try {
      const messages = await db
        .select({
          id: schema.chatMessages.id,
          message: schema.chatMessages.message,
          createdAt: schema.chatMessages.createdAt,
          user: {
            id: schema.users.id,
            username: schema.users.username,
            role: schema.users.role,
          }
        })
        .from(schema.chatMessages)
        .innerJoin(schema.users, eq(schema.chatMessages.userId, schema.users.id))
        .orderBy(desc(schema.chatMessages.createdAt))
        .limit(50);
      res.json(messages.reverse());
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch chat' });
    }
  });

  // --- Notifications API ---
  app.get('/api/notifications', authenticateToken, async (req: any, res: Response) => {
    try {
      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, req.user.id), eq(schema.notifications.read, 0)))
        .orderBy(desc(schema.notifications.createdAt));
      res.json(notifs);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.post('/api/notifications/read', authenticateToken, async (req: any, res: Response) => {
    try {
      await db.update(schema.notifications)
        .set({ read: 1 })
        .where(eq(schema.notifications.userId, req.user.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to mark read' });
    }
  });
`;

server = server.replace("  // ----- Vite Middleware", chatEndpoints + "\n  // ----- Vite Middleware");

// Socket initialization and app.listen replacement
const startListenOld = `
  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
`;
const startListenNew = `
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Socket Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error'));
      socket.data.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    
    // Join personal room for notifications
    socket.join(\`user_\${user.id}\`);

    socket.on('send_chat_message', async (data) => {
      try {
        const [inserted] = await db.insert(schema.chatMessages).values({
          userId: user.id,
          message: data.message,
        }).returning();

        // Broadcast to all
        io.emit('new_chat_message', {
          id: inserted.id,
          message: inserted.message,
          createdAt: inserted.createdAt,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          }
        });
      } catch (e) {
        console.error('Chat send error:', e);
      }
    });

    socket.on('disconnect', () => {
      // Handle disconnect if needed
    });
  });

  // Helper to send notifications from HTTP routes
  app.set('io', io);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
`;
server = server.replace(startListenOld, startListenNew);

fs.writeFileSync('server.ts', server);
console.log('Patched server.ts with sockets');
