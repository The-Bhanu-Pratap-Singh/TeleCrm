import fs from 'fs';

let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// 1. Add import
content = content.replace(
  "import { UserPlus, ShieldAlert, List, Plus, Trash2, GripVertical, Save, Edit2, X } from 'lucide-react';",
  "import { UserPlus, ShieldAlert } from 'lucide-react';\nimport AdminPipelineSettings from './AdminPipelineSettings.tsx';"
);

content = content.replace(
  "import type { User, Role, PipelineStage } from '../types.ts';",
  "import type { User, Role } from '../types.ts';"
);


// 2. Extract out all the stage state and functions
content = content.replace(
  /const \[stages, setStages\].*?\n/,
  ""
);
content = content.replace(
  /const \[newStageName, setNewStageName\].*?\n/,
  ""
);
content = content.replace(
  /const \[editingStageId, setEditingStageId\].*?\n/,
  ""
);
content = content.replace(
  /const \[editStageName, setEditStageName\].*?\n/,
  ""
);

content = content.replace(
  /fetch\('\/api\/stages'.*?catch\(console\.error\);\n/s,
  ""
);

content = content.replace(
  /const handleCreateStage = async \([\s\S]*?const moveStage = async \([\s\S]*?\}\n  \};\n/s,
  ""
);

// 3. Replace the JSX for stages with the new component
content = content.replace(
  /<div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t">[\s\S]*?<\/div>\n    <\/div>/s,
  `<div className="pt-6 border-t border-zinc-200">\n        <AdminPipelineSettings token={token} />\n      </div>\n    </div>`
);

fs.writeFileSync('src/components/AdminPanel.tsx', content);
