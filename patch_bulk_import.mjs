import fs from 'fs';

// --- patch server.ts ---
let serverCode = fs.readFileSync('server.ts', 'utf-8');

const oldBulkImport = /app\.post\('\/api\/leads\/bulk-import'[\s\S]*?res\.json\(\{ success: true, count: leads\.length \}\);[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Failed to import leads' \}\);\s*\}\s*\}\);/g;

const newBulkImport = `app.post('/api/leads/bulk-import', authenticateToken, requireRole(['Admin', 'Social Media Manager']), async (req: any, res) => {
    const { leads } = req.body;
    let importedCount = 0;
    let skippedCount = 0;
    try {
      await db.transaction(async (tx) => {
        for (const lead of leads) {
          if (!lead.clientName && !lead.contact) continue; // skip totally empty rows
          
          let clientName = lead.clientName || 'Unknown Import';
          let contact = lead.contact ? String(lead.contact).trim() : '';
          
          if (contact) {
            const existing = await tx.select({ id: schema.leads.id }).from(schema.leads).where(eq(schema.leads.contact, contact)).then(r => r[0] || null);
            if (existing) {
              skippedCount++;
              continue;
            }
          }
          
          let status = lead.status || 'New';
          let notesArr = [];
          if (lead.notes) {
             notesArr.push({ text: lead.notes, timestamp: new Date().toISOString(), author: req.user.username || 'System' });
          }

          const newLead = await tx.insert(schema.leads)
            .values({
              clientName, 
              contact, 
              requiredProduct: lead.requiredProduct || '', 
              quantity: lead.quantity || '', 
              price: lead.price || '', 
              status, 
              notes: JSON.stringify(notesArr),
              assignedUserId: req.user.id
            })
            .returning({ id: schema.leads.id })
            .then(res => res[0] || null);
          
          if (newLead) {
            await tx.insert(schema.activityLogs)
              .values({
                userId: req.user.id,
                action: 'Imported Lead',
                leadId: newLead.id,
                details: \`Imported lead via CSV bulk upload\`
              });
            importedCount++;
          }
        }
      });

      res.json({ success: true, count: importedCount, skipped: skippedCount });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to import leads' });
    }
  });`;

serverCode = serverCode.replace(oldBulkImport, newBulkImport);
fs.writeFileSync('server.ts', serverCode);

// --- patch LeadsList.tsx ---
let frontendCode = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const oldFrontendImport = /if \(res\.ok\) \{\s*alert\('Leads imported successfully'\);\s*fetchLeads\(\);\s*\} else \{\s*alert\('Failed to import leads'\);\s*\}/g;

const newFrontendImport = `if (res.ok) {
            const data = await res.json();
            alert(\`Imported \${data.count} leads successfully.\${data.skipped > 0 ? \` Skipped \${data.skipped} duplicate leads (matching mobile numbers).\` : ''}\`);
            fetchLeads();
          } else {
            alert('Failed to import leads');
          }`;

frontendCode = frontendCode.replace(oldFrontendImport, newFrontendImport);
fs.writeFileSync('src/components/LeadsList.tsx', frontendCode);
