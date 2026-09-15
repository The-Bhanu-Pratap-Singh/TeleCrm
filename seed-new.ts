import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const db = new DatabaseSync('./telecrm.sqlite');
const rawData = fs.readFileSync('./raw-leads-new.csv', 'utf-8');

// Clear existing leads as requested
db.exec('DELETE FROM leads;');

// Simple CSV parser for quoted fields
function parseCSV(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      i++; // skip escaped quote
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // skip \n
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
}

const rows = parseCSV(rawData);

const insertStmt = db.prepare(`
  INSERT INTO leads (
    clientName, contact, notes, status, assignedUserId
  ) VALUES (?, ?, ?, ?, ?)
`);

let count = 0;

for (const parts of rows) {
  if (parts.length === 0) continue;
  
  let phone = parts[0].trim().replace(/[^0-9]/g, '');
  if (!phone || phone.length < 10) continue; 

  const rest = parts.slice(1).filter(Boolean).join(' | ').trim();
  
  const notesArray = rest ? [{ text: rest, timestamp: new Date().toISOString(), author: 'System Import' }] : [];
  
  // User explicitly asked to set all statuses to 'New'
  const status = 'New';

  insertStmt.run(`Client ${phone.slice(-4)}`, phone, JSON.stringify(notesArray), status, 1);
  count++;
}

console.log(`Successfully reuploaded ${count} leads into the database with status "New"!`);
