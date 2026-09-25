import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.ts';

declare global {
  var _dbInstance: any;
}

function initSqliteFallback() {
  const dbFile = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'telecrm_local.sqlite');
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log(`[Database] Using local SQLite database engine at: ${dbFile}`);
  const sqlite = new Database(dbFile);

  // Enable WAL mode for high concurrency
  sqlite.pragma('journal_mode = WAL');

  // Create tables matching schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      reset_token TEXT,
      reset_token_expiry TEXT,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      address TEXT,
      assigned_user_id INTEGER,
      required_product TEXT,
      quantity TEXT,
      price TEXT,
      notes TEXT,
      next_follow_up TEXT,
      visit_schedule TEXT,
      installation_schedule TEXT,
      actual_install_date TEXT,
      status TEXT,
      priority TEXT DEFAULT 'Medium',
      email TEXT,
      tags TEXT,
      pending_tech_id INTEGER,
      tech_assignment_status TEXT,
      declined_tech_ids TEXT,
      tech_assigned_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      lead_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      punch_in TEXT NOT NULL,
      punch_out TEXT,
      notes TEXT,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default users if empty
  const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (!userCount || userCount.count === 0) {
    console.log('[Database] Seeding initial users (admin, sales, tech)...');
    const adminHash = bcrypt.hashSync('admin123', 10);
    const salesHash = bcrypt.hashSync('sales123', 10);
    const techHash = bcrypt.hashSync('tech123', 10);

    const insertUser = sqlite.prepare(`
      INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)
    `);
    insertUser.run('admin', adminHash, 'Admin');
    insertUser.run('sales', salesHash, 'Sales Manager');
    insertUser.run('tech', techHash, 'Technician');
  }

  // Seed default stages if empty
  const stageCount = sqlite.prepare('SELECT COUNT(*) as count FROM pipeline_stages').get() as { count: number };
  if (!stageCount || stageCount.count === 0) {
    console.log('[Database] Seeding initial pipeline stages...');
    const insertStage = sqlite.prepare(`
      INSERT OR IGNORE INTO pipeline_stages (name, order_index) VALUES (?, ?)
    `);
    const defaultStages = ['New', 'Contacted', 'Quoted', 'Visit Scheduled', 'Installed', 'Closed-Lost'];
    defaultStages.forEach((name, index) => {
      insertStage.run(name, index);
    });
  }

  // Seed initial sample leads if empty
  const leadCount = sqlite.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
  if (!leadCount || leadCount.count === 0) {
    console.log('[Database] Seeding initial sample leads...');
    const insertLead = sqlite.prepare(`
      INSERT INTO leads (client_name, contact, address, required_product, quantity, price, status, priority, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLead.run('Apex Towers - Mr. Sharma', '+91 98765 43210', 'Block B, Sector 45, Gurgaon', 'Heavy Duty Ceiling Hanger (6 Pipes)', '2 Units', '₹4,500', 'New', 'High', 'sharma@example.com');
    insertLead.run('Green Glen Residency', '+91 91234 56789', 'Flat 402, Outer Ring Road, Bengaluru', 'Stainless Steel 304 Hanger (4 Pipes)', '1 Unit', '₹2,800', 'Quoted', 'Medium', 'greenglen@example.com');
    insertLead.run('Silver Oak Villas', '+91 99887 76655', 'Villa 12, Whitefield, Bengaluru', 'Motorized Remote Ceiling Hanger', '3 Units', '₹18,500', 'Visit Scheduled', 'High', 'silveroak@example.com');
  }

  // Helper to adapt MySQL query dialect to SQLite
  function adaptSql(sql: string): string {
    return sql
      .replace(/\bdefault\b/gi, 'NULL')
      .replace(/\bnow\(\)/gi, "datetime('now')");
  }

  const queryFn = async (options: any, params: any[] = []): Promise<[any, any[]]> => {
    let sqlStr = typeof options === 'string' ? options : options.sql;
    const rowsAsArray = typeof options === 'object' && Boolean(options.rowsAsArray);

    sqlStr = adaptSql(sqlStr);

    const isSelect = sqlStr.trim().toUpperCase().startsWith('SELECT');
    const stmt = sqlite.prepare(sqlStr);

    if (isSelect) {
      const rows = rowsAsArray ? stmt.raw().all(params) : stmt.all(params);
      return [rows, []];
    } else {
      const info = stmt.run(params);
      return [{ affectedRows: info.changes, insertId: Number(info.lastInsertRowid) }, []];
    }
  };

  const pool = {
    query: queryFn,
    async getConnection() {
      return {
        query: queryFn,
        release() {},
      };
    },
  };

  return drizzle(pool as any, { schema, mode: 'default' });
}

function initDb() {
  if (global._dbInstance) {
    return global._dbInstance;
  }

  // Only use explicit MySQL socket if specified - NEVER use /app/cloudsql (which is a PostgreSQL socket)
  let mysqlSocket: string | null = null;
  if (process.env.MYSQL_SOCKET && fs.existsSync(process.env.MYSQL_SOCKET)) {
    mysqlSocket = process.env.MYSQL_SOCKET;
  }

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  // If explicit MySQL credentials are provided (e.g. in production or external MySQL server)
  if (mysqlSocket || host) {
    try {
      console.log(`[Database] Attempting connection to MySQL server (${mysqlSocket ? 'socket: ' + mysqlSocket : 'host: ' + host})...`);
      const pool = mysql.createPool({
        host: host || 'localhost',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: user || 'root',
        password: password || '',
        database: database || 'telecrm',
        socketPath: mysqlSocket || undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2000,
      });

      global._dbInstance = drizzle(pool, { schema, mode: 'default' });
      return global._dbInstance;
    } catch (err) {
      console.warn('[Database] MySQL connection initialization failed, falling back to local SQLite:', err);
    }
  }

  // Default fallback: embedded zero-configuration SQLite engine for full offline/preview reliability
  global._dbInstance = initSqliteFallback();
  return global._dbInstance;
}

export const db = initDb();
