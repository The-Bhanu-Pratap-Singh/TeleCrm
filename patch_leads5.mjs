import fs from 'fs';
const content = fs.readFileSync('src/components/LeadsList.tsx', 'utf8');

const replacement = `
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Lead Pipeline</h2>
          <p className="text-sm text-zinc-500 mt-1">Manage and track your customer interactions.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-zinc-200 shadow-sm">
            <button 
              onClick={() => setViewMode('table')}
              className={\`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors \${viewMode === 'table' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-500 hover:text-zinc-900'}\`}
            >
              <ListIcon className="w-4 h-4" /> Table
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={\`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors \${viewMode === 'kanban' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-500 hover:text-zinc-900'}\`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
          </div>
          
          <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
             <input 
               type="text" 
               placeholder="Search clients..." 
               className="pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
          <select 
            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="All">All Statuses</option>
            {stages.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          {(user.role === 'Admin') && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          {!isTechnician && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Lead
            </button>
          )}
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard 
          leads={filteredLeads} 
          stages={stages} 
          user={user} 
          onUpdateLeadStatus={handleUpdateLeadStatus} 
          onEditLead={(lead) => openModal(lead)} 
        />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Client Info</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Product Interest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {sortedLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-zinc-50 text-sm">
                  <td className="p-4">
                    <div className="font-medium text-zinc-900">{lead.clientName}</div>
                    <div className="text-zinc-500">{lead.contact}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-zinc-900">{lead.requiredProduct || '-'}</div>
                    <div className="text-zinc-500 text-xs">{lead.quantity ? \`Qty: \${lead.quantity}\` : ''}</div>
                  </td>
                  <td className="p-4 whitespace-nowrap text-sm text-zinc-500">{lead.assignedUserName || "Unassigned"}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                      {lead.status}
                    </span>
                    {lead.nextFollowUp && (
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> 
                        {new Date(lead.nextFollowUp).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => openModal(lead)}
                      className="text-indigo-600 hover:text-indigo-900 p-2"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {sortedLeads.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No leads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && editingLead && (
`;

// Replace everything from `return (` up to `{isModalOpen && editingLead && (`
const toReplaceRegex = /return \([\s\S]*?\{isModalOpen && editingLead && \(/m;
const newContent = content.replace(toReplaceRegex, replacement + "        <div className=\"fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50\">\n");
fs.writeFileSync('src/components/LeadsList.tsx', newContent);
