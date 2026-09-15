import fs from 'fs';

let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

// Add delete user function
const deleteUserFunc = `
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
if (!code.includes('handleDeleteUser')) {
  code = code.replace("const handleAddUser = async (e: React.FormEvent) => {", deleteUserFunc + "\n  const handleAddUser = async (e: React.FormEvent) => {");
}

// Add delete button next to edit (or instead if edit doesn't exist)
// Let's check what the table row looks like
