import fs from 'fs';
let app = fs.readFileSync('src/App.tsx', 'utf-8');

const brokenHtml = `<div className="flex items-center gap-2">
            {user && socket && <NotificationBell user={user} socket={socket} />}
            <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 md:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>`;

const fixedHtml = `<div className="flex items-center gap-2">
            {user && socket && <NotificationBell user={user} socket={socket} />}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 md:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>`;

app = app.replace(brokenHtml, fixedHtml);
fs.writeFileSync('src/App.tsx', app);
console.log('Fixed structure in App.tsx');
