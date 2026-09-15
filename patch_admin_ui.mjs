import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

// Add Trash icon to import
if (!code.includes('Trash2')) {
  code = code.replace("import { Plus, X, Users, ShieldAlert", "import { Plus, X, Users, ShieldAlert, Trash2");
}

// Add Actions column header
code = code.replace(
  '<th className="p-4 text-right">Role</th>',
  '<th className="p-4 text-right">Role</th>\n                  <th className="p-4 text-right w-20">Actions</th>'
);

// Add Actions column cell
const roleCell = `<td className="p-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {u.role}
                      </span>
                    </td>`;
const newCells = roleCell + `\n                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>`;
code = code.replace(roleCell, newCells);

// Fix colSpan for empty row
code = code.replace('colSpan={3}', 'colSpan={4}');

fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log('Patched AdminPanel UI');
