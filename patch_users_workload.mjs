import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

const oldUsers = `  // Get all users
  app.get('/api/users', authenticateToken, async (req, res) => {
    try {
      const users = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role
      }).from(schema.users);
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });`;

const newUsers = `  // Get all users
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    try {
      const users = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role
      }).from(schema.users);
      
      if (req.user.role === 'Admin') {
         const workloads = await db.select({
             assignedUserId: schema.leads.assignedUserId,
             pendingTechId: schema.leads.pendingTechId,
             techAssignmentStatus: schema.leads.techAssignmentStatus,
         }).from(schema.leads).where(eq(schema.leads.isArchived, 0));
         
         const usersWithWorkload = users.map(u => {
            if (u.role === 'Technician') {
               const assigned = workloads.filter(w => w.assignedUserId === u.id && ['Accepted', null, undefined].includes(w.techAssignmentStatus)).length;
               const pending = workloads.filter(w => w.pendingTechId === u.id && w.techAssignmentStatus === 'Pending').length;
               return { ...u, assignedCount: assigned, pendingCount: pending };
            }
            return u;
         });
         return res.json(usersWithWorkload);
      }
      
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });`;

code = code.replace(oldUsers, newUsers);
fs.writeFileSync('server.ts', code);
