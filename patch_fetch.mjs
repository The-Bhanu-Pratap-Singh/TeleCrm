import fs from 'fs';

let main = fs.readFileSync('src/main.tsx', 'utf-8');

const interceptor = `
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.status === 401 || response.status === 403) {
    // If it's an API request, we should probably log the user out
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (url && url.startsWith('/api/') && url !== '/api/users/login') {
      localStorage.removeItem('telecrm_token');
      localStorage.removeItem('telecrm_user');
      window.dispatchEvent(new Event('auth-error'));
    }
  }
  return response;
};
`;

if (!main.includes('window.fetch = async function')) {
  main = interceptor + '\n' + main;
  fs.writeFileSync('src/main.tsx', main);
  console.log('Added fetch interceptor');
}

let app = fs.readFileSync('src/App.tsx', 'utf-8');
const eventListener = `
  useEffect(() => {
    const handleAuthError = () => {
      handleLogout();
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);
`;

if (!app.includes('auth-error')) {
  app = app.replace('  const handleLogout = () => {', eventListener + '\n  const handleLogout = () => {');
  fs.writeFileSync('src/App.tsx', app);
  console.log('Added event listener for auth-error');
}
