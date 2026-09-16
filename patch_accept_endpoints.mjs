import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

const acceptEndpoints = `
  // Technician Accept Lead
  app.post('/api/leads/:id/accept-tech', authenticateToken, requireRole(['Technician', 'Admin']), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const leadResult = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id)));
      const lead = leadResult[0];
      
      if (!lead || lead.pendingTechId !== userId) {
        return res.status(403).json({ error: 'Not authorized or lead no longer pending for you.' });
      }
      
      await db.update(schema.leads).set({
        assignedUserId: userId,
        pendingTechId: null,
        techAssignmentStatus: 'Accepted'
      }).where(eq(schema.leads.id, Number(id)));
      
      await logAudit(userId, 'Technician Assignment', \`Accepted lead ID \${id}\`, Number(id));
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to accept lead' });
    }
  });

  // Technician Decline Lead
  app.post('/api/leads/:id/decline-tech', authenticateToken, requireRole(['Technician', 'Admin']), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const leadResult = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id)));
      const lead = leadResult[0];
      
      if (!lead || lead.pendingTechId !== userId) {
        return res.status(403).json({ error: 'Not authorized or lead no longer pending for you.' });
      }
      
      const declinedArr = lead.declinedTechIds ? JSON.parse(lead.declinedTechIds) : [];
      declinedArr.push(userId);
      
      // Auto-assign to next tech
      const techs = await db.select().from(schema.users).where(eq(schema.users.role, 'Technician'));
      let bestTech = null;
      let minWorkload = Infinity;
      
      for (const tech of techs) {
        if (declinedArr.includes(tech.id)) continue; 
        
        const workloadResult = await db.select({ count: sql\`count(*)\`.mapWith(Number) })
          .from(schema.leads)
          .where(eq(schema.leads.assignedUserId, tech.id));
        const count = workloadResult[0].count;
        
        let score = count;
        if (score < minWorkload) {
          minWorkload = score;
          bestTech = tech;
        }
      }
      
      let nextPendingId = null;
      let newStatus = 'Declined';
      
      if (bestTech) {
        nextPendingId = bestTech.id;
        newStatus = 'Pending';
        
        await db.insert(schema.notifications).values({
          userId: bestTech.id,
          title: 'New Lead Assignment',
          message: \`You have been selected for a new task: \${lead.clientName}\`
        });
      }
      
      await db.update(schema.leads).set({
        pendingTechId: nextPendingId,
        techAssignmentStatus: newStatus,
        declinedTechIds: JSON.stringify(declinedArr)
      }).where(eq(schema.leads.id, Number(id)));
      
      await logAudit(userId, 'Technician Assignment', \`Declined lead ID \${id}\`, Number(id));
      
      res.json({ success: true, reassigned: !!bestTech });
    } catch (e) {
      res.status(500).json({ error: 'Failed to decline lead' });
    }
  });

  // Export Leads JSON Backup
`;

code = code.replace("  // Export Leads JSON Backup", acceptEndpoints);
fs.writeFileSync('server.ts', code);
