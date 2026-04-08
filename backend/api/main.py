"""
api/main.py

AI Workflow Studio — Azure OpenAI edition (via LiteLLM).
Google ADK fully removed.

Agent endpoints:
  POST   /agents               → create agent
  GET    /agents               → list agents
  GET    /agents/{id}          → get one agent
  DELETE /agents/{id}          → delete agent
  POST   /agents/{id}/run      → standalone agent run

Workflow endpoints:
  POST   /workflows                    → create workflow
  GET    /workflows                    → list workflows
  GET    /workflows/{id}               → get workflow
  DELETE /workflows/{id}               → delete workflow
  POST   /workflows/{id}/run           → execute workflow
  POST   /workflows/{id}/reset-session → clear stored history

Ingest endpoints:
  POST /ingest/pdf | /ingest/url | /ingest/text | /ingest/db

GET /health
"""

from __future__ import annotations

import os
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Path & env setup ──────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent   # backend/
sys.path.insert(0, str(BASE_DIR / "agents"))
sys.path.insert(0, str(BASE_DIR))

load_dotenv(dotenv_path=BASE_DIR / ".env")

# Validate required Azure env vars on startup
_REQUIRED = ["AZURE_API_KEY", "AZURE_API_BASE", "LITELLM_MODEL_NAME"]
_missing  = [k for k in _REQUIRED if not os.getenv(k)]
if _missing:
    raise EnvironmentError(
        f"Missing required .env variables: {_missing}\n"
        "Make sure AZURE_API_KEY, AZURE_API_BASE, and LITELLM_MODEL_NAME are set."
    )

from agents.factory   import AgentConfig, AgentFactory
from agents.registry  import AgentRegistry
from workflows.engine import NodeConfig, WorkflowConfig, WorkflowEngine
from workflows.registry import WorkflowRegistry
from rag.pipeline     import RAGPipeline

# ── Singletons ────────────────────────────────────────────────────────────────
rag_pipeline:      RAGPipeline | None      = None
agent_registry:    AgentRegistry | None    = None
workflow_registry: WorkflowRegistry | None = None
workflow_engine:   WorkflowEngine | None   = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_pipeline, agent_registry, workflow_registry, workflow_engine
    rag_pipeline      = RAGPipeline()
    factory           = AgentFactory(rag_pipeline=rag_pipeline)
    agent_registry    = AgentRegistry(factory=factory)
    workflow_registry = WorkflowRegistry()
    workflow_engine   = WorkflowEngine(registry=agent_registry)
    model = os.getenv("LITELLM_MODEL_NAME")
    print(f"✓ Workflow system ready — model: {model}")
    yield
    print("✗ Shutting down")


app = FastAPI(
    title="AI Workflow Studio API",
    description="Azure OpenAI-powered multi-agent workflow system via LiteLLM.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Pydantic schemas
# =============================================================================

# ── Agent ─────────────────────────────────────────────────────────────────────

class CreateAgentRequest(BaseModel):
    name:        str  = Field(..., example="Summariser")
    description: str  = Field(..., example="Summarises long documents.")
    instruction: str  = Field(..., example="You are an expert summariser.")
    rag_enabled: bool = False

class AgentOut(BaseModel):
    agent_id: str; name: str; description: str; instruction: str; rag_enabled: bool

class AgentRunRequest(BaseModel):
    message:    str = Field(..., example="Tell me about climate change")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class AgentRunResponse(BaseModel):
    agent_id: str; agent_name: str; message: str
    response: str; session_id: str; error: str | None = None

# ── Nodes ─────────────────────────────────────────────────────────────────────

class NodeIn(BaseModel):
    node_id:   str
    node_type: str
    label:     str
    agent_id:           str | None = None
    condition_operator: str        = "contains"
    condition_value:    str        = ""
    true_next:  str | None         = None
    false_next: str | None         = None
    python_code:        str        = ""
    http_url:           str        = ""
    http_method:        str        = "GET"
    http_headers:       dict       = {}
    http_body_template: str        = ""

# ── Workflow ──────────────────────────────────────────────────────────────────

class CreateWorkflowRequest(BaseModel):
    name:      str          = Field(..., example="My Pipeline")
    nodes:     list[NodeIn] = Field(default_factory=list)
    agent_ids: list[str]    = Field(default_factory=list)   # legacy
    mode:      Literal["sequential", "parallel"] = "sequential"

class WorkflowOut(BaseModel):
    workflow_id: str; name: str; nodes: list[dict]; agent_ids: list[str]; mode: str

class RunWorkflowRequest(BaseModel):
    message:       str  = Field(..., example="Explain quantum computing")
    reset_session: bool = False

class StepOut(BaseModel):
    node_id: str; node_type: str; label: str
    input: str; output: str
    error: str | None = None; branch: str | None = None

class RunWorkflowResponse(BaseModel):
    workflow_id: str; workflow_name: str; mode: str
    steps: list[StepOut]; final_output: str

# ── Ingest ────────────────────────────────────────────────────────────────────

class IngestTextRequest(BaseModel):
    text: str; source: str = "manual"

class IngestUrlRequest(BaseModel):
    url: str

class IngestDbRequest(BaseModel):
    records: list[dict[str, Any]]; content_field: str = "content"; metadata_fields: list[str] = []

class IngestResponse(BaseModel):
    chunks_stored: int; message: str

# =============================================================================
# Helpers
# =============================================================================

def _agent_out(b) -> AgentOut:
    return AgentOut(
        agent_id=b.config.agent_id, name=b.config.name,
        description=b.config.description, instruction=b.config.instruction,
        rag_enabled=b.config.rag_enabled,
    )

def _node_in_to_config(n: NodeIn) -> NodeConfig:
    return NodeConfig(
        node_id=n.node_id, node_type=n.node_type, label=n.label,
        agent_id=n.agent_id,
        condition_operator=n.condition_operator, condition_value=n.condition_value,
        true_next=n.true_next, false_next=n.false_next,
        python_code=n.python_code,
        http_url=n.http_url, http_method=n.http_method,
        http_headers=n.http_headers, http_body_template=n.http_body_template,
    )

def _wf_out(wf: WorkflowConfig) -> WorkflowOut:
    return WorkflowOut(
        workflow_id=wf.workflow_id, name=wf.name, mode=wf.mode,
        agent_ids=wf.agent_ids,
        nodes=[{
            "node_id": n.node_id, "node_type": n.node_type, "label": n.label,
            "agent_id": n.agent_id,
            "condition_operator": n.condition_operator, "condition_value": n.condition_value,
            "true_next": n.true_next, "false_next": n.false_next,
            "python_code": n.python_code,
            "http_url": n.http_url, "http_method": n.http_method,
            "http_headers": n.http_headers, "http_body_template": n.http_body_template,
        } for n in wf.nodes],
    )

# =============================================================================
# Agent endpoints
# =============================================================================

@app.post("/agents", response_model=AgentOut, status_code=201)
async def create_agent(req: CreateAgentRequest):
    config = AgentConfig(
        name=req.name, description=req.description,
        instruction=req.instruction, rag_enabled=req.rag_enabled,
    )
    return _agent_out(agent_registry.create(config))

@app.get("/agents", response_model=list[AgentOut])
async def list_agents():
    return [_agent_out(b) for b in agent_registry.list()]

@app.get("/agents/{agent_id}", response_model=AgentOut)
async def get_agent(agent_id: str):
    b = agent_registry.get(agent_id)
    if not b: raise HTTPException(404, f"Agent '{agent_id}' not found.")
    return _agent_out(b)

@app.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str):
    if not agent_registry.delete(agent_id):
        raise HTTPException(404, f"Agent '{agent_id}' not found.")

@app.post("/agents/{agent_id}/run", response_model=AgentRunResponse)
async def run_agent_standalone(agent_id: str, req: AgentRunRequest):
    """Run a single agent independently with its own conversation session."""
    b = agent_registry.get(agent_id)
    if not b: raise HTTPException(404, f"Agent '{agent_id}' not found.")
    if not req.message.strip(): raise HTTPException(400, "message must not be empty.")

    output, error = await workflow_engine.run_agent_standalone(
        agent_id=agent_id, message=req.message, session_id=req.session_id,
    )
    return AgentRunResponse(
        agent_id=agent_id, agent_name=b.config.name,
        message=req.message, response=output,
        session_id=req.session_id, error=error,
    )

# =============================================================================
# Workflow endpoints
# =============================================================================

@app.post("/workflows", response_model=WorkflowOut, status_code=201)
async def create_workflow(req: CreateWorkflowRequest):
    for n in req.nodes:
        if n.node_type == "agent" and n.agent_id:
            if not agent_registry.exists(n.agent_id):
                raise HTTPException(400, f"Agent '{n.agent_id}' not found.")

    missing = [aid for aid in req.agent_ids if not agent_registry.exists(aid)]
    if missing:
        raise HTTPException(400, f"Unknown agent IDs: {missing}")

    config = WorkflowConfig(
        name=req.name,
        nodes=[_node_in_to_config(n) for n in req.nodes],
        agent_ids=req.agent_ids,
        mode=req.mode,
    )
    return _wf_out(workflow_registry.create(config))

@app.get("/workflows", response_model=list[WorkflowOut])
async def list_workflows():
    return [_wf_out(w) for w in workflow_registry.list()]

@app.get("/workflows/{workflow_id}", response_model=WorkflowOut)
async def get_workflow(workflow_id: str):
    wf = workflow_registry.get(workflow_id)
    if not wf: raise HTTPException(404, f"Workflow '{workflow_id}' not found.")
    return _wf_out(wf)

@app.delete("/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str):
    if not workflow_registry.delete(workflow_id):
        raise HTTPException(404, f"Workflow '{workflow_id}' not found.")

@app.post("/workflows/{workflow_id}/run", response_model=RunWorkflowResponse)
async def run_workflow(workflow_id: str, req: RunWorkflowRequest):
    wf = workflow_registry.get(workflow_id)
    if not wf: raise HTTPException(404, f"Workflow '{workflow_id}' not found.")
    if not req.message.strip(): raise HTTPException(400, "message must not be empty.")

    try:
        result = await workflow_engine.run(
            workflow=wf, user_input=req.message, reset_session=req.reset_session,
        )
    except Exception as e:
        raise HTTPException(500, str(e))

    return RunWorkflowResponse(
        workflow_id=result.workflow_id, workflow_name=result.workflow_name,
        mode=result.mode, final_output=result.final_output,
        steps=[StepOut(
            node_id=s.node_id, node_type=s.node_type, label=s.label,
            input=s.input, output=s.output, error=s.error, branch=s.branch,
        ) for s in result.steps],
    )

@app.post("/workflows/{workflow_id}/reset-session", status_code=200)
async def reset_workflow_session(workflow_id: str):
    wf = workflow_registry.get(workflow_id)
    if not wf: raise HTTPException(404, f"Workflow '{workflow_id}' not found.")
    workflow_engine._session_store.clear_workflow(workflow_id)
    return {"message": f"Session history cleared for workflow '{workflow_id}'"}

# =============================================================================
# Ingest endpoints
# =============================================================================

@app.post("/ingest/pdf", response_model=IngestResponse)
async def ingest_pdf(file_path: str):
    try:
        n = rag_pipeline.ingest_pdf(file_path)
        return IngestResponse(chunks_stored=n, message=f"PDF ingested: {file_path}")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/ingest/url", response_model=IngestResponse)
async def ingest_url(req: IngestUrlRequest):
    try:
        n = rag_pipeline.ingest_url(req.url)
        return IngestResponse(chunks_stored=n, message=f"URL ingested: {req.url}")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/ingest/text", response_model=IngestResponse)
async def ingest_text(req: IngestTextRequest):
    try:
        n = rag_pipeline.ingest_text(req.text, source=req.source)
        return IngestResponse(chunks_stored=n, message=f"Text ingested from: {req.source}")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/ingest/db", response_model=IngestResponse)
async def ingest_db(req: IngestDbRequest):
    try:
        n = rag_pipeline.ingest_db_records(
            records=req.records,
            content_field=req.content_field,
            metadata_fields=req.metadata_fields,
        )
        return IngestResponse(chunks_stored=n, message=f"Ingested {len(req.records)} DB records.")
    except Exception as e:
        raise HTTPException(500, str(e))

# =============================================================================
# Health
# =============================================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model":  os.getenv("LITELLM_MODEL_NAME", "unknown"),
        "agents": len(agent_registry.list()),
        "workflows": len(workflow_registry.list()),
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)