import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');
code = code.replace(/import KanbanBoard from '\.\/KanbanBoard\.tsx';/, "import KanbanBoard from './KanbanBoard.tsx';\nimport WhatsappChatDrawer from './WhatsappChatDrawer';");
fs.writeFileSync('src/components/LeadsList.tsx', code);
console.log('Fixed import');
