import fs from 'fs';

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const replacement = `  useEffect(() => {
    const fetchAllData = () => {
      fetch('/api/stages', { headers: { 'Authorization': \`Bearer \${token}\` } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setStages(data); })
        .catch(console.error);
      
      fetch('/api/leads', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setLeads(data);
      })
      .catch(console.error);

      if (user.role === 'Admin') {
        fetch('/api/activity', {
          headers: { 'Authorization': \`Bearer \${token}\` }
        })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setActivities(data);
        })
        .catch(console.error);
      }
    };
    
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000);
    return () => clearInterval(interval);
  }, [token, user.role]);`;

code = code.replace(/  useEffect\(\(\) => \{[\s\S]*?\.catch\(console\.error\);\n    \}\n  \}, \[token, user\.role\]\);/, replacement);

fs.writeFileSync('src/components/Dashboard.tsx', code);
