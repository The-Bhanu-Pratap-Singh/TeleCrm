import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';

export function initDb() {
  const db = new DatabaseSync('./telecrm.sqlite');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientName TEXT NOT NULL,
      contact TEXT NOT NULL,
      address TEXT,
      assignedUserId INTEGER,
      requiredProduct TEXT,
      quantity TEXT,
      price TEXT,
      notes TEXT,
      nextFollowUp TEXT,
      visitSchedule TEXT,
      installationSchedule TEXT,
      actualInstallDate TEXT,
      status TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assignedUserId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      leadId INTEGER,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(leadId) REFERENCES leads(id)
    );

    
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      punchIn TEXT NOT NULL,
      punchOut TEXT,
      notes TEXT,
      FOREIGN KEY(userId) REFERENCES users(id),
      UNIQUE(userId, date)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY(userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      orderIndex INTEGER NOT NULL
    );
  `);

  // Auto-provision an admin if no users exist
  const stmt = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1');
  const adminExists = stmt.get('Admin');
  
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    const insertStmt = db.prepare('INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)');
    insertStmt.run('admin', hash, 'Admin');
    console.log('Default Admin user created: admin / admin123');
  }

  // Seed default pipeline stages if empty
  const stageCountStmt = db.prepare('SELECT COUNT(*) as c FROM pipeline_stages');
  const stageCount = (stageCountStmt.get() as any).c;
  if (stageCount === 0) {
    const defaultStages = ['New', 'Follow-up', 'Visiting', 'Scheduled', 'Installed', 'Closed'];
    const insertStage = db.prepare('INSERT INTO pipeline_stages (name, orderIndex) VALUES (?, ?)');
    defaultStages.forEach((stage, index) => {
      insertStage.run(stage, index);
    });
  }

  return db;
}
