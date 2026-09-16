import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Lead } from '../types';

import enUS from 'date-fns/locale/en-US';

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
  const events = useMemo(() => {
    return leads
      .filter(l => l.visitSchedule || l.installationSchedule || l.nextFollowUp)
      .map(l => {
        const eventsArr = [];
        
        if (l.visitSchedule) {
          eventsArr.push({
            id: `visit-\${l.id}`,
            title: `[Visit] \${l.clientName}`,
            start: new Date(l.visitSchedule),
            end: new Date(l.visitSchedule),
            allDay: true,
            resource: l
          });
        }
        
        if (l.installationSchedule) {
          eventsArr.push({
            id: `install-\${l.id}`,
            title: `[Install] \${l.clientName}`,
            start: new Date(l.installationSchedule),
            end: new Date(l.installationSchedule),
            allDay: true,
            resource: l
          });
        }

        if (l.nextFollowUp && !l.visitSchedule && !l.installationSchedule) {
           eventsArr.push({
            id: `followup-\${l.id}`,
            title: `[Follow-up] \${l.clientName}`,
            start: new Date(l.nextFollowUp),
            end: new Date(l.nextFollowUp),
            allDay: true,
            resource: l
          });
        }
        
        return eventsArr;
      })
      .flat();
  }, [leads]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-[600px] w-full">
       <style dangerouslySetInnerHTML={{__html: `
        .rbc-toolbar button { color: inherit !important; }
        .rbc-event { background-color: #4f46e5 !important; border-radius: 4px; font-size: 11px; }
        .dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-header { border-color: #27272a; color: #f4f4f5; }
        .dark .rbc-day-bg + .rbc-day-bg { border-color: #27272a; }
        .dark .rbc-month-row + .rbc-month-row { border-color: #27272a; }
        .dark .rbc-off-range-bg { background-color: #18181b; }
        .dark .rbc-today { background-color: #27272a; }
       `}} />
       <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        views={['month', 'week', 'agenda']}
      />
    </div>
  );
}
