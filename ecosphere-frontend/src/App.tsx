// oxlint-disable react-hooks/exhaustive-deps
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  Gift,
  Leaf,
  LogOut,
  Medal,
  Plus,
  Recycle,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { jsPDF } from 'jspdf'
import { api, apiErrorMessage, dataOf, fieldErrors, type ApiEnvelope } from './api/client'
import { type User } from './auth'
import { useAuth } from './useAuth'

type Row = Record<string, any>
type Option = { id: string; name: string; title?: string; code?: string; points_required?: number; stock?: number }
type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null
type CrudField = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  required?: boolean
  options?: Array<string | { label: string; value: string }>
  step?: string
}

const sourceTypes = ['PURCHASE', 'MANUFACTURING', 'EXPENSE', 'FLEET']
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const today = new Date().toISOString().slice(0, 10)

function useLoad<T>(path: string, fallback: T, deps: Array<unknown> = []) {
  const [data, setData] = useState<T>(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get<ApiEnvelope<T>>(path)
      .then((response) => {
        if (alive) setData(dataOf<T>(response.data))
      })
      .catch((err) => {
        if (alive) setError(apiErrorMessage(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, deps)

  return { data, setData, loading, error }
}

function moneyNumber(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function dateOnly(value: unknown) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

function shortId(value: unknown) {
  return value ? String(value).slice(0, 8) : '-'
}

function Empty({ children = 'No data yet. Add a record to light up this view.' }: { children?: ReactNode }) {
  return <div className="empty">{children}</div>
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  if (!toast) return null
  return (
    <button type="button" className={`toast toast-${toast.tone}`} onClick={onClose}>
      {toast.message}
    </button>
  )
}

function PageHeader({ icon, title, actions }: { icon: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="title-lockup">
        <span className="title-icon">{icon}</span>
        <h1>{title}</h1>
      </div>
      {actions}
    </div>
  )
}

function Panel({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function DataTable({ rows, columns }: { rows: Row[]; columns?: string[] }) {
  const keys = columns || Object.keys(rows[0] || {}).slice(0, 8)
  if (!rows.length) return <Empty />
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{keys.map((key) => <th key={key}>{key.replaceAll('_', ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {keys.map((key) => <td key={key}>{formatCell(row[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && value.includes('T')) return dateOnly(value)
  return String(value)
}

function FieldError({ error }: { error?: string }) {
  return error ? <small className="field-error">{error}</small> : null
}

function Select({ value, onChange, children, required = false }: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  required?: boolean
}) {
  return (
    <select value={value} required={required} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  )
}

function CrudPanel({
  title,
  endpoint,
  fields,
  columns,
  icon,
  canDelete = true,
}: {
  title: string
  endpoint: string
  fields: CrudField[]
  columns: string[]
  icon?: ReactNode
  canDelete?: boolean
}) {
  const [reload, setReload] = useState(0)
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState<Row>(() => initialCrudForm(fields))
  const rows = useLoad<Row[]>(`${endpoint}?limit=100`, [], [reload, endpoint])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post(endpoint, normalizeCrudPayload(form, fields))
      setForm(initialCrudForm(fields))
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: `${title} created.` })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const remove = async (id: string) => {
    try {
      await api.delete(`${endpoint}/${id}`)
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: `${title} deleted.` })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  return (
    <>
      <ToastView toast={toast} onClose={() => setToast(null)} />
      <Panel title={title} icon={icon}>
        <form className="form-grid compact" onSubmit={submit}>
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              <CrudInput
                field={field}
                value={form[field.name]}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
              />
            </label>
          ))}
          <button className="primary-button" type="submit">Create</button>
        </form>
        {rows.error && <div className="form-message error">{rows.error}</div>}
        {!rows.data.length ? <Empty /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}
                  {canDelete && <th>actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.data.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
                    {canDelete && (
                      <td>
                        <button className="danger-button" type="button" onClick={() => remove(row.id)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

function CrudInput({ field, value, onChange }: { field: CrudField; value: any; onChange: (value: any) => void }) {
  if (field.type === 'select') {
    return (
      <Select value={String(value ?? '')} required={field.required} onChange={onChange}>
        <option value="">Select</option>
        {(field.options || []).map((option) => {
          const normalized = typeof option === 'string' ? { label: option, value: option } : option
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>
        })}
      </Select>
    )
  }
  if (field.type === 'textarea') {
    return <textarea className="input-textarea" value={value ?? ''} required={field.required} onChange={(event) => onChange(event.target.value)} />
  }
  if (field.type === 'checkbox') {
    return <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
  }
  return (
    <input
      type={field.type || 'text'}
      step={field.step}
      value={value ?? ''}
      required={field.required}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function initialCrudForm(fields: CrudField[]) {
  return fields.reduce<Row>((acc, field) => {
    acc[field.name] = field.type === 'checkbox' ? false : ''
    return acc
  }, {})
}

function normalizeCrudPayload(form: Row, fields: CrudField[]) {
  return fields.reduce<Row>((acc, field) => {
    const value = form[field.name]
    if (value === '' || value === undefined) return acc
    acc[field.name] = field.type === 'number' ? Number(value) : value
    return acc
  }, {})
}

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <main className="auth-shell"><div className="loading">Loading EcoSphere...</div></main>
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: <Gauge size={18} /> },
    { to: '/environmental', label: 'Environmental', icon: <Leaf size={18} /> },
    { to: '/social', label: 'Social', icon: <Users size={18} /> },
    { to: '/governance', label: 'Governance', icon: <ShieldCheck size={18} /> },
    { to: '/gamification', label: 'Gamification', icon: <Trophy size={18} /> },
    { to: '/reports', label: 'Reports', icon: <FileText size={18} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Recycle size={21} /></span>
          <span>EcoSphere</span>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button className="icon-button" type="button" title="Log out" onClick={() => { logout(); navigate('/login') }}>
            <LogOut size={18} />
          </button>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', department_id: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const departments = useLoad<Option[]>('/departments?limit=100', [], [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setMessage('')
    try {
      if (mode === 'login') {
        const response = await api.post<ApiEnvelope<{ token: string; user: User }>>('/auth/login', {
          email: form.email,
          password: form.password,
        })
        const session = dataOf<{ token: string; user: User }>(response.data)
        setSession(session.token, session.user)
        navigate('/dashboard')
      } else {
        await api.post('/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password,
          department_id: form.department_id || undefined,
        })
        setMessage('Account created. Sign in with your new credentials.')
        navigate('/login')
      }
    } catch (err) {
      setErrors(fieldErrors(err))
      setMessage(apiErrorMessage(err))
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark"><Recycle size={21} /></span>
          <span>EcoSphere</span>
        </div>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <form onSubmit={submit} className="form-grid">
          {mode === 'register' && (
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <FieldError error={errors.name} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            <FieldError error={errors.email} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
            <FieldError error={errors.password} />
          </label>
          {mode === 'register' && (
            <label>
              Department
              <Select value={form.department_id} onChange={(department_id) => setForm({ ...form, department_id })}>
                <option value="">Unassigned</option>
                {departments.data.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
              <FieldError error={errors.department_id} />
            </label>
          )}
          {message && <div className="form-message">{message}</div>}
          <button className="primary-button" type="submit">{mode === 'login' ? 'Sign in' : 'Register'}</button>
        </form>
        <button className="link-button" type="button" onClick={() => navigate(mode === 'login' ? '/register' : '/login')}>
          {mode === 'login' ? 'Create an account' : 'Back to sign in'}
        </button>
      </section>
    </main>
  )
}

function Dashboard() {
  const environmental = useLoad<Row[]>('/reports/environmental', [], [])
  const social = useLoad<Row[]>('/reports/social', [], [])
  const governance = useLoad<Row[]>('/reports/governance', [], [])
  const scores = useLoad<Row[]>('/department-scores/rankings', [], [])
  const totalCo2 = environmental.data.reduce((sum, row) => sum + Number(row.total_co2 || 0), 0)
  const approved = social.data.reduce((sum, row) => sum + Number(row.approved_participations || 0), 0)
  const openIssues = governance.data.reduce((sum, row) => sum + Number(row.open_issues || 0), 0)

  return (
    <>
      <PageHeader icon={<Gauge size={22} />} title="Dashboard" />
      <div className="metric-grid">
        <Metric label="CO2e tracked" value={`${moneyNumber(totalCo2)} kg`} icon={<Leaf size={18} />} />
        <Metric label="CSR approvals" value={String(approved)} icon={<Users size={18} />} />
        <Metric label="Open issues" value={String(openIssues)} icon={<ShieldCheck size={18} />} />
        <Metric label="Ranked departments" value={String(scores.data.length)} icon={<Trophy size={18} />} />
      </div>
      <div className="two-col">
        <Panel title="ESG Rankings" icon={<Medal size={18} />}>
          <LeaderboardTable rows={scores.data} />
        </Panel>
        <Panel title="Environmental Load" icon={<BarChart3 size={18} />}>
          <Chart rows={environmental.data} x="department_name" y="total_co2" type="bar" />
        </Panel>
      </div>
    </>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="metric">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  )
}

function Environmental() {
  const [toast, setToast] = useState<Toast>(null)
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState('tracking')
  const departments = useLoad<Option[]>('/departments?limit=100', [], [])
  const factors = useLoad<Row[]>('/emission-factors?limit=100', [], [reload])
  const report = useLoad<Row[]>('/reports/environmental', [], [reload])
  const [factorForm, setFactorForm] = useState({ name: '', source_type: 'PURCHASE', unit: 'kg', co2_per_unit: '', valid_from: today })
  const [txForm, setTxForm] = useState({ department_id: '', emission_factor_id: '', source_type: 'PURCHASE', quantity: '', transaction_date: today })
  const [filters, setFilters] = useState({ department_id: '', from: '', to: '' })
  const txQuery = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
  const transactions = useLoad<Row[]>(`/carbon-transactions?${txQuery.toString()}`, [], [filters.department_id, filters.from, filters.to, reload])

  const createFactor = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/emission-factors', { ...factorForm, co2_per_unit: Number(factorForm.co2_per_unit) })
      setFactorForm({ name: '', source_type: 'PURCHASE', unit: 'kg', co2_per_unit: '', valid_from: today })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Emission factor created.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const createTransaction = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const factor = factors.data.find((item) => item.id === txForm.emission_factor_id)
      const response = await api.post<ApiEnvelope<Row>>('/carbon-transactions', {
        ...txForm,
        source_type: factor?.source_type || txForm.source_type,
        quantity: Number(txForm.quantity),
      })
      const created = dataOf<Row>(response.data)
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: `Recorded ${moneyNumber(created.co2_equivalent)} kg CO2e.` })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const timeline = useMemo(() => {
    const grouped = transactions.data.reduce<Record<string, number>>((acc, row) => {
      const day = dateOnly(row.transaction_date)
      acc[day] = (acc[day] || 0) + Number(row.co2_equivalent || 0)
      return acc
    }, {})
    return Object.entries(grouped).map(([date, co2]) => ({ date, co2 })).sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions.data])

  return (
    <>
      <ToastView toast={toast} onClose={() => setToast(null)} />
      <PageHeader icon={<Leaf size={22} />} title="Environmental" />
      <div className="tabs">
        {['tracking', 'goals', 'products', 'categories'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} type="button" onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      {tab === 'tracking' && (
        <>
          <div className="two-col">
            <Panel title="Emission Factors" icon={<Plus size={18} />}>
              <form className="form-grid compact" onSubmit={createFactor}>
                <input placeholder="Name" value={factorForm.name} onChange={(event) => setFactorForm({ ...factorForm, name: event.target.value })} required />
                <Select value={factorForm.source_type} onChange={(source_type) => setFactorForm({ ...factorForm, source_type })} required>
                  {sourceTypes.map((type) => <option key={type}>{type}</option>)}
                </Select>
                <input placeholder="Unit" value={factorForm.unit} onChange={(event) => setFactorForm({ ...factorForm, unit: event.target.value })} required />
                <input placeholder="CO2 per unit" type="number" step="0.000001" value={factorForm.co2_per_unit} onChange={(event) => setFactorForm({ ...factorForm, co2_per_unit: event.target.value })} required />
                <input type="date" value={factorForm.valid_from} onChange={(event) => setFactorForm({ ...factorForm, valid_from: event.target.value })} required />
                <button className="primary-button" type="submit">Create</button>
              </form>
              <DataTable rows={factors.data} columns={['name', 'source_type', 'unit', 'co2_per_unit', 'valid_from', 'status']} />
            </Panel>
            <Panel title="Carbon Transaction" icon={<Recycle size={18} />}>
              <form className="form-grid" onSubmit={createTransaction}>
                <Select value={txForm.department_id} onChange={(department_id) => setTxForm({ ...txForm, department_id })} required>
                  <option value="">Department</option>
                  {departments.data.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </Select>
                <Select value={txForm.emission_factor_id} onChange={(emission_factor_id) => setTxForm({ ...txForm, emission_factor_id })} required>
                  <option value="">Emission factor</option>
                  {factors.data.map((factor) => <option key={factor.id} value={factor.id}>{factor.name} ({factor.source_type})</option>)}
                </Select>
                <input type="number" step="0.01" placeholder="Quantity" value={txForm.quantity} onChange={(event) => setTxForm({ ...txForm, quantity: event.target.value })} required />
                <input type="date" value={txForm.transaction_date} onChange={(event) => setTxForm({ ...txForm, transaction_date: event.target.value })} />
                <button className="primary-button" type="submit">Record CO2e</button>
              </form>
            </Panel>
          </div>
          <Panel title="Department Carbon Tracking" icon={<BarChart3 size={18} />}>
            <div className="filters">
              <Select value={filters.department_id} onChange={(department_id) => setFilters({ ...filters, department_id })}>
                <option value="">All departments</option>
                {departments.data.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
              <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
              <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            </div>
            <DataTable rows={transactions.data} columns={['transaction_date', 'department_id', 'source_type', 'quantity', 'co2_equivalent', 'auto_calculated']} />
          </Panel>
          <div className="two-col">
            <Panel title="CO2e by Department" icon={<BarChart3 size={18} />}>
              <Chart rows={report.data} x="department_name" y="total_co2" type="bar" />
            </Panel>
            <Panel title="CO2e Over Time" icon={<BarChart3 size={18} />}>
              <Chart rows={timeline} x="date" y="co2" type="line" />
            </Panel>
          </div>
        </>
      )}
      {tab === 'goals' && (
        <CrudPanel
          title="Environmental Goals"
          endpoint="/environmental-goals"
          icon={<Leaf size={18} />}
          columns={['title', 'department_id', 'target_metric', 'target_value', 'current_value', 'unit', 'deadline', 'status']}
          fields={[
            { name: 'department_id', label: 'Department', type: 'select', required: true, options: departments.data.map((department) => ({ label: department.name, value: department.id })) },
            { name: 'title', label: 'Title', required: true },
            { name: 'target_metric', label: 'Target metric', required: true },
            { name: 'target_value', label: 'Target value', type: 'number', required: true },
            { name: 'current_value', label: 'Current value', type: 'number' },
            { name: 'unit', label: 'Unit' },
            { name: 'deadline', label: 'Deadline', type: 'date' },
            { name: 'status', label: 'Status', type: 'select', options: ['IN_PROGRESS', 'ACHIEVED', 'MISSED'] },
          ]}
        />
      )}
      {tab === 'products' && (
        <CrudPanel
          title="Products"
          endpoint="/products"
          icon={<Recycle size={18} />}
          columns={['name', 'sku', 'description', 'created_at']}
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'sku', label: 'SKU', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
        />
      )}
      {tab === 'categories' && (
        <CrudPanel
          title="Categories"
          endpoint="/categories"
          icon={<Plus size={18} />}
          columns={['name', 'type', 'status', 'created_at']}
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'type', label: 'Type', type: 'select', required: true, options: ['CSR_ACTIVITY', 'CHALLENGE'] },
            { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
          ]}
        />
      )}
    </>
  )
}

function Social() {
  const { user, isManager } = useAuth()
  const [toast, setToast] = useState<Toast>(null)
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState('csr')
  const departments = useLoad<Option[]>('/departments?limit=100', [], [])
  const employees = useLoad<Option[]>('/employees', [], [])
  const activities = useLoad<Row[]>('/csr-activities?limit=100', [], [reload])
  const mine = useLoad<Row[]>(`/employee-participation?employee_id=${user?.id || ''}`, [], [reload, user?.id])
  const queue = useLoad<Row[]>('/employee-participation?approval_status=PENDING', [], [reload])
  const [activityForm, setActivityForm] = useState({ title: '', department_id: '', description: '', start_date: today, end_date: today, status: 'ONGOING' })
  const [join, setJoin] = useState({ activity_id: '', proof_url: '' })

  const createActivity = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/csr-activities', activityForm)
      setActivityForm({ title: '', department_id: '', description: '', start_date: today, end_date: today, status: 'ONGOING' })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'CSR activity created.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const joinActivity = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/employee-participation', { activity_id: join.activity_id, proof_url: join.proof_url || undefined })
      setJoin({ activity_id: '', proof_url: '' })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Participation submitted.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const decide = async (id: string, approval_status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/employee-participation/${id}/decision`, { approval_status, points_earned: approval_status === 'APPROVED' ? 25 : 0 })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: `Participation ${approval_status.toLowerCase()}.` })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  return (
    <>
      <ToastView toast={toast} onClose={() => setToast(null)} />
      <PageHeader icon={<Users size={22} />} title="Social" />
      <div className="tabs">
        {['csr', 'diversity', 'training'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} type="button" onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      {tab === 'csr' && (
        <>
          <div className="two-col">
            <Panel title="CSR Activities" icon={<Users size={18} />}>
              {isManager && (
                <form className="form-grid compact" onSubmit={createActivity}>
                  <input placeholder="Title" value={activityForm.title} onChange={(event) => setActivityForm({ ...activityForm, title: event.target.value })} required />
                  <Select value={activityForm.department_id} onChange={(department_id) => setActivityForm({ ...activityForm, department_id })}>
                    <option value="">Department</option>
                    {departments.data.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </Select>
                  <input placeholder="Description" value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} />
                  <input type="date" value={activityForm.start_date} onChange={(event) => setActivityForm({ ...activityForm, start_date: event.target.value })} />
                  <input type="date" value={activityForm.end_date} onChange={(event) => setActivityForm({ ...activityForm, end_date: event.target.value })} />
                  <button className="primary-button" type="submit">Create</button>
                </form>
              )}
              <DataTable rows={activities.data} columns={['title', 'department_id', 'status', 'start_date', 'end_date']} />
            </Panel>
            <Panel title="My Participation" icon={<CheckCircle2 size={18} />}>
              <form className="form-grid" onSubmit={joinActivity}>
                <Select value={join.activity_id} onChange={(activity_id) => setJoin({ ...join, activity_id })} required>
                  <option value="">Select CSR activity</option>
                  {activities.data.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                </Select>
                <input placeholder="Proof URL" value={join.proof_url} onChange={(event) => setJoin({ ...join, proof_url: event.target.value })} />
                <button className="primary-button" type="submit">Join</button>
              </form>
              <DataTable rows={mine.data} columns={['activity_id', 'proof_url', 'approval_status', 'points_earned', 'completion_date']} />
            </Panel>
          </div>
          {isManager && (
            <Panel title="Approval Queue" icon={<ClipboardCheck size={18} />}>
              {!queue.data.length ? <Empty /> : (
                <div className="queue-list">
                  {queue.data.map((item) => (
                    <div className="queue-item" key={item.id}>
                      <div>
                        <strong>Activity {shortId(item.activity_id)}</strong>
                        <small>Employee {shortId(item.employee_id)} · Proof {item.proof_url || 'missing'}</small>
                      </div>
                      <div className="actions">
                        <button className="primary-button" type="button" onClick={() => decide(item.id, 'APPROVED')}>Approve</button>
                        <button className="danger-button" type="button" onClick={() => decide(item.id, 'REJECTED')}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </>
      )}
      {tab === 'diversity' && (
        <CrudPanel
          title="Diversity Metrics"
          endpoint="/diversity-metrics"
          icon={<Users size={18} />}
          canDelete={false}
          columns={['department_id', 'period_start', 'period_end', 'gender_male', 'gender_female', 'gender_other']}
          fields={[
            { name: 'department_id', label: 'Department', type: 'select', required: true, options: departments.data.map((department) => ({ label: department.name, value: department.id })) },
            { name: 'period_start', label: 'Period start', type: 'date', required: true },
            { name: 'period_end', label: 'Period end', type: 'date', required: true },
            { name: 'gender_male', label: 'Male', type: 'number' },
            { name: 'gender_female', label: 'Female', type: 'number' },
            { name: 'gender_other', label: 'Other', type: 'number' },
          ]}
        />
      )}
      {tab === 'training' && (
        <CrudPanel
          title="Training Completions"
          endpoint="/training-completions"
          icon={<ClipboardCheck size={18} />}
          canDelete={false}
          columns={['employee_id', 'training_name', 'completed_date', 'status']}
          fields={[
            { name: 'employee_id', label: 'Employee', type: 'select', required: true, options: employees.data.map((employee) => ({ label: employee.name, value: employee.id })) },
            { name: 'training_name', label: 'Training name', required: true },
            { name: 'completed_date', label: 'Completed date', type: 'date' },
            { name: 'status', label: 'Status', type: 'select', options: ['PENDING', 'COMPLETED', 'OVERDUE'] },
          ]}
        />
      )}
    </>
  )
}

function Gamification() {
  const { user, isManager, refreshUser } = useAuth()
  const [toast, setToast] = useState<Toast>(null)
  const [reload, setReload] = useState(0)
  const challenges = useLoad<Row[]>('/challenges?status=ACTIVE&limit=100', [], [reload])
  const myChallenges = useLoad<Row[]>(`/challenge-participation?employee_id=${user?.id || ''}`, [], [reload, user?.id])
  const challengeQueue = useLoad<Row[]>('/challenge-participation?approval_status=PENDING', [], [reload])
  const badges = useLoad<Row[]>('/badges?limit=100', [], [])
  const earnedBadges = useLoad<Row[]>('/badges/earned', [], [reload])
  const rewards = useLoad<Row[]>('/rewards?limit=100', [], [reload])
  const rankings = useLoad<Row[]>('/department-scores/rankings', [], [reload])
  const myChallengeIds = new Set(myChallenges.data.map((item) => item.challenge_id))
  const earnedBadgeIds = new Set(earnedBadges.data.map((item) => item.badge_id))

  const joinChallenge = async (challenge_id: string) => {
    try {
      await api.post('/challenge-participation', { challenge_id })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Challenge joined.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const updateProgress = async (id: string, progress: number, proof_url?: string) => {
    try {
      await api.patch(`/challenge-participation/${id}/progress`, { progress, proof_url: proof_url || undefined })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Progress updated.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const decide = async (id: string, approval_status: 'APPROVED' | 'REJECTED') => {
    try {
      const response = await api.patch<ApiEnvelope<Row>>(`/challenge-participation/${id}/decision`, { approval_status })
      const awarded = response.data.badgesAwarded?.length || 0
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: awarded ? `${awarded} badge awarded.` : `Challenge ${approval_status.toLowerCase()}.` })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const redeem = async (reward: Row) => {
    if ((user?.points_balance || 0) < Number(reward.points_required || 0)) {
      setToast({ tone: 'error', message: 'Insufficient points balance.' })
      return
    }
    try {
      await api.post('/reward-redemptions', { reward_id: reward.id })
      await refreshUser()
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Reward redeemed.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  return (
    <>
      <ToastView toast={toast} onClose={() => setToast(null)} />
      <PageHeader icon={<Trophy size={22} />} title="Gamification" />
      <Panel title="Challenges Board" icon={<Trophy size={18} />}>
        {!challenges.data.length ? <Empty>No active challenges yet.</Empty> : (
          <div className="card-grid">
            {challenges.data.map((challenge) => (
              <article className="mini-card" key={challenge.id}>
                <strong>{challenge.title}</strong>
                <p>{challenge.description || 'No description provided.'}</p>
                <div className="pill-row">
                  <span>{challenge.xp} XP</span>
                  <span>{challenge.difficulty}</span>
                  <span>{dateOnly(challenge.deadline)}</span>
                </div>
                <button className="primary-button" type="button" disabled={myChallengeIds.has(challenge.id)} onClick={() => joinChallenge(challenge.id)}>
                  {myChallengeIds.has(challenge.id) ? 'Joined' : 'Join'}
                </button>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="My Challenge Progress" icon={<Gauge size={18} />}>
        {!myChallenges.data.length ? <Empty /> : (
          <div className="queue-list">
            {myChallenges.data.map((item) => (
              <ProgressRow key={item.id} item={item} onSave={updateProgress} />
            ))}
          </div>
        )}
      </Panel>
      {isManager && (
        <Panel title="Challenge Approval Queue" icon={<ClipboardCheck size={18} />}>
          {!challengeQueue.data.length ? <Empty /> : (
            <div className="queue-list">
              {challengeQueue.data.map((item) => (
                <div className="queue-item" key={item.id}>
                  <div>
                    <strong>Challenge {shortId(item.challenge_id)}</strong>
                    <small>Progress {item.progress}% · Proof {item.proof_url || 'missing'}</small>
                  </div>
                  <div className="actions">
                    <button className="primary-button" type="button" onClick={() => decide(item.id, 'APPROVED')}>Approve</button>
                    <button className="danger-button" type="button" onClick={() => decide(item.id, 'REJECTED')}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
      <div className="two-col">
        <Panel title="Badges" icon={<Award size={18} />}>
          <div className="card-grid tight">
            {badges.data.map((badge) => (
              <article className={`badge-card ${earnedBadgeIds.has(badge.id) ? 'earned' : ''}`} key={badge.id}>
                <Award size={22} />
                <strong>{badge.name}</strong>
                <small>{earnedBadgeIds.has(badge.id) ? 'Earned' : badge.description || 'Locked'}</small>
              </article>
            ))}
          </div>
          {!badges.data.length && <Empty>No badges configured yet.</Empty>}
        </Panel>
        <Panel title={`Rewards · ${user?.points_balance || 0} points`} icon={<Gift size={18} />}>
          <div className="card-grid tight">
            {rewards.data.map((reward) => (
              <article className="mini-card" key={reward.id}>
                <strong>{reward.name}</strong>
                <small>{reward.points_required} points · {reward.stock} left</small>
                <button className="primary-button" type="button" disabled={(user?.points_balance || 0) < Number(reward.points_required || 0) || Number(reward.stock || 0) < 1} onClick={() => redeem(reward)}>
                  Redeem
                </button>
              </article>
            ))}
          </div>
          {!rewards.data.length && <Empty>No rewards configured yet.</Empty>}
        </Panel>
      </div>
      <Panel title="Leaderboard" icon={<Medal size={18} />}>
        <LeaderboardTable rows={rankings.data} />
      </Panel>
    </>
  )
}

function ProgressRow({ item, onSave }: { item: Row; onSave: (id: string, progress: number, proof_url?: string) => void }) {
  const [progress, setProgress] = useState(Number(item.progress || 0))
  const [proof, setProof] = useState(item.proof_url || '')
  return (
    <div className="queue-item">
      <div>
        <strong>Challenge {shortId(item.challenge_id)}</strong>
        <small>{item.approval_status}</small>
      </div>
      <input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
      <input placeholder="Proof URL" value={proof} onChange={(event) => setProof(event.target.value)} />
      <button className="primary-button" type="button" onClick={() => onSave(item.id, progress, proof)}>Save {progress}%</button>
    </div>
  )
}

function Governance() {
  const { isAuditor, isAdmin, user } = useAuth()
  const [toast, setToast] = useState<Toast>(null)
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState('issues')
  const departments = useLoad<Option[]>('/departments?limit=100', [], [])
  const employees = useLoad<Option[]>('/employees', [], [])
  const audits = useLoad<Row[]>('/audits?limit=100', [], [reload])
  const issues = useLoad<Row[]>('/compliance-issues?limit=100', [], [reload])
  const policies = useLoad<Row[]>('/esg-policies?status=ACTIVE&limit=100', [], [reload])
  const acknowledgements = useLoad<Row[]>(`/policy-acknowledgements?employee_id=${user?.id || ''}`, [], [reload, user?.id])
  const [flagOnly, setFlagOnly] = useState(false)
  const [auditForm, setAuditForm] = useState({ title: '', department_id: '', audit_date: today, auditor: user?.name || '', scope: '', status: 'PLANNED' })
  const [issueForm, setIssueForm] = useState({ audit_id: '', severity: 'MEDIUM', description: '', owner_id: user?.id || '', due_date: today })
  const acknowledgedIds = new Set(acknowledgements.data.map((item) => item.policy_id))
  const unacknowledged = policies.data.filter((policy) => !acknowledgedIds.has(policy.id))
  const filteredIssues = flagOnly ? issues.data.filter((issue) => issue.flagged) : issues.data

  const createAudit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/audits', auditForm)
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Audit created.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const createIssue = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/compliance-issues', issueForm)
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Compliance issue created.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const flagOverdue = async () => {
    try {
      const response = await api.post<ApiEnvelope<Row[]>>('/compliance-issues/flag-overdue')
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: `${response.data.flaggedCount || 0} issues newly flagged.` })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  const acknowledge = async (policy_id: string) => {
    try {
      await api.post('/policy-acknowledgements', { policy_id })
      setReload((value) => value + 1)
      setToast({ tone: 'success', message: 'Policy acknowledged.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  return (
    <>
      <ToastView toast={toast} onClose={() => setToast(null)} />
      <PageHeader icon={<ShieldCheck size={22} />} title="Governance" actions={isAdmin && <button className="primary-button" type="button" onClick={flagOverdue}>Flag overdue</button>} />
      <div className="tabs">
        {['issues', 'policies'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} type="button" onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      {unacknowledged.length > 0 && (
        <section className="policy-banner">
          <strong>{unacknowledged.length} active policy acknowledgement pending</strong>
          <div className="actions">
            {unacknowledged.slice(0, 3).map((policy) => (
              <button key={policy.id} className="secondary-button" type="button" onClick={() => acknowledge(policy.id)}>{policy.title}</button>
            ))}
          </div>
        </section>
      )}
      {tab === 'issues' && (
        <div className="two-col">
          <Panel title="Audits" icon={<ClipboardCheck size={18} />}>
            {isAuditor && (
              <form className="form-grid compact" onSubmit={createAudit}>
                <input placeholder="Title" value={auditForm.title} onChange={(event) => setAuditForm({ ...auditForm, title: event.target.value })} required />
                <Select value={auditForm.department_id} onChange={(department_id) => setAuditForm({ ...auditForm, department_id })}>
                  <option value="">Department</option>
                  {departments.data.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </Select>
                <input type="date" value={auditForm.audit_date} onChange={(event) => setAuditForm({ ...auditForm, audit_date: event.target.value })} />
                <input placeholder="Auditor" value={auditForm.auditor} onChange={(event) => setAuditForm({ ...auditForm, auditor: event.target.value })} />
                <input placeholder="Scope" value={auditForm.scope} onChange={(event) => setAuditForm({ ...auditForm, scope: event.target.value })} />
                <button className="primary-button" type="submit">Create</button>
              </form>
            )}
            <DataTable rows={audits.data} columns={['title', 'department_id', 'audit_date', 'auditor', 'status']} />
          </Panel>
          <Panel title="Compliance Issues" icon={<ShieldCheck size={18} />}>
            {isAuditor && (
              <form className="form-grid compact" onSubmit={createIssue}>
                <Select value={issueForm.audit_id} onChange={(audit_id) => setIssueForm({ ...issueForm, audit_id })} required>
                  <option value="">Audit</option>
                  {audits.data.map((audit) => <option key={audit.id} value={audit.id}>{audit.title}</option>)}
                </Select>
                <Select value={issueForm.severity} onChange={(severity) => setIssueForm({ ...issueForm, severity })} required>
                  {severities.map((severity) => <option key={severity}>{severity}</option>)}
                </Select>
                <input placeholder="Description" value={issueForm.description} onChange={(event) => setIssueForm({ ...issueForm, description: event.target.value })} required />
                <Select value={issueForm.owner_id} onChange={(owner_id) => setIssueForm({ ...issueForm, owner_id })} required>
                  <option value="">Owner</option>
                  {employees.data.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </Select>
                <input type="date" value={issueForm.due_date} onChange={(event) => setIssueForm({ ...issueForm, due_date: event.target.value })} required />
                <button className="primary-button" type="submit">Create</button>
              </form>
            )}
            <label className="check-row">
              <input type="checkbox" checked={flagOnly} onChange={(event) => setFlagOnly(event.target.checked)} />
              Flagged only
            </label>
            {!filteredIssues.length ? <Empty /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>severity</th><th>description</th><th>owner</th><th>due</th><th>status</th><th>flagged</th></tr></thead>
                  <tbody>
                    {filteredIssues.map((issue) => (
                      <tr key={issue.id}>
                        <td><span className={`severity severity-${String(issue.severity).toLowerCase()}`}>{issue.severity}</span></td>
                        <td>{issue.description}</td>
                        <td>{shortId(issue.owner_id)}</td>
                        <td>{dateOnly(issue.due_date)}</td>
                        <td>{issue.status}</td>
                        <td>{issue.flagged ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
      {tab === 'policies' && (
        <CrudPanel
          title="ESG Policies"
          endpoint="/esg-policies"
          icon={<FileText size={18} />}
          columns={['title', 'category', 'version', 'effective_date', 'status']}
          fields={[
            { name: 'title', label: 'Title', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'category', label: 'Category', type: 'select', options: ['ENVIRONMENTAL', 'SOCIAL', 'GOVERNANCE'] },
            { name: 'version', label: 'Version' },
            { name: 'effective_date', label: 'Effective date', type: 'date' },
            { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'ARCHIVED'] },
          ]}
        />
      )}
    </>
  )
}

function Reports() {
  const [tab, setTab] = useState('environmental')
  const [filters, setFilters] = useState({ module: 'environmental', department_id: '', employee_id: '', challenge_id: '', from: '', to: '' })
  const path = tab === 'custom'
    ? `/reports/custom?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()}`
    : `/reports/${tab}`
  const report = useLoad<Row[]>(path, [], [tab, filters.module, filters.department_id, filters.employee_id, filters.challenge_id, filters.from, filters.to])
  const tabs = ['environmental', 'social', 'governance', 'esg-summary', 'custom']

  const exportCsv = () => {
    const keys = Object.keys(report.data[0] || {})
    const csv = [keys.join(','), ...report.data.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ecosphere-${tab}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const doc = new jsPDF()
    doc.text(`EcoSphere ${tab} report`, 14, 18)
    report.data.slice(0, 28).forEach((row, index) => {
      doc.text(JSON.stringify(row).slice(0, 95), 14, 30 + index * 8)
    })
    doc.save(`ecosphere-${tab}.pdf`)
  }

  return (
    <>
      <PageHeader icon={<FileText size={22} />} title="Reports" actions={(
        <div className="actions">
          <button className="secondary-button" type="button" disabled={!report.data.length} onClick={exportCsv}><Download size={16} />CSV</button>
          <button className="secondary-button" type="button" disabled={!report.data.length} onClick={exportPdf}><Download size={16} />PDF</button>
        </div>
      )} />
      <div className="tabs">
        {tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} type="button" onClick={() => setTab(item)}>{item.replace('-', ' ')}</button>)}
      </div>
      {tab === 'custom' && (
        <Panel title="Custom Builder" icon={<Settings size={18} />}>
          <div className="filters">
            <Select value={filters.module} onChange={(module) => setFilters({ ...filters, module })}>
              {['environmental', 'social', 'governance', 'gamification'].map((item) => <option key={item}>{item}</option>)}
            </Select>
            <input placeholder="Department id" value={filters.department_id} onChange={(event) => setFilters({ ...filters, department_id: event.target.value })} />
            <input placeholder="Employee id" value={filters.employee_id} onChange={(event) => setFilters({ ...filters, employee_id: event.target.value })} />
            <input placeholder="Challenge id" value={filters.challenge_id} onChange={(event) => setFilters({ ...filters, challenge_id: event.target.value })} />
            <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
            <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </div>
        </Panel>
      )}
      <div className="two-col">
        <Panel title="Chart" icon={<BarChart3 size={18} />}>
          <Chart rows={report.data} x={chartKeys(report.data).x} y={chartKeys(report.data).y} type="bar" />
        </Panel>
        <Panel title="Rows" icon={<FileText size={18} />}>
          <DataTable rows={report.data} />
        </Panel>
      </div>
    </>
  )
}

function chartKeys(rows: Row[]) {
  const sample = rows[0] || {}
  const x = ['department_name', 'transaction_date', 'period_end', 'title'].find((key) => key in sample) || Object.keys(sample)[0] || 'name'
  const y = ['total_co2', 'total_score', 'approved_participations', 'open_issues', 'transaction_count'].find((key) => key in sample) || Object.keys(sample).find((key) => Number.isFinite(Number(sample[key]))) || 'value'
  return { x, y }
}

function SettingsPage() {
  const { isAdmin } = useAuth()
  const [toast, setToast] = useState<Toast>(null)
  const [tab, setTab] = useState('config')
  const config = useLoad<Row>('/esg-config', {}, [])
  const [form, setForm] = useState<Row>({})

  useEffect(() => {
    if (Object.keys(config.data).length) setForm(config.data)
  }, [config.data])

  const total = Number(form.environmental_weight || 0) + Number(form.social_weight || 0) + Number(form.governance_weight || 0)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (Math.abs(total - 1) > 0.001) {
      setToast({ tone: 'error', message: 'Environmental, social, and governance weights must sum to 1.' })
      return
    }
    try {
      await api.put('/esg-config', {
        ...form,
        environmental_weight: Number(form.environmental_weight),
        social_weight: Number(form.social_weight),
        governance_weight: Number(form.governance_weight),
      })
      setToast({ tone: 'success', message: 'Settings saved.' })
    } catch (err) {
      setToast({ tone: 'error', message: apiErrorMessage(err) })
    }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader icon={<Settings size={22} />} title="Settings" />
        <Empty>Admin access is required for ESG configuration.</Empty>
      </>
    )
  }

  return (
    <>
      <ToastView toast={toast} onClose={() => setToast(null)} />
      <PageHeader icon={<Settings size={22} />} title="Settings" />
      <div className="tabs">
        {['config', 'departments'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} type="button" onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      {tab === 'config' && (
        <Panel title="ESG Configuration" icon={<Settings size={18} />}>
          <form className="settings-form" onSubmit={save}>
            {['auto_emission_calc_enabled', 'evidence_requirement_enabled', 'badge_auto_award_enabled'].map((key) => (
              <label className="switch-row" key={key}>
                <span>{key.replaceAll('_', ' ')}</span>
                <input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
              </label>
            ))}
            {['environmental_weight', 'social_weight', 'governance_weight'].map((key) => (
              <label key={key}>
                {key.replaceAll('_', ' ')}
                <input type="number" step="0.01" min="0" max="1" value={form[key] ?? ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              </label>
            ))}
            <div className={Math.abs(total - 1) > 0.001 ? 'form-message error' : 'form-message'}>Weight total: {total.toFixed(2)}</div>
            <button className="primary-button" type="submit">Save settings</button>
          </form>
        </Panel>
      )}
      {tab === 'departments' && (
        <CrudPanel
          title="Departments"
          endpoint="/departments"
          icon={<Users size={18} />}
          columns={['name', 'code', 'employee_count', 'status']}
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'code', label: 'Code', required: true },
            { name: 'employee_count', label: 'Employee count', type: 'number' },
            { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
          ]}
        />
      )}
    </>
  )
}

function Chart({ rows, x, y, type }: { rows: Row[]; x: string; y: string; type: 'bar' | 'line' }) {
  if (!rows.length) return <Empty />
  const chartRows = rows.map((row) => ({ ...row, [y]: Number(row[y] || 0) }))
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={x} tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={y} fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={x} tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={y} stroke="var(--color-accent)" strokeWidth={3} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function LeaderboardTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <Empty />
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>rank</th><th>department</th><th>total</th><th>environmental</th><th>social</th><th>governance</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.department_id}>
              <td>{index + 1}</td>
              <td>{row.department_name || shortId(row.department_id)}</td>
              <td><strong>{moneyNumber(row.total_score)}</strong></td>
              {['environmental_score', 'social_score', 'governance_score'].map((key) => (
                <td key={key}><ScoreBar value={Number(row[key] || 0)} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="scorebar">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      <small>{moneyNumber(value)}</small>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/environmental" element={<Environmental />} />
        <Route path="/social" element={<Social />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/gamification" element={<Gamification />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
