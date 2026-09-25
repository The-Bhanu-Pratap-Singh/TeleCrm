import { syncLeadToGoogleCalendar } from '../lib/googleAuth.ts';
import React, { useEffect, useState, useRef } from 'react';
import type { User, Lead, LeadStatus } from '../types.ts';
import { 
  Plus, X, Edit, MessageSquare, Bot, Loader2, Search, Download, History, 
  CalendarClock, LayoutGrid, List as ListIcon, CheckCircle2, FileText, Flame, 
  Upload, ChevronDown, ChevronUp, Save, Printer, MapPin, Lock, ShieldCheck,
  UserCheck, Clock
} from 'lucide-react';
import KanbanBoard from './KanbanBoard.tsx';
import WhatsappChatDrawer from './WhatsappChatDrawer';
import type { PipelineStage } from '../types.ts';
import Papa from 'papaparse';
import LeadMap from './LeadMap.tsx';

export default function LeadsList({ user, token }: { user: User, token: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [originalAssigneeId, setOriginalAssigneeId] = useState<number | null>(null);
  const [reassignmentReason, setReassignmentReason] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'audit'>('details');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [aiScript, setAiScript] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [users, setUsers] = useState<Partial<User>[]>([]);
  
  // Auto-save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedLeadRef = useRef<string>('');
  
  // Filtering state
  const [sortBy, setSortBy] = useState<'priority' | 'followUp' | 'recent'>('priority');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'map'>('table');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<number | 'All'>('All');

  // Note input state for adding new notes
  const [newNote, setNewNote] = useState('');
  const [newNextFollowUp, setNewNextFollowUp] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkAssignUserId, setBulkAssignUserId] = useState<number | ''>('');
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | ''>('');
  const [bulkTechId, setBulkTechId] = useState<string>('');
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
  const [bulkAssignSuccess, setBulkAssignSuccess] = useState('');

  const isSlaBreached = (lead: Lead) => {
    if (lead.techAssignmentStatus !== 'Pending' || !lead.techAssignedAt) return false;
    const assignedTime = new Date(lead.techAssignedAt).getTime();
    const thirtyMins = 30 * 60 * 1000;
    return Date.now() - assignedTime > thirtyMins;
  };

  const handleBulkUpdate = async () => {
    if (selectedLeadIds.length === 0) return;
    setBulkAssignLoading(true);
    try {
      const res = await fetch('/api/leads/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          status: bulkStatus || undefined,
          pendingTechId: bulkTechId ? Number(bulkTechId) : undefined,
        }),
      });
      if (res.ok) {
        setBulkAssignSuccess('Updated selected leads');
        setTimeout(() => setBulkAssignSuccess(''), 3000);
        setSelectedLeadIds([]);
        setBulkStatus('');
        setBulkTechId('');
        fetchLeads();
      }
    } catch (e) {
      console.error('Bulk update error:', e);
    } finally {
      setBulkAssignLoading(false);
    }
  };

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteLeadId, setNoteLeadId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [expandedNotesId, setExpandedNotesId] = useState<number | null>(null);
  const [expandedNoteText, setExpandedNoteText] = useState('');
  const [isSavingExpandedNote, setIsSavingExpandedNote] = useState(false);
  
  const toggleExpandedNote = (lead: Lead) => {
    if (expandedNotesId === lead.id) {
      setExpandedNotesId(null);
    } else {
      setExpandedNotesId(lead.id);
      setExpandedNoteText(typeof lead.notes === 'string' ? lead.notes : JSON.stringify(lead.notes || []));
    }
  };

  const autoSaveTimerRef2 = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (expandedNotesId !== null && expandedNoteText !== undefined) {
      if (autoSaveTimerRef2.current) {
        clearTimeout(autoSaveTimerRef2.current);
      }
      autoSaveTimerRef2.current = setTimeout(async () => {
        setIsSavingExpandedNote(true);
        try {
          const res = await fetch(`/api/leads/${expandedNotesId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: expandedNoteText })
          });
          if (res.ok) {
            setLeads(prev => prev.map(l => l.id === expandedNotesId ? {
              ...l,
              notes: [{ text: expandedNoteText, timestamp: new Date().toISOString(), author: user?.username || 'User' }]
            } : l));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsSavingExpandedNote(false);
        }
      }, 500);
    }
    return () => {
      if (autoSaveTimerRef2.current) clearTimeout(autoSaveTimerRef2.current);
    };
  }, [expandedNoteText, expandedNotesId]);



  
  
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'High': return 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400';
      case 'Low': return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400';
      default: return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(sortedLeads.map(l => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectLead = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(prev => [...prev, id]);
    } else {
      setSelectedLeadIds(prev => prev.filter(leadId => leadId !== id));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignUserId || selectedLeadIds.length === 0) return;
    setBulkAssignLoading(true);
    setBulkAssignSuccess('');
    try {
      const res = await fetch('/api/leads/bulk-assign', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          assignedUserId: Number(bulkAssignUserId)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBulkAssignSuccess(`Successfully reassigned ${selectedLeadIds.length} lead(s)!`);
        setSelectedLeadIds([]);
        setBulkAssignUserId('');
        fetchLeads();
        setTimeout(() => setBulkAssignSuccess(''), 3000);
      } else {
        alert(data.error || 'Failed to bulk assign leads');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to bulk assign leads');
    } finally {
      setBulkAssignLoading(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selectedLeadIds.length === 0) return;
    setBulkAssignLoading(true);
    setBulkAssignSuccess('');
    try {
      const res = await fetch('/api/leads/bulk-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leadIds: selectedLeadIds, status: bulkStatus })
      });
      if (res.ok) {
        setBulkAssignSuccess(`Successfully updated status for ${selectedLeadIds.length} lead(s)!`);
        setSelectedLeadIds([]);
        setBulkStatus('');
        fetchLeads();
        setTimeout(() => setBulkAssignSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    } finally {
      setBulkAssignLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedLeadIds.length} leads? This action cannot be undone.`)) return;
    
    setBulkAssignLoading(true);
    setBulkAssignSuccess('');
    try {
      const res = await fetch('/api/leads/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      });
      if (res.ok) {
        setBulkAssignSuccess(`Successfully deleted ${selectedLeadIds.length} lead(s)!`);
        setSelectedLeadIds([]);
        fetchLeads();
        setTimeout(() => setBulkAssignSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete leads');
    } finally {
      setBulkAssignLoading(false);
    }
  };

  const submitQuickNote = async () => {
    if (!noteLeadId || !noteText.trim()) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/leads/${noteLeadId}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ note: noteText.trim() })
      });
      if (res.ok) {
        setNoteText('');
        setIsNoteModalOpen(false);
        setNoteLeadId(null);
        fetchLeads(); // refresh to get the latest (optional if you just want to update UI, but good for consistency)
      } else {
        alert('Failed to add note');
      }
    } catch (err) {
      console.error(err);
      alert('Error adding note');
    } finally {
      setNoteLoading(false);
    }
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...lead, status: newStatus })
      });
      if (res.ok) {
        fetchLeads();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update lead status');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update lead status');
    }
  };

  const fetchLeads = () => {
    fetch('/api/leads', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLeads(data); })
      .catch(console.error);
  };

  const fetchUsers = () => {
    fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(console.error);
  };

  useEffect(() => {
    fetchLeads();
    fetchUsers();
    fetchStages();

    const handleGlobalAddLead = () => {
      openModal();
    };
    window.addEventListener('open-add-lead-modal', handleGlobalAddLead);
    return () => window.removeEventListener('open-add-lead-modal', handleGlobalAddLead);
  }, [token]);

  const fetchStages = () => {
    fetch('/api/stages', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => { if (Array.isArray(data)) setStages(data); })
    .catch(console.error);
  };

  // Auto-save mechanism
  useEffect(() => {
    if (!editingLead || !editingLead.id) return;
    
    // Simple deep equality check to prevent redundant saves
    // We omit 'notes' and 'nextFollowUp' from the auto-save comparison because they are handled
    // uniquely via the handleSave / add note function, but actually it's fine to just save what we have.
    const currentLeadStr = JSON.stringify(editingLead);
    if (lastSavedLeadRef.current === currentLeadStr) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const url = `/api/leads/${editingLead.id}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: currentLeadStr
        });
        
        if (res.ok) {
           lastSavedLeadRef.current = currentLeadStr;
           setLastSaved(new Date());
           // Update the leads list in the background silently
           fetch('/api/leads', { headers: { 'Authorization': `Bearer ${token}` } })
             .then(r => r.json())
             .then(data => { if (Array.isArray(data)) setLeads(data); })
             .catch(console.error);
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [editingLead, token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;

    let payload = { ...editingLead };
    
    if (newNextFollowUp) {
      payload.nextFollowUp = newNextFollowUp;
    }
    
    // Append new note if exists
    if (newNote.trim() || newNextFollowUp) {
      let finalNote = newNote.trim() || "Follow-up / Update logged";
      if (newNextFollowUp) {
        finalNote += `\n(Next Follow-up set to: ${newNextFollowUp})`;
      }
      const noteObj = {
        text: finalNote,
        timestamp: new Date().toISOString(),
        author: user.username
      };
      payload.notes = [...(payload.notes || []), noteObj];
    }

    const url = payload.id ? `/api/leads/${payload.id}` : '/api/leads';
    const method = payload.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...payload,
          reassignmentReason: reassignmentReason || undefined
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to save lead');
        return;
      }
      setIsModalOpen(false);
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    }
  };

  const generateScript = async () => {
    if (!editingLead) return;
    setAiLoading(true);
    setAiScript('');
    try {
      const lastNote = editingLead.notes && editingLead.notes.length > 0 
        ? editingLead.notes[editingLead.notes.length - 1].text 
        : '';
        
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clientName: editingLead.clientName,
          requiredProduct: editingLead.requiredProduct,
          quantity: editingLead.quantity,
          price: editingLead.price,
          lastNote
        })
      });
      const data = await res.json();
      setAiScript(data.script);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchAuditLogs = async (leadId: number) => {
    try {
      setAuditLoading(true);
      const res = await fetch(`/api/leads/${leadId}/audit-trail`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch audit trail:', e);
    } finally {
      setAuditLoading(false);
    }
  };

  const openModal = (lead?: Lead) => {
    const newEditingLead = lead ? { ...lead } : { status: 'New', notes: [] };
    setEditingLead(newEditingLead);
    setOriginalAssigneeId(lead?.assignedUserId || null);
    setReassignmentReason('');
    setActiveModalTab('details');
    setAuditLogs([]);
    lastSavedLeadRef.current = JSON.stringify(newEditingLead);
    setLastSaved(null);
    setIsSaving(false);
    setNewNote('');
    setNewNextFollowUp('');
    setAiScript('');
    setIsModalOpen(true);
    if (lead?.id) {
      fetchAuditLogs(lead.id);
    }
  };

  
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/leads/bulk-import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ leads: results.data })
          });
          if (res.ok) {
            const data = await res.json();
            alert(`Imported ${data.count} leads successfully.${data.skipped > 0 ? ` Skipped ${data.skipped} duplicate leads (matching mobile numbers).` : ''}`);
            fetchLeads();
          } else {
            alert('Failed to import leads');
          }
        } catch (err) {
          console.error(err);
          alert('Error importing leads');
        }
      }
    });
    // Reset file input
    e.target.value = '';
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Client Name', 'Contact', 'Email', 'Tags', 'Product', 'Quantity', 'Price', 'Status', 'Next Follow-up', 'Install Date'];
    const rows = filteredLeads.map(l => [
      l.id,
      `"${l.clientName}"`,
      `"${l.contact}"`,
      `"${l.email || ''}"`,
      `"${(l.tags || []).join(', ')}"`,
      `"${l.requiredProduct || ''}"`,
      `"${l.quantity || ''}"`,
      `"${l.price || ''}"`,
      l.status,
      l.nextFollowUp || '',
      l.actualInstallDate || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'leads_export.csv';
    link.click();
  };

  const isTechnician = user.role === 'Technician';

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      lead.clientName.toLowerCase().includes(searchLower) || 
      lead.contact.toLowerCase().includes(searchLower) ||
      (lead.email || '').toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
    const matchesAssignee = assigneeFilter === 'All' || lead.assignedUserId === assigneeFilter;
    return matchesSearch && matchesStatus && matchesAssignee;
  });


  const calculateHotness = (lead: Lead): number => {
    let score = 0;
    // Status scoring
    const s = lead.status.toLowerCase();
    if (s.includes('negotiation')) score += 30;
    else if (s.includes('scheduled')) score += 20;
    else if (s.includes('quoted')) score += 15;
    else if (s.includes('interested') && !s.includes('not')) score += 10;
    else if (s.includes('not interested') || s.includes('lost') || s.includes('rejected')) score -= 50;

    // Follow-up scoring
    if (lead.nextFollowUp) {
      const d = new Date(lead.nextFollowUp);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffDays = (d.getTime() - today.getTime()) / (1000 * 3600 * 24);
      if (diffDays <= 0) score += 40; // Overdue or today
      else if (diffDays <= 2) score += 20;
      else if (diffDays <= 7) score += 10;
    }

    // Activity scoring
    if (lead.notes && lead.notes.length > 0) {
      score += Math.min(30, lead.notes.length * 10);
    }
    
    return Math.max(0, Math.min(100, score)); // clamp 0-100
  };

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'priority') {
      return calculateHotness(b) - calculateHotness(a);
    } else if (sortBy === 'recent') {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    } else {
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
    }
  });


  
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 sm:space-y-6 relative pb-20 sm:pb-0">
      
      
      {selectedLeadIds.length > 0 && user.role !== 'Technician' && (
        <div className="no-print sticky top-0 z-50 mb-4 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 shadow-md flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
            {selectedLeadIds.length} lead(s) selected
          </span>
          <div className="flex gap-2">
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Update Status...</option>
              {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select
              value={bulkTechId}
              onChange={e => setBulkTechId(e.target.value)}
              className="text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Assign Tech...</option>
              {users.filter(u => u.role === 'Technician').map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <button
              onClick={handleBulkUpdate}
              disabled={!bulkStatus && !bulkTechId}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Apply Updates
            </button>
            <button
              onClick={() => setSelectedLeadIds([])}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {['New', 'Follow Up', 'Qualified', 'Closed'].map(status => {
          const count = leads.filter(l => l.status === status).length;
          return (
            <div key={status} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-colors">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{status} Leads</span>
              <span className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Lead Pipeline</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Manage and track customer interactions across all stages.</p>
        </div>
        
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Table / Kanban view toggle */}
          <div className="flex items-center justify-center gap-1 bg-white dark:bg-zinc-900 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800 shadow-2xs transition-colors">
            <button 
              onClick={() => setViewMode('table')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${viewMode === 'table' ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <ListIcon className="w-4 h-4" /> Table
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${viewMode === 'map' ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <MapPin className="w-4 h-4" /> Map
            </button>
          </div>
          
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
             <input 
               type="text" 
               placeholder="Search clients..." 
               className="w-full sm:w-44 md:w-52 pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>

          {/* Status Filter */}
          <select 
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="All">All Statuses</option>
            {stages.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          
          {/* Sort By */}
          <select 
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="priority">Sort by Priority (Hotness)</option>
            <option value="followUp">Sort by Next Follow-up</option>
            <option value="recent">Sort by Most Recent</option>
          </select>

          {/* Assignee Filter (Admins/Managers) */}
          {(user.role === 'Admin' || user.role === 'Social Media Manager' || user.role === 'Telecaller') && (
            <select 
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              value={assigneeFilter === 'All' ? 'All' : assigneeFilter.toString()}
              onChange={e => setAssigneeFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))}
            >
              <option value="All">All Assignees</option>
              {users.map(u => (
                <option key={u.id} value={u.id?.toString()}>{u.username}</option>
              ))}
            </select>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span className="hidden sm:inline">Export</span> CSV
            </button>

            {!isTechnician && (
              <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer">
                <Upload className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="hidden sm:inline">Import</span> CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
              </label>
            )}

            
            <button
              onClick={() => window.print()}
              className="no-print flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
{!isTechnician && (
              <button
                onClick={() => openModal()}
                className="hidden md:flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 transition-colors shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Lead
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex flex-nowrap overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        <div className="flex-none bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs min-w-[120px] transition-colors">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Leads</p>
          <p className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mt-1">{leads.length}</p>
        </div>
        {stages.map(stage => (
          <div key={stage.id} className="flex-none bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs min-w-[120px] transition-colors">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{stage.name}</p>
            <p className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mt-1">{statusCounts[stage.name] || 0}</p>
          </div>
        ))}
      </div>

      {bulkAssignSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/60 text-xs sm:text-sm font-medium">
          {bulkAssignSuccess}
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedLeadIds.length > 0 && user.role !== 'Technician' && (
        <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 p-3.5 sm:p-4 rounded-xl shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 transition-colors">
          <div className="text-xs sm:text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between xl:justify-start gap-2">
            <span>{selectedLeadIds.length} lead(s) selected</span>
            <button 
              onClick={() => setSelectedLeadIds([])} 
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 text-xs underline xl:ml-2"
            >
              Deselect All
            </button>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            {/* Bulk Assign */}
            {user.role === 'Admin' && (
              <div className="flex items-stretch sm:items-center gap-2.5">
                <select
                  className="px-3 py-2 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={bulkAssignUserId}
                  onChange={e => setBulkAssignUserId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Assign To User --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={bulkAssignLoading || bulkAssignUserId === ''}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  Assign
                </button>
              </div>
            )}

            {/* Bulk Status */}
            <div className="flex items-stretch sm:items-center gap-2.5">
              <select
                className="px-3 py-2 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value as any)}
              >
                <option value="">-- Set Status --</option>
                {stages.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleBulkStatusChange}
                disabled={bulkAssignLoading || bulkStatus === ''}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Update
              </button>
            </div>

            {/* Bulk Delete */}
            {user.role === 'Admin' && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkAssignLoading}
                className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs sm:text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {viewMode === 'kanban' ? (
        <KanbanBoard 
          leads={filteredLeads} 
          stages={stages} 
          user={user} 
          onUpdateLeadStatus={handleUpdateLeadStatus} 
          onEditLead={(lead) => openModal(lead)}
          selectedLeadIds={selectedLeadIds}
          onToggleSelect={handleSelectLead} 
        />
      ) : (
        <div>
          {/* Mobile Card List (Screen < md) */}
          <div className="md:hidden space-y-3">
            {/* Mobile Select All Header */}
            {sortedLeads.length > 0 && user.role !== 'Technician' && (
              <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-2xs transition-colors">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500" 
                    checked={sortedLeads.length > 0 && selectedLeadIds.length === sortedLeads.length}
                    onChange={handleSelectAll}
                  />
                  <span>Select All ({sortedLeads.length})</span>
                </label>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{selectedLeadIds.length} selected</span>
              </div>
            )}

            {sortedLeads.map(lead => (
              <div 
                key={lead.id} 
                className={`bg-white dark:bg-zinc-900 p-3.5 rounded-xl border transition-all ${
                  selectedLeadIds.includes(lead.id) ? 'border-indigo-300 dark:border-indigo-500/80 bg-indigo-50/20 dark:bg-indigo-950/30' : 'border-zinc-200 dark:border-zinc-800'
                } shadow-2xs space-y-2.5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {user.role !== 'Technician' && (
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500" 
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                      />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">{lead.clientName}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{lead.contact}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        setNoteLeadId(lead.id);
                        setIsNoteModalOpen(true);
                        setNoteText('');
                      }}
                      className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors mr-1"
                      title="Quick Note"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => openModal(lead)}
                      className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Edit Lead"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                  <div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{lead.requiredProduct || 'No product specified'}</span>
                    {lead.quantity && <span className="text-zinc-500 dark:text-zinc-400 ml-1.5">• Qty: {lead.quantity}</span>}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {lead.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                  <span className="truncate max-w-[160px]">Assigned: <span className="font-medium text-zinc-700 dark:text-zinc-300">{lead.assignedUserName || 'Unassigned'}</span></span>
                  {lead.nextFollowUp && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/50">
                      <CalendarClock className="w-3 h-3" />
                      {new Date(lead.nextFollowUp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {sortedLeads.length === 0 && (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                No leads found.
              </div>
            )}
          </div>

          {/* Desktop Responsive Table (Screen >= md) */}
          <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-850 dark:bg-zinc-800/70">
                  <tr>
                    {user.role !== 'Technician' && (
                      <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500" 
                          checked={sortedLeads.length > 0 && selectedLeadIds.length === sortedLeads.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                    )}
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Client Info</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Product Interest</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Assigned To</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  
                  {sortedLeads.map(lead => (
                    <React.Fragment key={lead.id}>
                    <tr className={`group hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:shadow-sm hover:-translate-y-0.5 text-sm transition-all duration-200 border-l-4 ${getPriorityColor(lead.priority).split(' ')[0]} ${expandedNotesId === lead.id ? 'bg-zinc-50 dark:bg-zinc-800/30 border-indigo-500' : ''}`}>
                      {user.role !== 'Technician' && (
                        <td className="px-5 py-3.5">
                          <input 
                            type="checkbox" 
                            className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500" 
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                          />
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {lead.clientName}
                          <span className={`no-print px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(lead.priority)}`}>
                            {lead.priority || 'Medium'}
                          </span>
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{lead.contact} {lead.email ? `• ${lead.email}` : ''}</div>
                        {lead.tags && lead.tags.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-1.5">
                             {lead.tags.map(tag => (
                               <span key={tag} className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium">
                                 {tag}
                               </span>
                             ))}
                           </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-zinc-900 dark:text-zinc-100 font-medium">{lead.requiredProduct || '-'}</div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs">{lead.quantity ? `Qty: ${lead.quantity}` : ''}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300 font-medium">{lead.assignedUserName || "Unassigned"}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          {calculateHotness(lead) >= 50 ? <Flame className="w-4 h-4 text-rose-500" /> : calculateHotness(lead) >= 30 ? <Flame className="w-4 h-4 text-orange-400" /> : <Flame className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />}
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Score: {calculateHotness(lead)}</span>
                        </div>

                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {lead.status}
                        </span>
                        

                        {lead.techAssignmentStatus === 'Pending' && (
                          <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded ${isSlaBreached(lead) ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 animate-pulse' : 'bg-amber-50 dark:bg-amber-900/40 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
                            {isSlaBreached(lead) ? '⚠️ SLA Breached (30m+)' : 'Tech Pending'}
                          </div>
                        )}
                        {lead.techAssignmentStatus === 'Declined' && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/40 text-[10px] font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                            Tech Declined
                          </div>
                        )}
                        {lead.techAssignmentStatus === 'Accepted' && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Tech Confirmed
                          </div>
                        )}


                        {lead.nextFollowUp && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> 
                            {new Date(lead.nextFollowUp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => toggleExpandedNote(lead)}
                          className={`text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors mr-1 ${expandedNotesId === lead.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
                          title="Expand Notes"
                        >
                          {expandedNotesId === lead.id ? <ChevronUp className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => openModal(lead)}
                          className="text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Edit Lead"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                                        </tr>
                    {expandedNotesId === lead.id && (
                      <tr className="bg-zinc-50/50 dark:bg-zinc-800/30 border-l-2 border-indigo-500">
                        <td colSpan={user.role !== 'Technician' ? 6 : 5} className="px-5 py-4">
                          <div className="flex flex-col gap-2 max-w-3xl ml-auto mr-auto w-full">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Quick Notes</label>
                            <textarea
                              className="w-full h-24 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-shadow"
                              placeholder="Add notes for this lead..."
                              value={expandedNoteText}
                              onChange={e => setExpandedNoteText(e.target.value)}
                            />
                            <div className="flex justify-between items-center gap-2">
                              <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                                {isSavingExpandedNote ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Auto-saved</>}
                              </div>
                              <button
                                onClick={() => setExpandedNotesId(null)}
                                className="px-3 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                  {sortedLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                        No leads found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {isNoteModalOpen && noteLeadId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full overflow-hidden transition-colors">
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850 dark:bg-zinc-800/50">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Add Quick Note
              </h3>
              <button 
                onClick={() => setIsNoteModalOpen(false)} 
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 p-1.5 rounded-full border border-zinc-200 dark:border-zinc-700"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Note Content</label>
                <textarea 
                  rows={4}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-zinc-400"
                  placeholder="Enter your note here..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850 dark:bg-zinc-800/50">
              <button 
                onClick={() => setIsNoteModalOpen(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
                disabled={noteLoading}
              >
                Cancel
              </button>
              <button 
                onClick={submitQuickNote}
                disabled={noteLoading || !noteText.trim()}
                className="px-4 sm:px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center min-w-[100px] shadow-xs transition-colors"
              >
                {noteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && editingLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto transition-colors">
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850 dark:bg-zinc-800/50 flex-shrink-0">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                  {editingLead.id ? 'Edit Lead' : 'New Lead'}
                </h3>
                {editingLead.id && (
                  <div className="flex items-center bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50">
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('details')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        activeModalTab === 'details' 
                          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' 
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      Lead Details
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModalTab('audit');
                        if (editingLead.id) fetchAuditLogs(editingLead.id);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        activeModalTab === 'audit' 
                          ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Audit Trail ({auditLogs.length})</span>
                    </button>
                  </div>
                )}
                {editingLead.id && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium">
                    {isSaving ? (
                      <span className="text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </span>
                    ) : lastSaved ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {activeModalTab === 'audit' ? (
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    <strong>Immutable Audit Trail:</strong> Every action, stage change, hand-off reason, price negotiation, and schedule is permanently recorded and cannot be altered or deleted.
                  </span>
                </div>

                {auditLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs">Loading audit trail...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    No audit records found for this lead.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                    {auditLogs.map((log, index) => {
                      const isReassignment = log.action.includes('Reassigned') || log.action.includes('Assignment');
                      const isStage = log.action.includes('Stage');
                      const isPrice = log.action.includes('Price');
                      const isSla = log.action.includes('SLA') || log.action.includes('Escalat');

                      const badgeColor = isReassignment
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : isStage
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : isPrice
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : isSla
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';

                      return (
                        <div key={log.id || index} className="relative group">
                          {/* Timeline dot */}
                          <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${
                            isSla ? 'bg-rose-500' : isReassignment ? 'bg-amber-500' : isStage ? 'bg-blue-500' : isPrice ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}></div>

                          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-750">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}>
                                  {log.action}
                                </span>
                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                  {log.username || 'System'}
                                  {log.userRole && (
                                    <span className="text-[10px] text-zinc-400 font-normal ml-1">
                                      ({log.userRole})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
                              {log.details}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('details')}
                    className="px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    &larr; Back to Details
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {editingLead.id && (editingLead.notes?.length || editingLead.nextFollowUp || editingLead.installationSchedule) ? (
                <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Quick Context
                  </h4>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                    {editingLead.notes && editingLead.notes.length > 0 && (
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1.5 opacity-80">Most Recent Note</p>
                        <div className="bg-white/80 dark:bg-zinc-800/80 p-3 rounded-lg border border-blue-50 dark:border-blue-900/30 shadow-sm">
                          <p className="text-sm text-blue-950 dark:text-blue-100 italic">"{editingLead.notes[editingLead.notes.length - 1].text}"</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 font-medium">
                            — {editingLead.notes[editingLead.notes.length - 1].author} on {new Date(editingLead.notes[editingLead.notes.length - 1].timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {(editingLead.nextFollowUp || editingLead.installationSchedule) && (
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1.5 opacity-80 flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5" /> Upcoming Actions
                        </p>
                        <div className="space-y-2 bg-white/80 dark:bg-zinc-800/80 p-3 rounded-lg border border-blue-50 dark:border-blue-900/30 shadow-sm">
                          {editingLead.nextFollowUp && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">Follow-up:</span>
                              <span className="text-sm text-blue-950 dark:text-blue-100 font-semibold">{new Date(editingLead.nextFollowUp).toLocaleDateString()}</span>
                            </div>
                          )}
                          {editingLead.installationSchedule && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">Installation:</span>
                              <span className="text-sm text-blue-950 dark:text-blue-100 font-semibold">{new Date(editingLead.installationSchedule).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {/* Basic Info */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-1.5">Client Details</h4>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Client Name</label>
                    <input type="text" required disabled={isTechnician}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={editingLead.clientName || ''}
                      onChange={e => setEditingLead({...editingLead, clientName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Contact</label>
                    <input type="text" required disabled={isTechnician}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={editingLead.contact || ''}
                      onChange={e => setEditingLead({...editingLead, contact: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                    <input type="email" disabled={isTechnician}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={editingLead.email || ''}
                      onChange={e => setEditingLead({...editingLead, email: e.target.value})}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tags (comma-separated)</label>
                    <input type="text" disabled={isTechnician}
                      placeholder="e.g. Cold Call, Referral, Web Inquiry"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={editingLead.tags?.join(', ') || ''}
                      onChange={e => setEditingLead({...editingLead, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Address</label>
                    <textarea disabled={isTechnician}
                      rows={2}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={editingLead.address || ''}
                      onChange={e => setEditingLead({...editingLead, address: e.target.value})}
                    />
                  </div>
                </div>

                {/* Product & Sales */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-1.5">Product & Schedule</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Product</label>
                      <input type="text" disabled={isTechnician}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={editingLead.requiredProduct || ''}
                        onChange={e => setEditingLead({...editingLead, requiredProduct: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Quantity/Length</label>
                      <input type="text" disabled={isTechnician}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={editingLead.quantity || ''}
                        onChange={e => setEditingLead({...editingLead, quantity: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Negotiated Price</label>
                    <input type="text" disabled={isTechnician}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={editingLead.price || ''}
                      onChange={e => setEditingLead({...editingLead, price: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                      <select 
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={editingLead.status}
                        onChange={e => setEditingLead({...editingLead, status: e.target.value as LeadStatus})}
                      >
                        {stages.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Next Follow-up</label>
                      <input type="date" disabled={isTechnician}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={editingLead.nextFollowUp ? editingLead.nextFollowUp.split('T')[0] : ''}
                        onChange={e => setEditingLead({...editingLead, nextFollowUp: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                     <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Install Schedule</label>
                      <input type="date" disabled={isTechnician && editingLead.status !== 'Scheduled'}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={editingLead.installationSchedule ? editingLead.installationSchedule.split('T')[0] : ''}
                        onChange={e => setEditingLead({...editingLead, installationSchedule: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Actual Install Date</label>
                      <input type="date" disabled={!isTechnician && user.role !== 'Admin'}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={editingLead.actualInstallDate ? editingLead.actualInstallDate.split('T')[0] : ''}
                        onChange={e => setEditingLead({...editingLead, actualInstallDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-1.5">Notes & History</h4>
                {editingLead.notes && editingLead.notes.length > 0 && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl space-y-2.5 max-h-40 overflow-y-auto border border-zinc-200/60 dark:border-zinc-700/60">
                    {editingLead.notes.map((n, i) => (
                      <div key={i} className="text-xs sm:text-sm">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{n.author}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 text-[11px] ml-2">{new Date(n.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <p className="text-zinc-700 dark:text-zinc-300 mt-0.5">{n.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3.5 sm:p-4 rounded-xl space-y-3 sm:space-y-4 shadow-2xs">
                    <h5 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">Log Follow-up / Assignment</h5>
                    <textarea
                      placeholder="Enter follow-up response or assignment reason here..."
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      rows={2}
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Next Follow-up Reminder</label>
                        <input 
                          type="datetime-local"
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          value={newNextFollowUp}
                          onChange={e => setNewNextFollowUp(e.target.value)}
                        />
                      </div>
                      {(user.role === 'Admin' || (!editingLead.id && (user.role === 'Social Media Manager' || user.role === 'Telecaller'))) && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                            <span>Assign To</span>
                            {editingLead.id && user.role !== 'Admin' && (
                              <span className="text-[10px] text-zinc-400 font-normal flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked (Admin Only)
                              </span>
                            )}
                            {editingLead.id && user.role === 'Admin' && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Admin Reassignment
                              </span>
                            )}
                          </label>
                          <select
                            disabled={Boolean(editingLead.id && user.role !== 'Admin')}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs sm:text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/60 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={editingLead.assignedUserId || ''}
                            onChange={e => setEditingLead({...editingLead, assignedUserId: Number(e.target.value)})}
                          >
                            <option value="">-- Select User --</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Admin Reassignment Reason Input */}
                      {user.role === 'Admin' && editingLead.id && Number(editingLead.assignedUserId) !== Number(originalAssigneeId) && (
                        <div className="sm:col-span-2 p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl space-y-1">
                          <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200">
                            Reason for Reassignment (Required for Immutable Audit Trail)
                          </label>
                          <input 
                            type="text"
                            required
                            placeholder="e.g. Telecaller on leave, workload balancing, regional territory shift"
                            className="w-full px-3 py-1.5 border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            value={reassignmentReason}
                            onChange={e => setReassignmentReason(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Gemini Section */}
              {!isTechnician && editingLead.id && (
                <div className="p-3.5 sm:p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> AI Follow-up Script
                    </h4>
                    <button
                      type="button"
                      onClick={generateScript}
                      disabled={aiLoading}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
                    >
                      {aiLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      Generate WhatsApp Script
                    </button>
                  </div>
                  {aiScript && (
                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed shadow-2xs">
                      {aiScript}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  {editingLead.id ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                >
                  {editingLead.id ? (newNote.trim() || newNextFollowUp ? 'Save Note & Close' : 'Done') : 'Create Lead'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    
      {editingLead && (
        <WhatsappChatDrawer
          lead={editingLead as Lead}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          token={token}
        />
      )}
</div>
  );
}
