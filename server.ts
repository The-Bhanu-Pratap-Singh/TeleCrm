import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
import { eq, inArray, and, or, desc, asc, sql, getTableColumns, lt } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_telecrm';

async function startServer() {

  // Automated Cleanup Policy for Leads
  const runCleanup = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await db.update(schema.leads)
        .set({ isArchived: 1 })
        .where(
          and(
            inArray(schema.leads.status, ['Closed-Lost', 'Inactive']),
            lt(schema.leads.updatedAt, thirtyDaysAgo),
            eq(schema.leads.isArchived, 0)
          )
        );
    } catch (e) {
      console.error('Cleanup policy error:', e);
    }
  };
  
  // Run on start and every hour
  runCleanup();
  setInterval(runCleanup, 60 * 60 * 1000);

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Login Brute Force Protection Tracker
  const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

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
      const [resObj] = await db.insert(schema.notifications).values({ userId, title, message });
      const notif = await db.select().from(schema.notifications).where(eq(schema.notifications.id, (resObj as any).insertId)).then((r: any) => r[0]);
      if (io) {
        io.to(`user_${userId}`).emit('new_notification', notif);
      }
    } catch (e) {
      console.error('Push Notif Error:', e);
    }
  };

  const logAudit = async (userId: number | null, action: string, details: string, leadId: number | null = null) => {
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

  // Automated Smart Matching Engine for Technicians
  const findBestTechnician = async (leadAddress: string = '', excludedIds: number[] = []) => {
    try {
      const techs = await db.select().from(schema.users).where(eq(schema.users.role, 'Technician'));
      if (techs.length === 0) return null;

      const todayStr = new Date().toISOString().split('T')[0];
      const todayAttendance = await db.select().from(schema.attendance).where(eq(schema.attendance.date, todayStr));
      
      const workloads = await db.select({
        assignedUserId: schema.leads.assignedUserId,
        pendingTechId: schema.leads.pendingTechId,
        techAssignmentStatus: schema.leads.techAssignmentStatus,
      }).from(schema.leads).where(eq(schema.leads.isArchived, 0));

      let bestTech: any = null;
      let minScore = Infinity;

      for (const tech of techs) {
        if (excludedIds.includes(tech.id)) continue;

        // Base workload: active jobs + pending jobs
        const assignedCount = workloads.filter(w => w.assignedUserId === tech.id && ['Accepted', null, undefined].includes(w.techAssignmentStatus)).length;
        const pendingCount = workloads.filter(w => w.pendingTechId === tech.id && w.techAssignmentStatus === 'Pending').length;
        let score = (assignedCount * 2) + pendingCount;

        // Attendance & active hours status
        const att = todayAttendance.find(a => a.userId === tech.id);
        if (att && att.punchIn && !att.punchOut) {
          score -= 5; // Actively clocked in and working
        } else if (att && att.punchOut) {
          score += 15; // Clocked out for the day
        } else {
          score += 5; // Not clocked in yet
        }

        // Location / Pincode proximity matching
        const techName = tech.username.toLowerCase();
        const addr = (leadAddress || '').toLowerCase();
        if (addr && addr.includes(techName)) {
          score -= 10;
        }

        if (score < minScore) {
          minScore = score;
          bestTech = tech;
        }
      }

      return bestTech;
    } catch (err) {
      console.error('findBestTechnician error:', err);
      return null;
    }
  };

  // Background 30-Minute SLA Timeout Automation Worker
  const runSlaCheck = async () => {
    try {
      const pendingLeads = await db.select()
        .from(schema.leads)
        .where(
          and(
            eq(schema.leads.techAssignmentStatus, 'Pending'),
            eq(schema.leads.isArchived, 0)
          )
        );

      const now = Date.now();
      const SLA_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

      for (const lead of pendingLeads) {
        if (!lead.techAssignedAt || !lead.pendingTechId) continue;
        const assignedTime = new Date(lead.techAssignedAt).getTime();
        
        if (now - assignedTime >= SLA_TIMEOUT_MS) {
          const expiredTechId = lead.pendingTechId;
          const declinedArr: number[] = lead.declinedTechIds ? JSON.parse(lead.declinedTechIds) : [];
          if (!declinedArr.includes(expiredTechId)) {
            declinedArr.push(expiredTechId);
          }

          // Immutable audit trail for SLA timeout revocation
          await logAudit(
            expiredTechId,
            'SLA Timeout Expired',
            `Technician response timed out after 30 minutes for lead "${lead.clientName}". Assignment automatically revoked.`,
            lead.id
          );

          // Route task to next available technician
          const nextTech = await findBestTechnician(lead.address || '', declinedArr);

          if (nextTech) {
            await db.update(schema.leads).set({
              pendingTechId: nextTech.id,
              techAssignmentStatus: 'Pending',
              techAssignedAt: new Date(),
              declinedTechIds: JSON.stringify(declinedArr),
              updatedAt: new Date()
            }).where(eq(schema.leads.id, lead.id));

            await pushNotification(
              nextTech.id,
              'Escalated SLA Task Assigned',
              `Lead "${lead.clientName}" was routed to you after previous technician timed out.`,
              app.get('io')
            );

            await logAudit(
              nextTech.id,
              'Auto-Escalated Assignment',
              `Auto-routed task to next available technician: ${nextTech.username} due to SLA timeout.`,
              lead.id
            );
          } else {
            // All technicians exhausted
            await db.update(schema.leads).set({
              pendingTechId: null,
              techAssignmentStatus: 'Escalated - Unassigned',
              declinedTechIds: JSON.stringify(declinedArr),
              updatedAt: new Date()
            }).where(eq(schema.leads.id, lead.id));

            const admins = await db.select().from(schema.users).where(eq(schema.users.role, 'Admin'));
            for (const admin of admins) {
              await pushNotification(
                admin.id,
                'SLA Alert: All Technicians Timed Out',
                `Lead "${lead.clientName}" could not be auto-assigned; all technicians declined or timed out.`,
                app.get('io')
              );
            }

            await logAudit(
              null,
              'SLA Escalation Alert',
              `All available technicians timed out or declined lead "${lead.clientName}". Escalated to Admin review.`,
              lead.id
            );
          }

          const ioInstance = app.get('io');
          if (ioInstance) {
            ioInstance.emit('lead_updated', { id: lead.id });
          }
        }
      }
    } catch (e) {
      console.error('SLA Check Error:', e);
    }
  };

  // Run on start and every 30 seconds
  runSlaCheck();
  setInterval(runSlaCheck, 30 * 1000);

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
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}_${username}`;
    const now = Date.now();
    const attempt = loginAttempts.get(key);

    if (attempt && attempt.lockedUntil > now) {
      const waitSec = Math.ceil((attempt.lockedUntil - now) / 1000);
      return res.status(429).json({ error: `Too many failed login attempts. Please try again in ${waitSec} seconds.` });
    }

    try {
      const user = await db.select().from(schema.users).where(eq(schema.users.username, username)).then(res => res[0] || null);
      if (!user) {
        const cur = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
        cur.count += 1;
        if (cur.count >= 5) cur.lockedUntil = now + 60 * 1000;
        loginAttempts.set(key, cur);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        const cur = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
        cur.count += 1;
        if (cur.count >= 5) cur.lockedUntil = now + 60 * 1000;
        loginAttempts.set(key, cur);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Successful login clears attempt counter
      loginAttempts.delete(key);

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

      // Auto-punch-in for today if not already punched in
      const todayDate = new Date().toISOString().split('T')[0];
      const existingAttendance = await db.select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.userId, user.id), eq(schema.attendance.date, todayDate)))
        .then(r => r[0] || null);

      if (!existingAttendance) {
        await db.insert(schema.attendance).values({
          userId: user.id,
          date: todayDate,
          punchIn: new Date().toISOString()
        });
        await logAudit(user.id, 'Punch In', 'Automatically recorded punch-in on login');
      }

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
      
      // Protect default Administrator account from public password reset takeover
      if (user.role === 'Admin') {
        return res.status(403).json({ error: 'Administrator password cannot be reset via public recovery.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
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

      if (user.role === 'Admin') {
        return res.status(403).json({ error: 'Administrator password cannot be reset via public recovery.' });
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
      const [resObj] = await db.insert(schema.users).values({ username, passwordHash, role });
      const newUser = await db.select({ id: schema.users.id, username: schema.users.username, role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, (resObj as any).insertId))
        .then((r: any) => r[0] || null);
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
      if (!declinedArr.includes(userId)) {
        declinedArr.push(userId);
      }
      
      // Auto-assign to next tech using smart matching engine
      const bestTech = await findBestTechnician(lead.address || '', declinedArr);
      
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
        techAssignedAt: bestTech ? new Date() : null,
        updatedAt: new Date()
      }).where(eq(schema.leads.id, Number(id)));
      
      await logAudit(userId, 'Technician Declined', `Technician declined lead "${lead.clientName}". Routed to next available technician.`, Number(id));

      const ioInstance = app.get('io');
      if (ioInstance) {
        ioInstance.emit('lead_updated', { id: Number(id) });
      }
      
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
         if (req.user.role !== 'Admin') {
           return res.status(403).json({ error: 'Only administrators can reassign leads.' });
         }
         updateData.assignedUserId = assignedUserId;
         // Clear pending if manually reassigned
         updateData.pendingTechId = null;
         updateData.techAssignmentStatus = assignedUserId ? 'Accepted' : null;
      }
      
      const whereCondition = req.user.role === 'Admin'
        ? inArray(schema.leads.id, leadIds)
        : and(inArray(schema.leads.id, leadIds), eq(schema.leads.assignedUserId, req.user.id));

      await db.update(schema.leads).set(updateData).where(whereCondition);
      
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
      // Exclusive Lead Ownership: Non-admin users cannot assign leads to other agents
      const finalAssignedUserId = req.user.role === 'Admin' ? (assignedUserId || req.user.id) : req.user.id;
      const initialStatus = status || 'New';

      // Check if initial status triggers automated technician matching
      const schedulingStages = ["Scheduled", "Installed", "Site Visit Scheduled", "Installation Scheduled"];
      let pendingTechId: number | null = null;
      let techAssignmentStatus: string | null = null;
      let techAssignedAt: Date | null = null;

      if (schedulingStages.includes(initialStatus)) {
        const bestTech = await findBestTechnician(address || '', []);
        if (bestTech) {
          pendingTechId = bestTech.id;
          techAssignmentStatus = 'Pending';
          techAssignedAt = new Date();
        }
      }

      const [resObj] = await db.insert(schema.leads)
        .values({
          clientName, contact, address, assignedUserId: finalAssignedUserId, requiredProduct,
          quantity, price, notes: JSON.stringify(notes || []), nextFollowUp, visitSchedule,
          installationSchedule, actualInstallDate, status: initialStatus, priority: priority || 'Medium',
          email, tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || []),
          pendingTechId, techAssignmentStatus, techAssignedAt,
          updatedAt: sql`CURRENT_TIMESTAMP`
        });
      const leadId = (resObj as any).insertId;

      if (finalAssignedUserId && finalAssignedUserId !== req.user.id) {
        await pushNotification(finalAssignedUserId, 'New Lead Assigned', `You have been assigned a new lead: ${clientName}`, app.get('io'));
      }

      if (pendingTechId) {
        await pushNotification(pendingTechId, 'New Task Assigned', `You have been selected for a new task: ${clientName}`, app.get('io'));
      }

      // Log immutable audit activity
      await logAudit(
        req.user.id,
        'Created Lead',
        `Lead "${clientName}" created and assigned to user ID ${finalAssignedUserId}${pendingTechId ? ` with technician ID ${pendingTechId} pending acceptance` : ''}`,
        leadId
      );

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
          const condition = req.user.role === 'Admin'
            ? eq(schema.leads.id, id)
            : and(eq(schema.leads.id, id), eq(schema.leads.assignedUserId, req.user.id));

          await tx.update(schema.leads)
            .set({ status: status })
            .where(condition)
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
      
      const lead = await db.select({ 
        clientName: schema.leads.clientName, 
        notes: schema.leads.notes,
        assignedUserId: schema.leads.assignedUserId,
        pendingTechId: schema.leads.pendingTechId
      })
        .from(schema.leads)
        .where(eq(schema.leads.id, Number(id)))
        .then(res => res[0] || null);

      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      // Exclusive Lead Ownership check
      if (req.user.role !== 'Admin' && lead.assignedUserId !== req.user.id && lead.pendingTechId !== req.user.id) {
        return res.status(403).json({ error: 'Exclusive lead ownership violation: You do not have permission to add notes to this lead.' });
      }
      
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

          const [resObj] = await tx.insert(schema.leads)
            .values({
              clientName, 
              contact, 
              requiredProduct: lead.requiredProduct || '', 
              quantity: lead.quantity || '', 
              price: lead.price || '', 
              status, 
              notes: JSON.stringify(notesArr),
              assignedUserId: req.user.id
            });
          
          const newLeadId = (resObj as any)?.insertId;
          if (newLeadId) {
            await tx.insert(schema.activityLogs)
              .values({
                userId: req.user.id,
                action: 'Imported Lead',
                leadId: newLeadId,
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

  // Update Lead (ACID compliant transaction with Exclusive Ownership and Immutable Audit Logging)
  app.put('/api/leads/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const {
      clientName, contact, address, assignedUserId, requiredProduct,
      quantity, price, notes, nextFollowUp, visitSchedule,
      installationSchedule, actualInstallDate, status, priority, email, tags,
      reassignmentReason
    } = req.body;
    
    try {
      await db.transaction(async (tx) => {
        // Concurrency Lock: Read inside ACID transaction
        const existingLead = await tx.select().from(schema.leads).where(eq(schema.leads.id, Number(id))).then(res => res[0] || null);

        if (!existingLead) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        // Exclusive Lead Ownership: Once a lead is assigned, no other non-admin user can access, edit, or re-assign
        if (req.user.role !== 'Admin' && existingLead.assignedUserId !== req.user.id && existingLead.pendingTechId !== req.user.id) {
          return res.status(403).json({ error: 'Exclusive lead ownership violation: This lead is locked to another user.' });
        }

        // Full override, visibility, and re-assignment privileges reserved EXCLUSIVELY for Admin role
        if (assignedUserId !== undefined && Number(assignedUserId) !== Number(existingLead.assignedUserId) && req.user.role !== 'Admin') {
          return res.status(403).json({ error: 'Exclusive privilege violation: Only administrators can re-assign leads.' });
        }

        const schedulingStages = ["Scheduled", "Installed", "Site Visit Scheduled", "Installation Scheduled"];
        let newPendingTechId = existingLead.pendingTechId;
        let newTechAssignmentStatus = existingLead.techAssignmentStatus;
        let newTechAssignedAt = existingLead.techAssignedAt;

        // Auto-assign matching engine if status transitioned to a scheduling stage
        if (status && status !== existingLead.status && schedulingStages.includes(status) && (!existingLead.techAssignmentStatus || existingLead.techAssignmentStatus === 'Declined')) {
          const declinedArr = existingLead.declinedTechIds ? JSON.parse(existingLead.declinedTechIds) : [];
          const bestTech = await findBestTechnician(address || existingLead.address || '', declinedArr);
          
          if (bestTech) {
            newPendingTechId = bestTech.id;
            newTechAssignmentStatus = 'Pending';
            newTechAssignedAt = new Date();
            
            await tx.insert(schema.notifications).values({
              userId: bestTech.id,
              title: 'New Lead Assignment',
              message: `You have been selected for a new task: ${clientName || existingLead.clientName}`
            });

            await tx.insert(schema.activityLogs).values({
              userId: req.user.id,
              action: 'Technician Assigned',
              details: `Auto-matched technician ${bestTech.username} for stage "${status}" (Pending Acceptance)`,
              leadId: Number(id)
            });
          }
        }

        const updateData: Record<string, any> = {
          updatedAt: new Date()
        };

        if (clientName !== undefined) updateData.clientName = clientName;
        if (contact !== undefined) updateData.contact = contact;
        if (address !== undefined) updateData.address = address;
        if (requiredProduct !== undefined) updateData.requiredProduct = requiredProduct;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (price !== undefined) updateData.price = price;
        if (notes !== undefined) updateData.notes = JSON.stringify(notes || []);
        if (nextFollowUp !== undefined) updateData.nextFollowUp = nextFollowUp;
        if (visitSchedule !== undefined) updateData.visitSchedule = visitSchedule;
        if (installationSchedule !== undefined) updateData.installationSchedule = installationSchedule;
        if (actualInstallDate !== undefined) updateData.actualInstallDate = actualInstallDate;
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (email !== undefined) updateData.email = email;
        if (tags !== undefined) updateData.tags = Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags || []);

        if (req.user.role === 'Admin' && assignedUserId !== undefined) {
          updateData.assignedUserId = assignedUserId;
          if (Number(assignedUserId) !== Number(existingLead.assignedUserId)) {
            // Clear pending tech if manually reassigned
            updateData.pendingTechId = null;
            updateData.techAssignmentStatus = assignedUserId ? 'Accepted' : null;
          }
        }

        if (newPendingTechId !== existingLead.pendingTechId) {
          updateData.pendingTechId = newPendingTechId;
          updateData.techAssignmentStatus = newTechAssignmentStatus;
          updateData.techAssignedAt = newTechAssignedAt;
        }

        await tx.update(schema.leads).set(updateData).where(eq(schema.leads.id, Number(id)));

        // --- Immutable Chronological Audit Trail Logging ---
        
        // 1. Stage changes
        if (status && status !== existingLead.status) {
          await tx.insert(schema.activityLogs).values({
            userId: req.user.id,
            action: 'Stage Changed',
            details: `Pipeline stage changed from "${existingLead.status}" to "${status}"`,
            leadId: Number(id)
          });
        }

        // 2. Price negotiations
        if (price !== undefined && price !== existingLead.price) {
          await tx.insert(schema.activityLogs).values({
            userId: req.user.id,
            action: 'Price Negotiation',
            details: `Negotiated price updated from "${existingLead.price || 'None'}" to "${price}"`,
            leadId: Number(id)
          });
        }

        // 3. Re-assignments (Handing off lead and why)
        if (req.user.role === 'Admin' && assignedUserId !== undefined && Number(assignedUserId) !== Number(existingLead.assignedUserId)) {
          const prevUser = existingLead.assignedUserId 
            ? await tx.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, existingLead.assignedUserId)).then(r => r[0]?.username || 'Unknown')
            : 'Unassigned';
          const newUser = assignedUserId 
            ? await tx.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, Number(assignedUserId))).then(r => r[0]?.username || 'Unknown')
            : 'Unassigned';

          await tx.insert(schema.activityLogs).values({
            userId: req.user.id,
            action: 'Lead Reassigned',
            details: `Lead handed off from ${prevUser} to ${newUser}. Reason: ${reassignmentReason || 'Administrative reassignment'}`,
            leadId: Number(id)
          });

          if (assignedUserId && assignedUserId !== req.user.id) {
            await pushNotification(Number(assignedUserId), 'Lead Assigned', `Lead "${clientName || existingLead.clientName}" has been assigned to you.`, app.get('io'));
          }
        }

        // 4. Follow-up scheduling
        if (nextFollowUp && nextFollowUp !== existingLead.nextFollowUp) {
          await tx.insert(schema.activityLogs).values({
            userId: req.user.id,
            action: 'Follow-up Scheduled',
            details: `Next follow-up scheduled for ${nextFollowUp}`,
            leadId: Number(id)
          });
        }

        // 5. General modification fallback if no specific field triggered
        if (!status && !price && assignedUserId === undefined && !nextFollowUp) {
          await tx.insert(schema.activityLogs).values({
            userId: req.user.id,
            action: 'Updated Lead',
            details: `Updated details for ${clientName || existingLead.clientName}`,
            leadId: Number(id)
          });
        }
      });

      const ioInstance = app.get('io');
      if (ioInstance) {
        ioInstance.emit('lead_updated', { id: Number(id) });
      }

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });

  // Immutable Audit Trail for Lead
  app.get('/api/leads/:id/audit-trail', authenticateToken, async (req: any, res: Response) => {
    const { id } = req.params;
    try {
      const lead = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id))).then(r => r[0] || null);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      
      if (req.user.role !== 'Admin' && lead.assignedUserId !== req.user.id && lead.pendingTechId !== req.user.id) {
        return res.status(403).json({ error: 'Exclusive lead ownership violation: You do not have permission to view this lead\'s history.' });
      }

      const logs = await db.select({
        id: schema.activityLogs.id,
        action: schema.activityLogs.action,
        details: schema.activityLogs.details,
        createdAt: schema.activityLogs.createdAt,
        userId: schema.activityLogs.userId,
        username: schema.users.username,
        userRole: schema.users.role,
      })
      .from(schema.activityLogs)
      .leftJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
      .where(eq(schema.activityLogs.leadId, Number(id)))
      .orderBy(desc(schema.activityLogs.createdAt));

      res.json(logs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch audit trail' });
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
      const [resObj] = await db.insert(schema.pipelineStages).values({ name, orderIndex: nextOrder });
      const newStage = await db.select({ id: schema.pipelineStages.id, name: schema.pipelineStages.name, orderIndex: schema.pipelineStages.orderIndex })
        .from(schema.pipelineStages)
        .where(eq(schema.pipelineStages.id, (resObj as any).insertId))
        .then((r: any) => r[0] || null);
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
      const lead = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id))).then(r => r[0] || null);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      
      // Exclusive Lead Ownership
      if (req.user.role !== 'Admin' && lead.assignedUserId !== req.user.id && lead.pendingTechId !== req.user.id) {
        return res.status(403).json({ error: 'Exclusive lead ownership violation: You do not have permission to view WhatsApp messages for this lead.' });
      }

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
      const lead = await db.select().from(schema.leads).where(eq(schema.leads.id, Number(id))).then(r => r[0] || null);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      
      // Exclusive Lead Ownership
      if (req.user.role !== 'Admin' && lead.assignedUserId !== req.user.id && lead.pendingTechId !== req.user.id) {
        return res.status(403).json({ error: 'Exclusive lead ownership violation: You do not have permission to send WhatsApp messages for this lead.' });
      }

      const [resObj] = await db.insert(schema.whatsappMessages)
        .values({
          leadId: Number(id),
          sender: sender || 'user',
          message: message
        });
      const newMessage = await db.select()
        .from(schema.whatsappMessages)
        .where(eq(schema.whatsappMessages.id, (resObj as any).insertId))
        .then((r: any) => r[0] || null);
        
      res.json(newMessage);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
  });

  // ----- Attendance & Daily Activity Tracking API -----
  
  // Punch In (called automatically on login or via dashboard action)
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
      const [resObj] = await db.insert(schema.attendance).values({ userId, date, punchIn: punchInTime });
      const newRecord = await db.select()
        .from(schema.attendance)
        .where(eq(schema.attendance.id, (resObj as any).insertId))
        .then((r: any) => r[0] || null);
      
      await logAudit(userId, 'Punch In', 'Punched in for work shift');
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
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)));
      
      const updatedRecord = await db.select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        .then(res => res[0] || null);

      await logAudit(userId, 'Punch Out', 'Punched out from work shift');
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
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)));
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save notes' });
    }
  });

  // Get Today's Attendance & Activity Summary for Current User
  app.get('/api/attendance/summary', authenticateToken, async (req: any, res: Response) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    try {
      const attendance = await db.select()
        .from(schema.attendance)
        .where(and(eq(schema.attendance.userId, userId), eq(schema.attendance.date, date)))
        .then(res => res[0] || null);

      // Tasks for today
      const tasks = await db.select()
        .from(schema.tasks)
        .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.date, date)))
        .orderBy(asc(schema.tasks.id));

      // User's assigned leads
      const userLeads = await db.select()
        .from(schema.leads)
        .where(
          and(
            req.user.role === 'Admin' ? eq(schema.leads.isArchived, 0) : eq(schema.leads.assignedUserId, userId),
            eq(schema.leads.isArchived, 0)
          )
        );

      const overdueLeads: any[] = [];
      const dueTodayLeads: any[] = [];

      for (const l of userLeads) {
        if (!l.nextFollowUp || ['Closed', 'Closed-Lost', 'Installed'].includes(l.status || '')) continue;
        const fDate = l.nextFollowUp.split('T')[0];
        if (fDate < date) {
          overdueLeads.push(l);
        } else if (fDate === date) {
          dueTodayLeads.push(l);
        }
      }

      // Count completed follow-ups today (activity logs for notes or stage updates by this user today)
      const logsToday = await db.select({
        leadId: schema.activityLogs.leadId
      }).from(schema.activityLogs)
        .where(
          and(
            eq(schema.activityLogs.userId, userId),
            sql`DATE(${schema.activityLogs.createdAt}) = ${date}`
          )
        );

      const distinctLeadsHandledToday = new Set(logsToday.map(l => l.leadId).filter(Boolean)).size;

      res.json({
        attendance,
        tasks,
        overdueCount: overdueLeads.length,
        dueTodayCount: dueTodayLeads.length,
        completedFollowUpsToday: distinctLeadsHandledToday,
        overdueLeads: overdueLeads.slice(0, 10),
        dueTodayLeads: dueTodayLeads.slice(0, 10),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch attendance summary' });
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
        .orderBy(asc(schema.tasks.id));
      res.json({ attendance, tasks });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch attendance info' });
    }
  });

  // Get All Team Attendance for Today (Admin Real-Time Monitoring Dashboard)
  app.get('/api/attendance/all', authenticateToken, requireRole(['Admin']), async (req: any, res) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      const allUsers = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role
      }).from(schema.users);
      
      const attendanceRecords = await db.select()
        .from(schema.attendance)
        .where(eq(schema.attendance.date, date));
      
      const tasks = await db.select()
        .from(schema.tasks)
        .where(eq(schema.tasks.date, date));

      // Get count of actions performed today per user
      const todayLogs = await db.select({
        userId: schema.activityLogs.userId,
        count: sql`count(*)`.mapWith(Number)
      }).from(schema.activityLogs)
        .where(sql`DATE(${schema.activityLogs.createdAt}) = ${date}`)
        .groupBy(schema.activityLogs.userId);
      
      const result = allUsers.map((user: any) => {
        const userAttendance = attendanceRecords.find((a: any) => a.userId === user.id);
        const userTasks = tasks.filter((t: any) => t.userId === user.id);
        const completedTasks = userTasks.filter((t: any) => t.completed).length;
        const userLog = todayLogs.find((l: any) => l.userId === user.id);
        
        let status = 'Absent';
        let activeMinutes = 0;
        if (userAttendance && userAttendance.punchIn) {
          const startTime = new Date(userAttendance.punchIn).getTime();
          const endTime = userAttendance.punchOut ? new Date(userAttendance.punchOut).getTime() : Date.now();
          activeMinutes = Math.max(0, Math.floor((endTime - startTime) / 60000));
          status = userAttendance.punchOut ? 'Punched Out' : 'Active (Punched In)';
        }

        return {
          user,
          status,
          attendance: userAttendance || null,
          activeMinutes,
          totalTasks: userTasks.length,
          completedTasks,
          activityCount: userLog?.count || 0
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
      const [resObj] = await db.insert(schema.tasks).values({ userId, date, text, completed: 0 });
      const newTask = await db.select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, (resObj as any).insertId))
        .then((r: any) => r[0] || null);
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
    // 1. Check handshake auth token
    let token = socket.handshake.auth?.token;

    // 2. Check authorization header
    if (!token && socket.handshake.headers.authorization) {
      const parts = socket.handshake.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // 3. Parse cookies from headers
    if (!token && socket.request.headers.cookie) {
      const cookieHeader = socket.request.headers.cookie;
      const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
      token = tokenMatch ? tokenMatch[1] : null;
    }
    
    if (!token) return next(new Error('Authentication error: No token provided'));
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error: Invalid or expired token'));
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
        const [resObj] = await db.insert(schema.chatMessages).values({
          userId: user.id,
          message: data.message,
        });
        const inserted = await db.select()
          .from(schema.chatMessages)
          .where(eq(schema.chatMessages.id, (resObj as any).insertId))
          .then((r: any) => r[0]);

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