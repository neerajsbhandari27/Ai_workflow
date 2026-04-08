import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Trash2, Plus, Database, Cpu, Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { agentApi } from '../api/client'
import type { Agent } from '../api/client'
import { useStore } from '../store'

// ── shared primitives (inline to keep page self-contained) ────────────────────

const mono = "'Space Mono', monospace"
const sans = "'DM Sans', sans-serif"

function Label({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>
      {children.toUpperCase()}
    </div>
  )
}

const inputCss: React.CSSProperties = {
  background: '#181818', border: '1px solid #2a2a2a', borderRadius: 4,
  color: '#f0f0f0', fontFamily: sans, fontSize: 13,
  padding: '8px 12px', outline: 'none', width: '100%',
}

// ── Standalone run modal ──────────────────────────────────────────────────────

function RunAgentModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const setResult = useStore(s => s.setAgentRunResult)
  const result    = useStore(s => s.agentRunResult)
  const sessionId = `standalone-${agent.agent_id}-${Date.now()}`

  const { mutate, isPending } = useMutation({
    mutationFn: () => agentApi.run(agent.agent_id, message, sessionId),
    onSuccess: r => { setResult(r); toast.success('Agent responded') },
    onError:   () => toast.error('Agent run failed'),
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: '1px solid #333', borderRadius: 8, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto' }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontFamily: mono, fontSize: 13, color: '#e8ff47' }}>// RUN_{agent.name.toUpperCase().replace(/ /g, '_')}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{agent.description}</div>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Your Message</Label>
            <textarea
              style={{ ...inputCss, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your message to the agent…"
              onFocus={e => (e.target.style.borderColor = '#47b3ff')}
              onBlur={e  => (e.target.style.borderColor = '#2a2a2a')}
            />
          </div>

          <button
            disabled={isPending || !message.trim()}
            onClick={() => mutate()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: message.trim() && !isPending ? '#47b3ff' : '#1e1e1e',
              border: '1px solid #47b3ff', borderRadius: 4, padding: '9px 16px',
              fontFamily: mono, fontSize: 12, color: message.trim() && !isPending ? '#0a0a0a' : '#555',
              cursor: message.trim() && !isPending ? 'pointer' : 'not-allowed',
            }}
          >
            {isPending
              ? <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Running…</>
              : <><Play size={11} /> Run Agent</>}
          </button>

          {/* Response */}
          {result && result.agent_id === agent.agent_id && (
            <div style={{ animation: 'fadeIn 0.2s ease both' }}>
              <Label>Response</Label>
              {result.error ? (
                <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid #ff4757', borderRadius: 4, padding: '10px 12px', fontFamily: mono, fontSize: 11, color: '#ff4757' }}>
                  {result.error}
                </div>
              ) : (
                <div style={{ background: '#181818', border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px', fontSize: 13, color: '#ccc', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}>
                  {result.response}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create Agent Modal ────────────────────────────────────────────────────────

function CreateAgentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc       = useQueryClient()
  const addAgent = useStore(s => s.addAgent)
  const [form, setForm] = useState({ name: '', description: '', instruction: '', rag_enabled: false })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { mutate, isPending } = useMutation({
    mutationFn: () => agentApi.create(form),
    onSuccess: (agent) => {
      addAgent(agent); qc.invalidateQueries({ queryKey: ['agents'] })
      toast.success(`Agent "${agent.name}" created`)
      onClose(); setForm({ name: '', description: '', instruction: '', rag_enabled: false })
    },
    onError: () => toast.error('Failed to create agent'),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())        e.name = 'Required'
    if (!form.description.trim()) e.description = 'Required'
    if (!form.instruction.trim()) e.instruction = 'Required'
    setErrors(e); return !Object.keys(e).length
  }

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, width: '100%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e1e', fontFamily: mono, fontSize: 13, color: '#f0f0f0' }}>// NEW_AGENT</div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'name', label: 'Name', placeholder: 'e.g. Researcher, Summariser' },
            { key: 'description', label: 'Description', placeholder: 'What does this agent do?' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label>{label}</Label>
              <input
                style={{ ...inputCss, borderColor: errors[key] ? '#ff4757' : '#2a2a2a' }}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                onFocus={ev => (ev.target.style.borderColor = errors[key] ? '#ff4757' : '#e8ff47')}
                onBlur={ev  => (ev.target.style.borderColor = errors[key] ? '#ff4757' : '#2a2a2a')}
              />
              {errors[key] && <div style={{ fontFamily: mono, fontSize: 10, color: '#ff4757', marginTop: 3 }}>{errors[key]}</div>}
            </div>
          ))}

          <div>
            <Label>Instruction (System Prompt)</Label>
            <textarea
              style={{ ...inputCss, minHeight: 90, resize: 'vertical', lineHeight: 1.6, borderColor: errors.instruction ? '#ff4757' : '#2a2a2a' }}
              value={form.instruction}
              onChange={e => setForm(f => ({ ...f, instruction: e.target.value }))}
              placeholder="You are an expert… Always respond with…"
              onFocus={ev => (ev.target.style.borderColor = '#e8ff47')}
              onBlur={ev  => (ev.target.style.borderColor = errors.instruction ? '#ff4757' : '#2a2a2a')}
            />
            {errors.instruction && <div style={{ fontFamily: mono, fontSize: 10, color: '#ff4757', marginTop: 3 }}>{errors.instruction}</div>}
          </div>

          {/* RAG toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '10px 12px', background: '#181818', borderRadius: 4, border: '1px solid #2a2a2a' }}
            onClick={() => setForm(f => ({ ...f, rag_enabled: !f.rag_enabled }))}>
            <div style={{ width: 32, height: 18, borderRadius: 9, background: form.rag_enabled ? '#47b3ff' : '#222', border: '1px solid #333', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: form.rag_enabled ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: form.rag_enabled ? '#0a0a0a' : '#555', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 13, color: '#ccc' }}>Enable RAG (knowledge base access)</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '7px 14px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 4, fontFamily: mono, fontSize: 11, color: '#555', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => validate() && mutate()}
              disabled={isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#e8ff47', border: '1px solid #e8ff47', borderRadius: 4, fontFamily: mono, fontSize: 11, color: '#0a0a0a', cursor: 'pointer' }}
            >
              {isPending ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              Create Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agents Page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const agents       = useStore(s => s.agents)
  const removeAgent  = useStore(s => s.removeAgent)
  const qc           = useQueryClient()
  const [modal, setModal]       = useState(false)
  const [runTarget, setRunTarget] = useState<Agent | null>(null)

  const { mutate: del } = useMutation({
    mutationFn: agentApi.delete,
    onSuccess: (_, id) => {
      removeAgent(id as string)
      qc.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agent deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="fade-in">
      {/* Page header */}
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 4 }}>MANAGE YOUR AI AGENTS</div>
          <h1 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Agents</h1>
        </div>
        <button
          onClick={() => setModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#e8ff47', border: '1px solid #e8ff47', borderRadius: 4, fontFamily: mono, fontSize: 12, color: '#0a0a0a', cursor: 'pointer' }}
        >
          <Plus size={12} /> New Agent
        </button>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {agents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 10 }}>
            <Bot size={48} color="#333" />
            <div style={{ fontFamily: mono, fontSize: 13, color: '#555' }}>No agents yet</div>
            <div style={{ fontSize: 12, color: '#444' }}>Create your first agent to get started</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {agents.map((agent, i) => (
              <div
                key={agent.agent_id}
                style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: 16, animation: `fadeIn 0.2s ease ${i * 0.05}s both` }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(71,179,255,0.1)', border: '1px solid #47b3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Cpu size={15} color="#47b3ff" />
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{agent.name}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: '#444' }}>{agent.agent_id.slice(0, 8)}…</div>
                    </div>
                  </div>
                  <button onClick={() => del(agent.agent_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4757', padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                <p style={{ fontSize: 12, color: '#888', marginBottom: 10, lineHeight: 1.55 }}>{agent.description}</p>

                {/* Instruction preview */}
                <div style={{ background: '#181818', borderRadius: 4, padding: '7px 10px', marginBottom: 10, fontFamily: mono, fontSize: 11, color: '#555', borderLeft: '2px solid #2a2a2a', lineHeight: 1.5, maxHeight: 56, overflow: 'hidden' }}>
                  {agent.instruction.slice(0, 110)}{agent.instruction.length > 110 ? '…' : ''}
                </div>

                {/* Badges + Run button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {agent.rag_enabled && (
                    <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 2, background: 'rgba(71,179,255,0.1)', color: '#47b3ff', border: '1px solid rgba(71,179,255,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Database size={8} />RAG
                    </span>
                  )}
                  <span style={{ fontFamily: mono, fontSize: 9, padding: '2px 6px', borderRadius: 2, background: '#181818', color: '#555', border: '1px solid #2a2a2a' }}>
                    gemini-2.0-flash
                  </span>
                  <button
                    onClick={() => setRunTarget(agent)}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(71,179,255,0.1)', border: '1px solid #47b3ff', borderRadius: 4, fontFamily: mono, fontSize: 10, color: '#47b3ff', cursor: 'pointer' }}
                  >
                    <Play size={10} /> Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAgentModal open={modal} onClose={() => setModal(false)} />
      {runTarget && <RunAgentModal agent={runTarget} onClose={() => setRunTarget(null)} />}
    </div>
  )
}