import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

const newEndpoints = `
  // Import Leads JSON Backup
  app.post('/api/leads/import-json', authenticateToken, requireRole(['Admin']), express.json({ limit: '50mb' }), async (req: any, res: Response) => {
    try {
      const leads = req.body;
      if (!Array.isArray(leads)) return res.status(400).json({ error: 'Invalid JSON format. Expected an array of leads.' });
      
      let insertedCount = 0;
      await db.transaction(async (tx) => {
        for (const l of leads) {
          const existing = await tx.select().from(schema.leads).where(eq(schema.leads.id, l.id));
          if (existing.length === 0) {
            await tx.insert(schema.leads).values({
              id: l.id,
              clientName: l.clientName,
              contact: l.contact,
              address: l.address,
              assignedUserId: l.assignedUserId,
              requiredProduct: l.requiredProduct,
              quantity: l.quantity,
              price: l.price,
              notes: JSON.stringify(l.notes || []),
              nextFollowUp: l.nextFollowUp,
              visitSchedule: l.visitSchedule,
              installationSchedule: l.installationSchedule,
              actualInstallDate: l.actualInstallDate,
              status: l.status,
              priority: l.priority,
              email: l.email,
              tags: typeof l.tags === 'string' ? l.tags : JSON.stringify(l.tags || []),
              createdAt: l.createdAt ? new Date(l.createdAt) : undefined,
              updatedAt: l.updatedAt ? new Date(l.updatedAt) : undefined,
              isArchived: l.isArchived,
            });
            insertedCount++;
          }
        }
      });
      
      res.json({ success: true, count: insertedCount });
    } catch (e) {
      console.error('Import error:', e);
      res.status(500).json({ error: 'Failed to import backup' });
    }
  });

  // Database Status Hash
  app.get('/api/leads/status-hash', authenticateToken, requireRole(['Admin']), async (req: any, res: Response) => {
    try {
      const result = await db.select({
        count: sql\`count(*)\`.mapWith(Number),
        maxId: sql\`max(\${schema.leads.id})\`.mapWith(Number)
      }).from(schema.leads);
      
      const count = result[0]?.count || 0;
      const maxId = result[0]?.maxId || 0;
      const hash = \`\${count}-\${maxId}\`;
      
      res.json({ hash, count });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to get status hash' });
    }
  });

  // Get Leads`;

code = code.replace("  // Get Leads", newEndpoints);
fs.writeFileSync('server.ts', code);
