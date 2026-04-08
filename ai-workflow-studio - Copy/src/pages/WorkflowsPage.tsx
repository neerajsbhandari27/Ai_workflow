import { useState, useCallback, useRef } from 'react'
import ReactFlow, {
  Background, Controls, BackgroundVariant,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Play, Save, RotateCcw, ChevronRight, LayoutList, Columns } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { workflowApi } from '../api/client'
import type { WorkflowNode, Workflow } from '../api/client'
import { useStore } from '../store'
import { nodeTypes } from '../components/nodes'
import { NodeConfigPanel } from '../components/panels/NodeConfigPanel'
import { NodePicker, PALETTE } from '../components/panels/NodePicker'

const mono = "'Space Mono', monospace"
const sans = "'DM Sans', sans-serif"

// ── Node factory ──────────────────────────────────────────────────────────────

let _counter = 0
const newId = () => `node_${++_counter}_${Date.now()}`

function makeNode(type: string, position: { x: number; y: number }): Node {
  const meta = PALETTE.find(p => p.type === type)
  const id   = newId()
  return {
    id, type, position,
    data: {
      node_id: id, node_type: type,
      label: meta?.label ?? type,
      description: '',
      agent_id: undefined, rag_enabled: false,
      condition_operator: 'contains', condition_value: '',
      true_next: null, false_next: null,
      python_code: '',
      http_url: '', http_method: 'GET', http_headers: {}, http_body_template: '',
    },
  }
}

function nodesToWorkflowNodes(nodes: Node[]): WorkflowNode[] {
  return nodes.map(n => ({
    node_id:            n.id,
    node_type:          n.data.node_type,
    label:              n.data.label,
    agent_id:           n.data.agent_id           ?? null,
    condition_operator: n.data.condition_operator ?? 'contains',
    condition_value:    n.data.condition_value    ?? '',
    true_next:          n.data.true_next          ?? null,
    false_next:         n.data.false_next         ?? null,
    python_code:        n.data.python_code        ?? '',
    http_url:           n.data.http_url           ?? '',
    http_method:        n.data.http_method        ?? 'GET',
    http_headers:       n.data.http_headers       ?? {},
    http_body_template: n.data.http_body_template ?? '',
  }))
}

// ── Read-only preview ─────────────────────────────────────────────────────────

function WorkflowPreview({ workflow }: { workflow: Workflow }) {
  const agents = useStore(s => s.agents)
  const nodes: Node[] = workflow.nodes.map((n, i) => ({
    id: n.node_id, type: n.node_type,
    position: { x: i * 265, y: 60 },
    data: {
      ...n,
      description: agents.find(a => a.agent_id === n.agent_id)?.description ?? '',
      rag_enabled: agents.find(a => a.agent_id === n.agent_id)?.rag_enabled ?? false,
    },
  }))
  const edges: Edge[] = workflow.nodes.slice(0, -1).map((_, i) => ({
    id: `e-${i}`,
    source: workflow.nodes[i].node_id,
    target: workflow.nodes[i + 1].node_id,
    animated: true, style: { stroke: '#e8ff47', strokeWidth: 1.5 },
  }))
  return (
    <div style={{ height: 230, borderRadius: 6, overflow: 'hidden', border: '1px solid #1e1e1e' }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        fitView fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false} zoomOnScroll={false}
        nodesDraggable={false} elementsSelectable={false}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a1a" />
      </ReactFlow>
    </div>
  )
}

// ── Build canvas ──────────────────────────────────────────────────────────────

function BuildCanvas({ onSaved }: { onSaved: () => void }) {
  const qc          = useQueryClient()
  const addWorkflow = useStore(s => s.addWorkflow)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode]  = useState<Node | null>(null)
  const [rfInstance, setRfInstance]      = useState<ReactFlowInstance | null>(null)
  const [name, setName]                  = useState('')
  const [mode, setMode]                  = useState<'sequential' | 'parallel'>('sequential')
  const [pickerOpen,   setPickerOpen]    = useState(false)
  const [pickerAnchor, setPickerAnchor]  = useState<{ x: number; y: number } | undefined>()
  const pendingFlowPos                   = useRef<{ x: number; y: number } | null>(null)

  // ── Connections ──────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (p: Connection) => setEdges(es => addEdge(
      { ...p, animated: true, style: { stroke: '#e8ff47', strokeWidth: 1.5 } }, es,
    )),
    [setEdges],
  )

  // ── Drag-and-drop ────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('nodeType')
    if (!type || !rfInstance || !wrapperRef.current) return
    const b  = wrapperRef.current.getBoundingClientRect()
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX - b.left, y: e.clientY - b.top })
    setNodes(ns => [...ns, makeNode(type, pos)])
  }, [rfInstance, setNodes])

  // ── Add node (click from picker) ─────────────────────────────────────────

  const handleAddNode = useCallback((type: string) => {
    let pos: { x: number; y: number }
    if (pendingFlowPos.current) {
      pos = pendingFlowPos.current
      pendingFlowPos.current = null
    } else if (rfInstance && wrapperRef.current) {
      const b = wrapperRef.current.getBoundingClientRect()
      pos = rfInstance.screenToFlowPosition({
        x: b.left + b.width  / 2 + nodes.length * 18,
        y: b.top  + b.height / 2 + nodes.length * 18,
      })
    } else {
      pos = { x: 200 + nodes.length * 40, y: 120 }
    }
    setNodes(ns => [...ns, makeNode(type, pos)])
  }, [rfInstance, nodes.length, setNodes])

  // ── Delete node ──────────────────────────────────────────────────────────

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }, [setNodes, setEdges])

  // ── Open picker ──────────────────────────────────────────────────────────

  const openPicker = (anchor?: { x: number; y: number }) => {
    setPickerAnchor(anchor)
    setPickerOpen(true)
  }

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!rfInstance || !wrapperRef.current) return
    const b = wrapperRef.current.getBoundingClientRect()
    pendingFlowPos.current = rfInstance.screenToFlowPosition({ x: e.clientX - b.left, y: e.clientY - b.top })
    openPicker({ x: e.clientX + 8, y: e.clientY + 8 })
  }, [rfInstance])

  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!rfInstance || !wrapperRef.current) return
    const b = wrapperRef.current.getBoundingClientRect()
    pendingFlowPos.current = rfInstance.screenToFlowPosition({ x: e.clientX - b.left, y: e.clientY - b.top })
    openPicker({ x: e.clientX + 8, y: e.clientY + 8 })
  }, [rfInstance])

  // ── Node data change ─────────────────────────────────────────────────────

  const handleNodeDataChange = useCallback((nodeId: string, newData: Partial<WorkflowNode>) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n))
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev)
  }, [setNodes])

  // ── Save ─────────────────────────────────────────────────────────────────

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => workflowApi.create({
      name: name.trim() || 'Untitled Workflow',
      nodes: nodesToWorkflowNodes(nodes), mode,
    }),
    onSuccess: wf => {
      addWorkflow(wf)
      qc.invalidateQueries({ queryKey: ['workflows'] })
      toast.success(`"${wf.name}" saved`)
      onSaved()
    },
    onError: () => toast.error('Failed to save workflow'),
  })

  const canSave = nodes.length > 0 && !isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderBottom: '1px solid #1e1e1e',
        background: '#0d0d0d', flexShrink: 0,
      }}>
        <input
          style={{
            background: '#181818', border: '1px solid #2a2a2a', borderRadius: 4,
            color: '#f0f0f0', fontFamily: mono, fontSize: 12,
            padding: '6px 10px', outline: 'none', width: 200,
          }}
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Workflow name…"
          onFocus={ev => (ev.target.style.borderColor = '#e8ff47')}
          onBlur={ev  => (ev.target.style.borderColor = '#2a2a2a')}
        />
        <select
          style={{
            background: '#181818', border: '1px solid #2a2a2a', borderRadius: 4,
            color: '#f0f0f0', fontFamily: mono, fontSize: 11,
            padding: '6px 8px', outline: 'none', cursor: 'pointer',
          }}
          value={mode} onChange={e => setMode(e.target.value as any)}
        >
          <option value="sequential">Sequential</option>
          <option value="parallel">Parallel</option>
        </select>
        <span style={{ fontFamily: mono, fontSize: 10, color: '#555' }}>
          {nodes.length} node{nodes.length !== 1 ? 's' : ''}
        </span>

        {/* Add Node CTA */}
        <button
          onClick={() => { pendingFlowPos.current = null; openPicker(undefined) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'rgba(232,255,71,0.1)', border: '1px solid #e8ff47',
            borderRadius: 5, fontFamily: mono, fontSize: 11, color: '#e8ff47', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,255,71,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,255,71,0.1)')}
        >
          <Plus size={12} /> Add Node
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => { setNodes([]); setEdges([]); setSelectedNode(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 4, fontFamily: mono, fontSize: 10, color: '#555', cursor: 'pointer' }}>
            <RotateCcw size={10} /> Clear
          </button>
          <button disabled={!canSave} onClick={() => save()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
              background: canSave ? '#e8ff47' : '#1a1a1a',
              border: `1px solid ${canSave ? '#e8ff47' : '#2a2a2a'}`,
              borderRadius: 4, fontFamily: mono, fontSize: 10,
              color: canSave ? '#0a0a0a' : '#444',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}>
            <Save size={10} /> Save Workflow
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div style={{
        padding: '4px 16px', background: '#0a0a0a',
        borderBottom: '1px solid #131313',
        fontFamily: mono, fontSize: 9, color: '#2e2e2e',
        display: 'flex', gap: 18, flexShrink: 0,
      }}>
        <span>+ Add Node → browse</span>
        <span>right-click / double-click canvas → add at position</span>
        <span>click node → configure &amp; delete</span>
        <span>Delete key → remove selected</span>
        <span>drag handles to connect</span>
      </div>

      {/* Canvas + config */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <div ref={wrapperRef} style={{ flex: 1, position: 'relative' }}
          onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} nodeTypes={nodeTypes}
            onInit={setRfInstance}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            onPaneContextMenu={onPaneContextMenu}
            onDoubleClick={onPaneDoubleClick}
            fitView proOptions={{ hideAttribution: true }}
            deleteKeyCode="Delete"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#181818" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                background: '#111', border: '1px dashed #2a2a2a',
                borderRadius: 12, padding: '32px 44px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: mono, fontSize: 13, color: '#444', marginBottom: 10 }}>
                  Canvas is empty
                </div>
                <div style={{ fontSize: 12, color: '#333', lineHeight: 1.7, fontFamily: sans }}>
                  Click <span style={{ color: '#e8ff47', fontFamily: mono }}>+ Add Node</span> in the toolbar<br />
                  or <span style={{ color: '#e8ff47', fontFamily: mono }}>right-click</span> anywhere on this canvas
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onChange={handleNodeDataChange}
            onDeleteNode={handleDeleteNode}
          />
        )}
      </div>

      <NodePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAddNode={handleAddNode}
        onDragStart={(e, type) => e.dataTransfer.setData('nodeType', type)}
        anchorPosition={pickerAnchor}
      />
    </div>
  )
}

// ── Workflows list page ────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const workflows      = useStore(s => s.workflows)
  const removeWorkflow = useStore(s => s.removeWorkflow)
  const qc             = useQueryClient()
  const navigate       = useNavigate()
  const [building, setBuilding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { mutate: del } = useMutation({
    mutationFn: workflowApi.delete,
    onSuccess: (_, id) => {
      removeWorkflow(id as string)
      qc.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Workflow deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  if (building) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #1e1e1e', background: '#0d0d0d', flexShrink: 0 }}>
          <button onClick={() => setBuilding(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontFamily: mono, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back
          </button>
          <span style={{ fontFamily: mono, fontSize: 12, color: '#e8ff47' }}>// WORKFLOW_BUILDER</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <BuildCanvas onSaved={() => setBuilding(false)} />
        </div>
      </div>
    )
  }

  const NODE_COLORS: Record<string, string> = {
    agent: '#47b3ff', chat_input: '#e8ff47', conditional: '#ff9f47',
    function: '#47ffb3', http_request: '#c47bff', output: '#ff4757',
  }

  return (
    <div className="fade-in">
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 4 }}>BUILD AGENT PIPELINES</div>
          <h1 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Workflows</h1>
        </div>
        <button onClick={() => setBuilding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#e8ff47', border: '1px solid #e8ff47', borderRadius: 5, fontFamily: mono, fontSize: 12, color: '#0a0a0a', cursor: 'pointer' }}>
          <Plus size={12} /> New Workflow
        </button>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {workflows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 13, color: '#555' }}>No workflows yet</div>
            <div style={{ fontSize: 12, color: '#444' }}>Click "New Workflow" to open the visual builder</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {workflows.map((wf, i) => {
              const uniqueTypes = [...new Set(wf.nodes.map(n => n.node_type))]
              return (
                <div key={wf.workflow_id} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, overflow: 'hidden', animation: `fadeIn 0.2s ease ${i * 0.05}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, background: 'rgba(232,255,71,0.08)', border: '1px solid rgba(232,255,71,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {wf.mode === 'sequential' ? <LayoutList size={15} color="#e8ff47" /> : <Columns size={15} color="#e8ff47" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>{wf.name}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: '#444', marginTop: 2 }}>
                        {wf.workflow_id.slice(0, 16)}… · {wf.nodes.length} node{wf.nodes.length !== 1 ? 's' : ''} · {wf.mode}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                      {uniqueTypes.map(t => (
                        <span key={t} style={{ fontFamily: mono, fontSize: 8, padding: '2px 6px', borderRadius: 3, background: `${NODE_COLORS[t] ?? '#888'}15`, color: NODE_COLORS[t] ?? '#888', border: `1px solid ${NODE_COLORS[t] ?? '#888'}30` }}>
                          {t.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => navigate(`/run?wf=${wf.workflow_id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(232,255,71,0.08)', border: '1px solid #e8ff47', borderRadius: 4, fontFamily: mono, fontSize: 10, color: '#e8ff47', cursor: 'pointer' }}>
                      <Play size={10} /> Run
                    </button>
                    <button onClick={() => setExpanded(expanded === wf.workflow_id ? null : wf.workflow_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <ChevronRight size={14} style={{ transform: expanded === wf.workflow_id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    <button onClick={() => del(wf.workflow_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4757', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {expanded === wf.workflow_id && wf.nodes.length > 0 && (
                    <div style={{ padding: '0 16px 16px' }} className="fade-in">
                      <WorkflowPreview workflow={wf} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}