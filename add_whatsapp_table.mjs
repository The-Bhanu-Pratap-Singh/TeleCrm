import fs from 'fs';
let schema = fs.readFileSync('src/db/schema.ts', 'utf-8');

if (!schema.includes('whatsappMessages')) {
  const tableCode = `
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender').notNull(), // 'user' or 'lead'
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  lead: one(leads, {
    fields: [whatsappMessages.leadId],
    references: [leads.id],
  }),
}));
`;
  // Insert before usersRelations
  schema = schema.replace('export const usersRelations', tableCode + '\nexport const usersRelations');
  
  // Also add whatsappMessages to leadsRelations
  schema = schema.replace('activityLogs: many(activityLogs),', 'activityLogs: many(activityLogs),\n  whatsappMessages: many(whatsappMessages),');
  
  fs.writeFileSync('src/db/schema.ts', schema);
  console.log('Added whatsappMessages to schema');
}
