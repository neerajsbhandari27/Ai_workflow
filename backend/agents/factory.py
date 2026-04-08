"""
agents/factory.py

Generic AgentFactory — builds LiteLLM-powered agents using Azure OpenAI.
Config is read from .env and passed explicitly to each completion() call
(avoids litellm global state which can cause import-time issues).
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from typing import Callable

# ── Read Azure config from env (set before any litellm import) ────────────────
_API_KEY     = os.getenv("AZURE_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY", "")
_API_BASE    = os.getenv("AZURE_API_BASE", "")
_API_VERSION = os.getenv("AZURE_API_VERSION", "2025-01-01-preview")
_MODEL       = os.getenv("LITELLM_MODEL_NAME", "azure/gpt-4")


# ── Agent config ──────────────────────────────────────────────────────────────

@dataclass
class AgentConfig:
    name:        str
    description: str
    instruction: str
    rag_enabled: bool      = False
    tools:       list[str] = field(default_factory=list)
    agent_id:    str       = field(default_factory=lambda: str(uuid.uuid4()))


# ── Built agent ───────────────────────────────────────────────────────────────

@dataclass
class BuiltAgent:
    config:  AgentConfig
    _runner: Callable = field(repr=False)

    def run(self, message: str, history: list[dict] | None = None) -> str:
        return self._runner(message, history or [])


# ── Factory ───────────────────────────────────────────────────────────────────

class AgentFactory:
    """
    Builds BuiltAgent instances backed by LiteLLM → Azure OpenAI.
    litellm is imported lazily inside the runner closure so import-time
    Pydantic schema errors cannot crash the server on startup.
    """

    def __init__(self, rag_pipeline=None):
        self._rag_pipeline = rag_pipeline

    def build(self, config: AgentConfig) -> BuiltAgent:
        pipeline    = self._rag_pipeline if config.rag_enabled else None
        instruction = config.instruction

        if config.rag_enabled:
            if pipeline is None:
                raise ValueError(
                    f"Agent '{config.name}' has rag_enabled=True "
                    "but no RAGPipeline was provided to AgentFactory."
                )
            instruction += (
                "\n\nYou have access to a knowledge base. "
                "Relevant context will be provided at the start of each message. "
                "Use it to give accurate, grounded answers."
            )

        # Capture config values in closure (avoids referencing self later)
        api_key     = _API_KEY
        api_base    = _API_BASE
        api_version = _API_VERSION
        model       = _MODEL

        def runner(message: str, history: list[dict]) -> str:
            # Lazy import — keeps litellm out of module-level import chain
            from litellm import completion  # noqa: PLC0415

            system_content = instruction

            # Inject RAG context if enabled
            if pipeline is not None:
                try:
                    context = pipeline.retrieve(message)
                    if context and context != "No relevant documents found.":
                        system_content += (
                            f"\n\n--- KNOWLEDGE BASE CONTEXT ---\n{context}\n---"
                        )
                except Exception as e:
                    system_content += f"\n\n[RAG retrieval failed: {e}]"

            messages = [{"role": "system", "content": system_content}]
            messages.extend(history)
            messages.append({"role": "user", "content": message})

            resp = completion(
                model=model,
                messages=messages,
                api_key=api_key,
                api_base=api_base,
                api_version=api_version,
            )
            return resp.choices[0].message.content or ""

        return BuiltAgent(config=config, _runner=runner)