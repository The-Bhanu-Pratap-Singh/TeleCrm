import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./telecrm.sqlite');
console.log("LEADS NULL ASSIGN:");
console.log(db.prepare('SELECT COUNT(*) as count FROM leads WHERE assignedUserId IS NULL').all());
console.log("LEADS SPECIFIC ASSIGN:");
console.log(db.prepare('SELECT assignedUserId, COUNT(*) as count FROM leads GROUP BY assignedUserId').all());
