import fs from 'fs';
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf-8');

const insertCode = `
  // Add Quick Note
  app.post('/api/leads/:id/note', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { note } = req.body;
    try {
      if (!note || note.trim() === '') {
        return res.status(400).json({ error: 'Note cannot be empty' });
      }
      
      const lead = db.prepare('SELECT clientName, notes FROM leads WHERE id = ?').get(id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      
      db.exec('BEGIN TRANSACTION');
      
      // We can also optionally append to the lead's JSON notes
      let currentNotes = [];
      try {
        currentNotes = JSON.parse(lead.notes || '[]');
      } catch (e) {}
      currentNotes.push(note);
      
      db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(JSON.stringify(currentNotes), id);
      
      db.prepare('INSERT INTO activity_logs (userId, action, leadId, details) VALUES (?, ?, ?, ?)').run(
        req.user.id,
        'Added Note',
        id,
        note
      );
      
      db.exec('COMMIT');
      res.json({ success: true });
    } catch (error) {
      db.exec('ROLLBACK');
      console.error(error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  });
`;

if (!code.includes('/api/leads/:id/note')) {
    code = code.replace('  // Update Lead', insertCode + '\n  // Update Lead');
    fs.writeFileSync(file, code);
    console.log('Patched server.ts');
} else {
    console.log('Already patched');
}
