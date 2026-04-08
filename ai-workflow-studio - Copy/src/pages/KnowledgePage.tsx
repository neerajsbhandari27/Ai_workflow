/**
 * KnowledgePage.tsx
 *
 * Two tabs:
 *   1. Ingest  — feed PDFs, URLs, text, DB records into ChromaDB
 *   2. Ask     — chat with the knowledge base (RAG Q&A)
 *
 * The Ask tab calls POST /agents/{rag_agent_id}/run using any RAG-enabled agent
 * the user has created, so questions are answered using the ingested documents.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Globe, FileText, Server, CheckCircle,
  MessageSquare, Send, Loader2, Database,
  BookOpen, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ingestApi, agentApi, type IngestResponse } from '../api/client'
import { useStore } from '../store'

const mono = "'Space Mono', monospace"
const sans = "'DM Sans', sans-serif"

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCss: React.CSSProperties = {
  background: '#181818', border: '1px solid #2a2a2a',
  borderRadius: 4, color: '#f0f0f0',
  fontFamily: sans, fontSize: 13,
  padding: '8px 12px', outline: 'none', width: '100%',
}

function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#e8ff47'
}
function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#2a2a2a'
}

function Label({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>
      {text.toUpperCase()}
    </div>
  )
}

function SuccessBanner({ result }: { result: IngestResponse }) {
  return (
    <div className="fade-in" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 12px', marginTop: 12,
      background: 'rgba(71,255,179,0.08)',
      border: '1px solid rgba(71,255,179,0.3)', borderRadius: 4,
    }}>
      <CheckCircle size={13} color="#47ffb3" />
      <span style={{ fontFamily: mono, fontSize: 11, color: '#47ffb3' }}>
        {result.chunks_stored} chunks stored — {result.message}
      </span>
    </div>
  )
}

function Btn({
  onClick, loading, disabled, children, variant = 'primary',
}: {
  onClick: () => void; loading?: boolean; disabled?: boolean
  children: React.ReactNode; variant?: 'primary' | 'ghost'
}) {
  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 4, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontFamily: mono, fontSize: 11, transition: 'all 0.12s',
        background: variant === 'primary' && !disabled ? '#e8ff47' : 'transparent',
        border: variant === 'primary' ? '1px solid #e8ff47' : '1px solid #2a2a2a',
        color: variant === 'primary' && !disabled ? '#0a0a0a' : '#555',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {loading && <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />}
      {children}
    </button>
  )
}

// =============================================================================
// Ingest tab
// =============================================================================

type IngestTab = 'text' | 'url' | 'pdf' | 'db'

const INGEST_TABS: { id: IngestTab; label: string; Icon: typeof Globe }[] = [
  { id: 'text', label: 'Text',       Icon: FileText },
  { id: 'url',  label: 'Web URL',    Icon: Globe    },
  { id: 'pdf',  label: 'PDF File',   Icon: FileText },
  { id: 'db',   label: 'DB Records', Icon: Server   },
]

function TextIngest() {
  const [text, setText]     = useState('')
  const [source, setSource] = useState('manual')
  const [result, setResult] = useState<IngestResponse | null>(null)
  const { mutate, isPending } = useMutation({
    mutationFn: () => ingestApi.text(text, source),
    onSuccess: r => { setResult(r); toast.success('Text ingested'); setText('') },
    onError:   () => toast.error('Failed to ingest text'),
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><Label text="Source Name" />
        <input style={inputCss} value={source} onChange={e => setSource(e.target.value)}
          placeholder="e.g. company-faq" onFocus={focusStyle} onBlur={blurStyle} />
      </div>
      <div><Label text="Text Content" />
        <textarea style={{ ...inputCss, minHeight: 160, resize: 'vertical', lineHeight: 1.6 }}
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste your text or markdown here…"
          onFocus={focusStyle as any} onBlur={blurStyle as any} />
      </div>
      <Btn onClick={() => mutate()} loading={isPending} disabled={!text.trim()}>
        <Upload size={11} /> Ingest Text
      </Btn>
      {result && <SuccessBanner result={result} />}
    </div>
  )
}

function UrlIngest() {
  const [url, setUrl]       = useState('')
  const [result, setResult] = useState<IngestResponse | null>(null)
  const { mutate, isPending } = useMutation({
    mutationFn: () => ingestApi.url(url),
    onSuccess: r => { setResult(r); toast.success('URL ingested'); setUrl('') },
    onError:   () => toast.error('Failed to ingest URL'),
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><Label text="Web URL" />
        <input style={inputCss} value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://docs.example.com/page"
          onFocus={focusStyle} onBlur={blurStyle} />
      </div>
      <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, fontFamily: sans }}>
        The page will be scraped, chunked, and stored in ChromaDB.
        Make sure the URL is publicly accessible from your server.
      </p>
      <Btn onClick={() => mutate()} loading={isPending} disabled={!url.trim()}>
        <Globe size={11} /> Scrape &amp; Ingest
      </Btn>
      {result && <SuccessBanner result={result} />}
    </div>
  )
}

function PdfIngest() {
  const [filePath, setFilePath] = useState('')
  const [result, setResult]     = useState<IngestResponse | null>(null)
  const { mutate, isPending } = useMutation({
    mutationFn: () => ingestApi.pdf(filePath),
    onSuccess: r => { setResult(r); toast.success('PDF ingested') },
    onError:   () => toast.error('Failed to ingest PDF'),
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '10px 12px', background: 'rgba(71,179,255,0.06)', border: '1px solid rgba(71,179,255,0.2)', borderRadius: 4, fontSize: 12, color: '#47b3ff', lineHeight: 1.6 }}>
        Provide the <strong>server-side absolute path</strong> to the PDF.
        The backend reads the file directly — it is not uploaded via the browser.
      </div>
      <div><Label text="Server File Path" />
        <input style={{ ...inputCss, fontFamily: mono, fontSize: 12 }}
          value={filePath} onChange={e => setFilePath(e.target.value)}
          placeholder="C:\data\report.pdf  or  /home/user/docs/file.pdf"
          onFocus={focusStyle} onBlur={blurStyle} />
      </div>
      <Btn onClick={() => mutate()} loading={isPending} disabled={!filePath.trim()}>
        <FileText size={11} /> Ingest PDF
      </Btn>
      {result && <SuccessBanner result={result} />}
    </div>
  )
}

function DbIngest() {
  const [rawJson, setRawJson]             = useState('[\n  { "content": "Your record text here", "id": 1 }\n]')
  const [contentField, setContentField]   = useState('content')
  const [metaFields, setMetaFields]       = useState('id')
  const [jsonError, setJsonError]         = useState('')
  const [result, setResult]               = useState<IngestResponse | null>(null)
  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const records = JSON.parse(rawJson)
      const metadata_fields = metaFields.split(',').map(s => s.trim()).filter(Boolean)
      return ingestApi.db(records, contentField, metadata_fields)
    },
    onSuccess: r => { setResult(r); toast.success('DB records ingested') },
    onError:   () => toast.error('Failed to ingest records'),
  })
  const handleRun = () => {
    try {
      const p = JSON.parse(rawJson)
      if (!Array.isArray(p)) { setJsonError('Must be a JSON array [ … ]'); return }
      setJsonError(''); mutate()
    } catch { setJsonError('Invalid JSON — check syntax') }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><Label text="Content Field" />
          <input style={inputCss} value={contentField} onChange={e => setContentField(e.target.value)}
            placeholder="content" onFocus={focusStyle} onBlur={blurStyle} />
        </div>
        <div><Label text="Metadata Fields (comma-separated)" />
          <input style={inputCss} value={metaFields} onChange={e => setMetaFields(e.target.value)}
            placeholder="id, title" onFocus={focusStyle} onBlur={blurStyle} />
        </div>
      </div>
      <div><Label text="Records — JSON Array" />
        <textarea style={{ ...inputCss, minHeight: 140, resize: 'vertical', fontFamily: mono, fontSize: 11, lineHeight: 1.5 }}
          value={rawJson} onChange={e => { setRawJson(e.target.value); setJsonError('') }}
          onFocus={focusStyle as any} onBlur={blurStyle as any} />
        {jsonError && <div style={{ fontFamily: mono, fontSize: 10, color: '#ff4757', marginTop: 4 }}>{jsonError}</div>}
      </div>
      <Btn onClick={handleRun} loading={isPending}>
        <Server size={11} /> Ingest Records
      </Btn>
      {result && <SuccessBanner result={result} />}
    </div>
  )
}

// =============================================================================
// Ask (RAG Q&A) tab
// =============================================================================

interface Message {
  role:    'user' | 'assistant'
  content: string
  error?:  boolean
}

function AskTab() {
  const agents = useStore(s => s.agents)
  const ragAgents = agents.filter(a => a.rag_enabled)

  const [selectedAgentId, setSelectedAgentId] = useState(() => ragAgents[0]?.agent_id ?? '')
  const [question, setQuestion]               = useState('')
  const [messages, setMessages]               = useState<Message[]>([])
  const [sessionId]                           = useState(() => `rag-qa-${Date.now()}`)

  const { mutate, isPending } = useMutation({
    mutationFn: () => agentApi.run(selectedAgentId, question, sessionId),
    onSuccess: data => {
      setMessages(prev => [
        ...prev,
        { role: 'user',      content: question },
        { role: 'assistant', content: data.response || '', error: !!data.error },
      ])
      setQuestion('')
    },
    onError: () => {
      setMessages(prev => [
        ...prev,
        { role: 'user',      content: question },
        { role: 'assistant', content: 'Request failed. Check the backend logs.', error: true },
      ])
      setQuestion('')
    },
  })

  const handleSend = () => {
    if (!question.trim() || !selectedAgentId || isPending) return
    mutate()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (ragAgents.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 20px', gap: 12, textAlign: 'center',
      }}>
        <Database size={40} color="#333" />
        <div style={{ fontFamily: mono, fontSize: 13, color: '#555' }}>
          No RAG-enabled agents
        </div>
        <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6, maxWidth: 320 }}>
          Go to the <span style={{ color: '#e8ff47' }}>Agents</span> page and create an agent
          with <span style={{ color: '#47b3ff' }}>RAG enabled</span> — then come back here to
          ask questions from your knowledge base.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>

      {/* Agent selector */}
      <div style={{
        padding: '12px 0', marginBottom: 12,
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Database size={13} color="#47b3ff" />
        <span style={{ fontFamily: mono, fontSize: 10, color: '#555' }}>AGENT</span>
        <select
          style={{ ...inputCss, width: 'auto', minWidth: 200, cursor: 'pointer', fontFamily: mono, fontSize: 11 }}
          value={selectedAgentId}
          onChange={e => { setSelectedAgentId(e.target.value); setMessages([]) }}
        >
          {ragAgents.map(a => (
            <option key={a.agent_id} value={a.agent_id} style={{ background: '#181818' }}>
              {a.name}
            </option>
          ))}
        </select>
        <span style={{ fontFamily: mono, fontSize: 9, color: '#333' }}>
          answers using ingested knowledge base
        </span>
      </div>

      {/* Message thread */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: 12, paddingBottom: 8,
        minHeight: 200,
      }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 0', gap: 8,
          }}>
            <BookOpen size={32} color="#2a2a2a" />
            <div style={{ fontFamily: mono, fontSize: 11, color: '#444' }}>
              Ask anything about your ingested documents
            </div>
            <div style={{ fontSize: 11, color: '#333', fontFamily: sans }}>
              Shift+Enter for new line · Enter to send
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className="fade-in"
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
              background: msg.role === 'user'
                ? 'rgba(232,255,71,0.1)'
                : msg.error ? 'rgba(255,71,87,0.08)' : '#181818',
              border: msg.role === 'user'
                ? '1px solid rgba(232,255,71,0.3)'
                : msg.error ? '1px solid rgba(255,71,87,0.3)' : '1px solid #2a2a2a',
              fontSize: 13,
              color: msg.error ? '#ff4757' : '#ccc',
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
              fontFamily: sans,
            }}>
              {msg.role === 'assistant' && (
                <div style={{ fontFamily: mono, fontSize: 8, color: '#555', marginBottom: 6 }}>
                  ASSISTANT
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
            <Loader2 size={12} color="#e8ff47" style={{ animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: '#555' }}>
              Searching knowledge base…
            </span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        marginTop: 12,
        display: 'flex', gap: 8, alignItems: 'flex-end',
        borderTop: '1px solid #1a1a1a', paddingTop: 12,
      }}>
        <textarea
          style={{
            ...inputCss, flex: 1, resize: 'none',
            minHeight: 44, maxHeight: 120,
            lineHeight: 1.6, paddingTop: 10,
          }}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a question from your knowledge base…"
          onFocus={focusStyle as any}
          onBlur={blurStyle as any}
        />
        <button
          disabled={!question.trim() || isPending || !selectedAgentId}
          onClick={handleSend}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, flexShrink: 0,
            background: question.trim() && !isPending ? '#e8ff47' : '#181818',
            border: `1px solid ${question.trim() && !isPending ? '#e8ff47' : '#2a2a2a'}`,
            borderRadius: 4, cursor: question.trim() && !isPending ? 'pointer' : 'not-allowed',
            transition: 'all 0.12s',
          }}
        >
          {isPending
            ? <Loader2 size={14} color="#e8ff47" style={{ animation: 'spin 0.8s linear infinite' }} />
            : <Send size={14} color={question.trim() ? '#0a0a0a' : '#444'} />}
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Knowledge Page (main)
// =============================================================================

type MainTab = 'ingest' | 'ask'

export default function KnowledgePage() {
  const [mainTab,   setMainTab]   = useState<MainTab>('ingest')
  const [ingestTab, setIngestTab] = useState<IngestTab>('text')

  const agents    = useStore(s => s.agents)
  const ragAgents = agents.filter(a => a.rag_enabled)

  return (
    <div className="fade-in">
      {/* Page header */}
      <div style={{
        padding: '28px 32px 0', borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 4 }}>
          KNOWLEDGE BASE
        </div>
        <h1 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em', marginBottom: 16 }}>
          Knowledge
        </h1>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {([
            { id: 'ingest', label: 'Ingest Documents', Icon: Upload   },
            { id: 'ask',    label: `Ask Questions${ragAgents.length ? ` (${ragAgents.length} RAG agent${ragAgents.length !== 1 ? 's' : ''})` : ''}`, Icon: MessageSquare },
          ] as { id: MainTab; label: string; Icon: typeof Upload }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMainTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', background: 'none', border: 'none',
                cursor: 'pointer',
                borderBottom: mainTab === id ? '2px solid #e8ff47' : '2px solid transparent',
                marginBottom: -1,
                fontFamily: mono, fontSize: 11,
                color: mainTab === id ? '#e8ff47' : '#555',
                transition: 'color 0.14s',
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>

        {/* ── INGEST TAB ─────────────────────────────────────────────────── */}
        {mainTab === 'ingest' && (
          <div style={{ maxWidth: 660 }}>
            {/* Info */}
            <div style={{
              padding: '10px 14px', marginBottom: 20,
              background: 'rgba(232,255,71,0.04)',
              border: '1px solid rgba(232,255,71,0.15)',
              borderRadius: 6, fontSize: 12, color: '#888', lineHeight: 1.6,
            }}>
              Documents ingested here are stored in{' '}
              <span style={{ fontFamily: mono, color: '#e8ff47', fontSize: 11 }}>ChromaDB</span>.
              Any agent with <span style={{ fontFamily: mono, color: '#47b3ff', fontSize: 11 }}>RAG enabled</span>{' '}
              can search them. Switch to the <span style={{ color: '#e8ff47' }}>Ask Questions</span> tab to
              chat with the knowledge base directly.
            </div>

            {/* Ingest type tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1a1a1a', marginBottom: 20 }}>
              {INGEST_TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setIngestTab(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: ingestTab === id ? '2px solid #e8ff47' : '2px solid transparent',
                    marginBottom: -1,
                    fontFamily: mono, fontSize: 10,
                    color: ingestTab === id ? '#e8ff47' : '#555',
                  }}>
                  <Icon size={11} />{label}
                </button>
              ))}
            </div>

            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: 8, padding: 20,
            }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: '#333', marginBottom: 16, letterSpacing: '0.1em' }}>
                // INGEST_{ingestTab.toUpperCase()}
              </div>
              {ingestTab === 'text' && <TextIngest />}
              {ingestTab === 'url'  && <UrlIngest  />}
              {ingestTab === 'pdf'  && <PdfIngest  />}
              {ingestTab === 'db'   && <DbIngest   />}
            </div>
          </div>
        )}

        {/* ── ASK TAB ────────────────────────────────────────────────────── */}
        {mainTab === 'ask' && (
          <div style={{ maxWidth: 720 }}>
            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: 8, padding: 20,
            }}>
              <AskTab />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}