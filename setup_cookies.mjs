import fs from 'fs';

let server = fs.readFileSync('server.ts', 'utf-8');

// Add cookie-parser import
if (!server.includes('cookieParser')) {
  server = server.replace("import express, { Request, Response, NextFunction } from 'express';", "import express, { Request, Response, NextFunction } from 'express';\nimport cookieParser from 'cookie-parser';");
}

// Add app.use(cookieParser())
if (!server.includes('app.use(cookieParser())')) {
  server = server.replace('app.use(express.json());', 'app.use(express.json());\n  app.use(cookieParser());');
}

// Modify authenticateToken
const authRegex = /const authenticateToken = \(req: any, res: Response, next: NextFunction\) => \{[\s\S]*?jwt\.verify/;
const newAuth = `const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    // Try cookie first, then auth header
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify`;
server = server.replace(authRegex, newAuth);

// Modify login endpoint
const loginRegex = /const token = jwt\.sign\([\s\S]*?res\.json\(\{ token, user: \{ id: user\.id, username: user\.username, role: user\.role \} \}\);/
const newLogin = `const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Set HTTP-Only Cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });`
server = server.replace(loginRegex, newLogin);

// Add logout endpoint
const logoutEndpoint = `  // Logout endpoint
  app.post('/api/users/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ success: true });
  });
`;
if (!server.includes('/api/users/logout')) {
  server = server.replace('  // Get all users', logoutEndpoint + '\n  // Get all users');
}

fs.writeFileSync('server.ts', server);
console.log('Server updated for cookies');
