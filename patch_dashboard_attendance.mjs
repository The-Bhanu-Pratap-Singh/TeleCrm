import fs from 'fs';
const file = 'src/components/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf-8');

const imports = `import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';
import { Activity, ClipboardList, Target, TrendingUp, Users, CalendarClock, Download, CheckSquare, Clock, Users as UsersIcon } from 'lucide-react';
import type { Lead, User, ActivityLog, Attendance, Task } from '../types.ts';
`;

code = code.replace(/import React.*?\n.*?\n.*?\n.*?\n/m, imports);

const stateAndFetch = `
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [dailyNotes, setDailyNotes] = useState('');
  const [teamAttendance, setTeamAttendance] = useState<any[]>([]);

  useEffect(() => {
    fetchAttendance();
    if (user.role === 'Admin') {
      fetchTeamAttendance();
    }
  }, [user]);

  const fetchAttendance = async () => {
    try {
      // Auto punch-in on load if not already
      const pRes = await fetch('/api/attendance/punch-in', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const pData = await pRes.json();
      
      const res = await fetch('/api/attendance/today', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const data = await res.json();
      setAttendance(data.attendance);
      setTasks(data.tasks);
      setDailyNotes(data.attendance?.notes || '');
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeamAttendance = async () => {
    try {
      const res = await fetch('/api/attendance/all', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      setTeamAttendance(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handlePunchOut = async () => {
    if(!confirm('Are you sure you want to punch out for the day?')) return;
    try {
      await fetch('/api/attendance/punch-out', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      fetchAttendance();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await fetch('/api/attendance/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ notes: dailyNotes })
      });
      alert('Daily notes saved!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ text: newTaskText })
      });
      setNewTaskText('');
      fetchAttendance();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (id: number, completed: boolean) => {
    try {
      await fetch(\`/api/tasks/\${id}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ completed: !completed })
      });
      fetchAttendance();
    } catch (err) {
      console.error(err);
    }
  };
`;

code = code.replace('const [activityFilter, setActivityFilter] = useState<\'today\' | \'7days\' | \'30days\'>(\'today\');', 'const [activityFilter, setActivityFilter] = useState<\'today\' | \'7days\' | \'30days\'>(\'today\');\n' + stateAndFetch);

const attendanceWidget = `
      {/* Attendance & Daily Tasks row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* My Daily Tasks */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col transition-colors overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" /> My Daily Tasks
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add a new task for today..."
                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
              />
              <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap">
                Add Task
              </button>
            </form>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] max-h-[200px]">
              {tasks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">No tasks added yet.</div>
              ) : (
                tasks.map(task => (
                  <label key={task.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id, task.completed)}
                      className="mt-0.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={\`text-sm \${task.completed ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-200'}\`}>
                      {task.text}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Daily Login & Attendance Tracking */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col transition-colors overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" /> Daily Attendance & Log
            </h3>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Punch-In Time</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {attendance ? new Date(attendance.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
                {attendance?.punchOut && (
                  <span className="text-xs text-zinc-500 mt-1">Punched out: {new Date(attendance.punchOut).toLocaleTimeString()}</span>
                )}
              </div>
              <button
                onClick={handlePunchOut}
                disabled={!attendance || !!attendance.punchOut}
                className="px-6 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {attendance?.punchOut ? 'Punched Out' : 'Punch Out'}
              </button>
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Daily Work Updates (Notes)</label>
              <textarea
                value={dailyNotes}
                onChange={e => setDailyNotes(e.target.value)}
                placeholder="E.g., Called 25 leads, scheduled 3 visits..."
                className="flex-1 resize-none border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors min-h-[80px]"
              />
              <div className="flex justify-end">
                <button onClick={handleSaveNotes} className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Admin Team Monitor Widget */}
      {user.role === 'Admin' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/20">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" /> Live Team Attendance Monitor
            </h3>
            <button onClick={fetchTeamAttendance} className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Team Member</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Punch In</th>
                  <th className="px-4 py-3 font-medium">Punch Out</th>
                  <th className="px-4 py-3 font-medium">Tasks Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {teamAttendance.map((ta: any) => (
                  <tr key={ta.user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-medium">{ta.user.username} <span className="text-xs text-zinc-400 font-normal ml-2">({ta.user.role})</span></td>
                    <td className="px-4 py-3">
                      {ta.attendance ? (
                        ta.attendance.punchOut ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Offline</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">Absent</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{ta.attendance?.punchIn ? new Date(ta.attendance.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3">{ta.attendance?.punchOut ? new Date(ta.attendance.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full" 
                            style={{ width: ta.totalTasks > 0 ? \`\${(ta.completedTasks / ta.totalTasks) * 100}%\` : '0%' }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500">{ta.completedTasks} / {ta.totalTasks}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
`;

code = code.replace('<div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">', attendanceWidget + '\n\n      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">');

fs.writeFileSync(file, code);
console.log('Patched Dashboard for Attendance/Tasks');
