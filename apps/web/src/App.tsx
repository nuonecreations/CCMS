import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, fetchWithAuth, getUser, setAuthToken, setUser, removeAuthToken, removeUser } from './auth';
import * as XLSX from 'xlsx';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, Database, Download, FileSpreadsheet, LayoutDashboard, Menu,
  Phone, PhoneCall, RefreshCw, Search, Settings, UploadCloud, Users, XCircle, X
} from 'lucide-react';

type Preview = {
  fileName: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  totalArrears: number;
  worksiteCounts: Record<string, number>;
  rows: Array<{ accountNumber?: string; name?: string; arrears?: number; worksiteCode?: string }>;
  errors: Array<{ rowNumber: number; accountNo?: string; errorCode: string; message: string }>;
};

type CustomerRow = {
  id: number;
  accountNumber: string;
  customerName?: string;
  address?: string;
  mobileNumber?: string;
  regionCode: string;
  worksiteCode: string;
  categoryCode?: string;
  worksite: { code: string; nameSi: string; nameEn: string };
  arrearsSnapshots: Array<{
    totalDue: number | null;
    arrearsAmount: number | null;
    pendingPayment: number | null;
    priority: string;
    snapshotDate: string;
  }>;
};

type PagedResult = { data: any[]; total: number; page: number; pageSize: number };

const worksites = [
  ['33','මාකඳුර','Makandura'],['35','රදම්පල','Radampola'],['36','තිහගොඩ','Thihagoda'],
  ['37','අකුරැස්ස','Akuressa'],['38','පිටබැද්දර','Pitabeddara'],['39','හක්මන','Hakmana'],
  ['60','මාතර/මිරිස්ස','Matara/Mirissa'],['61','දෙවිනුවර','Devinuwara'],['62','ගන්දර','Gandara'],
  ['63','කෝට්ටෙගොඩ','Kottagoda'],['64','දික්වැල්ල','Dickwella'],['65','වැලිගම','Weligama'],
  ['66','දෙණියාය','Deniyaya'],['67','කඹුරුපිටිය','Kamburupitiya'],['68','ඌරුබොක්ක','Urubokka'],
  ['69','මාලිම්බඩ','Malimbada'],['70','කුඩාවැල්ල','Kudawella'],
];



function formatLKR(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `Rs. ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const priorityColors: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#fde8e8', text: '#b91c1c' },
  HIGH: { bg: '#fff3cd', text: '#92400e' },
  MEDIUM: { bg: '#e0f2fe', text: '#0369a1' },
  NORMAL: { bg: '#f0fdf4', text: '#166534' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const c = priorityColors[priority] ?? priorityColors.NORMAL;
  return <span style={{ background: c.bg, color: c.text, padding: '3px 9px', borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{priority}</span>;
}


function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
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
  const currentUser = getUser();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [active, setActive] = useState(isAdmin ? 'Dashboard' : 'Call Queue');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [dashStats, setDashStats] = useState<{ totalCustomers: number; totalArrears: number; collectedAmount?: number; remainingArrears?: number } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchWithAuth(`${API_BASE}/customers?pageSize=1`).then(r => r.json()).then((d: PagedResult) => {
      setDashStats(prev => ({ totalCustomers: d.total, totalArrears: prev?.totalArrears ?? 0 }));
    }).catch(() => {});
    fetchWithAuth(`${API_BASE}/worksites`).then(r => r.json()).then((ws: any[]) => {
      const total = ws.reduce((sum: number, w: any) => sum + Number(w.totalArrears ?? 0), 0);
      const collected = ws.reduce((sum: number, w: any) => sum + Number(w.collectedAmount ?? 0), 0);
      const remaining = ws.reduce((sum: number, w: any) => sum + Number(w.remainingArrears ?? 0), 0);
      setDashStats(prev => ({ totalCustomers: prev?.totalCustomers ?? 0, totalArrears: total, collectedAmount: collected, remainingArrears: remaining }));
    }).catch(() => {});
  }, [active, isAuthenticated]);

  if (!isAuthenticated) return <LoginPage onLogin={() => setIsAuthenticated(true)} />;


  async function previewFile() {
    if (!file) return;
    setLoading(true); setMessage('');
    const form = new FormData(); form.append('file', file);
    try {
      const res = await fetchWithAuth(`${API_BASE}/imports/arrears/preview`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      setPreview(await res.json());
      setActive('Import Preview');
    } catch (e: any) {
      setMessage(e?.message || 'Backend connection failed.');
    } finally { setLoading(false); }
  }

  async function confirmImport() {
    if (!file) return;
    setLoading(true); setMessage('');
    const form = new FormData(); form.append('file', file); form.append('reportPeriod', '2026/05');
    try {
      const res = await fetchWithAuth(`${API_BASE}/imports/arrears/confirm`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      setMessage(`Import completed successfully.`);
      setActive('Dashboard');
    } catch {
      setMessage('Import confirmation failed.');
    } finally { setLoading(false); }
  }

  const nav = [
    ['Dashboard', LayoutDashboard], ['Arrears Import', UploadCloud], ['Customers', Users],
    ['Call Queue', Phone], ['Call Log', PhoneCall], ['Complaints', ClipboardList], ['Reports', BarChart3]
  ] as const;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">C</div><div><strong>CCMS</strong><span>Matara Regional Office</span></div></div>
      <div className="region-badge"><span className="dot" /> <b>31 - Matara Region</b></div>
      
        <nav>
          {isAdmin && <button className={`nav-item ${active === 'Dashboard' ? 'active' : ''}`} onClick={() => setActive('Dashboard')}><LayoutDashboard size={18}/> Overview</button>}
          <button className={`nav-item ${active === 'Call Queue' ? 'active' : ''}`} onClick={() => setActive('Call Queue')}><Phone size={18}/> Call Queue</button>
          <button className={`nav-item ${active === 'Customers' ? 'active' : ''}`} onClick={() => setActive('Customers')}><Users size={18}/> Customers</button>
          <button className={`nav-item ${active === 'Complaints' ? 'active' : ''}`} onClick={() => setActive('Complaints')}><AlertTriangle size={18}/> Complaints</button>
          {isAdmin && <button className={`nav-item ${active === 'Reports' ? 'active' : ''}`} onClick={() => setActive('Reports')}><BarChart3 size={18}/> Reports</button>}
          <button className={`nav-item ${active === 'Upload Data' ? 'active' : ''}`} onClick={() => setActive('Upload Data')}><UploadCloud size={18}/> Upload Data</button>
          {isAdmin && <button className={`nav-item ${active === 'Users' ? 'active' : ''}`} onClick={() => setActive('Users')}><Users size={18}/> Users</button>}
        </nav>
  
      <div className="sidebar-bottom"><button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} onClick={() => setActive('Settings')}><Settings size={18}/><span>Settings</span></button></div>
    </aside>

    <main className="main">
      <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="mobile-title"><Menu size={20}/><b>{active}</b></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar" style={{ background: '#3b82f6', color: '#fff', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {currentUser?.name?.[0] || 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 13, lineHeight: 1.2 }}>
              <b>{currentUser?.name || 'User'}</b>
              <span style={{ color: '#666' }}>{currentUser?.role || 'Operator'}</span>
            </div>
          </div>
        </div>
        <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <span className="live"><span className="dot"/>System Online</span>
          <button className="ghost" style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, color: '#e11d48' }} onClick={() => { removeAuthToken(); removeUser(); window.location.reload(); }}>
            <X size={16}/> Logout
          </button>
        </div>
      </header>
      <div className="content">
        {active === 'Dashboard' && <Dashboard preview={preview} message={message} stats={dashStats} onNavigate={setActive} />}
        {active === 'Upload Data' && <ImportPage file={file} setFile={setFile} preview={preview} loading={loading} message={message} onPreview={previewFile} onConfirm={confirmImport} />}
        {active === 'Import Preview' && <ImportPage file={file} setFile={setFile} preview={preview} loading={loading} message={message} onPreview={previewFile} onConfirm={confirmImport} />}
        {active === 'Customers' && <CustomersPage />}
        {active === 'Call Queue' && <CallQueuePage />}
        {active === 'Call Log' && <CallLogPage />}
        {active === 'Complaints' && <ComplaintsPage />}
        {active === 'Reports' && <ReportsPage />}
        {active === 'Users' && <UsersPage />}
        {active === 'Settings' && <SettingsPage />}
      </div>
    </main>
  </div>
}

function Dashboard({ preview, message, stats, onNavigate }: any) {
  const [calls, setCalls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [worksitesData, setWorksitesData] = useState<any[]>([]);

  useEffect(() => {
    fetchWithAuth(`${API_BASE}/customers/calls/log`).then(r => r.json()).then(j => setCalls(j.data || [])).catch(()=>{});
    fetchWithAuth(`${API_BASE}/customers/complaints/all`).then(r => r.json()).then(j => setComplaints(j.data || [])).catch(()=>{});
    fetchWithAuth(`${API_BASE}/worksites`).then(r => r.json()).then(j => setWorksitesData(j || [])).catch(()=>{});
  }, []);

  const todayStr = new Date().toLocaleDateString();
  const todayCalls = calls.filter(c => new Date(c.callDate).toLocaleDateString() === todayStr);
  const activeComplaints = complaints.filter(c => c.status !== 'CLOSED' && c.status !== 'RESOLVED');

  return <div>
    <div className="page-heading"><div><p className="eyebrow">OVERVIEW</p><h1>Customer Call Management</h1></div><button className="primary" onClick={() => onNavigate('Call Queue')}><Phone size={16}/> Start Call Queue</button></div>
    {message && <div className="success-banner"><CheckCircle2 size={18}/>{message}</div>}
    
    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
      <Stat icon={<Users/>} label="Customers" value={stats?.totalCustomers ? stats.totalCustomers.toLocaleString() : '—'} hint="Total in database" color="#3b82f6" bgColor="#eff6ff" />
      <Stat icon={<PhoneCall/>} label="Calls" value={todayCalls.length.toString()} hint="Logged today" color="#8b5cf6" bgColor="#f5f3ff" />
      <Stat icon={<AlertTriangle/>} label="Complaints" value={activeComplaints.length.toString()} hint="Pending resolution" color="#f59e0b" bgColor="#fffbeb" />
      <Stat icon={<Database/>} label="Original Arrears" value={stats?.totalArrears ? formatLKR(stats.totalArrears) : '—'} hint="Latest snapshot" color="#64748b" bgColor="#f8fafc" />
      <Stat icon={<CheckCircle2/>} label="Collected" value={stats?.collectedAmount ? formatLKR(stats.collectedAmount) : '—'} hint="Paid commitments" color="#10b981" bgColor="#ecfdf5" />
      <Stat icon={<AlertTriangle/>} label="Remaining" value={stats?.remainingArrears ? formatLKR(stats.remainingArrears) : (stats?.totalArrears ? formatLKR(stats.totalArrears) : '—')} hint="Current arrears" color="#ef4444" bgColor="#fef2f2" />
    </div>

    <div className="dashboard-grid" style={{ marginTop: 24 }}>
      <section className="panel"><div className="panel-header"><div><h2>Worksite Distribution</h2><p className="muted">Total arrears by worksite</p></div></div>
        <div className="worksite-list">
          {worksitesData.slice(0, 8).map(w => {
             const matched = worksites.find(x => x[0] === w.code);
             return <div className="worksite-row" key={w.code}>
               <div className="worksite-name"><span className="code">{w.code}</span><div><b>{matched?.[1]}</b><small>{matched?.[2]}</small></div></div>
               <div className="bar-wrap"><div className="bar" style={{width: `${Math.max(4, Math.min(100, (Number(w.totalArrears) / (stats?.totalArrears || 1)) * 100))}%`}}/></div>
               <strong>{formatLKR(Number(w.totalArrears))}</strong>
             </div>
          })}
        </div>
      </section>
      <section className="panel"><div className="panel-header"><div><h2>Recent Calls</h2><p className="muted">Latest call outcomes</p></div><Activity size={19}/></div>
        <div className="activity">
          {calls.slice(0, 5).map((c: any) => (
             <ActivityRow key={c.id} icon={<Phone/>} title={c.customer?.customerName || c.customer?.accountNumber} status={c.callOutcome}/>
          ))}
          {calls.length === 0 && <p className="muted" style={{padding:20}}>No calls recorded yet</p>}
        </div>
      </section>
    </div>
  </div>
}

function CustomersPage() {
  const [data, setData] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [wsFilter, setWsFilter] = useState('');
  const [paymentModalData, setPaymentModalData] = useState<CustomerRow | null>(null);
  const pageSize = 20;

  const loadData = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    if (wsFilter) params.set('worksiteCode', wsFilter);
    fetchWithAuth(`${API_BASE}/customers?${params}`).then(r => r.json()).then(j => { setData(j.data || []); setTotal(j.total); }).catch(()=>setData([]));
  }, [page, search, wsFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  return <div>
    <div className="page-heading"><div><p className="eyebrow">CUSTOMER MANAGEMENT</p><h1>Customers</h1></div></div>
    <div className="filter-bar">
      <div className="filter-search"><Search size={16}/><input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      <select className="filter-select" value={wsFilter} onChange={e => { setWsFilter(e.target.value); setPage(1); }}>
        <option value="">All Worksites</option>
        {worksites.map(([c, s, e]) => <option key={c} value={c}>{c} — {e}</option>)}
      </select>
    </div>
    <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead><tr><th>Account No.</th><th>Customer Name</th><th>Worksite</th><th>Mobile</th><th style={{textAlign:'right'}}>Arrears</th><th>Priority</th><th>Actions</th></tr></thead>
        <tbody>{data.map(c => { const s = c.arrearsSnapshots?.[0]; return <tr key={c.id}><td><code className="account-code">{c.accountNumber}</code></td><td><b>{c.customerName || '—'}</b></td><td><span className="code">{c.worksiteCode}</span> {c.worksite?.nameEn}</td><td>{c.mobileNumber || '—'}</td><td style={{textAlign:'right',fontWeight:600}}>{formatLKR(s?.arrearsAmount)}</td><td>{s ? <PriorityBadge priority={s.priority} /> : '—'}</td><td><button className="ghost" onClick={() => setPaymentModalData(c)}><CheckCircle2 size={16}/> Paid</button></td></tr>; })}</tbody>
      </table>
    </section>
    {paymentModalData && <PaymentModal customer={paymentModalData} onClose={() => { setPaymentModalData(null); loadData(); }} />}
  </div>;
}

function CallQueuePage() {
  const [data, setData] = useState<CustomerRow[]>([]);
  const [page, setPage] = useState(1);
  const [callModalData, setCallModalData] = useState<CustomerRow | null>(null);

  const loadQueue = useCallback(() => {
    fetchWithAuth(`${API_BASE}/customers/call-queue?page=${page}&pageSize=15`).then(r => r.json()).then(j => setData(j.data || [])).catch(()=>setData([]));
  }, [page]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  return <div>
    <div className="page-heading"><div><p className="eyebrow">CALL OPERATIONS</p><h1>Call Queue</h1><p className="muted">Arrears &gt; 100,000/- grouped by worksite</p></div><button className="primary" onClick={loadQueue}><RefreshCw size={16}/> Refresh</button></div>
    
    <div className="queue-grid">
      {data.map((c, i) => {
        const snap = c.arrearsSnapshots?.[0];
        return <div className="queue-card" key={c.id}>
          <div className="queue-rank">{i + 1}</div>
          <div className="queue-info">
            <div className="queue-top"><b>{c.customerName || 'Unknown'}</b> {snap && <PriorityBadge priority={snap.priority} />}</div>
            <div className="queue-details"><span><code className="account-code">{c.accountNumber}</code></span><span className="code">{c.worksiteCode}</span><span>{c.worksite?.nameEn}</span>{c.mobileNumber && <span>📱 {c.mobileNumber}</span>}</div>
            <div className="queue-amounts"><div><small>Arrears</small><b>{formatLKR(snap?.arrearsAmount)}</b></div><div><small>Total Due</small><b>{formatLKR(snap?.totalDue)}</b></div></div>
          </div>
          <button className="call-btn" onClick={() => setCallModalData(c)}><Phone size={16}/> Call</button>
        </div>;
      })}
    </div>

    {callModalData && <CallModal customer={callModalData} onClose={() => { setCallModalData(null); loadQueue(); }} />}
  </div>;
}

function CallModal({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const snap = customer.arrearsSnapshots?.[0];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    await fetchWithAuth(`${API_BASE}/customers/${customer.id}/calls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false); onClose();
  }

  return <div className="modal-backdrop"><div className="modal">
    <div className="modal-header"><h2>Log Call: {customer.customerName || customer.accountNumber}</h2><button type="button" className="icon-btn" onClick={onClose}><X size={20}/></button></div>
    <div className="modal-cust-info">
      <div><small>Account No</small><b>{customer.accountNumber}</b></div>
      <div><small>Mobile</small><b>{customer.mobileNumber || '—'}</b></div>
      <div><small>Arrears</small><b>{formatLKR(snap?.arrearsAmount)}</b></div>
    </div>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Call Status</label><select name="callOutcome" required>
          <option value="ANSWERED">Answered</option><option value="NO_ANSWER">No Answer</option><option value="WRONG_NUMBER">Wrong Number</option><option value="NUMBER_NOT_AVAILABLE">Number Not Available</option>
        </select></div>
        <div className="field"><label>Customer Response</label><select name="customerResponse" required>
          <option value="PAYMENT_PROMISED">Payment Promised</option><option value="COMPLAINT_RAISED">Complaint Raised</option><option value="INFORMATION_PROVIDED">Information Provided</option><option value="FOLLOW_UP_REQUIRED">Follow up Required</option><option value="NONE">None</option>
        </select></div>
        <div className="field"><label>Promise Amount (Rs.)</label><input name="promisedAmount" type="number" /></div>
        <div className="field"><label>Promise Date</label><input name="promiseDate" type="date" /></div>
        <div className="field"><label>Assigned Section</label><input name="assignedSection" placeholder="e.g. Disconnection unit" /></div>
        <div className="field"><label>Follow-up Date</label><input name="nextFollowupDate" type="date" /></div>
        <div className="field"><label>Final Status</label><select name="finalStatus" required><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></div>
      </div>
      <div className="field"><label>Notes / Complaint Details</label><textarea name="notes" rows={3} required></textarea></div>
      <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Call Log'}</button></div>
    </form>
  </div></div>;
}

function PaymentModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const snap = customer.arrearsSnapshots?.[0];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    await fetchWithAuth(`${API_BASE}/customers/${customer.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false); onClose();
  }

  return <div className="modal-backdrop"><div className="modal">
    <div className="modal-header"><h2>Payment Received: {customer.customerName || customer.accountNumber}</h2><button type="button" className="icon-btn" onClick={onClose}><X size={20}/></button></div>
    <div className="modal-cust-info">
      <div><small>Account No</small><b>{customer.accountNumber}</b></div>
      <div><small>Arrears</small><b>{formatLKR(snap?.arrearsAmount)}</b></div>
    </div>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Amount Paid (Rs.)</label><input name="amount" type="number" required /></div>
        <div className="field"><label>Payment Date</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea name="notes" placeholder="Receipt number, remarks..." rows={3} /></div>
      </div>
      <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Add Payment'}</button></div>
    </form>
  </div></div>;
}

function CallLogPage() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => { fetchWithAuth(`${API_BASE}/customers/calls/log`).then(r => r.json()).then(j => setData(j.data || [])).catch(()=>setData([])); }, []);
  return <div>
    <div className="page-heading"><div><p className="eyebrow">HISTORY</p><h1>Call Log</h1></div></div>
    <section className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 1200 }}>
        <thead><tr><th>Call Date</th><th>Account No.</th><th>Customer Name</th><th>Mobile</th><th>Arrears</th><th>Call Status</th><th>Response</th><th>Notes</th><th>Assigned</th><th>Follow-up</th><th>Status</th></tr></thead>
        <tbody>{data.map(c => <tr key={c.id}>
          <td>{new Date(c.callDate).toLocaleDateString()}</td>
          <td><code className="account-code">{c.customer.accountNumber}</code></td>
          <td><b>{c.customer.customerName}</b></td>
          <td>{c.customer.mobileNumber}</td>
          <td style={{textAlign:'right'}}>{formatLKR(c.customer.arrearsSnapshots?.[0]?.arrearsAmount)}</td>
          <td>{c.callOutcome}</td>
          <td>{c.customerResponse}</td>
          <td><small>{c.notes}</small></td>
          <td>{c.assignedSection}</td>
          <td>{c.nextFollowupDate ? new Date(c.nextFollowupDate).toLocaleDateString() : '—'}</td>
          <td>{c.finalStatus}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}

function ComplaintsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [accountNo, setAccountNo] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  
  const load = () => { fetchWithAuth(`${API_BASE}/customers/complaints/all`).then(r => r.json()).then(j => setData(j.data || [])).catch(()=>setData([])); };
  useEffect(() => { load(); }, []);

  function formatAccountNo(val: string) {
    const v = val.replace(/\D/g, '');
    if (v.length <= 2) return v;
    if (v.length <= 4) return `${v.slice(0, 2)}/${v.slice(2)}`;
    if (v.length <= 7) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    if (v.length <= 10) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4, 7)}/${v.slice(7)}`;
    return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4, 7)}/${v.slice(7, 10)}/${v.slice(10, 12)}`;
  }

  const handleAccountChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAccountNo(e.target.value);
    setAccountNo(formatted);
    if (formatted.length === 16) {
      try {
        const r = await fetchWithAuth(`${API_BASE}/customers?search=${encodeURIComponent(formatted)}&pageSize=1`);
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
      await fetchWithAuth(`${API_BASE}/customers/complaints/${editData.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetchWithAuth(`${API_BASE}/customers/${customerId}/complaints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    await fetchWithAuth(`${API_BASE}/customers/complaints/${id}`, { method: 'DELETE' });
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
}

function ReportsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    fetchWithAuth(`${API_BASE}/customers/calls/log`).then(r => r.json()).then(j => setCalls(j.data || [])).catch(()=>{});
    fetchWithAuth(`${API_BASE}/customers/complaints/all`).then(r => r.json()).then(j => setComplaints(j.data || [])).catch(()=>{});
  }, []);

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const todayCalls = calls.filter(c => { const d = new Date(c.callDate).toISOString().split('T')[0]; return d >= startDate && d <= endDate; });
  const todayComplaints = complaints.filter(c => { const d = new Date(c.createdAt).toISOString().split('T')[0]; return d >= startDate && d <= endDate; });

  const downloadExcel = (data: any[], filename: string, type: 'calls' | 'complaints') => {
    let rows: any[] = [];
    if (type === 'calls') {
      rows = data.map(c => ({
        'Account No': c.customer?.accountNumber || '',
        'Customer Name': c.customer?.customerName || '',
        'Call Date': new Date(c.callDate).toLocaleString(),
        'Call Status': c.callOutcome,
        'Response': c.customerResponse,
        'Notes': c.notes || '',
        'Assigned To': c.assignedSection || ''
      }));
    } else {
      rows = data.map(c => ({
        'Complaint No': c.complaintNumber,
        'Account No': c.customer?.accountNumber || '',
        'Category': c.category,
        'Description': c.description || '',
        'Priority': c.priority,
        'Status': c.status,
        'Assigned To': c.assignedTo || ''
      }));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  };

  const printReport = (data: any[], title: string, type: 'calls' | 'complaints') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let tableHtml = '<table border="1" style="width:100%; border-collapse: collapse; text-align: left;">';
    
    if (type === 'calls') {
      tableHtml += '<thead><tr><th>Account No</th><th>Name</th><th>Date</th><th>Status</th><th>Response</th><th>Notes</th></tr></thead><tbody>';
      data.forEach(c => {
        tableHtml += `<tr><td>${c.customer?.accountNumber||''}</td><td>${c.customer?.customerName||''}</td><td>${new Date(c.callDate).toLocaleString()}</td><td>${c.callOutcome}</td><td>${c.customerResponse}</td><td>${c.notes||''}</td></tr>`;
      });
    } else {
      tableHtml += '<thead><tr><th>Complaint No</th><th>Account No</th><th>Category</th><th>Description</th><th>Priority</th><th>Status</th></tr></thead><tbody>';
      data.forEach(c => {
        tableHtml += `<tr><td>${c.complaintNumber}</td><td>${c.customer?.accountNumber||''}</td><td>${c.category}</td><td>${c.description||''}</td><td>${c.priority}</td><td>${c.status}</td></tr>`;
      });
    }
    tableHtml += '</tbody></table>';

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          ${tableHtml}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return <div>
    <div className="page-heading"><div><p className="eyebrow">ANALYTICS</p><h1>System Reports</h1><p className="muted">Filter and download reports</p></div><div style={{display:'flex',gap:10,alignItems:'center'}}><div className="field" style={{marginBottom:0}}><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div><span className="muted">to</span><div className="field" style={{marginBottom:0}}><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div></div></div>
    
    <div className="stat-grid" style={{ marginBottom: 20 }}>
      <Stat icon={<PhoneCall/>} label="Calls Today" value={todayCalls.length.toString()} hint="Total calls logged today" />
      <Stat icon={<ClipboardList/>} label="Complaints Today" value={todayComplaints.length.toString()} hint="Total complaints raised today" />
    </div>

    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Calls Report</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ghost" onClick={() => printReport(todayCalls, 'Calls Report', 'calls')} disabled={todayCalls.length === 0}>Print / PDF</button>
            <button className="ghost" onClick={() => downloadExcel(todayCalls, 'Calls_Report.xlsx', 'calls')} disabled={todayCalls.length === 0}><Download size={14}/> Excel</button>
          </div>
        </div>
        <div className="mini-table">
          {todayCalls.length === 0 ? <p className="muted" style={{padding:20}}>No calls found for period</p> : todayCalls.map(c => <div className="mini-row" key={c.id}><span>{c.customer?.accountNumber}</span><strong>{c.callOutcome}</strong></div>)}
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>Complaints Report</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ghost" onClick={() => printReport(todayComplaints, 'Complaints Report', 'complaints')} disabled={todayComplaints.length === 0}>Print / PDF</button>
            <button className="ghost" onClick={() => downloadExcel(todayComplaints, 'Complaints_Report.xlsx', 'complaints')} disabled={todayComplaints.length === 0}><Download size={14}/> Excel</button>
          </div>
        </div>
        <div className="mini-table">
          {todayComplaints.length === 0 ? <p className="muted" style={{padding:20}}>No complaints found for period</p> : todayComplaints.map(c => <div className="mini-row" key={c.id}><span>{c.customer?.accountNumber}</span><strong>{c.category}</strong></div>)}
        </div>
      </section>
    </div>
  </div>;
}

function Stat({ icon, label, value, hint, color, bgColor }: any) { return <div className="stat-card" style={color ? { borderLeft: `4px solid ${color}` } : {}}><div className="stat-icon" style={bgColor ? { background: bgColor, color: color } : {}}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function ActivityRow({ icon, title, status }: any) { return <div className="activity-row"><div className="activity-icon">{icon}</div><div><b>{title}</b><small>{status}</small></div><CheckCircle2 size={17} className={status === 'Ready' ? 'check' : 'pending'}/></div>; }
function Placeholder({ title, icon, text }: any) { return <div><div className="page-heading"><div><p className="eyebrow">MODULE</p><h1>{title}</h1><p className="muted">{text}</p></div></div><div className="empty-state">{icon}<h2>{title} module</h2><p>{text}</p></div></div>; }
function ImportPage({ file, setFile, preview, loading, message, onPreview, onConfirm }: any) {
  return <div><div className="page-heading"><div><p className="eyebrow">DATA</p><h1>Import</h1></div></div>
    <section className="panel upload-panel"><div className="upload-zone" onClick={() => document.getElementById('excel-input')?.click()}><input id="excel-input" type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} /><h2>{file ? file.name : 'Upload File'}</h2></div><div className="upload-actions"><button className="primary" onClick={onPreview}>Preview</button></div></section>
    {preview && <section className="panel"><button className="primary" onClick={onConfirm}>Confirm Import</button></section>}
  </div>;
}


function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const load = () => { fetchWithAuth(`${API_BASE}/users`).then(r => r.json()).then(setUsers).catch(()=>{}); };
  useEffect(() => { load(); }, []);

  async function submit(e: any) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(fd.entries());
    if (editUser && !body.password) delete body.password; // Don't send empty password when editing

    if (editUser) {
      await fetchWithAuth(`${API_BASE}/users/${editUser.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    } else {
      await fetchWithAuth(`${API_BASE}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    }
    setShowForm(false);
    setEditUser(null);
    load();
  }

  const openEdit = (u: any) => { setEditUser(u); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditUser(null); };

  return <div>
    <div className="page-heading"><div><p className="eyebrow">SETTINGS</p><h1>User Management</h1></div><button className="primary" onClick={() => { setEditUser(null); setShowForm(true); }}>+ Add User</button></div>
    <section className="panel" style={{ padding: 0 }}>
      <table className="data-table">
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => <tr key={u.id}>
            <td><b>{u.username}</b></td>
            <td>{u.name}</td>
            <td><span className="code">{u.role}</span></td>
            <td>
              <div style={{display: 'flex', gap: 5}}>
                <button className="ghost" onClick={() => openEdit(u)}>Edit</button>
                <button className="ghost" style={{color: '#b91c1c'}} onClick={async () => { if(confirm('Delete user?')) { await fetchWithAuth(`${API_BASE}/users/${u.id}`, {method: 'DELETE'}); load(); } }}>Delete</button>
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </section>
    {showForm && <div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>{editUser ? 'Edit User' : 'Create User'}</h2><button type="button" className="icon-btn" onClick={closeForm}><X size={20}/></button></div>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Username</label><input name="username" required defaultValue={editUser?.username} /></div>
          <div className="field"><label>Name</label><input name="name" required defaultValue={editUser?.name} /></div>
          <div className="field"><label>Password {editUser && '(Leave blank to keep)'}</label><input name="password" type="password" required={!editUser} /></div>
          <div className="field"><label>Role</label><select name="role" defaultValue={editUser?.role}><option>CALL_OPERATOR</option><option>ADMIN</option><option>SUPER_ADMIN</option></select></div>
        </div>
        <div className="modal-actions"><button type="button" className="ghost" onClick={closeForm}>Cancel</button><button type="submit" className="primary">{editUser ? 'Update User' : 'Create User'}</button></div>
      </form>
    </div></div>}
  </div>;
}

function SettingsPage() {
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [msg, setMsg] = useState('');
  const user = getUser();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuper = user?.role === 'SUPER_ADMIN';
  
  const changePassword = async (e: any) => {
    e.preventDefault();
    if(pass !== confirmPass) return setMsg('Passwords do not match');
    const res = await fetchWithAuth(`${API_BASE}/auth/change-password`, {
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
    const res = await fetchWithAuth(`${API_BASE}/imports/system-reset`, { method: 'POST' });
    if(res.ok) alert('System Reset Successful!');
    else alert('Failed to reset system');
  };

  const [imports, setImports] = useState<any[]>([]);
  const loadImports = () => { fetchWithAuth(`${API_BASE}/imports`).then(r => r.json()).then(setImports).catch(()=>{}); };
  useEffect(() => { if (isSuper || user?.role === 'ADMIN') loadImports(); }, [isSuper, user?.role]);

  const deleteImport = async (id: number) => {
    if(!confirm('Are you sure you want to delete this specific database import?')) return;
    await fetchWithAuth(`${API_BASE}/imports/${id}`, { method: 'DELETE' });
    loadImports();
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

      {isAdmin && (
        <section className="panel">
          <h3>Uploaded Databases (Imports)</h3>
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
      )}

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
