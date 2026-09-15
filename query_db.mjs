import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./telecrm.sqlite');
console.log("USERS:");
console.log(db.prepare('SELECT id, username, role FROM users').all());
console.log("LEADS COUNT:");
console.log(db.prepare('SELECT COUNT(*) as count FROM leads').all());
console.log("LEADS:");
console.log(db.prepare('SELECT id, clientName, assignedUserId FROM leads').all());
