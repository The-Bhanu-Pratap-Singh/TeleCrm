import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

code = code.replace(
  '<th className="p-4 text-right">Role</th>',
  '<th className="p-4 text-right">Role</th>\n                  <th className="p-4 text-right">Workload</th>'
);

code = code.replace(
  `                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button `,
  `                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {u.role === 'Technician' ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium" title="Assigned Tasks">{u.assignedCount || 0} Active</span>
                          {u.pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded" title="Pending Acceptance">{u.pendingCount} Pending</span>}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button `
);

code = code.replace(
  '<td colSpan={4} className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No active users.</td>',
  '<td colSpan={5} className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No active users.</td>'
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
