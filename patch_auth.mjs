import fs from 'fs';

// 1. App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf-8');

// replace state
app = app.replace(
  "const [token, setToken] = useState<string | null>(localStorage.getItem('telecrm_token'));",
  "const [token, setToken] = useState<string | null>(''); // Kept state to prevent prop errors, but unused for auth"
);

// replace verifyToken useEffect
const oldVerify = /useEffect\(\(\) => \{\s*const verifyToken = async \(\) => \{[\s\S]*?verifyToken\(\);\s*\}, \[token\]\);/;
const newVerify = `useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Session verification failed', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verifySession();
  }, []);`;
app = app.replace(oldVerify, newVerify);

// replace handleLogin
const oldHandleLogin = /const handleLogin = \(newToken: string, newUser: User\) => \{[\s\S]*?\};/;
const newHandleLogin = `const handleLogin = (newToken: string, newUser: User) => {
    setUser(newUser);
    // Note: token is handled via HttpOnly cookie now.
  };`;
app = app.replace(oldHandleLogin, newHandleLogin);

// replace handleLogout
const oldHandleLogout = /const handleLogout = \(\) => \{[\s\S]*?setIsMobileMenuOpen\(false\);\s*\};/;
const newHandleLogout = `const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setIsMobileMenuOpen(false);
  };`;
app = app.replace(oldHandleLogout, newHandleLogout);

fs.writeFileSync('src/App.tsx', app);


// 2. main.tsx
let main = fs.readFileSync('src/main.tsx', 'utf-8');
const oldInterceptor = /if \(url && url\.startsWith\('\/api\/'\) && url !== '\/api\/users\/login'\) \{[\s\S]*?window\.dispatchEvent\(new Event\('auth-error'\)\);\s*\}/;
const newInterceptor = `if (url && url.startsWith('/api/') && url !== '/api/users/login') {
      window.dispatchEvent(new Event('auth-error'));
    }`;
main = main.replace(oldInterceptor, newInterceptor);
fs.writeFileSync('src/main.tsx', main);

console.log('App.tsx and main.tsx patched');
