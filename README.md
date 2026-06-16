# AI Workflow

AI Workflow is a no-code/low-code platform for building, orchestrating, and deploying AI-powered applications. Inspired by modern AI Foundry platforms, it enables users to create intelligent agents, design multi-step workflows, and implement Retrieval-Augmented Generation (RAG) pipelines through a unified interface.

## 🚀 Features

### 🤖 AI Agents
* Create and configure custom AI agents.
* Connect agents with LLM providers (OpenAI, Gemini, Claude, etc.).
* Define agent roles, instructions, tools, and memory.
* Support for multi-agent collaboration and agent-to-agent communication.

### 🔄 Workflow Builder
* Design AI workflows using a visual workflow editor.
* Chain multiple agents and tools together.
* Conditional branching and decision-making capabilities.
* Event-driven workflow execution.
* Real-time workflow monitoring and debugging.

### 📚 Retrieval-Augmented Generation (RAG)
* Upload and manage enterprise documents.
* Automated document chunking and embedding generation.
* Vector database integration for semantic search.
* Context-aware retrieval for accurate responses.
* Support for multiple knowledge bases.

### 🔌 Tool & API Integration
* Connect external APIs and services.
* Custom tool creation using MCP (Model Context Protocol).
* Function calling support for LLMs.
* Web search and external knowledge retrieval.

### ⚡ Real-Time Execution
* Asynchronous task processing.
* Streaming AI responses.
* Workflow execution tracking.
* Detailed logging and observability.

---

## 🏗️ Architecture

```text
+------------------+
|    React UI      |
+---------+--------+
          |
          v
+------------------+
|    FastAPI API   |
+---------+--------+
          |
          v
+------------------+
| Workflow Engine  |
+----+--------+----+
     |        |
     v        v
+--------+ +--------+
| Agents | |  RAG   |
+--------+ +--------+
     |        |
     v        v
+------------------+
| LLM Providers    |
|  Open AI         |
+------------------+
```
<img width="1731" height="800" alt="Screenshot_16-6-2026_14019_localhost" src="https://github.com/user-attachments/assets/b0d3e669-c6ca-4657-a497-d011c9d1ccc5" />
<img width="1731" height="1164" alt="Screenshot_16-6-2026_14126_localhost" src="https://github.com/user-attachments/assets/36871ef5-29f6-48a5-9b6b-de4376289b3a" />
<img width="1731" height="936" alt="Screenshot_16-6-2026_14059_localhost" src="https://github.com/user-attachments/assets/f4954b67-e57a-49f0-8fbf-ed5fdae6a8fc" />
<img width="1731" height="800" alt="Screenshot_16-6-2026_14036_localhost" src="https://github.com/user-attachments/assets/c4e1cb44-a2b9-40c3-b88f-5c06f0902164" />
<img width="1731" height="956" alt="Screenshot_16-6-2026_14150_localhost" src="https://github.com/user-attachments/assets/ae739d6d-e2ec-473d-abe7-d18861e3c846" />
