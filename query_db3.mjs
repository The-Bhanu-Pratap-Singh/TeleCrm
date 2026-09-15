import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./telecrm.sqlite');
console.log("LOGS:");
console.log(db.prepare('SELECT id, userId, action, details, createdAt FROM activity_logs ORDER BY id DESC LIMIT 20').all());
