import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  resetToken: text('reset_token'),
  resetTokenExpiry: timestamp('reset_token_expiry'),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  clientName: text('client_name').notNull(),
  contact: text('contact').notNull(),
  address: text('address'),
  assignedUserId: integer('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  requiredProduct: text('required_product'),
  quantity: text('quantity'),
  price: text('price'),
  notes: text('notes'),
  nextFollowUp: text('next_follow_up'),
  visitSchedule: text('visit_schedule'),
  installationSchedule: text('installation_schedule'),
  actualInstallDate: text('actual_install_date'),
  status: text('status'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  leadId: integer('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  punchIn: text('punch_in').notNull(),
  punchOut: text('punch_out'),
  notes: text('notes'),
}, (t) => [
  unique().on(t.userId, t.date)
]);

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  text: text('text').notNull(),
  completed: integer('completed').default(0),
});

export const pipelineStages = pgTable('pipeline_stages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  orderIndex: integer('order_index').notNull(),
});


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
