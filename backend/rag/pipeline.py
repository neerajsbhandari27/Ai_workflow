"""
rag/pipeline.py

RAG pipeline using Azure OpenAI embeddings via LiteLLM.
Google embeddings fully removed.

ChromaDB is lazy-initialised to avoid OpenBLAS memory errors on startup.
Embeddings use text-embedding-ada-002 (or whatever Azure deployment you set
via AZURE_EMBEDDING_DEPLOYMENT in .env, defaults to "text-embedding-ada-002").
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Suppress ChromaDB telemetry and local model loading
os.environ["ANONYMIZED_TELEMETRY"] = "false"

import chromadb
from chromadb import EmbeddingFunction, Documents, Embeddings

import openai
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredMarkdownLoader,
    WebBaseLoader,
)
from langchain_core.documents import Document

CHROMA_PERSIST_DIR = str(BASE_DIR / "chroma_db")
COLLECTION_NAME    = "rag_collection"
CHUNK_SIZE         = 1000
CHUNK_OVERLAP      = 150
TOP_K              = 5

# Azure embedding deployment name (set in .env, e.g. "text-embedding-ada-002")
_EMBED_DEPLOYMENT = os.getenv("AZURE_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002")
_AZURE_API_KEY    = os.getenv("AZURE_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY", "")
_AZURE_API_BASE   = os.getenv("AZURE_API_BASE", "")
_AZURE_API_VER    = os.getenv("AZURE_API_VERSION", "2025-01-01-preview")


# ── Azure embedding function for ChromaDB ─────────────────────────────────────

class AzureEmbeddingFunction(EmbeddingFunction):
    """
    Calls Azure OpenAI embeddings API via the openai SDK.
    Completely bypasses sentence-transformers and OpenBLAS.
    """

    def __init__(self):
        self._client = openai.AzureOpenAI(
            api_key=_AZURE_API_KEY,
            azure_endpoint=_AZURE_API_BASE,
            api_version=_AZURE_API_VER,
        )
        self._deployment = _EMBED_DEPLOYMENT

    def __call__(self, input: Documents) -> Embeddings:
        texts = [input] if isinstance(input, str) else list(input)
        resp  = self._client.embeddings.create(
            input=texts,
            model=self._deployment,
        )
        return [item.embedding for item in resp.data]


# ── RAG Pipeline ──────────────────────────────────────────────────────────────

class RAGPipeline:
    """
    Lazy-initialised RAG pipeline backed by ChromaDB + Azure OpenAI embeddings.
    The ChromaDB client is created only on first use, keeping server startup fast.
    """

    def __init__(self):
        self._client:     chromadb.PersistentClient | None = None
        self._collection: chromadb.Collection | None       = None
        self._embed_fn:   AzureEmbeddingFunction | None    = None
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP,
        )

    # ── Lazy init ─────────────────────────────────────────────────────────────

    def _get_collection(self) -> chromadb.Collection:
        if self._collection is not None:
            return self._collection

        self._embed_fn   = AzureEmbeddingFunction()
        self._client     = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self._embed_fn,
            metadata={"hnsw:space": "cosine"},
        )
        return self._collection

    # ── Internal add ─────────────────────────────────────────────────────────

    def _add_documents(self, docs: list[Document]) -> int:
        if not docs:
            return 0
        collection = self._get_collection()
        chunks     = self.splitter.split_documents(docs)
        if not chunks:
            return 0

        ids       = [f"doc_{i}_{abs(hash(c.page_content))}" for i, c in enumerate(chunks)]
        texts     = [c.page_content for c in chunks]
        metadatas = [c.metadata for c in chunks]

        collection.add(documents=texts, metadatas=metadatas, ids=ids)
        return len(chunks)

    # ── Ingest methods ────────────────────────────────────────────────────────

    def ingest_pdf(self, file_path: str) -> int:
        return self._add_documents(PyPDFLoader(file_path).load())

    def ingest_text(self, text: str, source: str = "manual") -> int:
        return self._add_documents(
            [Document(page_content=text, metadata={"source": source})]
        )

    def ingest_markdown(self, file_path: str) -> int:
        return self._add_documents(UnstructuredMarkdownLoader(file_path).load())

    def ingest_txt(self, file_path: str) -> int:
        return self._add_documents(TextLoader(file_path).load())

    def ingest_url(self, url: str) -> int:
        return self._add_documents(WebBaseLoader(url).load())

    def ingest_db_records(
        self,
        records: list[dict[str, Any]],
        content_field:   str            = "content",
        metadata_fields: list[str] | None = None,
    ) -> int:
        docs = []
        for row in records:
            content  = str(row.get(content_field, ""))
            metadata = {"source": "database"}
            if metadata_fields:
                metadata.update(
                    {k: str(row.get(k, "")) for k in metadata_fields if k in row}
                )
            docs.append(Document(page_content=content, metadata=metadata))
        return self._add_documents(docs)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def retrieve(self, query: str, top_k: int = TOP_K) -> str:
        collection = self._get_collection()
        count      = collection.count()
        if count == 0:
            return "No documents in knowledge base yet."

        # Embed the query with retrieval task intent
        client = openai.AzureOpenAI(
            api_key=_AZURE_API_KEY,
            azure_endpoint=_AZURE_API_BASE,
            api_version=_AZURE_API_VER,
        )
        q_embed = client.embeddings.create(
            input=[query], model=_EMBED_DEPLOYMENT,
        ).data[0].embedding

        results   = collection.query(
            query_embeddings=[q_embed],
            n_results=min(top_k, count),
        )
        docs      = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas",  [[]])[0]

        if not docs:
            return "No relevant documents found."

        parts = []
        for i, (text, meta) in enumerate(zip(docs, metadatas), 1):
            source = (meta or {}).get("source", "unknown")
            parts.append(f"[{i}] (source: {source})\n{text}")
        return "\n\n---\n\n".join(parts)