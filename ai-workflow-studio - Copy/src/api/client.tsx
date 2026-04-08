import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Agent {
  agent_id: string; name: string; description: string
  instruction: string; rag_enabled: boolean
}

export type NodeType = 'agent' | 'chat_input' | 'conditional' | 'function' | 'http_request' | 'output'

export interface WorkflowNode {
  node_id:   string
  node_type: NodeType
  label:     string
  // agent
  agent_id?: string
  // conditional
  condition_operator?: string
  condition_value?:    string
  true_next?:  string | null
  false_next?: string | null
  // function
  python_code?: string
  // http
  http_url?:           string
  http_method?:        string
  http_headers?:       Record<string, string>
  http_body_template?: string
}

export interface Workflow {
  workflow_id: string; name: string
  nodes:       WorkflowNode[]
  agent_ids:   string[]
  mode:        'sequential' | 'parallel'
}

export interface StepResult {
  node_id: string; node_type: string; label: string
  input: string; output: string
  error: string | null; branch: string | null
}

export interface RunWorkflowResponse {
  workflow_id: string; workflow_name: string; mode: string
  steps: StepResult[]; final_output: string
}

export interface AgentRunResponse {
  agent_id: string; agent_name: string
  message: string; response: string
  session_id: string; error: string | null
}

export interface IngestResponse { chunks_stored: number; message: string }
export interface HealthResponse { status: string; agents: number; workflows: number }

// ── Agent API ─────────────────────────────────────────────────────────────────

export const agentApi = {
  list:   ()   => http.get<Agent[]>('/agents').then(r => r.data),
  create: (p: Omit<Agent,'agent_id'>) => http.post<Agent>('/agents', p).then(r => r.data),
  delete: (id: string) => http.delete(`/agents/${id}`),
  run: (agent_id: string, message: string, session_id: string) =>
    http.post<AgentRunResponse>(`/agents/${agent_id}/run`, { message, session_id }).then(r => r.data),
}

// ── Workflow API ──────────────────────────────────────────────────────────────

export const workflowApi = {
  list:   ()   => http.get<Workflow[]>('/workflows').then(r => r.data),
  create: (p: { name: string; nodes: WorkflowNode[]; mode: string; agent_ids?: string[] }) =>
    http.post<Workflow>('/workflows', p).then(r => r.data),
  delete: (id: string)  => http.delete(`/workflows/${id}`),
  run:    (id: string, message: string, reset_session = false) =>
    http.post<RunWorkflowResponse>(`/workflows/${id}/run`, { message, reset_session }).then(r => r.data),
  resetSession: (id: string) =>
    http.post(`/workflows/${id}/reset-session`).then(r => r.data),
}

// ── Ingest API ────────────────────────────────────────────────────────────────

export const ingestApi = {
  text: (text: string, source: string) =>
    http.post<IngestResponse>('/ingest/text', { text, source }).then(r => r.data),
  url:  (url: string) =>
    http.post<IngestResponse>('/ingest/url', { url }).then(r => r.data),
  pdf:  (file_path: string) =>
    http.post<IngestResponse>(`/ingest/pdf?file_path=${encodeURIComponent(file_path)}`).then(r => r.data),
  db:   (records: Record<string, unknown>[], content_field: string, metadata_fields: string[]) =>
    http.post<IngestResponse>('/ingest/db', { records, content_field, metadata_fields }).then(r => r.data),
}

export const healthApi = {
  check: () => http.get<HealthResponse>('/health').then(r => r.data),
}