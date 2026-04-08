import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Cpu, Database } from 'lucide-react'
import { Badge } from '../shared/ui'

export interface AgentNodeData {
  label:       string
  description: string
  rag_enabled: boolean
  agent_id:    string
  index:       number
}

const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => (
  <div style={{
    background: 'var(--bg-1)',
    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-2)'}`,
    borderRadius: 8, padding: '12px 14px',
    minWidth: 175, maxWidth: 215,
    boxShadow: selected ? '0 0 0 1px var(--accent)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'var(--sans)',
  }}>
    <Handle type="target" position={Position.Left}  />

    {/* Step circle + icon + name */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'var(--accent)', color: '#0a0a0a',
        fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {data.index + 1}
      </div>
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        background: 'var(--accent-dim)', border: '1px solid var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Cpu size={12} color="var(--accent)" />
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
        color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {data.label}
      </span>
    </div>

    {/* Description */}
    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.4 }}>
      {data.description.slice(0, 65)}{data.description.length > 65 ? '…' : ''}
    </p>

    {/* Badges */}
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {data.rag_enabled && (
        <Badge color="blue">
          <Database size={9} />RAG
        </Badge>
      )}
      <Badge color="default">agent</Badge>
    </div>

    <Handle type="source" position={Position.Right} />
  </div>
))

AgentNode.displayName = 'AgentNode'
export default AgentNode