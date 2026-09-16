import { DatabaseSync } from 'node:sqlite';
import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function migrate() {
  const sqliteDb = new DatabaseSync('./telecrm.sqlite');
  
  const users = sqliteDb.prepare('SELECT * FROM users').all() as any[];
  for (const u of users) {
    const existing = await db.select().from(schema.users).where(eq(schema.users.username, u.username));
    if (existing.length === 0) {
      await db.insert(schema.users).values({
        id: u.id,
        username: u.username,
        passwordHash: u.passwordHash,
        role: u.role,
      });
      console.log('Inserted user', u.username);
    }
  }

  const leads = sqliteDb.prepare('SELECT * FROM leads').all() as any[];
  for (const l of leads) {
    const existing = await db.select().from(schema.leads).where(eq(schema.leads.id, l.id));
    if (existing.length === 0) {
      await db.insert(schema.leads).values({
        id: l.id,
        clientName: l.clientName,
        contact: l.contact,
        address: l.address,
        assignedUserId: l.assignedUserId,
        requiredProduct: l.requiredProduct,
        quantity: l.quantity,
        price: l.price,
        notes: l.notes,
        nextFollowUp: l.nextFollowUp,
        visitSchedule: l.visitSchedule,
        installationSchedule: l.installationSchedule,
        actualInstallDate: l.actualInstallDate,
        status: l.status,
        createdAt: new Date(l.createdAt),
      });
      console.log('Inserted lead', l.id);
    }
  }
  
  const logs = sqliteDb.prepare('SELECT * FROM activity_logs').all() as any[];
  for (const l of logs) {
     const existing = await db.select().from(schema.activityLogs).where(eq(schema.activityLogs.id, l.id));
     if (existing.length === 0) {
        await db.insert(schema.activityLogs).values({
           id: l.id,
           userId: l.userId,
           action: l.action,
           leadId: l.leadId,
           details: l.details,
           createdAt: new Date(l.createdAt)
        });
        console.log('Inserted activity log', l.id);
     }
  }
  
  try {
    const wmsgs = sqliteDb.prepare('SELECT * FROM whatsapp_messages').all() as any[];
    for (const msg of wmsgs) {
      const existing = await db.select().from(schema.whatsappMessages).where(eq(schema.whatsappMessages.id, msg.id));
      if (existing.length === 0) {
         await db.insert(schema.whatsappMessages).values({
            id: msg.id,
            leadId: msg.leadId,
            sender: msg.sender,
            message: msg.message,
            timestamp: new Date(msg.timestamp)
         });
         console.log('Inserted whatsapp', msg.id);
      }
    }
  } catch (e) { console.log('No whatsapp_messages table'); }

  try {
    const chats = sqliteDb.prepare('SELECT * FROM chat_messages').all() as any[];
    for (const msg of chats) {
      const existing = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.id, msg.id));
      if (existing.length === 0) {
         await db.insert(schema.chatMessages).values({
            id: msg.id,
            userId: msg.userId,
            message: msg.message,
            createdAt: new Date(msg.createdAt)
         });
         console.log('Inserted chat', msg.id);
      }
    }
  } catch(e) { console.log('No chat_messages'); }
  
  process.exit(0);
}
migrate().catch(console.error);
