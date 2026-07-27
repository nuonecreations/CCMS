const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/import \{ useCallback, useEffect, useMemo, useState \} from 'react';/, 
  `import { useCallback, useEffect, useMemo, useState } from 'react';\nimport { API_BASE, fetchWithAuth, getUser, setAuthToken, setUser, removeAuthToken, removeUser } from './auth';`);

content = content.replace(/const API_BASE = .*;/g, '');

content = content.replace(/fetch\(/g, 'fetchWithAuth(');

content = content.replace(/export default function App\(\) \{/, 
  `
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(\`\${API_BASE}/auth/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      setAuthToken(data.access_token);
      setUser(data.user);
      onLogin();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f5f7fb' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 12, width: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px', textAlign: 'center' }}>CCMS Login</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div className="field">
            <label>Username</label>
            <input required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="primary" style={{ marginTop: 10, justifyContent: 'center' }}>Login</button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getUser());
  if (!isAuthenticated) return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  const currentUser = getUser();
  const isAdmin = currentUser?.role === 'ADMIN';`);

content = content.replace(/const \[active, setActive\] = useState\('Dashboard'\);/, 
  `const [active, setActive] = useState(isAdmin ? 'Dashboard' : 'Call Queue');`);

content = content.replace(/<nav>([\s\S]*?)<\/nav>/m, (match) => {
  return `
        <nav>
          {isAdmin && <button className={\`nav-item \${active === 'Dashboard' ? 'active' : ''}\`} onClick={() => setActive('Dashboard')}><LayoutDashboard size={18}/> Overview</button>}
          <button className={\`nav-item \${active === 'Call Queue' ? 'active' : ''}\`} onClick={() => setActive('Call Queue')}><Phone size={18}/> Call Queue</button>
          <button className={\`nav-item \${active === 'Customers' ? 'active' : ''}\`} onClick={() => setActive('Customers')}><Users size={18}/> Customers</button>
          <button className={\`nav-item \${active === 'Complaints' ? 'active' : ''}\`} onClick={() => setActive('Complaints')}><AlertTriangle size={18}/> Complaints</button>
          {isAdmin && <button className={\`nav-item \${active === 'Reports' ? 'active' : ''}\`} onClick={() => setActive('Reports')}><BarChart3 size={18}/> Reports</button>}
          {isAdmin && <button className={\`nav-item \${active === 'Upload Data' ? 'active' : ''}\`} onClick={() => setActive('Upload Data')}><UploadCloud size={18}/> Upload Data</button>}
          {isAdmin && <button className={\`nav-item \${active === 'Users' ? 'active' : ''}\`} onClick={() => setActive('Users')}><Users size={18}/> Users</button>}
        </nav>
  `;
});

content = content.replace(/<div className="operator">([\s\S]*?)<\/div>/m, (match) => {
  return `
        <div className="operator">
          <div className="avatar">{currentUser?.name?.[0] || 'U'}</div>
          <div><b>{currentUser?.name || 'User'}</b><span>{currentUser?.role || 'Operator'}</span></div>
          <button className="icon-btn" style={{marginLeft: 'auto'}} onClick={() => { removeAuthToken(); removeUser(); setIsAuthenticated(false); }}>
            <XCircle size={16}/>
          </button>
        </div>
  `;
});

content = content.replace(/{active === 'Upload Data' && <UploadPage \/>}/, 
  `{active === 'Upload Data' && isAdmin && <UploadPage />}
          {active === 'Users' && isAdmin && <UsersPage />}`);

content += `

function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = () => { fetchWithAuth(\`\${API_BASE}/users\`).then(r => r.json()).then(setUsers).catch(()=>{}); };
  useEffect(() => { load(); }, []);

  async function submit(e: any) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetchWithAuth(\`\${API_BASE}/users\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd.entries()))
    });
    setShowForm(false);
    load();
  }

  return <div>
    <div className="page-heading"><div><p className="eyebrow">SETTINGS</p><h1>User Management</h1></div><button className="primary" onClick={() => setShowForm(true)}>+ Add User</button></div>
    <section className="panel" style={{ padding: 0 }}>
      <table className="data-table">
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => <tr key={u.id}>
            <td><b>{u.username}</b></td>
            <td>{u.name}</td>
            <td><span className="code">{u.role}</span></td>
            <td><button className="ghost" onClick={async () => { await fetchWithAuth(\`\${API_BASE}/users/\${u.id}\`, {method: 'DELETE'}); load(); }}>Delete</button></td>
          </tr>)}
        </tbody>
      </table>
    </section>
    {showForm && <div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>Create User</h2><button type="button" className="icon-btn" onClick={() => setShowForm(false)}><X size={20}/></button></div>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Username</label><input name="username" required /></div>
          <div className="field"><label>Name</label><input name="name" required /></div>
          <div className="field"><label>Password</label><input name="password" type="password" required /></div>
          <div className="field"><label>Role</label><select name="role"><option>CALL_OPERATOR</option><option>ADMIN</option></select></div>
        </div>
        <div className="modal-actions"><button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary">Create User</button></div>
      </form>
    </div></div>}
  </div>;
}
`;

fs.writeFileSync('src/App.tsx', content);
