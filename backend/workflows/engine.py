"""
workflows/engine.py

WorkflowEngine — runs mixed-node workflows using LiteLLM agents.
Google ADK fully removed. Each agent is now a BuiltAgent with a .run() method.

Node types:
  agent        -> calls BuiltAgent.run(message, history)
  chat_input   -> passes user message through unchanged
  conditional  -> branches on output content
  function     -> executes sandboxed Python
  http_request -> calls external HTTP endpoint
  output       -> terminal collector node

Session fix: one conversation history list per (workflow_id, agent_id).
No external session service needed — history is stored in a plain dict.
"""

from __future__ import annotations

import asyncio
import re
import uuid
import httpx
import json
from dataclasses import dataclass, field
from typing import Any, Literal

from agents.registry import AgentRegistry


# ── Node definition ───────────────────────────────────────────────────────────

NodeType = Literal["agent", "chat_input", "conditional", "function", "http_request", "output"]

@dataclass
class NodeConfig:
    node_id:   str
    node_type: NodeType
    label:     str

    # agent node
    agent_id: str | None = None

    # conditional node
    condition_operator: str      = "contains"
    condition_value:    str      = ""
    true_next:  str | None       = None
    false_next: str | None       = None

    # function node
    python_code: str = ""

    # http_request node
    http_url:           str  = ""
    http_method:        str  = "GET"
    http_headers:       dict = field(default_factory=dict)
    http_body_template: str  = ""


@dataclass
class WorkflowConfig:
    name:        str
    nodes:       list[NodeConfig]
    mode:        Literal["sequential", "parallel"] = "sequential"
    workflow_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_ids:   list[str] = field(default_factory=list)  # legacy support


# ── Step result ───────────────────────────────────────────────────────────────

@dataclass
class StepResult:
    node_id:   str
    node_type: str
    label:     str
    input:     str
    output:    str
    error:     str | None = None
    branch:    str | None = None


@dataclass
class WorkflowResult:
    workflow_id:   str
    workflow_name: str
    mode:          str
    steps:         list[StepResult]
    final_output:  str


# ── Session store ─────────────────────────────────────────────────────────────
# Stores conversation history (list of dicts) per workflow+agent key.
# Replaces InMemorySessionService — no Google ADK dependency.

class SessionStore:
    def __init__(self):
        # key: "{workflow_id}::{agent_id}" -> list of {"role":..., "content":...}
        self._histories: dict[str, list[dict]] = {}

    def get_history(self, workflow_id: str, agent_id: str) -> list[dict]:
        key = f"{workflow_id}::{agent_id}"
        return self._histories.setdefault(key, [])

    def append(self, workflow_id: str, agent_id: str, role: str, content: str):
        self.get_history(workflow_id, agent_id).append(
            {"role": role, "content": content}
        )

    def clear_workflow(self, workflow_id: str):
        keys = [k for k in self._histories if k.startswith(f"{workflow_id}::")]
        for k in keys:
            del self._histories[k]


# ── Engine ────────────────────────────────────────────────────────────────────

class WorkflowEngine:

    def __init__(self, registry: AgentRegistry):
        self._registry      = registry
        self._session_store = SessionStore()

    # ── Public ────────────────────────────────────────────────────────────────

    async def run(
        self,
        workflow: WorkflowConfig,
        user_input: str,
        reset_session: bool = False,
    ) -> WorkflowResult:
        if reset_session:
            self._session_store.clear_workflow(workflow.workflow_id)

        nodes = workflow.nodes

        # Legacy: plain agent_ids -> wrap in agent nodes
        if not nodes and workflow.agent_ids:
            nodes = [
                NodeConfig(
                    node_id=aid, node_type="agent",
                    label=f"Agent {i+1}", agent_id=aid,
                )
                for i, aid in enumerate(workflow.agent_ids)
            ]

        if workflow.mode == "parallel":
            steps = await self._run_parallel(workflow, nodes, user_input)
            final = self._merge_parallel(steps)
        else:
            steps = await self._run_sequential(workflow, nodes, user_input)
            final = next(
                (s.output for s in reversed(steps) if s.output and not s.error),
                "",
            )

        return WorkflowResult(
            workflow_id=workflow.workflow_id,
            workflow_name=workflow.name,
            mode=workflow.mode,
            steps=steps,
            final_output=final,
        )

    # ── Sequential ────────────────────────────────────────────────────────────

    async def _run_sequential(
        self,
        workflow: WorkflowConfig,
        nodes: list[NodeConfig],
        initial_input: str,
    ) -> list[StepResult]:
        steps:         list[StepResult] = []
        current_input: str              = initial_input
        node_map = {n.node_id: n for n in nodes}
        i = 0

        while i < len(nodes):
            node   = nodes[i]
            result = await self._run_node(node, current_input, workflow.workflow_id)
            steps.append(result)

            if result.error:
                break

            # Conditional branching
            if node.node_type == "conditional":
                next_id = node.true_next if result.branch == "true" else node.false_next
                if next_id and next_id in node_map:
                    target = [j for j, n in enumerate(nodes) if n.node_id == next_id]
                    if target:
                        i = target[0]
                        continue

            if result.output:
                current_input = result.output
            i += 1

        return steps

    # ── Parallel ─────────────────────────────────────────────────────────────

    async def _run_parallel(
        self,
        workflow: WorkflowConfig,
        nodes: list[NodeConfig],
        user_input: str,
    ) -> list[StepResult]:
        tasks   = [self._run_node(n, user_input, workflow.workflow_id) for n in nodes]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        steps: list[StepResult] = []
        for node, result in zip(nodes, results):
            if isinstance(result, Exception):
                steps.append(StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=user_input, output="", error=str(result),
                ))
            else:
                steps.append(result)
        return steps

    # ── Node dispatcher ───────────────────────────────────────────────────────

    async def _run_node(
        self,
        node: NodeConfig,
        current_input: str,
        workflow_id: str,
    ) -> StepResult:
        try:
            if node.node_type == "chat_input":
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input, output=current_input,
                )

            elif node.node_type == "agent":
                output, error = await self._invoke_agent(node, current_input, workflow_id)
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input, output=output, error=error,
                )

            elif node.node_type == "conditional":
                branch, label = self._evaluate_condition(node, current_input)
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input,
                    output=label, branch=branch,
                )

            elif node.node_type == "function":
                output, error = self._run_python(node, current_input)
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input, output=output, error=error,
                )

            elif node.node_type == "http_request":
                output, error = await self._run_http(node, current_input)
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input, output=output, error=error,
                )

            elif node.node_type == "output":
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input, output=current_input,
                )

            else:
                return StepResult(
                    node_id=node.node_id, node_type=node.node_type,
                    label=node.label, input=current_input, output="",
                    error=f"Unknown node type: {node.node_type}",
                )

        except Exception as e:
            return StepResult(
                node_id=node.node_id, node_type=node.node_type,
                label=node.label, input=current_input, output="", error=str(e),
            )

    # ── Agent invocation (LiteLLM, session-safe) ──────────────────────────────

    async def _invoke_agent(
        self,
        node: NodeConfig,
        message: str,
        workflow_id: str,
    ) -> tuple[str, str | None]:
        built = self._registry.get(node.agent_id or "")
        if built is None:
            return "", f"Agent '{node.agent_id}' not found in registry."

        try:
            history = self._session_store.get_history(workflow_id, node.agent_id or "")

            # Run in thread pool so async endpoint isn't blocked by sync LiteLLM call
            loop   = asyncio.get_event_loop()
            output = await loop.run_in_executor(
                None, built.run, message, list(history)
            )

            # Persist turn to history
            self._session_store.append(workflow_id, node.agent_id or "", "user",      message)
            self._session_store.append(workflow_id, node.agent_id or "", "assistant", output)

            return output, None

        except Exception as e:
            return "", str(e)

    # ── Standalone agent run ──────────────────────────────────────────────────

    async def run_agent_standalone(
        self,
        agent_id: str,
        message: str,
        session_id: str,
    ) -> tuple[str, str | None]:
        """Run a single agent outside any workflow with its own isolated history."""
        built = self._registry.get(agent_id)
        if built is None:
            return "", f"Agent '{agent_id}' not found."

        try:
            # Standalone uses session_id as the workflow_id key so it's isolated
            history = self._session_store.get_history(session_id, agent_id)
            loop    = asyncio.get_event_loop()
            output  = await loop.run_in_executor(None, built.run, message, list(history))

            self._session_store.append(session_id, agent_id, "user",      message)
            self._session_store.append(session_id, agent_id, "assistant", output)

            return output, None

        except Exception as e:
            return "", str(e)

    # ── Conditional evaluator ─────────────────────────────────────────────────

    @staticmethod
    def _evaluate_condition(node: NodeConfig, text: str) -> tuple[str, str]:
        op  = node.condition_operator
        val = node.condition_value
        try:
            if   op == "contains":     match = val.lower() in text.lower()
            elif op == "not_contains": match = val.lower() not in text.lower()
            elif op == "equals":       match = text.strip() == val.strip()
            elif op == "regex":        match = bool(re.search(val, text))
            else:                      match = False
        except Exception:
            match = False

        branch = "true" if match else "false"
        return branch, f"Condition [{op} '{val}'] → {branch.upper()}"

    # ── Python function runner ────────────────────────────────────────────────

    @staticmethod
    def _run_python(node: NodeConfig, current_input: str) -> tuple[str, str | None]:
        code = node.python_code.strip()
        if not code:
            return current_input, None

        local_vars: dict[str, Any] = {"input": current_input, "output": ""}
        try:
            exec(compile(code, "<function_node>", "exec"), {"__builtins__": __builtins__}, local_vars)
            return str(local_vars.get("output", "")), None
        except Exception as e:
            return "", f"Python error: {e}"

    # ── HTTP request runner ───────────────────────────────────────────────────

    @staticmethod
    async def _run_http(node: NodeConfig, current_input: str) -> tuple[str, str | None]:
        url    = node.http_url.strip()
        method = node.http_method.upper()
        if not url:
            return "", "HTTP node: URL is empty."

        body_str = node.http_body_template.replace("{input}", current_input)
        headers  = node.http_headers or {}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                if   method == "GET":    resp = await client.get(url, headers=headers)
                elif method == "POST":   resp = await client.post(url, content=body_str, headers=headers)
                elif method == "PUT":    resp = await client.put(url, content=body_str, headers=headers)
                elif method == "DELETE": resp = await client.delete(url, headers=headers)
                else: return "", f"Unsupported HTTP method: {method}"

                try:
                    return json.dumps(resp.json(), indent=2), None
                except Exception:
                    return resp.text, None

        except Exception as e:
            return "", f"HTTP error: {e}"

    @staticmethod
    def _merge_parallel(steps: list[StepResult]) -> str:
        parts = []
        for s in steps:
            parts.append(f"[{s.label}]\n{s.error if s.error else s.output}")
        return "\n\n---\n\n".join(parts)