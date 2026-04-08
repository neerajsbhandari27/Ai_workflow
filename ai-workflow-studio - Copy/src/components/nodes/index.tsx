import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Cpu, MessageSquare, GitBranch, Code2, Globe, Flag, Database } from 'lucide-react'

// ── Shared shell ──────────────────────────────────────────────────────────────

function NodeShell({
  selected, accent, icon: Icon, iconBg,
  title, subtitle, badge, children,
  showTarget = true, showSource = true,
}: {
  selected: boolean
  accent: string
  icon: React.ElementType
  iconBg: string
  title: string
  subtitle?: string
  badge?: string
  children?: React.ReactNode
  showTarget?: boolean
  showSource?: boolean
}) {
  return (
    <div style={{
      background: '#111',
      borderRadius: 8,
      minWidth: 185,
      maxWidth: 230,
      border: `1px solid ${selected ? accent : '#2a2a2a'}`,
      boxShadow: selected ? `0 0 0 1px ${accent}` : 'none',
      fontFamily: "'DM Sans', sans-serif",
      overflow: 'hidden',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      {showTarget && <Handle type="target" position={Position.Left} />}

      {/* Coloured header stripe */}
      <div style={{
        background: iconBg,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}>
        <Icon size={13} color={accent} />
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          fontWeight: 700,
          color: accent,
          flex: 1,
        }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 9,
            color: accent,
            opacity: 0.75,
            background: 'rgba(0,0,0,0.35)',
            padding: '1px 5px',
            borderRadius: 2,
          }}>
            {badge}
          </span>
        )}
      </div>

      {/* Body */}
      {(subtitle || children) && (
        <div style={{ padding: '8px 10px' }}>
          {subtitle && (
            <p style={{ fontSize: 11, color: '#777', lineHeight: 1.45, margin: 0 }}>
              {subtitle.slice(0, 72)}{subtitle.length > 72 ? '…' : ''}
            </p>
          )}
          {children}
        </div>
      )}

      {showSource && <Handle type="source" position={Position.Right} />}
    </div>
  )
}

// ── Chat Input ────────────────────────────────────────────────────────────────

export const ChatInputNode = memo(({ data, selected }: NodeProps) => (
  <NodeShell
    selected={selected}
    accent="#e8ff47"
    iconBg="rgba(232,255,71,0.08)"
    icon={MessageSquare}
    title={data.label || 'Chat Input'}
    subtitle="Entry point — injects user message"
    showTarget={false}
  />
))
ChatInputNode.displayName = 'ChatInputNode'

// ── Agent ─────────────────────────────────────────────────────────────────────

export const AgentNode = memo(({ data, selected }: NodeProps) => (
  <NodeShell
    selected={selected}
    accent="#47b3ff"
    iconBg="rgba(71,179,255,0.08)"
    icon={Cpu}
    title={data.label || 'Agent'}
    badge="azure"
    subtitle={data.description}
  >
    {data.rag_enabled && (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        color: '#47b3ff',
      }}>
        <Database size={9} />
        <span>RAG enabled</span>
      </div>
    )}
    {!data.agent_id && (
      <div style={{
        marginTop: 6,
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        color: '#ff9f47',
      }}>
        ⚠ No agent selected
      </div>
    )}
  </NodeShell>
))
AgentNode.displayName = 'AgentNode'

// ── Conditional ───────────────────────────────────────────────────────────────

export const ConditionalNode = memo(({ data, selected }: NodeProps) => (
  <NodeShell
    selected={selected}
    accent="#ff9f47"
    iconBg="rgba(255,159,71,0.08)"
    icon={GitBranch}
    title={data.label || 'Conditional'}
  >
    <div style={{
      fontFamily: "'Space Mono', monospace",
      fontSize: 10,
      marginTop: 6,
    }}>
      <span style={{ color: '#666' }}>if output </span>
      <span style={{ color: '#ff9f47' }}>{data.condition_operator || 'contains'}</span>
      <div style={{
        background: '#181818',
        borderRadius: 3,
        padding: '3px 7px',
        marginTop: 4,
        color: '#f0f0f0',
        fontSize: 10,
        wordBreak: 'break-all',
      }}>
        "{data.condition_value || '...'}"
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#47ffb3' }}>TRUE →</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#ff4757' }}>← FALSE</span>
    </div>
  </NodeShell>
))
ConditionalNode.displayName = 'ConditionalNode'

// ── Function ──────────────────────────────────────────────────────────────────

export const FunctionNode = memo(({ data, selected }: NodeProps) => (
  <NodeShell
    selected={selected}
    accent="#47ffb3"
    iconBg="rgba(71,255,179,0.08)"
    icon={Code2}
    title={data.label || 'Function'}
    badge="python"
  >
    <div style={{
      background: '#181818',
      borderRadius: 3,
      padding: '5px 7px',
      marginTop: 6,
      fontFamily: "'Space Mono', monospace",
      fontSize: 10,
      color: '#47ffb3',
      maxHeight: 52,
      overflow: 'hidden',
      lineHeight: 1.4,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {(data.python_code || '# write code here…').slice(0, 80)}
    </div>
  </NodeShell>
))
FunctionNode.displayName = 'FunctionNode'

// ── HTTP Request ──────────────────────────────────────────────────────────────

export const HttpRequestNode = memo(({ data, selected }: NodeProps) => (
  <NodeShell
    selected={selected}
    accent="#c47bff"
    iconBg="rgba(196,123,255,0.08)"
    icon={Globe}
    title={data.label || 'HTTP Request'}
    badge={data.http_method || 'GET'}
  >
    <div style={{
      fontFamily: "'Space Mono', monospace",
      fontSize: 10,
      color: '#777',
      marginTop: 4,
      wordBreak: 'break-all',
    }}>
      {(data.http_url || 'https://…').slice(0, 45)}
    </div>
  </NodeShell>
))
HttpRequestNode.displayName = 'HttpRequestNode'

// ── Output ────────────────────────────────────────────────────────────────────

export const OutputNode = memo(({ data, selected }: NodeProps) => (
  <NodeShell
    selected={selected}
    accent="#ff4757"
    iconBg="rgba(255,71,87,0.08)"
    icon={Flag}
    title={data.label || 'Output'}
    subtitle="Terminal — collects final result"
    showSource={false}
  />
))
OutputNode.displayName = 'OutputNode'

// ── nodeTypes map for ReactFlow ───────────────────────────────────────────────

export const nodeTypes = {
  agent:        AgentNode,
  chat_input:   ChatInputNode,
  conditional:  ConditionalNode,
  function:     FunctionNode,
  http_request: HttpRequestNode,
  output:       OutputNode,
}