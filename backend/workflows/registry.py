"""
workflows/registry.py

In-memory store for all user-created workflows.
"""

from __future__ import annotations

from workflows.engine import WorkflowConfig


class WorkflowRegistry:

    def __init__(self):
        self._workflows: dict[str, WorkflowConfig] = {}

    def create(self, config: WorkflowConfig) -> WorkflowConfig:
        self._workflows[config.workflow_id] = config
        return config

    def get(self, workflow_id: str) -> WorkflowConfig | None:
        return self._workflows.get(workflow_id)

    def list(self) -> list[WorkflowConfig]:
        return list(self._workflows.values())

    def delete(self, workflow_id: str) -> bool:
        if workflow_id in self._workflows:
            del self._workflows[workflow_id]
            return True
        return False