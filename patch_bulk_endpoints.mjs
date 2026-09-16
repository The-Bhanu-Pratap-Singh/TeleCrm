import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

const replacement = `  // Bulk Update Leads
  app.post('/api/leads/bulk-update', authenticateToken, async (req: any, res: Response) => {
    try {
      const { leadIds, updates } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'No lead IDs provided.' });
      }
      
      const { status, assignedUserId, ...otherUpdates } = updates;
      
      // We process them one by one to trigger the same auto-assign or notification logic
      // However, for simplicity and performance, we'll just do a standard bulk update and if status triggers scheduling,
      // we can reuse a simplified version. But since they want simple batch assignment, let's just do it directly.
      let updateData = { ...otherUpdates };
      if (status) updateData.status = status;
      if (assignedUserId !== undefined) {
         updateData.assignedUserId = assignedUserId;
         // Clear pending if manually reassigned
         updateData.pendingTechId = null;
         updateData.techAssignmentStatus = assignedUserId ? 'Accepted' : null;
      }
      
      await db.update(schema.leads).set(updateData).where(inArray(schema.leads.id, leadIds));
      
      await logAudit(req.user.id, 'Bulk Update', \`Updated \${leadIds.length} leads\`);
      
      res.json({ success: true, count: leadIds.length });
    } catch (e) {
      console.error('Bulk update error', e);
      res.status(500).json({ error: 'Failed to bulk update leads' });
    }
  });

  // Get Leads`;

code = code.replace("  // Get Leads", replacement);
fs.writeFileSync('server.ts', code);
