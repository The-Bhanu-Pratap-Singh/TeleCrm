import fs from 'fs';
let server = fs.readFileSync('server.ts', 'utf-8');
server = server.replace(/app\.get\('\/api\/leads\/:id\/whatsapp', authenticateToken, async \(req, res\) => {/g, "app.get('/api/leads/:id/whatsapp', authenticateToken, async (req: any, res) => {");
server = server.replace(/app\.post\('\/api\/leads\/:id\/whatsapp', authenticateToken, async \(req, res\) => {/g, "app.post('/api/leads/:id/whatsapp', authenticateToken, async (req: any, res) => {");
fs.writeFileSync('server.ts', server);
console.log('Fixed req type');
