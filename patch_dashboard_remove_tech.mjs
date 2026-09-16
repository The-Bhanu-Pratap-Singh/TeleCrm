import fs from 'fs';

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// The block starts with: {/* Pending Tech Assignments */}
// and ends before: {/* Grid Overview */}

code = code.replace(/      \{\/\* Pending Tech Assignments \*\/\}[\s\S]*?\{\/\* Grid Overview \*\/\}/m, '      {/* Grid Overview */}');

fs.writeFileSync('src/components/Dashboard.tsx', code);
