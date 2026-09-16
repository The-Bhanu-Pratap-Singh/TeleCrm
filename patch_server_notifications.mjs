import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf-8');

// 1. Lead Creation Notification
const createLeadRe = /const leadId = newLead\.id;\s*\/\/ Log activity\s*await db\.insert\(schema\.activityLogs\)/g;

const newCreateLead = `const leadId = newLead.id;

      if (finalAssignedUserId && finalAssignedUserId !== req.user.id) {
        await pushNotification(finalAssignedUserId, 'New Lead Assigned', \`You have been assigned a new lead: \${clientName}\`, app.get('io'));
      }

      // Log activity
      await db.insert(schema.activityLogs)`;

serverCode = serverCode.replace(createLeadRe, newCreateLead);

// 2. Lead Update Notification
const updateLeadRe = /const existingLead = await db\.select\(\{[\s\S]*?if \(!existingLead\) \{/g;
const newUpdateLead = `const existingLead = await db.select({
          assignedUserId: schema.leads.assignedUserId,
          clientName: schema.leads.clientName
        }).from(schema.leads).where(eq(schema.leads.id, Number(id))).then(res => res[0] || null);

      if (!existingLead) {`;

// Hmm, the regex might be tricky. Let's do simple string replace for Lead Update.
const beforeUpdate = `      await db.update(schema.leads)
        .set({
          clientName, contact, address, assignedUserId, requiredProduct,
          quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,
          installationSchedule, actualInstallDate, status, priority,
          email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])
        })
        .where(eq(schema.leads.id, Number(id)))
        ;`;

const afterUpdate = `      await db.update(schema.leads)
        .set({
          clientName, contact, address, assignedUserId, requiredProduct,
          quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,
          installationSchedule, actualInstallDate, status, priority,
          email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])
        })
        .where(eq(schema.leads.id, Number(id)))
        ;

      if (assignedUserId && assignedUserId !== existingLead.assignedUserId && assignedUserId !== req.user.id) {
         await pushNotification(assignedUserId, 'Lead Assigned', \`Lead \${clientName || existingLead.clientName} has been assigned to you.\`, app.get('io'));
      }
`;

serverCode = serverCode.replace(beforeUpdate, afterUpdate);

fs.writeFileSync('server.ts', serverCode);
