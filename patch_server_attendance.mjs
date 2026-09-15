import fs from 'fs';
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf-8');

const attendanceRoutes = `
  // ----- Attendance & Tasks API -----
  
  // Punch In (called automatically on dashboard load or manual button)
  app.post('/api/attendance/punch-in', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    try {
      const existing = db.prepare('SELECT * FROM attendance WHERE userId = ? AND date = ?').get(userId, date);
      if (existing) {
        return res.json({ success: true, message: 'Already punched in today', data: existing });
      }
      
      const punchInTime = new Date().toISOString();
      const stmt = db.prepare('INSERT INTO attendance (userId, date, punchIn) VALUES (?, ?, ?)');
      const result = stmt.run(userId, date, punchInTime);
      
      const newRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
      res.json({ success: true, data: newRecord });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to punch in' });
    }
  });

  // Punch Out
  app.post('/api/attendance/punch-out', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    const punchOutTime = new Date().toISOString();
    try {
      const stmt = db.prepare('UPDATE attendance SET punchOut = ? WHERE userId = ? AND date = ?');
      stmt.run(punchOutTime, userId, date);
      
      const updatedRecord = db.prepare('SELECT * FROM attendance WHERE userId = ? AND date = ?').get(userId, date);
      res.json({ success: true, data: updatedRecord });
    } catch (error) {
      res.status(500).json({ error: 'Failed to punch out' });
    }
  });

  // Save Daily Notes
  app.post('/api/attendance/notes', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    const { notes } = req.body;
    try {
      const stmt = db.prepare('UPDATE attendance SET notes = ? WHERE userId = ? AND date = ?');
      stmt.run(notes, userId, date);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save notes' });
    }
  });

  // Get Today's Attendance & Tasks for Current User
  app.get('/api/attendance/today', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    try {
      const attendance = db.prepare('SELECT * FROM attendance WHERE userId = ? AND date = ?').get(userId, date);
      const tasks = db.prepare('SELECT * FROM tasks WHERE userId = ? AND date = ? ORDER BY id ASC').all();
      res.json({ attendance, tasks });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch attendance info' });
    }
  });

  // Get All Team Attendance for Today (Admin)
  app.get('/api/attendance/all', authenticateToken, requireRole(['Admin']), (req: any, res) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      // Get all users except admin (or include admin too, up to preference)
      const allUsers = db.prepare('SELECT id, username, role FROM users').all();
      
      // Get all attendance records for today
      const attendanceRecords = db.prepare('SELECT * FROM attendance WHERE date = ?').all();
      
      // Get all tasks for today
      const tasks = db.prepare('SELECT * FROM tasks WHERE date = ?').all();
      
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
  app.post('/api/tasks', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const date = new Date().toISOString().split('T')[0];
    const { text } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO tasks (userId, date, text) VALUES (?, ?, ?)');
      const result = stmt.run(userId, date, text);
      const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
      res.json(newTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update Task (Toggle)
  app.put('/api/tasks/:id', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { completed } = req.body;
    try {
      const stmt = db.prepare('UPDATE tasks SET completed = ? WHERE id = ? AND userId = ?');
      stmt.run(completed ? 1 : 0, id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update task' });
    }
  });
  
  // Delete Task
  app.delete('/api/tasks/:id', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM tasks WHERE id = ? AND userId = ?').run(id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

`;

if (!code.includes('/api/attendance/punch-in')) {
  code = code.replace('// ----- Vite Middleware for Dev or Static Files for Prod -----', attendanceRoutes + '\n  // ----- Vite Middleware for Dev or Static Files for Prod -----');
  fs.writeFileSync(file, code);
  console.log('Patched server.ts with attendance/tasks API');
}
