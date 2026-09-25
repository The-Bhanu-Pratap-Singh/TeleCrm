import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Lead } from '../types';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  leads: Lead[];
}

export default function CalendarView({ leads }: CalendarViewProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const events = useMemo(() => {
    return leads
      .filter(l => l.visitSchedule || l.installationSchedule || l.nextFollowUp)
      .map(l => {
        const eventsArr = [];
        
        if (l.visitSchedule) {
          eventsArr.push({
            id: `visit-${l.id}`,
            title: `[Site Visit] ${l.clientName} (${l.address || 'Field'})`,
            start: new Date(l.visitSchedule),
            end: new Date(l.visitSchedule),
            allDay: true,
            type: 'visit',
            isOverdue: l.visitSchedule.split('T')[0] < todayStr && !['Installed', 'Closed'].includes(l.status || ''),
            resource: l
          });
        }
        
        if (l.installationSchedule) {
          eventsArr.push({
            id: `install-${l.id}`,
            title: `[Install] ${l.clientName} - ${l.requiredProduct || 'Hangers'}`,
            start: new Date(l.installationSchedule),
            end: new Date(l.installationSchedule),
            allDay: true,
            type: 'install',
            isOverdue: l.installationSchedule.split('T')[0] < todayStr && l.status !== 'Installed',
            resource: l
          });
        }

        if (l.nextFollowUp) {
          eventsArr.push({
            id: `followup-${l.id}`,
            title: `[Follow-up] ${l.clientName} (${l.contact})`,
            start: new Date(l.nextFollowUp),
            end: new Date(l.nextFollowUp),
            allDay: true,
            type: 'followup',
            isOverdue: l.nextFollowUp.split('T')[0] < todayStr && !['Closed', 'Closed-Lost', 'Installed'].includes(l.status || ''),
            resource: l
          });
        }
        
        return eventsArr;
      })
      .flat();
  }, [leads, todayStr]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[640px] w-full flex flex-col">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-600"></span>
          <span className="text-zinc-700 dark:text-zinc-300">Installation Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-violet-600"></span>
          <span className="text-zinc-700 dark:text-zinc-300">Site Visit Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-600"></span>
          <span className="text-zinc-700 dark:text-zinc-300">Telecaller Follow-up</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-600"></span>
          <span className="text-zinc-700 dark:text-zinc-300">Overdue Event</span>
        </div>
      </div>

       <style dangerouslySetInnerHTML={{__html: `
        .rbc-toolbar button { color: inherit !important; }
        .dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-header { border-color: #27272a; color: #f4f4f5; }
        .dark .rbc-day-bg + .rbc-day-bg { border-color: #27272a; }
        .dark .rbc-month-row + .rbc-month-row { border-color: #27272a; }
        .dark .rbc-off-range-bg { background-color: #18181b; }
        .dark .rbc-today { background-color: #27272a; }
       `}} />

       <div className="flex-1 min-h-0">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={['month', 'week', 'agenda']}
          eventPropGetter={(event: any) => {
            let bg = '#4f46e5';
            if (event.isOverdue) bg = '#e11d48';
            else if (event.type === 'install') bg = '#059669';
            else if (event.type === 'visit') bg = '#7c3aed';
            else if (event.type === 'followup') bg = '#d97706';

            return {
              style: {
                backgroundColor: bg,
                color: '#ffffff',
                borderRadius: '6px',
                padding: '2px 6px',
                fontWeight: 600,
                fontSize: '11px',
                border: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }
            };
          }}
        />
       </div>
    </div>
  );
}
