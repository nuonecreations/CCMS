const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Move Logout button to Header next to System Online
app = app.replace(
  /<div className="operator">([\s\S]*?)<\/div>/,
  `
        <div className="operator">
          <div className="avatar">{currentUser?.name?.[0] || 'U'}</div>
          <div><b>{currentUser?.name || 'User'}</b><span>{currentUser?.role || 'Operator'}</span></div>
        </div>
  `
);
app = app.replace(
  /<span className="online-badge"><span className="dot"><\/span>System Online<\/span>/,
  `<span className="online-badge"><span className="dot"></span>System Online</span>
          <button className="ghost" style={{ padding: '4px 8px', fontSize: 12, marginLeft: 10, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => { removeAuthToken(); removeUser(); window.location.reload(); }}>
            <XCircle size={14}/> Logout
          </button>`
);

// 2. Wrap Search bar in condition
app = app.replace(
  /<div className="search-bar">([\s\S]*?)<\/div>/,
  `
          {['Customers', 'Call Queue', 'Complaints'].includes(active) && (
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="Search records..." />
            </div>
          )}
  `
);

// 3. Update active pages for Settings
app = app.replace(
  /{isAdmin && <button className={\`nav-item \${active === 'Users' \? 'active' : ''}\`} onClick={\(\) => setActive\('Users'\)}><Users size={18}\/> Users<\/button>}/,
  `{isAdmin && <button className={\`nav-item \${active === 'Users' ? 'active' : ''}\`} onClick={() => setActive('Users')}><Users size={18}/> Users</button>}
          {isAdmin && <button className={\`nav-item \${active === 'Settings' ? 'active' : ''}\`} onClick={() => setActive('Settings')}><Settings size={18}/> Settings</button>}`
);

app = app.replace(
  /{active === 'Users' && isAdmin && <UsersPage \/>}/,
  `{active === 'Users' && isAdmin && <UsersPage />}
          {active === 'Settings' && isAdmin && <SettingsPage />}`
);

// 4. Update Users Page (SUPER_ADMIN role option)
app = app.replace(
  /<option>ADMIN<\/option><\/select><\/div>/,
  `<option>ADMIN</option><option>SUPER_ADMIN</option></select></div>`
);

// Add SettingsPage component
const settingsPageStr = `
function SettingsPage() {
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [msg, setMsg] = useState('');
  const user = getUser();
  const isSuper = user?.role === 'SUPER_ADMIN';
  
  const changePassword = async (e: any) => {
    e.preventDefault();
    if(pass !== confirmPass) return setMsg('Passwords do not match');
    const res = await fetchWithAuth(\`\${API_BASE}/auth/change-password\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: pass })
    });
    if(res.ok) { setMsg('Password changed successfully!'); setPass(''); setConfirmPass(''); }
    else setMsg('Failed to change password.');
  };

  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-theme');
  };

  const resetSystem = async () => {
    if(!confirm('WARNING: This will permanently delete ALL data (Customers, Calls, Complaints, etc) except Users. Are you absolutely sure?')) return;
    const res = await fetchWithAuth(\`\${API_BASE}/imports/system-reset\`, { method: 'POST' });
    if(res.ok) alert('System Reset Successful!');
    else alert('Failed to reset system');
  };

  return <div className="page-heading">
    <div><p className="eyebrow">SYSTEM</p><h1>Settings</h1></div>
    <div style={{display: 'flex', flexDirection: 'column', gap: 20, width: '100%', marginTop: 20}}>
      
      <section className="panel">
        <h3>Change Password</h3>
        {msg && <p>{msg}</p>}
        <form onSubmit={changePassword} style={{display: 'flex', gap: 10, alignItems: 'end', marginTop: 15}}>
          <div className="field"><label>New Password</label><input type="password" required value={pass} onChange={e=>setPass(e.target.value)} /></div>
          <div className="field"><label>Confirm Password</label><input type="password" required value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} /></div>
          <button className="primary" type="submit">Update</button>
        </form>
      </section>
      
      <section className="panel">
        <h3>Appearance</h3>
        <button className="ghost" onClick={toggleDarkMode} style={{marginTop: 15}}>Toggle Dark / Light Mode</button>
      </section>

      {isSuper && (
        <section className="panel" style={{border: '1px solid #fee2e2'}}>
          <h3 style={{color: '#b91c1c'}}>Danger Zone</h3>
          <p style={{color: '#666', marginTop: 5, marginBottom: 15}}>These actions are irreversible.</p>
          <div style={{display: 'flex', gap: 10}}>
            <button className="ghost" style={{color: '#b91c1c', borderColor: '#b91c1c'}} onClick={resetSystem}>Reset System Database</button>
          </div>
        </section>
      )}

    </div>
  </div>;
}
`;

app += settingsPageStr;

// Write back
fs.writeFileSync('src/App.tsx', app);
