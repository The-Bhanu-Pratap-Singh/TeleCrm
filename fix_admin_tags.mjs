import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

code = code.replace(
  `        </div>
        </div>
      )}`,
  `        </div>
      )}`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
