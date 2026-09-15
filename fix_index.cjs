const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const script = `
    <script>
      window.addEventListener('error', function(e) {
        if (e.message && e.message.includes('Cannot set property fetch of #<Window>')) {
          e.preventDefault();
          e.stopPropagation();
          return true;
        }
      }, true);
      const originalOnError = window.onerror;
      window.onerror = function(msg, url, line, col, error) {
        if (msg && msg.includes('Cannot set property fetch of #<Window>')) {
          return true;
        }
        if (originalOnError) return originalOnError(msg, url, line, col, error);
      };
      
      // Also try to intercept unhandledrejection just in case
      window.addEventListener('unhandledrejection', function(e) {
        if (e.reason && e.reason.message && e.reason.message.includes('Cannot set property fetch of #<Window>')) {
          e.preventDefault();
        }
      });
    </script>
    <script type="module" src="/src/main.tsx"></script>
`;
html = html.replace('<script type="module" src="/src/main.tsx"></script>', script);
fs.writeFileSync('index.html', html);
