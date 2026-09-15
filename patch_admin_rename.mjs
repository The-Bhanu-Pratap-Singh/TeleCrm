import fs from 'fs';

let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// 1. Add lucide icons for editing
content = content.replace(
  "import { UserPlus, ShieldAlert, List, Plus, Trash2, GripVertical, Save } from 'lucide-react';",
  "import { UserPlus, ShieldAlert, List, Plus, Trash2, GripVertical, Save, Edit2, X } from 'lucide-react';"
);

// 2. Add state variables for renaming
content = content.replace(
  "const [newStageName, setNewStageName] = useState('');",
  "const [newStageName, setNewStageName] = useState('');\n  const [editingStageId, setEditingStageId] = useState<number | null>(null);\n  const [editStageName, setEditStageName] = useState('');"
);

// 3. Add handleRenameStage function
const renameFunction = `
  const handleRenameStage = async (id: number) => {
    if (!editStageName.trim()) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(\`/api/stages/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ name: editStageName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename stage');
      setEditingStageId(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };
`;

content = content.replace(
  "const handleDeleteStage = async (id: number) => {",
  `${renameFunction}\n  const handleDeleteStage = async (id: number) => {`
);

// 4. Update the render loop for stages
const oldStageRender = `{stages.map((stage, i) => (
              <div key={stage.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <button type="button" disabled={i === 0} onClick={() => moveStage(i, -1)} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">▲</button>
                    <button type="button" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">▼</button>
                  </div>
                  <span className="font-medium text-sm text-zinc-900">{stage.name}</span>
                </div>
                <button type="button" onClick={() => handleDeleteStage(stage.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}`;

const newStageRender = `{stages.map((stage, i) => (
              <div key={stage.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 group">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex flex-col">
                    <button type="button" disabled={i === 0} onClick={() => moveStage(i, -1)} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">▲</button>
                    <button type="button" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)} className="text-zinc-400 hover:text-indigo-600 disabled:opacity-30">▼</button>
                  </div>
                  {editingStageId === stage.id ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <input 
                        type="text" 
                        className="w-full px-2 py-1 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editStageName}
                        onChange={(e) => setEditStageName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameStage(stage.id);
                          if (e.key === 'Escape') setEditingStageId(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleRenameStage(stage.id)} className="p-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingStageId(null)} className="p-1.5 bg-zinc-100 text-zinc-700 rounded hover:bg-zinc-200">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-sm text-zinc-900">{stage.name}</span>
                  )}
                </div>
                {editingStageId !== stage.id && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingStageId(stage.id);
                        setEditStageName(stage.name);
                      }} 
                      className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
                      title="Rename Stage"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDeleteStage(stage.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1" title="Delete Stage">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}`;

content = content.replace(oldStageRender, newStageRender);

fs.writeFileSync('src/components/AdminPanel.tsx', content);
