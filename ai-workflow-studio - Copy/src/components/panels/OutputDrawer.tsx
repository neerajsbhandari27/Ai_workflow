import { useEffect } from 'react'
import { X, CheckCircle, XCircle, ChevronDown, ChevronRight, GitBranch, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store'
import type { StepResult } from '../../api/client'

// ── node type colours ─────────────────────────────────────────────────────────

const NODE_ACCENT: Record<string, string> = {
  agent:        '#47b3ff',
  chat_input:   '#e8ff47',
  conditional:  '#ff9f47',
  function:     '#47ffb3',
  http_request: '#c47bff',
  output:       '#ff4757',
}

function StepCard({ step, index }: { step: StepResult; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const hasError = !!step.error
  const accent   = NODE_ACCENT[step.node_type] ?? '#888'

  return (
    <div style={{
      border: `1px solid ${hasError ? '#ff4757' : '#2a2a2a'}`,
      borderRadius: 6, overflow: 'hidden',
      animation: `fadeIn 0.2s ease ${index * 0.06}s both`,
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
          background: '#111', cursor: 'pointer',
          borderBottom: open ? '1px solid #1e1e1e' : 'none',
        }}
      >
        {/* Step number dot */}
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          background: hasError ? 'rgba(255,71,87,0.15)' : `${accent}18`,
          border: `1px solid ${hasError ? '#ff4757' : accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700,
          color: hasError ? '#ff4757' : accent,
        }}>
          {index + 1}
        </div>

        {/* Node type pill */}
        <span style={{
          fontFamily: "'Space Mono', monospace", fontSize: 9,
          padding: '1px 5px', borderRadius: 2,
          background: `${accent}18`, color: accent,
          border: `1px solid ${accent}30`, flexShrink: 0,
        }}>
          {step.node_type}
        </span>

        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#f0f0f0', flex: 1 }}>
          {step.label}
        </span>

        {/* Branch badge */}
        {step.branch && (
          <span style={{
            fontFamily: "'Space Mono', monospace", fontSize: 9,
            color: step.branch === 'true' ? '#47ffb3' : '#ff4757',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <GitBranch size={9} />{step.branch.toUpperCase()}
          </span>
        )}

        {hasError
          ? <XCircle     size={12} color="#ff4757" />
          : <CheckCircle size={12} color="#47ffb3" />}
        {open
          ? <ChevronDown  size={11} color="#555" />
          : <ChevronRight size={11} color="#555" />}
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '10px 12px', background: '#0a0a0a', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#555', marginBottom: 3 }}>INPUT</div>
            <div style={{
              background: '#181818', borderRadius: 3, padding: '6px 8px',
              fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#666',
              lineHeight: 1.55, maxHeight: 80, overflowY: 'auto',
            }}>
              {step.input || '—'}
            </div>
          </div>

          {hasError ? (
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#ff4757', marginBottom: 3 }}>ERROR</div>
              <div style={{
                background: 'rgba(255,71,87,0.08)', borderRadius: 3, padding: '6px 8px',
                fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#ff4757', lineHeight: 1.55,
              }}>
                {step.error}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#47ffb3', marginBottom: 3 }}>OUTPUT</div>
              <div style={{
                background: '#181818', borderRadius: 3, padding: '6px 8px',
                fontSize: 12, color: '#ccc', lineHeight: 1.7,
                maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap',
              }}>
                {step.output || '—'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function OutputDrawer() {
  const open         = useStore(s => s.drawerOpen)
  const setOpen      = useStore(s => s.setDrawerOpen)
  const result       = useStore(s => s.runResult)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 480, background: '#0d0d0d',
        borderLeft: '1px solid #2a2a2a',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #1e1e1e',
          position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1,
        }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#f0f0f0' }}>
              // WORKFLOW_OUTPUT
            </div>
            {result && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#555', marginTop: 2 }}>
                {result.workflow_name} · {result.mode} · {result.steps.length} steps
              </div>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#333',
          }}>
            Run a workflow to see results
          </div>
        ) : (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Step cards */}
            {result.steps.map((step, i) => (
              <StepCard key={`${step.node_id}-${i}`} step={step} index={i} />
            ))}

            {/* Final output box */}
            <div style={{
              border: '1px solid #e8ff47', borderRadius: 6, overflow: 'hidden',
              animation: `fadeIn 0.3s ease ${result.steps.length * 0.06 + 0.1}s both`,
              marginTop: 4,
            }}>
              <div style={{
                padding: '7px 12px', background: 'rgba(232,255,71,0.06)',
                fontFamily: "'Space Mono', monospace", fontSize: 9,
                color: '#e8ff47', letterSpacing: '0.08em',
              }}>
                FINAL OUTPUT
              </div>
              <div style={{
                padding: 12, fontSize: 13, color: '#f0f0f0',
                lineHeight: 1.8, whiteSpace: 'pre-wrap', background: '#0a0a0a',
                maxHeight: 300, overflowY: 'auto',
              }}>
                {result.final_output || '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}