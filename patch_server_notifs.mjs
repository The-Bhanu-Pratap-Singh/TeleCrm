import fs from 'fs';
let server = fs.readFileSync('server.ts', 'utf-8');

// Helper to push notification
const notifHelper = `
  const pushNotification = async (userId: number, title: string, message: string, io: any) => {
    try {
      const [notif] = await db.insert(schema.notifications).values({ userId, title, message }).returning();
      if (io) {
        io.to(\`user_\${userId}\`).emit('new_notification', notif);
      }
    } catch (e) {
      console.error('Push Notif Error:', e);
    }
  };
`;
server = server.replace("  const logAudit = async", notifHelper + "\n  const logAudit = async");

// Bulk Assign Notification
const bulkAssignRe = /await logAudit\(req\.user\.id, 'Mass Lead Reassignment', `Reassigned \${leadIds\.length} leads to user ID \${assignedUserId}`\);/g;
server = server.replace(bulkAssignRe, "await logAudit(req.user.id, 'Mass Lead Reassignment', `Reassigned ${leadIds.length} leads to user ID ${assignedUserId}`);\n      if (assignedUserId) { await pushNotification(assignedUserId, 'New Leads Assigned', `You have been assigned ${leadIds.length} new leads in bulk by ${req.user.username}.`, req.app.get('io')); }");

// Single Assign Notification (POST /api/leads)
// Need to find where single lead is inserted with assignedUserId
const singleLeadRe = /const \[lead\] = await tx\.insert\(schema\.leads\)\.values\(\{([^}]*)\}\)\.returning\(\);/g;
// Actually simpler: let's just grep the file for POST /api/leads to see where to inject.
fs.writeFileSync('server.ts', server);
console.log('Patched basic bulk notifications');
