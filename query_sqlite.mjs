import { DatabaseSync } from 'node:sqlite';
const sqliteDb = new DatabaseSync('./telecrm.sqlite');
console.log('Users in sqlite:', sqliteDb.prepare('SELECT * FROM users').all());
console.log('Leads in sqlite:', sqliteDb.prepare('SELECT COUNT(*) as c FROM leads').get().c);
