import React, { useEffect, useState } from 'react';
import type { PipelineStage } from '../types.ts';
import { List, Plus, Trash2, Save, Edit2, X } from 'lucide-react';

export default function AdminPipelineSettings({ token }: { token: string }) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStages = () => {
    fetch('/api/stages', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStages(data); })
      .catch(console.error);
  };

  useEffect(() => {
    fetchStages();
  }, [token]);

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newStageName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create stage');
      setNewStageName('');
      fetchStages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRenameStage = async (id: number) => {
    if (!editStageName.trim()) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/stages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editStageName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename stage');
      setEditingStageId(null);
      fetchStages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteStage = async (id: number) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/stages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete stage');
      fetchStages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const moveStage = async (index: number, direction: -1 | 1) => {
    const newStages = [...stages];
    if (index + direction < 0 || index + direction >= newStages.length) return;
    
    // Swap
    const temp = newStages[index];
    newStages[index] = newStages[index + direction];
    newStages[index + direction] = temp;
    
    // Update orderIndex
    const reordered = newStages.map((s, i) => ({ ...s, orderIndex: i }));
    setStages(reordered);
    
    // Save to backend
    try {
      await fetch('/api/stages/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ stages: reordered })
      });
    } catch (err) {
      console.error(err);
      fetchStages(); // Reset on error
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
      {/* Stages Manager */}
      <div className="lg:col-span-1 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs h-fit transition-colors">
        <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm sm:text-base flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Add Pipeline Stage
        </h3>
        
        {error && <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 p-2.5 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-100 dark:border-red-900/50 mb-4">{error}</div>}
        {success && <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-100 dark:border-emerald-900/50 mb-4">{success}</div>}
        
        <form onSubmit={handleCreateStage} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Stage Name</label>
            <input 
              type="text" 
              required 
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
              value={newStageName} 
              onChange={e => setNewStageName(e.target.value)} 
              placeholder="e.g. Qualified" 
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors shadow-xs"
          >
            Add Stage
          </button>
        </form>
      </div>

      {/* Stages List */}
      <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs overflow-hidden h-fit transition-colors">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm sm:text-base flex items-center gap-2">
            <List className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Pipeline Stages
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Reorder or edit stages</span>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {stages.map((stage, i) => (
            <div key={stage.id} className="p-3 sm:p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group gap-2 sm:gap-4 transition-colors">
              <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button 
                    type="button" 
                    disabled={i === 0} 
                    onClick={() => moveStage(i, -1)} 
                    className="w-7 h-6 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-20 text-xs transition-colors"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button 
                    type="button" 
                    disabled={i === stages.length - 1} 
                    onClick={() => moveStage(i, 1)} 
                    className="w-7 h-6 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-20 text-xs transition-colors"
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>

                {editingStageId === stage.id ? (
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 max-w-sm">
                    <input 
                      type="text" 
                      className="w-full px-2.5 py-1.5 border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editStageName}
                      onChange={(e) => setEditStageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameStage(stage.id);
                        if (e.key === 'Escape') setEditingStageId(null);
                      }}
                      autoFocus
                    />
                    <button 
                      onClick={() => handleRenameStage(stage.id)} 
                      className="p-1.5 sm:p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex-shrink-0"
                      title="Save"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setEditingStageId(null)} 
                      className="p-1.5 sm:p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono w-5">#{i + 1}</span>
                    <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">{stage.name}</span>
                  </div>
                )}
              </div>
              {editingStageId !== stage.id && (
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingStageId(stage.id);
                      setEditStageName(stage.name);
                    }} 
                    className="p-1.5 sm:p-2 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Rename Stage"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleDeleteStage(stage.id)} 
                    className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors" 
                    title="Delete Stage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {stages.length === 0 && (
            <div className="p-6 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">No stages configured.</div>
          )}
        </div>
      </div>
    </div>
  );
}
