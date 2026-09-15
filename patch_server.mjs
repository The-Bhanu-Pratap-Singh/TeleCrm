import fs from 'fs';

let server = fs.readFileSync('server.ts', 'utf-8');

const whatsappRoutes = `
  // Get WhatsApp Messages for Lead
  app.get('/api/leads/:id/whatsapp', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const messages = await db.select()
        .from(schema.whatsappMessages)
        .where(eq(schema.whatsappMessages.leadId, Number(id)))
        .orderBy(asc(schema.whatsappMessages.timestamp));
      res.json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch WhatsApp messages' });
    }
  });

  // Post WhatsApp Message (Mock sending/receiving)
  app.post('/api/leads/:id/whatsapp', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { message, sender } = req.body;
    try {
      const newMessage = await db.insert(schema.whatsappMessages)
        .values({
          leadId: Number(id),
          sender: sender || 'user',
          message: message
        })
        .returning()
        .then(res => res[0] || null);
        
      res.json(newMessage);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
  });
`;

if (!server.includes('/api/leads/:id/whatsapp')) {
  server = server.replace('  // ----- Attendance & Tasks API -----', whatsappRoutes + '\n  // ----- Attendance & Tasks API -----');
  fs.writeFileSync('server.ts', server);
  console.log('Added WhatsApp endpoints');
} else {
  console.log('Endpoints already exist');
}
