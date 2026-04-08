import { create } from 'zustand'
import type { Agent, Workflow, RunWorkflowResponse, AgentRunResponse } from '../api/client'

interface AppStore {
  agents:           Agent[]
  setAgents:        (a: Agent[]) => void
  addAgent:         (a: Agent)   => void
  removeAgent:      (id: string) => void

  workflows:        Workflow[]
  setWorkflows:     (w: Workflow[]) => void
  addWorkflow:      (w: Workflow)   => void
  removeWorkflow:   (id: string)    => void

  // output drawer
  runResult:        RunWorkflowResponse | null
  setRunResult:     (r: RunWorkflowResponse | null) => void
  drawerOpen:       boolean
  setDrawerOpen:    (v: boolean) => void

  // standalone agent result
  agentRunResult:   AgentRunResponse | null
  setAgentRunResult:(r: AgentRunResponse | null) => void
}

export const useStore = create<AppStore>((set) => ({
  agents:        [],
  setAgents:     (agents)    => set({ agents }),
  addAgent:      (agent)     => set(s => ({ agents: [...s.agents, agent] })),
  removeAgent:   (id)        => set(s => ({ agents: s.agents.filter(a => a.agent_id !== id) })),

  workflows:     [],
  setWorkflows:  (workflows) => set({ workflows }),
  addWorkflow:   (w)         => set(s => ({ workflows: [...s.workflows, w] })),
  removeWorkflow:(id)        => set(s => ({ workflows: s.workflows.filter(w => w.workflow_id !== id) })),

  runResult:       null,
  setRunResult:    (r) => set({ runResult: r }),
  drawerOpen:      false,
  setDrawerOpen:   (v) => set({ drawerOpen: v }),

  agentRunResult:    null,
  setAgentRunResult: (r) => set({ agentRunResult: r }),
}))