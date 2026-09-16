import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

code = code.replace(
  '<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">',
  "{activeTab === 'users' && (\n      <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8\">"
);

code = code.replace(
  `        </div>
        </div>
      )}
      
      {activeTab === 'pipeline' && (`,
  `        </div>
      </div>
      )}
      
      {activeTab === 'pipeline' && (`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
