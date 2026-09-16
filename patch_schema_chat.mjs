import fs from 'fs';
let schema = fs.readFileSync('src/db/schema.ts', 'utf-8');

const newTables = `
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: integer('read').default(0).notNull(), // 0 = false, 1 = true
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
`;

schema = schema.replace("export const usersRelations =", newTables + "\nexport const usersRelations =");
fs.writeFileSync('src/db/schema.ts', schema);
console.log('Added chat & notification schemas');
