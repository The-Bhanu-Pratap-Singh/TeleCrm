import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /useEffect\(\(\) => \{\s*if \(token\) \{\s*\/\/ In a real app[\s\S]*?setUser\(JSON\.parse\(storedUser\)\);\s*\}\s*\}\s*setLoading\(false\);\s*\}, \[token\]\);/;

const replacement = `useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const res = await fetch('/api/me', {
            headers: { Authorization: \`Bearer \${token}\` }
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            localStorage.setItem('telecrm_user', JSON.stringify(userData));
          } else {
            handleLogout();
          }
        } catch (err) {
          console.error(err);
          // If network error, try to use local storage as fallback
          const storedUser = localStorage.getItem('telecrm_user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, [token]);`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
