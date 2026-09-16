import fs from 'fs';

const removeAuthHeader = (file) => {
  let code = fs.readFileSync(file, 'utf-8');
  code = code.replace(/headers:\s*{\s*Authorization:[^}]*}\s*/g, '');
  // also clean up any trailing comma if necessary, but since headers was the only arg inside the init object besides method sometimes:
  code = code.replace(/,\s*}/g, '}');
  fs.writeFileSync(file, code);
};

removeAuthHeader('src/components/ChatWidget.tsx');
removeAuthHeader('src/components/NotificationBell.tsx');
console.log('Cleaned up fetch auth headers');
