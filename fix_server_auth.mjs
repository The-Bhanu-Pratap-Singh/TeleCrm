import fs from 'fs';
let server = fs.readFileSync('server.ts', 'utf-8');

// Update authenticateToken
const oldAuth = `  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };`;

const newAuth = `  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, async (err: any, decodedUser: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      try {
        const dbUser = await db.select().from(schema.users).where(eq(schema.users.id, decodedUser.id)).then(res => res[0] || null);
        if (!dbUser || dbUser.username !== decodedUser.username) {
          return res.status(401).json({ error: 'User invalid or deleted' });
        }
        // Update req.user with latest DB state
        req.user = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
        next();
      } catch (e) {
         return res.status(500).json({ error: 'Server error' });
      }
    });
  };`;

server = server.replace(oldAuth, newAuth);

// Add /api/me route
const meRoute = `  // Get current user profile
  app.get('/api/me', authenticateToken, async (req: any, res: Response) => {
    res.json(req.user);
  });
`;

if (!server.includes('/api/me')) {
  server = server.replace('  // Get all users', meRoute + '\n  // Get all users');
}

fs.writeFileSync('server.ts', server);
console.log('Fixed auth in server');
