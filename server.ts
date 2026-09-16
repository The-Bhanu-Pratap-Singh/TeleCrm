import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcryptjs';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Drizzle ORM Imports
import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';
import { eq, inArray, and, or, desc, asc, sql, getTableColumns } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_telecrm';

async function startServer() {

  // Automated Cleanup Policy for Leads
  const runCleanup = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const res = await db.update(schema.leads)
        .set({ isArchived: 1 })
        .where(
          and(
            inArray(schema.leads.status, ['Closed-Lost', 'Inactive']),
            lt(schema.leads.updatedAt, thirtyDaysAgo),
            eq(schema.leads.isArchived, 0)
          )
        )
        .returning({ id: schema.leads.id });
        
      if (res.length > 0) {
        console.log("Archived " + res.length + " old leads.");
      }
    } catch (e) {
      console.error('Cleanup policy error:', e);
    }
  };
  
  // Run on start and every hour
  runCleanup();
  setInterval(runCleanup, 60 * 60 * 1000);

  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // ----- Middleware: Auth -----
  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    // Try cookie first, then auth header
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, async (err: any, decodedUser: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      try {
        const dbUser = await db.select().from(schema.users).where(eq(schema.users.id, decodedUser.id)).then(res => res[0] || null);
        if (!dbUser || dbUser.username !== decodedUser.username) {
          return res.status(401).json({ error: 'User invalid or deleted' });
        }
        // Update req.user with latest DB state, include exp from token
        req.user = { id: dbUser.id, username: dbUser.username, role: dbUser.role, exp: decodedUser.exp };
        next();
      } catch (e) {
         return res.status(500).json({ error: 'Server error' });
      }
    });
  };



  const pushNotification = async (userId: number, title: string, message: string, io: any) => {
    try {
      const [notif] = await db.insert(schema.notifications).values({ userId, title, message }).returning();
      if (io) {
        io.to(`user_${userId}`).emit('new_notification', notif);
      }
    } catch (e) {
      console.error('Push Notif Error:', e);
    }
  };

  const logAudit = async (userId, action, details, leadId = null) => {
    try {
      await db.insert(schema.activityLogs).values({
        userId,
        action,
        details,
        leadId
      });
    } catch (e) {
      console.error('Audit log failed', e);
    }
  };

  const requireRole = (roles: string[]) => {
    return (req: any, res: Response, next: NextFunction) => {
      if (!roles.includes(req.user.role) && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  };

  // ----- API Routes -----

  // Login
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await db.select().from(schema.users).where(eq(schema.users.username, username)).then(res => res[0] || null);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Set HTTP-Only Cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      await logAudit(user.id, 'Login', 'User logged in successfully');
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // Generate Reset Token (Mock email)
  app.post('/api/users/forgot-password', async (req, res) => {
    try {
      const { username } = req.body;
      const user = await db.select().from(schema.users).where(eq(schema.users.username, username)).then(r => r[0]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      
      await db.update(schema.users).set({ resetToken, resetTokenExpiry }).where(eq(schema.users.id, user.id));
      
      await logAudit(user.id, 'Password Reset Requested', 'Generated reset token');
      
      // In a real app, send this via email. We return it for the UI to show.
      res.json({ message: 'Reset token generated', resetToken });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Reset Password
  app.post('/api/users/reset-password', async (req, res) => {
    try {
      const { username, resetToken, newPassword } = req.body;
      const user = await db.select().from(schema.users).where(eq(schema.users.username, username)).then(r => r[0]);
      
      if (!user || user.resetToken !== resetToken || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(schema.users).set({ 
        passwordHash, 
        resetToken: null, 
        resetTokenExpiry: null 
      }).where(eq(schema.users.id, user.id));
      
      await logAudit(user.id, 'Password Reset', 'Password reset successfully completed');
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get current user profile
  app.get('/api/me', authenticateToken, async (req: any, res: Response) => {
    res.json(req.user);
  });


  app.post('/api/users/refresh', authenticateToken, (req: any, res: Response) => {
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, role: req.user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ success: true, token });
  });

  // Logout endpoint
  app.post('/api/users/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ success: true });
  });


  app.delete('/api/users/:id', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    try {
      if (req.user.id === Number(req.params.id)) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }
      await db.delete(schema.users).where(eq(schema.users.id, Number(req.params.id)));
      await logAudit(req.user.id, 'User Deletion', `Deleted user ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get all users
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    try {
      const users = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role
      }).from(schema.users);
      
      if (req.user.role === 'Admin') {
         const workloads = await db.select({
             assignedUserId: schema.leads.assignedUserId,
             pendingTechId: schema.leads.pendingTechId,
             techAssignmentStatus: schema.leads.techAssignmentStatus,
         }).from(schema.leads).where(eq(schema.leads.isArchived, 0));
         
         const usersWithWorkload = users.map(u => {
            if (u.role === 'Technician') {
               const assigned = workloads.filter(w => w.assignedUserId === u.id && ['Accepted', null, undefined].includes(w.techAssignmentStatus)).length;
               const pending = workloads.filter(w => w.pendingTechId === u.id && w.techAssignmentStatus === 'Pending').length;
               return { ...u, assignedCount: assigned, pendingCount: pending };
            }
            return u;
         });
         return res.json(usersWithWorkload);
      }
      
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Create a user (Admin only)
  app.post('/api/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { username, password, role } = req.body;
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await db.insert(schema.users)
        .values({ username, passwordHash, role })
        .returning({ id: schema.users.id, username: schema.users.username, role: schema.users.role })
        .then(res => res[0] || null); // .then(res => res[0] || null) for single returned row
      res.json(newUser);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create user. Username might already exist.' });
    }
  });



  // Technician Accept Lead
  app.post('/api/leads/:id/accept-tech', authenticateToken, requireRole(['Technician', 'Admin']), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const leadResult = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id)));
      const lead = leadResult[0];
      
      if (!lead || lead.pendingTechId !== userId) {
        return res.status(403).json({ error: 'Not authorized or lead no longer pending for you.' });
      }
      
      await db.update(schema.leads).set({
        assignedUserId: userId,
        pendingTechId: null,
        techAssignmentStatus: 'Accepted'
      }).where(eq(schema.leads.id, Number(id)));
      
      await logAudit(userId, 'Technician Assignment', `Accepted lead ID ${id}`, Number(id));
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to accept lead' });
    }
  });

  // Technician Decline Lead
  app.post('/api/leads/:id/decline-tech', authenticateToken, requireRole(['Technician', 'Admin']), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const leadResult = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id)));
      const lead = leadResult[0];
      
      if (!lead || lead.pendingTechId !== userId) {
        return res.status(403).json({ error: 'Not authorized or lead no longer pending for you.' });
      }
      
      const declinedArr = lead.declinedTechIds ? JSON.parse(lead.declinedTechIds) : [];
      declinedArr.push(userId);
      
      // Auto-assign to next tech
      const techs = await db.select().from(schema.users).where(eq(schema.users.role, 'Technician'));
      let bestTech = null;
      let minWorkload = Infinity;
      
      for (const tech of techs) {
        if (declinedArr.includes(tech.id)) continue; 
        
        const workloadResult = await db.select({ count: sql`count(*)`.mapWith(Number) })
          .from(schema.leads)
          .where(eq(schema.leads.assignedUserId, tech.id));
        const count = workloadResult[0].count;
        
        let score = count;
        if (score < minWorkload) {
          minWorkload = score;
          bestTech = tech;
        }
      }
      
      let nextPendingId = null;
      let newStatus = 'Declined';
      
      if (bestTech) {
        nextPendingId = bestTech.id;
        newStatus = 'Pending';
        
        await db.insert(schema.notifications).values({
          userId: bestTech.id,
          title: 'New Lead Assignment',
          message: `You have been selected for a new task: ${lead.clientName}`
        });
      }
      
      await db.update(schema.leads).set({
        pendingTechId: nextPendingId,
        techAssignmentStatus: newStatus,
        declinedTechIds: JSON.stringify(declinedArr),
        techAssignedAt: bestTech ? new Date() : null
      }).where(eq(schema.leads.id, Number(id)));
      
      await logAudit(userId, 'Technician Assignment', `Declined lead ID ${id}`, Number(id));
      
      res.json({ success: true, reassigned: !!bestTech });
    } catch (e) {
      res.status(500).json({ error: 'Failed to decline lead' });
    }
  });

  // Export Leads JSON Backup

  app.get('/api/leads/export-json', authenticateToken, requireRole(['Admin']), async (req: any, res: Response) => {
    try {
      const allLeads = await db.select().from(schema.leads);
      // Let's parse JSON notes and tags for a cleaner export
      const parsedLeads = allLeads.map(l => ({
        ...l,
        notes: JSON.parse(l.notes || '[]'),
        tags: typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : l.tags || []
      }));
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="leads-backup.json"');
      res.send(JSON.stringify(parsedLeads, null, 2));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to export backup' });
    }
  });


  // Import Leads JSON Backup
  app.post('/api/leads/import-json', authenticateToken, requireRole(['Admin']), express.json({ limit: '50mb' }), async (req: any, res: Response) => {
    try {
      const leads = req.body;
      if (!Array.isArray(leads)) return res.status(400).json({ error: 'Invalid JSON format. Expected an array of leads.' });
      
      let insertedCount = 0;
      await db.transaction(async (tx) => {
        for (const l of leads) {
          const existing = await tx.select().from(schema.leads).where(eq(schema.leads.id, l.id));
          if (existing.length === 0) {
            await tx.insert(schema.leads).values({
              id: l.id,
              clientName: l.clientName,
              contact: l.contact,
              address: l.address,
              assignedUserId: l.assignedUserId,
              requiredProduct: l.requiredProduct,
              quantity: l.quantity,
              price: l.price,
              notes: JSON.stringify(l.notes || []),
              nextFollowUp: l.nextFollowUp,
              visitSchedule: l.visitSchedule,
              installationSchedule: l.installationSchedule,
              actualInstallDate: l.actualInstallDate,
              status: l.status,
              priority: l.priority,
              email: l.email,
              tags: typeof l.tags === 'string' ? l.tags : JSON.stringify(l.tags || []),
              createdAt: l.createdAt ? new Date(l.createdAt) : undefined,
              updatedAt: l.updatedAt ? new Date(l.updatedAt) : undefined,
              isArchived: l.isArchived,
            });
            insertedCount++;
          }
        }
      });
      
      res.json({ success: true, count: insertedCount });
    } catch (e) {
      console.error('Import error:', e);
      res.status(500).json({ error: 'Failed to import backup' });
    }
  });

  // Database Status Hash
  app.get('/api/leads/status-hash', authenticateToken, requireRole(['Admin']), async (req: any, res: Response) => {
    try {
      const result = await db.select({
        count: sql`count(*)`.mapWith(Number),
        maxId: sql`max(${schema.leads.id})`.mapWith(Number)
      }).from(schema.leads);
      
      const count = result[0]?.count || 0;
      const maxId = result[0]?.maxId || 0;
      const hash = `${count}-${maxId}`;
      
      res.json({ hash, count });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to get status hash' });
    }
  });

  // Bulk Update Leads
  app.post('/api/leads/bulk-update', authenticateToken, async (req: any, res: Response) => {
    try {
      const { leadIds, updates } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'No lead IDs provided.' });
      }
      
      const { status, assignedUserId, ...otherUpdates } = updates;
      
      // We process them one by one to trigger the same auto-assign or notification logic
      // However, for simplicity and performance, we'll just do a standard bulk update and if status triggers scheduling,
      // we can reuse a simplified version. But since they want simple batch assignment, let's just do it directly.
      let updateData = { ...otherUpdates };
      if (status) updateData.status = status;
      if (assignedUserId !== undefined) {
         updateData.assignedUserId = assignedUserId;
         // Clear pending if manually reassigned
         updateData.pendingTechId = null;
         updateData.techAssignmentStatus = assignedUserId ? 'Accepted' : null;
      }
      
      await db.update(schema.leads).set(updateData).where(inArray(schema.leads.id, leadIds));
      
      await logAudit(req.user.id, 'Bulk Update', `Updated ${leadIds.length} leads`);
      
      res.json({ success: true, count: leadIds.length });
    } catch (e) {
      console.error('Bulk update error', e);
      res.status(500).json({ error: 'Failed to bulk update leads' });
    }
  });

  // Get Leads
  app.get('/api/leads', authenticateToken, async (req: any, res) => {
    try {
      const { role, id } = req.user;
      let leads;
      
      const query = db.select({
        ...getTableColumns(schema.leads), // Select all fields from leads
        assignedUserName: schema.users.username // Select username from users as assignedUserName
      }).from(schema.leads).leftJoin(schema.users, eq(schema.leads.assignedUserId, schema.users.id));
      // Filter out archived unless explicitly requested (e.g., query param)
      const includeArchived = req.query.archived === 'true';

      

      let conditions = [];
      if (!includeArchived) {
        conditions.push(eq(schema.leads.isArchived, 0));
      }
      
      if (role === 'Technician') {
        conditions.push(or(
          eq(schema.leads.assignedUserId, id),
          eq(schema.leads.pendingTechId, id)
        ));
      } else if (role !== 'Admin') {
        conditions.push(eq(schema.leads.assignedUserId, id));
      }

      
      let finalQuery = query;
      if (conditions.length > 0) {
        finalQuery = query.where(and(...conditions));
      }
      
      if (role === 'Technician') {
        leads = await finalQuery.orderBy(asc(schema.leads.installationSchedule));
      } else {
        leads = await finalQuery.orderBy(desc(schema.leads.id));
      }

      
      // parse JSON notes
      leads = (leads as any[]).map(l => ({ ...l, notes: JSON.parse(l.notes || '[]'), tags: typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : l.tags || [] }));
      res.json(leads);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  // Create Lead
  app.post('/api/leads', authenticateToken, async (req: any, res) => {
    const {
      clientName, contact, address, assignedUserId, requiredProduct,
      quantity, price, notes, nextFollowUp, visitSchedule,
      installationSchedule, actualInstallDate, status, priority, email, tags
    } = req.body;
    
    try {
      const finalAssignedUserId = assignedUserId || req.user.id;
      const newLead = await db.insert(schema.leads)
        .values({
          clientName, contact, address, assignedUserId: finalAssignedUserId, requiredProduct,
          quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,
          installationSchedule, actualInstallDate, status: status || 'New', priority: priority || 'Medium',
          email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || []), updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .returning({ id: schema.leads.id })
        .then(res => res[0] || null);
      const leadId = newLead.id;

      if (finalAssignedUserId && finalAssignedUserId !== req.user.id) {
        await pushNotification(finalAssignedUserId, 'New Lead Assigned', `You have been assigned a new lead: ${clientName}`, app.get('io'));
      }

      // Log activity
      await db.insert(schema.activityLogs)
        .values({
          userId: req.user.id,
          action: 'Created Lead',
          leadId: leadId,
          details: `Lead ${clientName} created`
        })
        ;

      res.json({ id: leadId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  });


  // Bulk Assign Leads
  app.put('/api/leads/bulk-assign', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    const { leadIds, assignedUserId } = req.body;
    try {
      await db.transaction(async (tx) => {
        for (const id of leadIds) {
          await tx.update(schema.leads)
            .set({ assignedUserId: assignedUserId })
            .where(eq(schema.leads.id, id))
            ;
          
          await tx.insert(schema.activityLogs)
            .values({
              userId: req.user.id,
              action: 'Updated Lead',
              leadId: id,
              details: `Bulk reassigned to user ${assignedUserId}`
            })
            ;
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to bulk assign leads' });
    }
  });

  // Bulk Status Update Leads
  app.put('/api/leads/bulk-status', authenticateToken, async (req: any, res) => {
    const { leadIds, status } = req.body;
    try {
      await db.transaction(async (tx) => {
        for (const id of leadIds) {
          await tx.update(schema.leads)
            .set({ status: status })
            .where(eq(schema.leads.id, id))
            ;
          
          await tx.insert(schema.activityLogs)
            .values({
              userId: req.user.id,
              action: 'Updated Lead Status',
              leadId: id,
              details: `Bulk status updated to ${status}`
            })
            ;
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to bulk update lead status' });
    }
  });

  // Bulk Delete Leads
  app.delete('/api/leads/bulk-delete', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    const { leadIds } = req.body;
    try {
      await db.transaction(async (tx) => {
        for (const id of leadIds) {
          await tx.delete(schema.leads).where(eq(schema.leads.id, id));
          
          await tx.insert(schema.activityLogs)
            .values({
              userId: req.user.id,
              action: 'Deleted Lead',
              leadId: id,
              details: `Bulk deleted lead`
            })
            ;
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to bulk delete leads' });
    }
  });


  // Add Quick Note
  app.post('/api/leads/:id/note', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { note } = req.body;
    try {
      if (!note || note.trim() === '') {
        return res.status(400).json({ error: 'Note cannot be empty' });
      }
      
      const lead = await db.select({ clientName: schema.leads.clientName, notes: schema.leads.notes })
        .from(schema.leads)
        .where(eq(schema.leads.id, Number(id)))
        .then(res => res[0] || null);

      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      
      await db.transaction(async (tx) => {
        // We can also optionally append to the lead's JSON notes
        let currentNotes = [];
        try {
          currentNotes = JSON.parse(lead.notes || '[]');
        } catch (e) {
          console.warn('Failed to parse existing notes, initializing as empty array.');
        }
        
        const user = await tx.select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.id, req.user.id))
          .then(res => res[0] || null);

        currentNotes.push({
          text: note,
          timestamp: new Date().toISOString(),
          author: user ? user.username : 'Unknown'
        });
        
        await tx.update(schema.leads)
          .set({ notes: JSON.stringify(currentNotes) })
          .where(eq(schema.leads.id, Number(id)))
          ;
        
        await tx.insert(schema.activityLogs)
          .values({
            userId: req.user.id,
            action: 'Added Note',
            leadId: Number(id),
            details: note
          })
          ;
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  });


  // Bulk Import Leads
  app.post('/api/leads/bulk-import', authenticateToken, requireRole(['Admin', 'Social Media Manager']), async (req: any, res) => {
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
                details: `Imported lead via CSV bulk upload`
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
  });

  // Update Lead
  app.put('/api/leads/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const {
      clientName, contact, address, assignedUserId, requiredProduct,
      quantity, price, notes, nextFollowUp, visitSchedule,
      installationSchedule, actualInstallDate, status, priority, email, tags
    } = req.body;
    
    try {
      // Access Control
      const existingLead = await db.select({
          assignedUserId: schema.leads.assignedUserId,
          clientName: schema.leads.clientName,
          status: schema.leads.status,
          techAssignmentStatus: schema.leads.techAssignmentStatus,
          declinedTechIds: schema.leads.declinedTechIds,
          address: schema.leads.address
        }).from(schema.leads).where(eq(schema.leads.id, Number(id))).then(res => res[0] || null);

      if (!existingLead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      if (req.user.role !== 'Admin' && existingLead.assignedUserId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to modify this lead. It is assigned to someone else.' });
      }

      // Check if status changed to a scheduling stage
      const schedulingStages = ["Scheduled", "Installed", "Site Visit Scheduled", "Installation Scheduled"];
      let newPendingTechId = undefined;
      let newTechAssignmentStatus = undefined;
      let newTechAssignedAt = undefined;
      
      if (status && status !== existingLead.status && schedulingStages.includes(status) && (!existingLead.techAssignmentStatus || existingLead.techAssignmentStatus === 'Declined')) {
        // Auto-assign algorithm
        const techs = await db.select().from(schema.users).where(eq(schema.users.role, 'Technician'));
        
        if (techs.length > 0) {
          let bestTech = null;
          let minWorkload = Infinity;
          
          const declinedArr = existingLead.declinedTechIds ? JSON.parse(existingLead.declinedTechIds) : [];
          
          for (const tech of techs) {
            if (declinedArr.includes(tech.id)) continue; 
            
            const workloadResult = await db.select({ count: sql`count(*)`.mapWith(Number) })
              .from(schema.leads)
              .where(eq(schema.leads.assignedUserId, tech.id));
              
            const count = workloadResult[0].count;
            
            let score = count;
            const techName = tech.username.toLowerCase();
            const addr = (address || existingLead.address || '').toLowerCase();
            if (addr && addr.includes(techName)) {
               score -= 10; 
            }
            
            if (score < minWorkload) {
              minWorkload = score;
              bestTech = tech;
            }
          }
          
          if (bestTech) {
            newPendingTechId = bestTech.id;
            newTechAssignmentStatus = 'Pending';
            newTechAssignedAt = new Date();
            
            await db.insert(schema.notifications).values({
              userId: bestTech.id,
              title: 'New Lead Assignment',
              message: `You have been selected for a new task: ${clientName || existingLead.clientName}`
            });
          }
        }
      }

      const updateData = {
        clientName, contact, address, assignedUserId, requiredProduct,
        quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,
        installationSchedule, actualInstallDate, status, priority,
        email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || [])
      };
      
      if (newPendingTechId !== undefined) {
        updateData.pendingTechId = newPendingTechId;
        updateData.techAssignmentStatus = newTechAssignmentStatus;
        updateData.techAssignedAt = newTechAssignedAt;
      }

      await db.update(schema.leads).set(updateData).where(eq(schema.leads.id, Number(id)));

      if (assignedUserId && assignedUserId !== existingLead.assignedUserId && assignedUserId !== req.user.id) {
         await pushNotification(assignedUserId, 'Lead Assigned', `Lead ${clientName || existingLead.clientName} has been assigned to you.`, app.get('io'));
      }


      // Log activity
      await db.insert(schema.activityLogs)
        .values({
          userId: req.user.id,
          action: 'Updated Lead',
          leadId: Number(id),
          details: `Updated details for ${clientName}`
        })
        ;

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });


  // ----- Pipeline Stages API -----
  app.get('/api/stages', authenticateToken, async (req, res) => {
    try {
      const stages = await db.select().from(schema.pipelineStages).orderBy(asc(schema.pipelineStages.orderIndex));
      res.json(stages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch pipeline stages' });
    }
  });

  app.post('/api/stages', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { name } = req.body;
    try {
      const maxOrderQuery = await db.select({ maxOrder: sql<number>`max(${schema.pipelineStages.orderIndex})` }).from(schema.pipelineStages).then(res => res[0] || null);
      const nextOrder = (maxOrderQuery?.maxOrder !== null ? maxOrderQuery?.maxOrder : -1) + 1;
      const newStage = await db.insert(schema.pipelineStages)
        .values({ name, orderIndex: nextOrder })
        .returning({ id: schema.pipelineStages.id, name: schema.pipelineStages.name, orderIndex: schema.pipelineStages.orderIndex })
        .then(res => res[0] || null);
      res.json(newStage);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create stage. Name might already exist.' });
    }
  });

  app.put('/api/stages/reorder', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { stages } = req.body; // Array of { id, orderIndex }
    try {
      await db.transaction(async (tx) => {
        for (const stage of stages) {
          await tx.update(schema.pipelineStages)
            .set({ orderIndex: stage.orderIndex })
            .where(eq(schema.pipelineStages.id, stage.id))
            ;
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to reorder stages' });
    }
  });

  app.put('/api/stages/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      await db.update(schema.pipelineStages)
        .set({ name })
        .where(eq(schema.pipelineStages.id, Number(id)))
        ;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update stage' });
    }
  });

  app.delete('/api/stages/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    try {
      // Prevent deleting if leads are in this stage
      const stage = await db.select({ name: schema.pipelineStages.name })
        .from(schema.pipelineStages)
        .where(eq(schema.pipelineStages.id, Number(id)))
        .then(res => res[0] || null);
      
      if (!stage) return res.status(404).json({ error: 'Stage not found' });
      
      const leadsCountResult = await db.select({ c: sql<number>`count(*)` })
        .from(schema.leads)
        .where(eq(schema.leads.status, stage.name))
        .then(res => res[0] || null);
      
      if ((leadsCountResult?.c || 0) > 0) {
        return res.status(400).json({ error: 'Cannot delete stage containing leads' });
      }
      
      await db.delete(schema.pipelineStages).where(eq(schema.pipelineStages.id, Number(id)));
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete stage' });
    }
  });

  // Get Activity Logs (Admin only)

  app.get('/api/activity', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    try {
      const logs = await db.select({
        id: schema.activityLogs.id,
        action: schema.activityLogs.action,
        details: schema.activityLogs.details,
        createdAt: schema.activityLogs.createdAt,
        username: schema.users.username,
        leadName: schema.leads.clientName
      }).from(schema.activityLogs)
        .leftJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
        .leftJoin(schema.leads, eq(schema.activityLogs.leadId, schema.leads.id))
        .orderBy(desc(schema.activityLogs.id))
        .limit(100)
        ;
      res.json(logs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  // Gemini AI - Generate WhatsApp Script
  app.post('/api/generate-script', authenticateToken, async (req: any, res) => {
    const { clientName, requiredProduct, quantity, price, lastNote } = req.body;
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert sales assistant for Hanger Hub Ceiling Hangers. 
Generate a concise, friendly, and persuasive WhatsApp follow-up message for a client.

Client details:
- Name: ${clientName || 'Valued Customer'}
- Product interested in: ${quantity || 'some'} of ${requiredProduct || 'Ceiling Hangers'}
- Price discussed: ${price || 'our best offer'}
- Last interaction note: ${lastNote || 'None'}

The message should be polite, action-oriented, use minimal appropriate emojis, and encourage them to schedule a visit or installation.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      res.json({ script: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate script' });
    }
  });

  

  // Get WhatsApp Messages for Lead
  app.get('/api/leads/:id/whatsapp', authenticateToken, async (req: any, res) => {
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
  app.post('/api/leads/:id/whatsapp', authenticateToken, async (req: any, res) => {
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

  // ----- Attendance & Tasks API -----
  
  // Punch In (called automatically on dashboard load or manual button)
  app.post('/api/attendance/punch-in', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    try {
      const existing = await db.select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        .then(res => res[0] || null);
      if (existing) {
        return res.json({ success: true, message: 'Already punched in today', data: existing });
      }
      
      const punchInTime = new Date().toISOString();
      const newRecord = await db.insert(schema.attendance)
        .values({ userId, date, punchIn: punchInTime })
        .returning() // Return all fields of the newly inserted row
        .then(res => res[0] || null);
      
      res.json({ success: true, data: newRecord });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to punch in' });
    }
  });

  // Punch Out
  app.post('/api/attendance/punch-out', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    const punchOutTime = new Date().toISOString();
    try {
      await db.update(schema.attendance)
        .set({ punchOut: punchOutTime })
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        ;
      
      const updatedRecord = await db.select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        .then(res => res[0] || null);
      res.json({ success: true, data: updatedRecord });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to punch out' });
    }
  });

  // Save Daily Notes
  app.post('/api/attendance/notes', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    const { notes } = req.body;
    try {
      await db.update(schema.attendance)
        .set({ notes: notes })
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        ;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save notes' });
    }
  });

  // Get Today's Attendance & Tasks for Current User
  app.get('/api/attendance/today', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    try {
      const attendance = await db.select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        .then(res => res[0] || null);
      const tasks = await db.select()
        .from(schema.tasks)
        .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.date, date)))
        .orderBy(asc(schema.tasks.id))
        ;
      res.json({ attendance, tasks });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch attendance info' });
    }
  });

  // Get All Team Attendance for Today (Admin)
  app.get('/api/attendance/all', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      // Get all users except admin (or include admin too, up to preference)
      const allUsers = await db.select({
          id: schema.users.id,
          username: schema.users.username,
          role: schema.users.role
        }).from(schema.users);
      
      // Get all attendance records for today
      const attendanceRecords = await db.select()
        .from(schema.attendance)
        .where(eq(schema.attendance.date, date))
        ;
      
      // Get all tasks for today
      const tasks = await db.select()
        .from(schema.tasks)
        .where(eq(schema.tasks.date, date))
        ;
      
      const result = allUsers.map((user: any) => {
        const userAttendance = attendanceRecords.find((a: any) => a.userId === user.id);
        const userTasks = tasks.filter((t: any) => t.userId === user.id);
        const completedTasks = userTasks.filter((t: any) => t.completed).length;
        
        return {
          user,
          attendance: userAttendance || null,
          totalTasks: userTasks.length,
          completedTasks
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch team attendance' });
    }
  });

  // Create Task
  app.post('/api/tasks', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    const { text } = req.body;
    try {
      const newTask = await db.insert(schema.tasks)
        .values({ userId, date, text, completed: 0 })
        .returning() // Return all fields
        .then(res => res[0] || null);
      res.json(newTask);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update Task (Toggle)
  app.put('/api/tasks/:id', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { completed } = req.body;
    try {
      await db.update(schema.tasks)
        .set({ completed: completed ? 1 : 0 })
        .where(and(eq(schema.tasks.id, Number(id)), eq(schema.tasks.userId, userId)))
        ;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });
  
  // Delete Task
  app.delete('/api/tasks/:id', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
      await db.delete(schema.tasks)
        .where(and(eq(schema.tasks.id, Number(id)), eq(schema.tasks.userId, userId)))
        ;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });



  // --- Chat API ---
  app.get('/api/chat', authenticateToken, async (req: any, res: Response) => {
    try {
      const messages = await db
        .select({
          id: schema.chatMessages.id,
          message: schema.chatMessages.message,
          createdAt: schema.chatMessages.createdAt,
          user: {
            id: schema.users.id,
            username: schema.users.username,
            role: schema.users.role,
          }
        })
        .from(schema.chatMessages)
        .innerJoin(schema.users, eq(schema.chatMessages.userId, schema.users.id))
        .orderBy(desc(schema.chatMessages.createdAt))
        .limit(50);
      res.json(messages.reverse());
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch chat' });
    }
  });

  // --- Notifications API ---
  app.get('/api/notifications', authenticateToken, async (req: any, res: Response) => {
    try {
      const notifs = await db
        .select()
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, req.user.id), eq(schema.notifications.read, 0)))
        .orderBy(desc(schema.notifications.createdAt));
      res.json(notifs);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.post('/api/notifications/read', authenticateToken, async (req: any, res: Response) => {
    try {
      await db.update(schema.notifications)
        .set({ read: 1 })
        .where(eq(schema.notifications.userId, req.user.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to mark read' });
    }
  });

  // ----- Vite Middleware for Dev or Static Files for Prod -----
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Socket Auth Middleware
  io.use((socket, next) => {
    // Parse cookies from headers
    const cookieHeader = socket.request.headers.cookie;
    if (!cookieHeader) return next(new Error('Authentication error: No cookies'));
    
    // Quick parser for token
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    if (!token) return next(new Error('Authentication error: No token'));
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      socket.data.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    
    // Join personal room for notifications
    socket.join(`user_${user.id}`);

    socket.on('send_chat_message', async (data) => {
      try {
        const [inserted] = await db.insert(schema.chatMessages).values({
          userId: user.id,
          message: data.message,
        }).returning();

        // Broadcast to all
        io.emit('new_chat_message', {
          id: inserted.id,
          message: inserted.message,
          createdAt: inserted.createdAt,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          }
        });
      } catch (e) {
        console.error('Chat send error:', e);
      }
    });

    socket.on('disconnect', () => {
      // Handle disconnect if needed
    });
  });

  // Helper to send notifications from HTTP routes
  app.set('io', io);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);