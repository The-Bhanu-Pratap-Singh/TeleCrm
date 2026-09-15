import React, { useRef } from 'react';
import type { Lead, PipelineStage, User } from '../types.ts';
import { Calendar, User as UserIcon, ArrowRightLeft, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface KanbanBoardProps {
  leads: Lead[];
  stages: PipelineStage[];
  user: User;
  onUpdateLeadStatus: (leadId: number, newStatus: string) => Promise<void>;
  onEditLead: (lead: Lead) => void;
  selectedLeadIds: number[];
  onToggleSelect: (leadId: number, selected: boolean) => void;
}

export default function KanbanBoard({ leads, stages, user, onUpdateLeadStatus, onEditLead, selectedLeadIds, onToggleSelect }: KanbanBoardProps) {
  const stageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    
    // If dropped in the same column and same position, do nothing
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const leadId = parseInt(draggableId, 10);
    const newStatus = destination.droppableId;
    const lead = leads.find(l => l.id === leadId);

    if (lead && lead.status !== newStatus) {
      if (user.role === 'Admin' || lead.assignedUserId === user.id) {
        onUpdateLeadStatus(leadId, newStatus);
      } else {
        alert('You do not have permission to move this lead.');
      }
    }
  };

  const handleQuickStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, lead: Lead) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    if (newStatus && newStatus !== lead.status) {
      if (user.role === 'Admin' || lead.assignedUserId === user.id) {
        onUpdateLeadStatus(lead.id, newStatus);
      } else {
        alert('You do not have permission to move this lead.');
      }
    }
  };

  const scrollToStage = (stageName: string) => {
    const el = stageRefs.current[stageName];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Mobile Stage Quick Tabs */}
      <div className="flex md:hidden overflow-x-auto gap-2 pb-1.5 -mx-1 px-1 scrollbar-none">
        {stages.map((stage) => {
          const count = leads.filter(l => l.status === stage.name).length;
          return (
            <button
              key={stage.id}
              onClick={() => scrollToStage(stage.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-700 transition-colors"
            >
              <span>{stage.name}</span>
              <span className="px-1.5 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full text-[10px] font-semibold">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex overflow-x-auto pb-4 gap-3 sm:gap-5 h-[calc(100vh-270px)] sm:h-[calc(100vh-240px)] md:h-[calc(100vh-220px)] items-start snap-x snap-mandatory scroll-smooth touch-pan-x">
          {stages.map((stage) => {
            const columnLeads = leads.filter(l => l.status === stage.name);
            
            return (
              <div 
                key={stage.id} 
                ref={el => { stageRefs.current[stage.name] = el; }}
                className="flex-shrink-0 w-[84vw] max-w-[310px] sm:w-72 md:w-80 bg-zinc-100/70 dark:bg-zinc-900/60 rounded-xl flex flex-col max-h-full border border-zinc-200 dark:border-zinc-800 shadow-2xs snap-start transition-colors"
              >
                <div className="p-3 sm:p-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 rounded-t-xl flex justify-between items-center sticky top-0 z-10 transition-colors">
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm truncate mr-2">{stage.name}</h3>
                  <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                    {columnLeads.length}
                  </span>
                </div>
                
                <Droppable droppableId={stage.name}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-2.5 sm:p-3 overflow-y-auto flex-1 space-y-2.5 sm:space-y-3 min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                    >
                      {columnLeads.map((lead, index) => {
                        const draggableId = lead.id.toString();
                        return (
                        <React.Fragment key={draggableId}><Draggable draggableId={draggableId} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onEditLead(lead)}
                              style={{...provided.draggableProps.style}}
                              className={`relative bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-lg shadow-xs border transition-colors ${
                                snapshot.isDragging ? 'border-indigo-500 shadow-md rotate-2 z-50' : 'border-zinc-200 dark:border-zinc-700/80 hover:border-indigo-300 dark:hover:border-indigo-500'
                              }`}
                            >
                              
<div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
  {user.role !== 'Technician' && (
    <input 
      type="checkbox"
      checked={selectedLeadIds.includes(lead.id)}
      onChange={(e) => onToggleSelect(lead.id, e.target.checked)}
      className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
    />
  )}
</div>

                              <div className="flex justify-between items-start mb-1.5 gap-2 pr-6">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <GripVertical className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                  <h4 className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1" title={lead.clientName}>
                                    {lead.clientName}
                                  </h4>
                                </div>
                                <div className="flex items-center" onClick={e => e.stopPropagation()}>
                                  <div className="relative inline-flex items-center" title="Move status">
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-1 pointer-events-none" />
                                    <select
                                      value={lead.status}
                                      onChange={(e) => handleQuickStatusChange(e, lead)}
                                      className="text-[11px] bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded px-1.5 py-0.5 text-zinc-700 dark:text-zinc-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none max-w-[90px] truncate"
                                    >
                                      {stages.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-1.5 mt-2 ml-5">
                                <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 gap-1.5">
                                  <UserIcon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                                  <span className="truncate">{lead.assignedUserName || 'Unassigned'}</span>
                                </div>
                                {lead.nextFollowUp && (
                                  <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                    <span>{new Date(lead.nextFollowUp).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                              
                              {lead.requiredProduct && (
                                <div className="mt-2.5 ml-5 inline-flex items-center px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-700/60 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700 max-w-full truncate">
                                  {lead.requiredProduct}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable></React.Fragment>
                      )})}
                      {provided.placeholder}
                      {columnLeads.length === 0 && !snapshot.isDraggingOver && (
                        <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500 italic">
                          No leads in this stage
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
