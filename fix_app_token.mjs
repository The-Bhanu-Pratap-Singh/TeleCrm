import fs from 'fs';
let app = fs.readFileSync('src/App.tsx', 'utf-8');

app = app.replace("if (!token || !user) {", "if (!user) {");
fs.writeFileSync('src/App.tsx', app);
console.log('Fixed App.tsx user check');
