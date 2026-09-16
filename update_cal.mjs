import fs from 'fs';

let code = fs.readFileSync('src/components/CalendarView.tsx', 'utf-8');

code = code.replace(/const locales = \{[\s\S]*?'en-US': require\('date-fns\/locale\/en-US'\),[\s\S]*?\};/, `import enUS from 'date-fns/locale/en-US';

const locales = {
  'en-US': enUS,
};`);

fs.writeFileSync('src/components/CalendarView.tsx', code);
