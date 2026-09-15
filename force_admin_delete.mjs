import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

if (!code.includes('Trash2 } from')) {
  code = code.replace(
    "import { UserPlus, ShieldAlert } from 'lucide-react';", 
    "import { UserPlus, ShieldAlert, Trash2 } from 'lucide-react';"
  );
}

const funcBody = `
  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      const res = await fetch(\`/api/users/\${id}\`, {
        method: 'DELETE',
        headers: { Authorization: \`Bearer \${token}\` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Network error while deleting user');
    }
  };
`;

if (!code.includes('const handleDeleteUser =')) {
  code = code.replace(
    "const handleCreateUser = async (e: React.FormEvent) => {", 
    funcBody + "\n  const handleCreateUser = async (e: React.FormEvent) => {"
  );
}

fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log('Forced AdminPanel delete');
