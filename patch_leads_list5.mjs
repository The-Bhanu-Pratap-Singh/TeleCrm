import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

const contactInputRe = /<div>\s*<label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Contact<\/label>\s*<input type="text" required disabled=\{isTechnician\}\s*className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs sm:text-sm disabled:bg-zinc-100 dark:disabled:bg-zinc-800\/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"\s*value=\{editingLead\.contact \|\| ''\}\s*onChange=\{e => setEditingLead\(\{\.\.\.editingLead, contact: e\.target\.value\}\)\}\s*\/>\s*<\/div>/g;

const contactPlusEmailPlusTags = `<div>
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
                  </div>`;

code = code.replace(contactInputRe, contactPlusEmailPlusTags);

fs.writeFileSync('src/components/LeadsList.tsx', code);
