import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bot, GitFork, Database, Activity, ChevronRight, Zap } from 'lucide-react'
import { agentApi, workflowApi, healthApi } from './api/client'
import { useStore } from './store'
import { OutputDrawer } from "./components/panels/OutputDrawer"
import AgentsPage    from './pages/AgentsPage'
import WorkflowsPage from './pages/WorkflowsPage'
import KnowledgePage from './pages/KnowledgePage'
import RunPage       from './pages/RunPage'

const mono = "'Space Mono', monospace"
const sans = "'DM Sans', sans-serif"

function Sidebar() {
  const nav = [
    { to: '/agents',    icon: Bot,      label: 'Agents',    sub: 'Create & run'   },
    { to: '/workflows', icon: GitFork,  label: 'Workflows', sub: 'Visual builder' },
    { to: '/knowledge', icon: Database, label: 'Knowledge', sub: 'Ingest & ask'   },
    { to: '/run',       icon: Activity, label: 'Run',       sub: 'Execute & test' },
  ]

  const { data: health } = useQuery({
    queryKey: ['health'], queryFn: healthApi.check, refetchInterval: 5000,
  })

  return (
    <aside style={{
      width: 220, background: '#0d0d0d',
      borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
    }}>
      <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Zap size={14} color="#e8ff47" fill="#e8ff47" />
          <span style={{ fontFamily: mono, fontSize: 12, color: '#e8ff47', letterSpacing: '0.06em' }}>
            AI WORKFLOW
          </span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
          STUDIO v3.1
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 0' }}>
        {nav.map(({ to, icon: Icon, label, sub }) => (
          <NavLink key={to} to={to} style={{ textDecoration: 'none', display: 'block' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px',
                background: isActive ? 'rgba(232,255,71,0.05)' : 'transparent',
                borderLeft: `2px solid ${isActive ? '#e8ff47' : 'transparent'}`,
                transition: 'all 0.13s',
              }}>
                <Icon size={14} color={isActive ? '#e8ff47' : '#444'} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isActive ? '#f0f0f0' : '#888', fontFamily: sans }}>{label}</div>
                  <div style={{ fontSize: 9, color: '#444', fontFamily: mono }}>{sub}</div>
                </div>
                {isActive && <ChevronRight size={10} color="#e8ff47" />}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 18px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: health?.status === 'ok' ? '#47ffb3' : '#ff4757',
            animation: health?.status === 'ok' ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ fontFamily: mono, fontSize: 9, color: '#444' }}>
            {health?.status === 'ok' ? 'BACKEND ONLINE' : 'OFFLINE'}
          </span>
        </div>
        {health && (
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: '#444' }}>
              <span style={{ color: '#e8ff47' }}>{health.agents}</span> agents
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, color: '#444' }}>
              <span style={{ color: '#e8ff47' }}>{health.workflows}</span> flows
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}

function Bootstrap() {
  const setAgents    = useStore(s => s.setAgents)
  const setWorkflows = useStore(s => s.setWorkflows)
  const { data: agents }    = useQuery({ queryKey: ['agents'],    queryFn: agentApi.list })
  const { data: workflows } = useQuery({ queryKey: ['workflows'], queryFn: workflowApi.list })
  useEffect(() => { if (agents)    setAgents(agents)       }, [agents])
  useEffect(() => { if (workflows) setWorkflows(workflows) }, [workflows])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Bootstrap />
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
          <Routes>
            <Route path="/"          element={<AgentsPage />}    />
            <Route path="/agents"    element={<AgentsPage />}    />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/ingest"    element={<KnowledgePage />} />  {/* backwards compat */}
            <Route path="/run"       element={<RunPage />}       />
          </Routes>
        </main>
      </div>
      <OutputDrawer />
    </BrowserRouter>
  )
}