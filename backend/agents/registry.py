"""
agents/registry.py

In-memory store for all user-created agents.
Provides create / get / list / delete operations.
"""

from __future__ import annotations

from agents.factory import AgentConfig, AgentFactory, BuiltAgent


class AgentRegistry:
    """
    Holds all BuiltAgent instances keyed by agent_id.
    Shared as a singleton across the app.
    """

    def __init__(self, factory: AgentFactory):
        self._factory = factory
        self._agents: dict[str, BuiltAgent] = {}

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(self, config: AgentConfig) -> BuiltAgent:
        """Build and register a new agent. Returns the BuiltAgent."""
        built = self._factory.build(config)
        self._agents[built.config.agent_id] = built
        return built

    def get(self, agent_id: str) -> BuiltAgent | None:
        return self._agents.get(agent_id)

    def list(self) -> list[BuiltAgent]:
        return list(self._agents.values())

    def delete(self, agent_id: str) -> bool:
        """Returns True if deleted, False if not found."""
        if agent_id in self._agents:
            del self._agents[agent_id]
            return True
        return False

    def exists(self, agent_id: str) -> bool:
        return agent_id in self._agents
