import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Play, Loader2, RotateCcw, PanelRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { workflowApi } from '../api/client'
import { useStore } from '../store'

const mono = "'Space Mono', monospace"
const sans = "'DM Sans', sans-serif"

const inputCss: React.CSSProperties = {
  background: '#181818', border: '1px solid #2a2a2a',
  borderRadius: 4, color: '#f0f0f0', fontFamily: sans,
  fontSize: 13, padding: '8px 12px', outline: 'none', width: '100%',
}

export default function RunPage() {
  const workflows        = useStore(s => s.workflows)
  const agents           = useStore(s => s.agents)
  const setRunResult     = useStore(s => s.setRunResult)
  const setDrawerOpen    = useStore(s => s.setDrawerOpen)
  const runResult        = useStore(s => s.runResult)

  const [searchParams]   = useSearchParams()
  const [workflowId, setWorkflowId] = useState(() => searchParams.get('wf') ?? '')
  const [message, setMessage]       = useState('')
  const [resetSession, setResetSession] = useState(false)

  useEffect(() => {
    const wf = searchParams.get('wf')
    if (wf) setWorkflowId(wf)
  }, [searchParams])

  const { mutate, isPending } = useMutation({
    mutationFn: () => workflowApi.run(workflowId, message, resetSession),
    onSuccess: (data) => {
      setRunResult(data)
      setDrawerOpen(true)
      toast.success('Workflow complete — see results →')
    },
    onError: () => toast.error('Workflow execution failed'),
  })

  const selectedWf = workflows.find(w => w.workflow_id === workflowId)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 4 }}>EXECUTE & INSPECT</div>
          <h1 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Run Workflow</h1>
        </div>
        {runResult && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(232,255,71,0.08)', border: '1px solid #e8ff47', borderRadius: 4, fontFamily: mono, fontSize: 10, color: '#e8ff47', cursor: 'pointer' }}
          >
            <PanelRight size={11} /> View Last Output
          </button>
        )}
      </div>

      <div style={{ padding: '32px', maxWidth: 560 }}>
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: '#555', letterSpacing: '0.08em' }}>// CONFIGURE_RUN</div>

          {/* Workflow select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>WORKFLOW</div>
            <select
              style={inputCss}
              value={workflowId}
              onChange={e => { setWorkflowId(e.target.value) }}
            >
              <option value="">Select a workflow…</option>
              {workflows.map(w => (
                <option key={w.workflow_id} value={w.workflow_id} style={{ background: '#181818' }}>
                  {w.name} ({w.mode})
                </option>
              ))}
            </select>
          </div>

          {/* Workflow info */}
          {selectedWf && (
            <div style={{ padding: '10px 12px', background: '#181818', borderRadius: 4, borderLeft: '2px solid #e8ff47', animation: 'fadeIn 0.15s ease' }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: '#555', marginBottom: 6 }}>NODES IN THIS WORKFLOW</div>
              {selectedWf.nodes.map((n, i) => {
                const agent = agents.find(a => a.agent_id === n.agent_id)
                const COLORS: Record<string, string> = {
                  agent: '#47b3ff', chat_input: '#e8ff47', conditional: '#ff9f47',
                  function: '#47ffb3', http_request: '#c47bff', output: '#ff4757',
                }
                const color = COLORS[n.node_type] ?? '#888'
                return (
                  <div key={n.node_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontFamily: mono, fontSize: 10 }}>
                    <span style={{ color: '#555' }}>{i + 1}.</span>
                    <span style={{ padding: '1px 5px', borderRadius: 2, background: `${color}15`, color, border: `1px solid ${color}30`, fontSize: 9 }}>
                      {n.node_type}
                    </span>
                    <span style={{ color: '#ccc' }}>{n.label}</span>
                    {agent && <span style={{ color: '#555', fontSize: 9 }}>({agent.name})</span>}
                  </div>
                )
              })}
              <div style={{ fontFamily: mono, fontSize: 9, color: '#555', marginTop: 8 }}>
                MODE: <span style={{ color: '#e8ff47' }}>{selectedWf.mode.toUpperCase()}</span>
                <span style={{ marginLeft: 12 }}>NODES: <span style={{ color: '#e8ff47' }}>{selectedWf.nodes.length}</span></span>
              </div>
            </div>
          )}

          {/* Message input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>YOUR MESSAGE</div>
            <textarea
              style={{ ...inputCss, minHeight: 110, resize: 'vertical', lineHeight: 1.65 }}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your question or task for the workflow…"
              onFocus={ev => (ev.target.style.borderColor = '#e8ff47')}
              onBlur={ev  => (ev.target.style.borderColor = '#2a2a2a')}
            />
          </div>

          {/* Reset session toggle */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setResetSession(r => !r)}
          >
            <div style={{ width: 30, height: 17, borderRadius: 9, background: resetSession ? '#ff9f47' : '#1e1e1e', border: '1px solid #2a2a2a', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: resetSession ? 13 : 2, width: 11, height: 11, borderRadius: '50%', background: resetSession ? '#0a0a0a' : '#444', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: '#888' }}>
              Reset session before run
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, color: '#555' }}>
              (clears agent memory)
            </span>
          </div>

          {/* Run button */}
          <button
            disabled={isPending || !workflowId || !message.trim()}
            onClick={() => mutate()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 4,
              background: workflowId && message.trim() && !isPending ? '#e8ff47' : '#1a1a1a',
              border: `1px solid ${workflowId && message.trim() ? '#e8ff47' : '#2a2a2a'}`,
              fontFamily: mono, fontSize: 12,
              color: workflowId && message.trim() && !isPending ? '#0a0a0a' : '#555',
              cursor: workflowId && message.trim() && !isPending ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {isPending
              ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Running…</>
              : <><Play size={13} /> Run Workflow</>}
          </button>

          {/* Running pulse */}
          {isPending && (
            <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(232,255,71,0.05)', border: '1px solid rgba(232,255,71,0.2)', borderRadius: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e8ff47', animation: 'pulse 1s infinite' }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: '#e8ff47' }}>Agents processing…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}