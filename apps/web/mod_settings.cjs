const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const resetSystem = async \(\) => \{[\s\S]*?return <div className="page-heading">/;
const replacement = `const resetSystem = async () => {
    if(!confirm('WARNING: This will permanently delete ALL data (Customers, Calls, Complaints, etc) except Users. Are you absolutely sure?')) return;
    const res = await fetchWithAuth(\`\${API_BASE}/imports/system-reset\`, { method: 'POST' });
    if(res.ok) alert('System Reset Successful!');
    else alert('Failed to reset system');
  };

  const [imports, setImports] = useState<any[]>([]);
  const loadImports = () => { fetchWithAuth(\`\${API_BASE}/imports\`).then(r => r.json()).then(setImports).catch(()=>{}); };
  useEffect(() => { if (isSuper || user?.role === 'ADMIN') loadImports(); }, [isSuper, user?.role]);

  const deleteImport = async (id: number) => {
    if(!confirm('Are you sure you want to delete this specific database import?')) return;
    await fetchWithAuth(\`\${API_BASE}/imports/\${id}\`, { method: 'DELETE' });
    loadImports();
  };

  return <div className="page-heading">`;

app = app.replace(regex, replacement);

const settingsSectionRegex = /<h3 style={{color: '#b91c1c'}}>Danger Zone<\/h3>/;
const settingsReplacement = `<h3>Uploaded Databases (Imports)</h3>
        {imports.length === 0 ? <p className="muted">No databases uploaded yet.</p> : (
          <table className="data-table" style={{marginTop: 10}}>
            <thead><tr><th>ID</th><th>Month</th><th>Imported On</th><th>Total Rows</th><th>Actions</th></tr></thead>
            <tbody>
              {imports.map(imp => <tr key={imp.id}>
                <td>{imp.id}</td><td>{imp.month}</td>
                <td>{new Date(imp.importedAt).toLocaleDateString()}</td>
                <td>{imp.totalRows}</td>
                <td><button className="ghost" style={{color: 'red'}} onClick={() => deleteImport(imp.id)}>Delete</button></td>
              </tr>)}
            </tbody>
          </table>
        )}
      </section>

      {isSuper && (
        <section className="panel" style={{border: '1px solid #fee2e2'}}>
          <h3 style={{color: '#b91c1c'}}>Danger Zone</h3>`;

app = app.replace(settingsSectionRegex, settingsReplacement);

fs.writeFileSync('src/App.tsx', app);
