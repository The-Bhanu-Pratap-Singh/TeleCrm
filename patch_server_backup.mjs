import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf-8');

const backupEndpoint = `
  // Export Leads JSON Backup
  app.get('/api/leads/export-json', authenticateToken, requireRole(['Admin']), async (req: any, res: Response) => {
    try {
      const allLeads = await db.select().from(schema.leads);
      // Let's parse JSON notes and tags for a cleaner export
      const parsedLeads = allLeads.map(l => ({
        ...l,
        notes: JSON.parse(l.notes || '[]'),
        tags: typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : l.tags || []
      }));
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="leads-backup.json"');
      res.send(JSON.stringify(parsedLeads, null, 2));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to export backup' });
    }
  });

  // Get Leads`;

serverCode = serverCode.replace("  // Get Leads", backupEndpoint);

fs.writeFileSync('server.ts', serverCode);
