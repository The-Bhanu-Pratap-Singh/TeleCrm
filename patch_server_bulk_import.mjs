import fs from 'fs';
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf-8');

const importLogic = `
  // Bulk Import Leads
  app.post('/api/leads/bulk-import', authenticateToken, requireRole(['Admin', 'Social Media Manager']), async (req: any, res) => {
    const { leads } = req.body;
    try {
      db.exec('BEGIN TRANSACTION');
      const stmt = db.prepare(\`
        INSERT INTO leads (
          clientName, contact, requiredProduct, quantity, price, 
          status, notes, assignedUserId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      \`);
      const logStmt = db.prepare('INSERT INTO activity_logs (userId, action, leadId, details) VALUES (?, ?, ?, ?)');

      for (const lead of leads) {
        if (!lead.clientName && !lead.contact) continue; // skip totally empty rows
        
        let clientName = lead.clientName || 'Unknown Import';
        let contact = lead.contact || '';
        let status = lead.status || 'New';
        let notesArr = [];
        if (lead.notes) {
           notesArr.push({ text: lead.notes, timestamp: new Date().toISOString(), author: req.user.username || 'System' });
        }

        const result = stmt.run(
          clientName, 
          contact, 
          lead.requiredProduct || '', 
          lead.quantity || '', 
          lead.price || '', 
          status, 
          JSON.stringify(notesArr),
          req.user.id
        );
        
        logStmt.run(req.user.id, 'Imported Lead', result.lastInsertRowid, \`Imported lead via CSV bulk upload\`);
      }

      db.exec('COMMIT');
      res.json({ success: true, count: leads.length });
    } catch (error) {
      db.exec('ROLLBACK');
      console.error(error);
      res.status(500).json({ error: 'Failed to import leads' });
    }
  });
`;

if (!code.includes('/api/leads/bulk-import')) {
    code = code.replace('  // Update Lead', importLogic + '\n  // Update Lead');
    fs.writeFileSync(file, code);
    console.log('Patched server import logic');
}
