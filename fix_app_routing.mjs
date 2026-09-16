import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');
if (!code.includes('<CalendarAppView')) {
  code = code.replace(
    "{currentView === 'activity' && user.role === 'Admin' && <ActivityLogViewer token={token} />}",
    "{currentView === 'activity' && user.role === 'Admin' && <ActivityLogViewer token={token} />}\n            {currentView === 'calendar' && <CalendarAppView user={user} token={token} />}"
  );
  fs.writeFileSync('src/App.tsx', code);
  console.log('Fixed routing');
} else {
  console.log('Routing already has CalendarAppView');
}
