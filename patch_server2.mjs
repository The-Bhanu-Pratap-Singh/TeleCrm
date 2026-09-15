import fs from 'fs';

let server = fs.readFileSync('server.ts', 'utf-8');

// 1. Add audit logging helper
const auditHelper = `
  const logAudit = async (userId, action, details, leadId = null) => {
    try {
      await db.insert(schema.activityLogs).values({
        userId,
        action,
        details,
        leadId
      });
    } catch (e) {
      console.error('Audit log failed', e);
    }
  };
`;
server = server.replace("  const requireRole = (roles: string[]) => {", auditHelper + "\n  const requireRole = (roles: string[]) => {");

// 2. Change bulk-assign role to Admin only and add logging
const bulkAssignOld = "app.put('/api/leads/bulk-assign', authenticateToken, requireRole(['Admin', 'Social Media Manager', 'Telecaller']), async (req: any, res) => {";
const bulkAssignNew = "app.put('/api/leads/bulk-assign', authenticateToken, requireRole(['Admin']), async (req: any, res) => {";
server = server.replace(bulkAssignOld, bulkAssignNew);

const bulkAssignLogTarget = "res.json({ message: 'Leads assigned successfully' });";
const bulkAssignLogNew = `await logAudit(req.user.id, 'Mass Lead Reassignment', \`Reassigned \${leadIds.length} leads to user ID \${assignedUserId}\`);
      res.json({ message: 'Leads assigned successfully' });`;
server = server.replace(bulkAssignLogTarget, bulkAssignLogNew);

// 3. Add User Deletion
const userDeleteRoute = `
  app.delete('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    try {
      if (req.user.id === Number(req.params.id)) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }
      await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));
      await logAudit(req.user.id, 'User Deletion', \`Deleted user ID \${req.params.id}\`);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });
`;
server = server.replace("  // Get all users", userDeleteRoute + "\n  // Get all users");

// 4. Log logins
const loginLogTarget = "res.json({ token, user: { id: user.id, username: user.username, role: user.role } });";
const loginLogNew = `await logAudit(user.id, 'Login', 'User logged in successfully');
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });`;
server = server.replace(loginLogTarget, loginLogNew);

// 5. Password Reset & Recovery
const pwResetRoutes = `
  // Generate Reset Token (Mock email)
  app.post('/api/users/forgot-password', async (req, res) => {
    try {
      const { username } = req.body;
      const user = await db.select().from(schema.users).where(eq(schema.users.username, username)).then(r => r[0]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      
      await db.update(schema.users).set({ resetToken, resetTokenExpiry }).where(eq(schema.users.id, user.id));
      
      await logAudit(user.id, 'Password Reset Requested', 'Generated reset token');
      
      // In a real app, send this via email. We return it for the UI to show.
      res.json({ message: 'Reset token generated', resetToken });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Reset Password
  app.post('/api/users/reset-password', async (req, res) => {
    try {
      const { username, resetToken, newPassword } = req.body;
      const user = await db.select().from(schema.users).where(eq(schema.users.username, username)).then(r => r[0]);
      
      if (!user || user.resetToken !== resetToken || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(schema.users).set({ 
        passwordHash, 
        resetToken: null, 
        resetTokenExpiry: null 
      }).where(eq(schema.users.id, user.id));
      
      await logAudit(user.id, 'Password Reset', 'Password reset successfully completed');
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });
`;
server = server.replace("  // Get current user profile", pwResetRoutes + "\n  // Get current user profile");

// 6. Update authenticateToken and /api/me to include exp
// We'll pass exp along in req.user
const verifyRegex = /jwt\.verify\(token, JWT_SECRET, async \(err: any, decodedUser: any\) => \{[\s\S]*?req\.user = \{ id: dbUser\.id, username: dbUser\.username, role: dbUser\.role \};/;
const newVerify = `jwt.verify(token, JWT_SECRET, async (err: any, decodedUser: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      try {
        const dbUser = await db.select().from(schema.users).where(eq(schema.users.id, decodedUser.id)).then(res => res[0] || null);
        if (!dbUser || dbUser.username !== decodedUser.username) {
          return res.status(401).json({ error: 'User invalid or deleted' });
        }
        // Update req.user with latest DB state, include exp from token
        req.user = { id: dbUser.id, username: dbUser.username, role: dbUser.role, exp: decodedUser.exp };`;
server = server.replace(verifyRegex, newVerify);

// 7. Session Refresh Endpoint
const refreshEndpoint = `
  app.post('/api/users/refresh', authenticateToken, (req: any, res: Response) => {
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, role: req.user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ success: true, token });
  });
`;
server = server.replace("  // Logout endpoint", refreshEndpoint + "\n  // Logout endpoint");


fs.writeFileSync('server.ts', server);
console.log('Patched server.ts successfully');

