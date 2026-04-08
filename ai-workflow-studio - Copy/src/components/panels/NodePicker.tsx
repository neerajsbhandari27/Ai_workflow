/**
 * NodePicker.tsx
 *
 * Floating panel for selecting and adding nodes to the canvas.
 *
 * Opens via:
 *   1. "+ Add Node" toolbar button  → drops at canvas centre
 *   2. Right-click on canvas        → drops at cursor position
 *   3. Double-click on canvas       → drops at cursor position
 *
 * Features:
 *   - Live search across name / description / detail
 *   - Category filter tabs
 *   - Hover to see full node explanation
 *   - Click card → add node
 *   - Drag card → drop anywhere on canvas
 *   - Keyboard: ↑↓ navigate, Enter add, Esc close
 */

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Cpu, GitBranch, Code2, Globe, Flag, Search, X, Info } from 'lucide-react'

// ── Palette catalogue ─────────────────────────────────────────────────────────

export interface PaletteEntry {
  type:     string
  label:    string
  icon:     React.ElementType
  color:    string
  category: string
  desc:     string
  detail:   string
}

export const PALETTE: PaletteEntry[] = [
  {
    type: 'chat_input',
    label: 'Chat Input',
    icon: MessageSquare,
    color: '#e8ff47',
    category: 'Input / Output',
    desc: 'Entry point for user message',
    detail:
      "The starting node of every workflow. Receives the user's message and passes it downstream unchanged. Add exactly one per workflow — it must be the first node.",
  },
  {
    type: 'agent',
    label: 'Agent',
    icon: Cpu,
    color: '#47b3ff',
    category: 'AI',
    desc: 'Azure GPT-4 AI agent',
    detail:
      'Runs one of your configured AI agents via Azure OpenAI (LiteLLM). The agent receives the previous node output as its prompt. Configure instruction, RAG and tool settings per agent on the Agents page.',
  },
  {
    type: 'conditional',
    label: 'Conditional',
    icon: GitBranch,
    color: '#ff9f47',
    category: 'Logic',
    desc: 'If / else branch',
    detail:
      'Evaluates the previous output against a rule: contains, not contains, equals, or regex. Routes to TRUE path or FALSE path accordingly, enabling dynamic branching in your workflow.',
  },
  {
    type: 'function',
    label: 'Function',
    icon: Code2,
    color: '#47ffb3',
    category: 'Logic',
    desc: 'Run custom Python code',
    detail:
      'Executes server-side Python. The variable `input` holds the previous output. Assign your result to `output`. Runs inside a sandboxed exec() — great for data transformation and filtering.',
  },
  {
    type: 'http_request',
    label: 'HTTP Request',
    icon: Globe,
    color: '#c47bff',
    category: 'Integration',
    desc: 'Call any external API',
    detail:
      'Makes a GET / POST / PUT / DELETE call to any URL. Use {input} in the body template to inject the previous output. The response body (JSON or text) is passed to the next node.',
  },
  {
    type: 'output',
    label: 'Output',
    icon: Flag,
    color: '#ff4757',
    category: 'Input / Output',
    desc: 'Collect final result',
    detail:
      'Terminal node. Marks the end of the workflow and surfaces the final result in the output drawer. No further nodes can be connected after this.',
  },
]

const CATEGORIES = ['All', ...Array.from(new Set(PALETTE.map(p => p.category)))]

// ── Props ─────────────────────────────────────────────────────────────────────

interface NodePickerProps {
  open:             boolean
  onClose:          () => void
  onAddNode:        (type: string) => void
  onDragStart:      (e: React.DragEvent, type: string) => void
  anchorPosition?:  { x: number; y: number }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NodePicker({
  open,
  onClose,
  onAddNode,
  onDragStart,
  anchorPosition,
}: NodePickerProps) {
  const [query,    setQuery]    = useState('')
  const [category, setCategory] = useState('All')
  const [focused,  setFocused]  = useState(0)
  const [hovered,  setHovered]  = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef  = useRef<HTMLDivElement>(null)

  const mono = "'Space Mono', monospace"
  const sans = "'DM Sans', sans-serif"

  // Filtered list
  const filtered = PALETTE.filter(p => {
    const q    = query.toLowerCase()
    const inQ  = !q
      || p.label.toLowerCase().includes(q)
      || p.desc.toLowerCase().includes(q)
      || p.detail.toLowerCase().includes(q)
    const inCat = category === 'All' || p.category === category
    return inQ && inCat
  })

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 60)
      setQuery('')
      setCategory('All')
      setFocused(0)
      setHovered(null)
    }
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocused(f => Math.min(f + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocused(f => Math.max(f - 1, 0))
      }
      if (e.key === 'Enter' && filtered[focused]) {
        onAddNode(filtered[focused].type)
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, focused, onAddNode, onClose])

  // Click outside closes
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  // Panel position
  const panelStyle: React.CSSProperties = anchorPosition
    ? {
        position:  'fixed',
        left:      Math.min(anchorPosition.x, window.innerWidth  - 480),
        top:       Math.min(anchorPosition.y, window.innerHeight - 560),
        zIndex:    500,
      }
    : {
        position:  'fixed',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        zIndex:    500,
      }

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        inset:    0,
        zIndex:   499,
        background: 'rgba(0,0,0,0.4)',
      }} />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          ...panelStyle,
          width:      460,
          background: '#0d0d0d',
          border:     '1px solid #2a2a2a',
          borderRadius: 10,
          boxShadow:  '0 24px 80px rgba(0,0,0,0.75)',
          display:    'flex',
          flexDirection: 'column',
          maxHeight:  '78vh',
          overflow:   'hidden',
          animation:  'fadeIn 0.14s ease both',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 16px 10px',
          borderBottom:   '1px solid #1a1a1a',
          flexShrink:     0,
        }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 12, color: '#e8ff47', fontWeight: 700 }}>
              // ADD_NODE
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: '#444', marginTop: 2 }}>
              click to place · drag to position
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      '#555',
              padding:    4,
              display:    'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            background: '#181818',
            border:     '1px solid #2a2a2a',
            borderRadius: 6,
            padding:    '7px 10px',
          }}>
            <Search size={13} color="#555" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setFocused(0) }}
              placeholder="Search nodes…"
              style={{
                background: 'none',
                border:     'none',
                outline:    'none',
                color:      '#f0f0f0',
                fontFamily: sans,
                fontSize:   13,
                flex:       1,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  color:      '#555',
                  padding:    0,
                  display:    'flex',
                  alignItems: 'center',
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* ── Category tabs ────────────────────────────────────────────────── */}
        <div style={{
          display:      'flex',
          gap:          4,
          padding:      '8px 14px',
          borderBottom: '1px solid #1a1a1a',
          overflowX:    'auto',
          flexShrink:   0,
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setFocused(0) }}
              style={{
                padding:      '4px 10px',
                borderRadius: 4,
                border:       'none',
                cursor:       'pointer',
                fontFamily:   mono,
                fontSize:     9,
                whiteSpace:   'nowrap',
                background:   category === cat ? '#e8ff47' : '#181818',
                color:        category === cat ? '#0a0a0a' : '#666',
                transition:   'all 0.12s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Node grid ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign:  'center',
              padding:    '36px 0',
              fontFamily: mono,
              fontSize:   12,
              color:      '#444',
            }}>
              No nodes match "{query}"
            </div>
          ) : (
            <div style={{
              display:               'grid',
              gridTemplateColumns:   '1fr 1fr',
              gap:                   8,
            }}>
              {filtered.map((entry, idx) => {
                const Icon      = entry.icon
                const isActive  = hovered === entry.type || focused === idx

                return (
                  <div
                    key={entry.type}
                    draggable
                    onDragStart={e => { onDragStart(e, entry.type); onClose() }}
                    onClick={() => { onAddNode(entry.type); onClose() }}
                    onMouseEnter={() => { setHovered(entry.type); setFocused(idx) }}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      background:   isActive ? '#181818' : '#111',
                      border:       `1px solid ${isActive ? entry.color : '#222'}`,
                      borderRadius: 7,
                      padding:      '12px 12px 10px',
                      cursor:       'pointer',
                      transition:   'all 0.12s',
                      position:     'relative',
                      userSelect:   'none',
                    }}
                  >
                    {/* Icon + label */}
                    <div style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        8,
                      marginBottom: 6,
                    }}>
                      <div style={{
                        width:          32,
                        height:         32,
                        borderRadius:   6,
                        flexShrink:     0,
                        background:     `${entry.color}15`,
                        border:         `1px solid ${entry.color}40`,
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                      }}>
                        <Icon size={15} color={entry.color} />
                      </div>
                      <div>
                        <div style={{
                          fontFamily: mono,
                          fontSize:   11,
                          fontWeight: 700,
                          color:      isActive ? '#f0f0f0' : '#ccc',
                        }}>
                          {entry.label}
                        </div>
                        <div style={{
                          fontFamily: mono,
                          fontSize:   8,
                          color:      entry.color,
                          opacity:    0.85,
                        }}>
                          {entry.category}
                        </div>
                      </div>
                    </div>

                    {/* Short description */}
                    <div style={{
                      fontSize:   11,
                      color:      '#666',
                      lineHeight: 1.45,
                      fontFamily: sans,
                    }}>
                      {entry.desc}
                    </div>

                    {/* Expanded detail on hover */}
                    {isActive && (
                      <div style={{
                        fontSize:     10,
                        color:        '#555',
                        lineHeight:   1.55,
                        fontFamily:   sans,
                        marginTop:    8,
                        borderTop:    '1px solid #1e1e1e',
                        paddingTop:   7,
                      }}>
                        {entry.detail}
                      </div>
                    )}

                    {/* Drag hint */}
                    {isActive && (
                      <div style={{
                        position:   'absolute',
                        top:        6,
                        right:      8,
                        fontFamily: mono,
                        fontSize:   8,
                        color:      '#444',
                      }}>
                        drag ↗
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{
          padding:      '8px 14px',
          borderTop:    '1px solid #1a1a1a',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          flexShrink:   0,
        }}>
          <Info size={10} color="#444" />
          <span style={{ fontFamily: mono, fontSize: 9, color: '#444' }}>
            ↑↓ navigate · Enter add · Esc close · drag card to position on canvas
          </span>
        </div>
      </div>
    </>
  )
}