import fs from 'fs';

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Add stages state
content = content.replace(
  'const [activityFilter, setActivityFilter] = useState<\'today\' | \'7days\' | \'30days\'>(\'7days\');',
  'const [activityFilter, setActivityFilter] = useState<\'today\' | \'7days\' | \'30days\'>(\'7days\');\n  const [stages, setStages] = useState<{name: string, orderIndex: number}[]>([]);'
);

// Fetch stages in useEffect
content = content.replace(
  'fetch(\'/api/leads\', {',
  `fetch('/api/stages', { headers: { 'Authorization': \`Bearer \${token}\` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStages(data); })
      .catch(console.error);
    
    fetch('/api/leads', {`
);

// Replace hardcoded chartData with dynamic mapping
content = content.replace(
  `const chartData = [
    { name: 'New', count: statusCounts['New'] || 0 },
    { name: 'Follow-up', count: statusCounts['Follow-up'] || 0 },
    { name: 'Visiting', count: statusCounts['Visiting'] || 0 },
    { name: 'Scheduled', count: statusCounts['Scheduled'] || 0 },
    { name: 'Installed', count: statusCounts['Installed'] || 0 },
    { name: 'Closed', count: statusCounts['Closed'] || 0 },
  ];`,
  `const chartData = stages.map(stage => ({
    name: stage.name,
    count: statusCounts[stage.name] || 0
  }));`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
