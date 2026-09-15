import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const db = new DatabaseSync('./telecrm.sqlite');
const rawData = fs.readFileSync('./raw-leads.txt', 'utf-8');

const insertStmt = db.prepare(`
  INSERT INTO leads (
    clientName, contact, notes, status, assignedUserId
  ) VALUES (?, ?, ?, ?, ?)
`);

const lines = rawData.trim().split('\n');
let count = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  const parts = line.split('\t').map(s => s.trim());
  let phone = parts[0];
  
  // Basic cleanup for phone
  phone = phone.replace(/[^0-9]/g, '');
  if (!phone || phone.length < 10) continue; 

  const rest = parts.slice(1).filter(Boolean).join(' | ');
  
  const notesArray = rest ? [{ text: rest, timestamp: new Date().toISOString(), author: 'System Import' }] : [];
  
  let status = 'New';
  const textLower = rest.toLowerCase();
  
  if (textLower.includes('not intrested') || textLower.includes('not interested') || textLower.includes('not required') || textLower.includes('dead') || textLower.includes('plan cancelled') || textLower.includes('expensive')) {
    status = 'Closed';
  } else if (textLower.includes('visit')) {
    status = 'Visiting';
  } else if (textLower.includes('installation') || textLower.includes('done')) {
    status = 'Scheduled';
  } else if (rest) {
    status = 'Follow-up';
  }

  insertStmt.run(`Client ${phone.slice(-4)}`, phone, JSON.stringify(notesArray), status, 1);
  count++;
}

console.log(`Successfully seeded ${count} leads into the database!`);
