const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const complaintsCompRegex = /function ComplaintsPage\(\) \{[\s\S]*?return <div>[\s\S]*?<\/div>;\n}/;

const replacement = `function ComplaintsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [accountNo, setAccountNo] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  
  const load = () => { fetchWithAuth(\`\${API_BASE}/customers/complaints/all\`).then(r => r.json()).then(j => setData(j.data)).catch(()=>setData([])); };
  useEffect(() => { load(); }, []);

  function formatAccountNo(val: string) {
    const v = val.replace(/\\D/g, '');
    if (v.length <= 2) return v;
    if (v.length <= 4) return \`\${v.slice(0, 2)}/\${v.slice(2)}\`;
    if (v.length <= 7) return \`\${v.slice(0, 2)}/\${v.slice(2, 4)}/\${v.slice(4)}\`;
    if (v.length <= 10) return \`\${v.slice(0, 2)}/\${v.slice(2, 4)}/\${v.slice(4, 7)}/\${v.slice(7)}\`;
    return \`\${v.slice(0, 2)}/\${v.slice(2, 4)}/\${v.slice(4, 7)}/\${v.slice(7, 10)}/\${v.slice(10, 12)}\`;
  }

  const handleAccountChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAccountNo(e.target.value);
    setAccountNo(formatted);
    if (formatted.length === 16) {
      try {
        const r = await fetchWithAuth(\`\${API_BASE}/customers?search=\${encodeURIComponent(formatted)}&pageSize=1\`);
        const j = await r.json();
        if (j.data && j.data.length > 0) {
          setCustomerId(j.data[0].id);
          setCustomerName(j.data[0].customerName || '');
          setMobileNumber(j.data[0].mobileNumber || '');
        } else {
          setCustomerId(null);
        }
      } catch { setCustomerId(null); }
    } else {
      setCustomerId(null);
    }
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editData && !customerId) { alert('Valid customer account required.'); return; }
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    
    if (editData) {
      await fetchWithAuth(\`\${API_BASE}/customers/complaints/\${editData.id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetchWithAuth(\`\${API_BASE}/customers/\${customerId}/complaints\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    
    closeModal();
    load();
  }
  
  function openEdit(c: any) {
    setEditData(c);
    setAccountNo(c.customer?.accountNumber || '');
    setCustomerName(c.customer?.customerName || '');
    setMobileNumber(c.customer?.mobileNumber || '');
    setCustomerId(c.customerId);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false); setEditData(null); setAccountNo(''); setCustomerName(''); setMobileNumber(''); setCustomerId(null);
  }

  async function deleteComplaint(id: number) {
    if(!confirm('Are you sure you want to delete this complaint?')) return;
    await fetchWithAuth(\`\${API_BASE}/customers/complaints/\${id}\`, { method: 'DELETE' });
    load();
  }

  return <div>
    <div className="page-heading"><div><p className="eyebrow">SUPPORT</p><h1>Complaints</h1></div><button className="primary" onClick={() => setShowForm(true)}>+ Capture Complaint</button></div>
    
    <div className="complaint-workflow">
      <div className="workflow-step">1. Registration</div><div className="workflow-step">2. Categorization</div><div className="workflow-step">3. Assignment</div><div className="workflow-step">4. Resolution</div><div className="workflow-step">5. Closure</div>
    </div>

    <section className="panel" style={{ padding: 0 }}>
      <table className="data-table">
        <thead><tr><th>Complaint No</th><th>Account No</th><th>Category</th><th>Description</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Actions</th></tr></thead>
        <tbody>
          {data.map(c => <tr key={c.id}>
            <td><b>{c.complaintNumber}</b></td>
            <td><code className="account-code">{c.customer?.accountNumber}</code></td>
            <td>{c.category}</td>
            <td><small>{c.description}</small></td>
            <td><PriorityBadge priority={c.priority} /></td>
            <td><span className="code">{c.status}</span></td>
            <td>{c.assignedTo || 'Unassigned'}</td>
            <td>
              <button className="ghost" style={{padding: '2px 6px', marginRight: 5}} onClick={() => openEdit(c)}>Edit</button>
              <button className="ghost" style={{color: 'red', padding: '2px 6px'}} onClick={() => deleteComplaint(c.id)}>Delete</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </section>

    {showForm && <div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>{editData ? 'Edit Complaint' : 'Capture Complaint'}</h2><button type="button" className="icon-btn" onClick={closeModal}><X size={20}/></button></div>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Account Number</label><input required value={accountNo} onChange={handleAccountChange} placeholder="XX/XX/XXX/XXX/XX" disabled={!!editData} /></div>
          <div className="field"><label>Customer Name</label><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Enter or auto-populate" disabled={!!editData} /></div>
          <div className="field"><label>Telephone Number</label><input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="Enter or auto-populate" disabled={!!editData} /></div>
          <div className="field"><label>Category</label><select name="category" defaultValue={editData?.category}>
            <option>Reading Error</option><option>High Bill</option><option>Leak Detection</option><option>Internal Leak</option><option>Category Change</option><option>Disconnection/Reconnection</option><option>Payment Issue</option><option>Meter Deffective</option><option>Other Complaint</option>
          </select></div>
          <div className="field"><label>Priority</label><select name="priority" defaultValue={editData?.priority}><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select></div>
          <div className="field"><label>Status</label><select name="status" defaultValue={editData?.status || 'NEW'}><option>NEW</option><option>IN_PROGRESS</option><option>RESOLVED</option></select></div>
          <div className="field"><label>Assign To</label><input name="assignedTo" placeholder="e.g. Technical Team" defaultValue={editData?.assignedTo} /></div>
        </div>
        <div className="field"><label>Complaint Description</label><textarea name="description" rows={3} required defaultValue={editData?.description}></textarea></div>
        <div className="modal-actions"><button type="button" className="ghost" onClick={closeModal}>Cancel</button><button type="submit" className="primary">{editData ? 'Save Changes' : 'Register Complaint'}</button></div>
      </form>
    </div></div>}
  </div>;
}`;

app = app.replace(complaintsCompRegex, replacement);

fs.writeFileSync('src/App.tsx', app);
