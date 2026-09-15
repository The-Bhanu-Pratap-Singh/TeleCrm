import fs from 'fs';
let code = fs.readFileSync('src/components/KanbanBoard.tsx', 'utf-8');
code = code.replace(/<Draggable key=\{draggableId as any\} draggableId=\{draggableId\} index=\{index\}>/g, '<React.Fragment key={draggableId}><Draggable draggableId={draggableId} index={index}>');
code = code.replace(/<\/Draggable>/g, '</Draggable></React.Fragment>');
fs.writeFileSync('src/components/KanbanBoard.tsx', code);
