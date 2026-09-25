import { relations } from 'drizzle-orm';
import { int, mysqlTable, text, varchar, timestamp, unique } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  uid: varchar('uid', { length: 255 }).unique(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  resetToken: text('reset_token'),
  resetTokenExpiry: timestamp('reset_token_expiry'),
  role: varchar('role', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isArchived: int('is_archived').default(0),
});

export const leads = mysqlTable('leads', {
  id: int('id').autoincrement().primaryKey(),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 255 }).notNull(),
  address: text('address'),
  assignedUserId: int('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  requiredProduct: text('required_product'),
  quantity: varchar('quantity', { length: 100 }),
  price: varchar('price', { length: 100 }),
  notes: text('notes'),
  nextFollowUp: varchar('next_follow_up', { length: 100 }),
  visitSchedule: varchar('visit_schedule', { length: 100 }),
  installationSchedule: varchar('installation_schedule', { length: 100 }),
  actualInstallDate: varchar('actual_install_date', { length: 100 }),
  status: varchar('status', { length: 100 }),
  priority: varchar('priority', { length: 50 }).default('Medium'),
  email: varchar('email', { length: 255 }),
  tags: text('tags'),
  
  // Tech Assignment Workflow
  pendingTechId: int('pending_tech_id').references(() => users.id, { onDelete: 'set null' }),
  techAssignmentStatus: varchar('tech_assignment_status', { length: 50 }),
  declinedTechIds: text('declined_tech_ids'),
  techAssignedAt: timestamp('tech_assigned_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isArchived: int('is_archived').default(0),
});

export const activityLogs = mysqlTable('activity_logs', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 255 }).notNull(),
  leadId: int('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isArchived: int('is_archived').default(0),
});

export const attendance = mysqlTable('attendance', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: varchar('date', { length: 50 }).notNull(),
  punchIn: varchar('punch_in', { length: 100 }).notNull(),
  punchOut: varchar('punch_out', { length: 100 }),
  notes: text('notes'),
}, (t) => [
  unique('attendance_user_date_idx').on(t.userId, t.date)
]);

export const tasks = mysqlTable('tasks', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: varchar('date', { length: 50 }).notNull(),
  text: text('text').notNull(),
  completed: int('completed').default(0),
});

export const pipelineStages = mysqlTable('pipeline_stages', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  orderIndex: int('order_index').notNull(),
});

export const whatsappMessages = mysqlTable('whatsapp_messages', {
  id: int('id').autoincrement().primaryKey(),
  leadId: int('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  sender: varchar('sender', { length: 50 }).notNull(),
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const chatMessages = mysqlTable('chat_messages', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = mysqlTable('notifications', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  read: int('read').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  lead: one(leads, {
    fields: [whatsappMessages.leadId],
    references: [leads.id],
  }),
}));

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

export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  activityLogs: many(activityLogs),
  whatsappMessages: many(whatsappMessages),
  attendance: many(attendance),
  tasks: many(tasks),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [leads.assignedUserId],
    references: [users.id],
  }),
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [activityLogs.leadId],
    references: [leads.id],
  }),
}));
