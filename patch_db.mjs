import fs from 'fs';
const file = 'src/server/db.ts';
let code = fs.readFileSync(file, 'utf-8');

const newTables = `
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
`;

if (!code.includes('CREATE TABLE IF NOT EXISTS attendance')) {
  code = code.replace('CREATE TABLE IF NOT EXISTS pipeline_stages', newTables + '\n    CREATE TABLE IF NOT EXISTS pipeline_stages');
  fs.writeFileSync(file, code);
  console.log('Patched db.ts');
}
