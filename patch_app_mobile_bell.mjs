import fs from 'fs';
let app = fs.readFileSync('src/App.tsx', 'utf-8');

const oldMobileHeader = `<p className="text-[11px] text-zinc-400 font-medium">TeleCRM</p>
          </div>
        </div>`;

const newMobileHeader = `<p className="text-[11px] text-zinc-400 font-medium">TeleCRM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {user && socket && <NotificationBell user={user} socket={socket} />}
        </div>`;

app = app.replace(oldMobileHeader, newMobileHeader);
fs.writeFileSync('src/App.tsx', app);
console.log('Patched Mobile Bell');
