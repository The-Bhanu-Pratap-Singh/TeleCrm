import http from 'http';
const visited = new Set();
async function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
async function walk(url) {
  if (visited.has(url)) return;
  visited.add(url);
  const content = await fetchText(url);
  if (content.includes("fetch = function") || content.includes(".fetch=function") || content.includes("fetch=function")) {
    console.log("Found in:", url);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("fetch = function") || lines[i].includes(".fetch=function") || lines[i].includes("fetch=function")) {
            console.log("  Line", i, ":", lines[i].substring(0, 150));
        }
    }
  }
  const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    let nextUrl = match[1];
    if (nextUrl.startsWith('/')) {
      await walk('http://localhost:3000' + nextUrl);
    } else if (nextUrl.startsWith('.')) {
      const base = url.substring(0, url.lastIndexOf('/'));
      await walk(base + '/' + nextUrl);
    }
  }
}
walk('http://localhost:3000/src/main.tsx');
