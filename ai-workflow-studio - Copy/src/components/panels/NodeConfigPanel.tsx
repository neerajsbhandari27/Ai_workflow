/**
 * NodeConfigPanel.tsx
 *
 * Fixes:
 *  1. Agent selection: batches all related fields in one onChange call
 *     so agent_id + description + rag_enabled are set atomically
 *  2. Delete node button added at the bottom
 *  3. Node ID display so user can copy it for conditional true_next / false_next
 */

import { useState, useEffect } from 'react'
import { X, Trash2, Copy, Check } from 'lucide-react'
import type { Node } from 'reactflow'
import type { WorkflowNode } from '../../api/client'
import { useStore } from '../../store'

interface Props {
  node:         Node | null
  onClose:      () => void
  onChange:     (id: string, data: Partial<WorkflowNode>) => void
  onDeleteNode: (id: string) => void
}

// ── Tiny shared primitives ────────────────────────────────────────────────────

const mono = "'Space Mono', monospace"
const sans = "'DM Sans', sans-serif"

function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <label style={{
          fontFamily: mono, fontSize: 9,
          color: '#555', letterSpacing: '0.08em',
        }}>
          {label.toUpperCase()}
        </label>
        {hint && (
          <span style={{ fontFamily: mono, fontSize: 8, color: '#3a3a3a' }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  )
}

const baseInput: React.CSSProperties = {
  background: '#181818', border: '1px solid #2a2a2a',
  borderRadius: 4, color: '#f0f0f0',
  fontFamily: sans, fontSize: 12,
  padding: '7px 10px', outline: 'none', width: '100%',
  transition: 'border-color 0.14s',
}

const monoInput: React.CSSProperties = {
  ...baseInput,
  fontFamily: mono, fontSize: 11,
}

function FocusInput(props: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const { mono: useMono, style, ...rest } = props
  return (
    <input
      style={{ ...(useMono ? monoInput : baseInput), ...style }}
      onFocus={e => (e.target.style.borderColor = '#e8ff47')}
      onBlur={e  => (e.target.style.borderColor = '#2a2a2a')}
      {...rest}
    />
  )
}

function FocusTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  const { mono: useMono, style, ...rest } = props
  return (
    <textarea
      style={{
        ...(useMono ? monoInput : baseInput),
        resize: 'vertical', lineHeight: 1.55,
        minHeight: 80, ...style,
      }}
      onFocus={e => (e.target.style.borderColor = '#e8ff47')}
      onBlur={e  => (e.target.style.borderColor = '#2a2a2a')}
      {...rest}
    />
  )
}

// ── Node accent colours ───────────────────────────────────────────────────────

const NODE_COLOR: Record<string, string> = {
  agent:        '#47b3ff',
  chat_input:   '#e8ff47',
  conditional:  '#ff9f47',
  function:     '#47ffb3',
  http_request: '#c47bff',
  output:       '#ff4757',
}

// ── Main component ────────────────────────────────────────────────────────────

export function NodeConfigPanel({ node, onClose, onChange, onDeleteNode }: Props) {
  const agents = useStore(s => s.agents)

  // Local copy of node data — kept in sync when selected node changes
  const [data, setData] = useState<Record<string, any>>(node?.data ?? {})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setData(node?.data ?? {})
  }, [node?.id])   // only reset when the selected node ID changes, not on every data update

  if (!node) return null

  const nodeType = node.data.node_type as string
  const accent   = NODE_COLOR[nodeType] ?? '#888'

  // Update a single field and propagate to parent
  const set = (k: string, v: any) => {
    setData(prev => {
      const next = { ...prev, [k]: v }
      onChange(node.id, next)
      return next
    })
  }

  // Update multiple fields atomically — fixes agent selection bug
  const setMany = (patch: Record<string, any>) => {
    setData(prev => {
      const next = { ...prev, ...patch }
      onChange(node.id, next)
      return next
    })
  }

  const copyId = () => {
    navigator.clipboard.writeText(node.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0,
      width: 300, zIndex: 10,
      background: '#0d0d0d',
      borderLeft: `1px solid ${accent}40`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px',
        borderBottom: `1px solid ${accent}25`,
        background: `${accent}08`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: accent, flexShrink: 0,
          }} />
          <span style={{ fontFamily: mono, fontSize: 11, color: '#f0f0f0' }}>
            {nodeType.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2, display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Node ID (copy for conditional routing) ── */}
      <div style={{
        padding: '6px 14px',
        borderBottom: '1px solid #151515',
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: mono, fontSize: 8, color: '#3a3a3a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ID: {node.id}
        </span>
        <button
          onClick={copyId}
          title="Copy node ID (use in conditional routing)"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#47ffb3' : '#444', padding: 2, display: 'flex', flexShrink: 0 }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>

      {/* ── Fields ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: 14,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>

        {/* Label — all types */}
        <Field label="Label">
          <FocusInput
            value={data.label || ''}
            onChange={e => set('label', e.target.value)}
            placeholder="Node label"
          />
        </Field>

        {/* ── AGENT ─────────────────────────────────────────────── */}
        {nodeType === 'agent' && (
          <>
            <Field label="Select Agent" hint="choose from your created agents">
              {agents.length === 0 ? (
                <div style={{
                  padding: '10px 12px', background: '#181818',
                  border: '1px solid #2a2a2a', borderRadius: 4,
                  fontFamily: mono, fontSize: 10, color: '#555',
                  lineHeight: 1.5,
                }}>
                  No agents yet.{' '}
                  <span style={{ color: '#47b3ff' }}>
                    Go to the Agents page to create one first.
                  </span>
                </div>
              ) : (
                <select
                  style={{
                    ...baseInput,
                    cursor: 'pointer',
                    borderColor: data.agent_id ? '#47b3ff' : '#2a2a2a',
                  }}
                  value={data.agent_id || ''}
                  onChange={e => {
                    const id = e.target.value
                    const ag = agents.find(a => a.agent_id === id)
                    // Batch all agent-related fields in ONE call to avoid overwrites
                    setMany({
                      agent_id:    id,
                      label:       ag ? ag.name        : data.label,
                      description: ag ? ag.description : '',
                      rag_enabled: ag ? ag.rag_enabled : false,
                    })
                  }}
                >
                  <option value="">— choose agent —</option>
                  {agents.map(a => (
                    <option key={a.agent_id} value={a.agent_id}>
                      {a.name}{a.rag_enabled ? ' [RAG]' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {data.agent_id && (() => {
              const ag = agents.find(a => a.agent_id === data.agent_id)
              return ag ? (
                <div style={{
                  background: '#181818', border: '1px solid #47b3ff30',
                  borderRadius: 4, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ fontFamily: mono, fontSize: 9, color: '#47b3ff' }}>SELECTED AGENT</div>
                  <div style={{ fontSize: 12, color: '#f0f0f0', fontWeight: 500 }}>{ag.name}</div>
                  <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>{ag.description}</div>
                  {ag.rag_enabled && (
                    <div style={{ fontFamily: mono, fontSize: 9, color: '#47b3ff' }}>
                      ✓ RAG enabled — has knowledge base access
                    </div>
                  )}
                  <div style={{
                    fontFamily: mono, fontSize: 9, color: '#555',
                    borderTop: '1px solid #222', paddingTop: 6, marginTop: 2,
                    overflow: 'hidden', maxHeight: 44,
                  }}>
                    {ag.instruction.slice(0, 120)}{ag.instruction.length > 120 ? '…' : ''}
                  </div>
                </div>
              ) : null
            })()}
          </>
        )}

        {/* ── CONDITIONAL ───────────────────────────────────────── */}
        {nodeType === 'conditional' && (
          <>
            <Field label="Operator">
              <select
                style={{ ...baseInput, cursor: 'pointer' }}
                value={data.condition_operator || 'contains'}
                onChange={e => set('condition_operator', e.target.value)}
              >
                <option value="contains">contains</option>
                <option value="not_contains">not contains</option>
                <option value="equals">equals</option>
                <option value="regex">regex match</option>
              </select>
            </Field>
            <Field label="Value to match">
              <FocusInput
                mono
                value={data.condition_value || ''}
                onChange={e => set('condition_value', e.target.value)}
                placeholder='e.g.  yes   or   error   or   [0-9]+'
              />
            </Field>
            <Field label="TRUE → jump to node ID" hint="paste node ID from header">
              <FocusInput
                mono
                value={data.true_next || ''}
                onChange={e => set('true_next', e.target.value || null)}
                placeholder="node_id_..."
              />
            </Field>
            <Field label="FALSE → jump to node ID" hint="leave blank to stop">
              <FocusInput
                mono
                value={data.false_next || ''}
                onChange={e => set('false_next', e.target.value || null)}
                placeholder="node_id_..."
              />
            </Field>
            <div style={{
              padding: '8px 10px', background: '#181818',
              border: '1px solid #ff9f4730', borderRadius: 4,
              fontFamily: mono, fontSize: 9, color: '#555', lineHeight: 1.6,
            }}>
              Tip: click the copy icon next to any node's ID (top of this panel) to get the ID for routing.
            </div>
          </>
        )}

        {/* ── FUNCTION ──────────────────────────────────────────── */}
        {nodeType === 'function' && (
          <Field label="Python Code">
            <div style={{ fontFamily: mono, fontSize: 9, color: '#444', marginBottom: 4, lineHeight: 1.6 }}>
              <span style={{ color: '#47ffb3' }}>input</span> = previous output &nbsp;·&nbsp;
              assign result to <span style={{ color: '#47ffb3' }}>output</span>
            </div>
            <FocusTextarea
              mono
              style={{ minHeight: 180 }}
              value={data.python_code || ''}
              onChange={e => set('python_code', e.target.value)}
              placeholder={'# Example\nwords = input.split()\noutput = f"Word count: {len(words)}"'}
            />
          </Field>
        )}

        {/* ── HTTP REQUEST ───────────────────────────────────────── */}
        {nodeType === 'http_request' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 8 }}>
              <Field label="Method">
                <select
                  style={{ ...baseInput, cursor: 'pointer' }}
                  value={data.http_method || 'GET'}
                  onChange={e => set('http_method', e.target.value)}
                >
                  {['GET', 'POST', 'PUT', 'DELETE'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="URL">
                <FocusInput
                  mono
                  value={data.http_url || ''}
                  onChange={e => set('http_url', e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                />
              </Field>
            </div>
            <Field label="Body Template" hint="{input} → prev output">
              <FocusTextarea
                mono
                style={{ minHeight: 80 }}
                value={data.http_body_template || ''}
                onChange={e => set('http_body_template', e.target.value)}
                placeholder={'{"query": "{input}"}'}
              />
            </Field>
            <Field label="Headers (JSON)">
              <FocusTextarea
                mono
                style={{ minHeight: 60 }}
                value={
                  typeof data.http_headers === 'string'
                    ? data.http_headers
                    : JSON.stringify(data.http_headers || {}, null, 2)
                }
                onChange={e => {
                  try   { set('http_headers', JSON.parse(e.target.value)) }
                  catch { set('http_headers', e.target.value) }
                }}
                placeholder={'{"Content-Type": "application/json"}'}
              />
            </Field>
          </>
        )}

        {/* ── CHAT INPUT / OUTPUT ────────────────────────────────── */}
        {(nodeType === 'chat_input' || nodeType === 'output') && (
          <div style={{
            padding: '12px', background: '#181818',
            border: '1px solid #222', borderRadius: 4,
            fontFamily: mono, fontSize: 10, color: '#555', lineHeight: 1.6,
          }}>
            {nodeType === 'chat_input'
              ? 'Entry point. Passes the user message to the next node. No configuration needed.'
              : 'Terminal node. Collects the final workflow output. No configuration needed.'}
          </div>
        )}
      </div>

      {/* ── Delete button ── */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid #1a1a1a',
        flexShrink: 0,
      }}>
        <button
          onClick={() => { onDeleteNode(node.id); onClose() }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
            padding: '8px 0',
            background: 'rgba(255,71,87,0.08)',
            border: '1px solid rgba(255,71,87,0.4)',
            borderRadius: 4, cursor: 'pointer',
            fontFamily: mono, fontSize: 10, color: '#ff4757',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,71,87,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,71,87,0.08)')}
        >
          <Trash2 size={12} /> Remove Node
        </button>
      </div>
    </div>
  )
}