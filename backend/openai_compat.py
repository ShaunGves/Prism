"""
openai_compat.py — HTTP pipeline runner for the OpenAI-compatible endpoint.

Runs the full Prism pipeline (decompose → dispatch → synthesize) without a WebSocket,
collecting results in memory. Returns the synthesis text + audit log.
"""
import asyncio
import time
import json
from typing import AsyncGenerator

from backend.decomp import decompose
from backend.dispatcher import PrismDispatcher
from backend.schema import DecompositionResult, TaskResult
from backend.privacy import re_inject


class EventCollector:
    """
    Mimics the WebSocket send interface but buffers all events in memory.
    Used by PrismDispatcher so we can run the full pipeline over HTTP.
    """

    def __init__(self):
        self.events: list[dict] = []
        self.synthesis_chunks: list[str] = []
        self._synthesis_queue: asyncio.Queue = asyncio.Queue()

    async def send(self, event: dict) -> None:
        self.events.append(event)
        if event.get("type") == "synthesis_chunk":
            chunk = event.get("chunk", "")
            self.synthesis_chunks.append(chunk)
            await self._synthesis_queue.put(chunk)
        elif event.get("type") == "synthesis_complete":
            await self._synthesis_queue.put(None)  # sentinel

    def get_full_synthesis(self) -> str:
        return "".join(self.synthesis_chunks)

    def get_audit(self) -> list[TaskResult]:
        for event in self.events:
            if event.get("type") == "synthesis_complete":
                return [TaskResult(**r) for r in event.get("audit", [])]
        return []

    async def stream_synthesis(self) -> AsyncGenerator[str, None]:
        """Yield synthesis chunks as they arrive (for streaming mode)."""
        while True:
            item = await self._synthesis_queue.get()
            if item is None:
                break
            yield item


def _strip_tags(text: str) -> str:
    """Remove XML provenance tags from synthesis output."""
    import re
    return re.sub(r"<\/?(t\d+|synthesis)>", "", text)


async def run_pipeline_http(
    messages: list[dict],
    settings: dict | None = None,
    session_id: str | None = None,
) -> tuple[str, list[TaskResult]]:
    """
    Run the full Prism pipeline for a list of OpenAI-format messages.
    Extracts the last user message as the query.

    Returns:
        (synthesis_text, audit_results)
    """
    settings = settings or {}

    # Extract the last user message as the query
    query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            query = msg.get("content", "")
            break

    if not query:
        return "No user message found.", []

    import uuid
    sid = session_id or str(uuid.uuid4())

    # Decompose
    temperature = settings.get("temperature", 0.1)
    decomp = await decompose(query, temperature=temperature)

    # Build user context (empty for OpenAI compat endpoint — no attached files)
    user_context: dict = {"settings": settings}

    # Run dispatcher with event collector
    collector = EventCollector()
    dispatcher = PrismDispatcher(ws_send=collector.send, session_id=sid)
    await dispatcher.run(decomp, user_context)

    synthesis = _strip_tags(collector.get_full_synthesis())
    audit = collector.get_audit()

    return synthesis, audit


async def run_pipeline_streaming(
    messages: list[dict],
    settings: dict | None = None,
    session_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Run the full Prism pipeline and yield synthesis chunks as they arrive.
    Each yielded item is a raw text chunk (not yet SSE-formatted).
    """
    settings = settings or {}

    query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            query = msg.get("content", "")
            break

    if not query:
        yield "No user message found."
        return

    import uuid
    sid = session_id or str(uuid.uuid4())

    temperature = settings.get("temperature", 0.1)
    decomp = await decompose(query, temperature=temperature)

    user_context: dict = {"settings": settings}
    collector = EventCollector()
    dispatcher = PrismDispatcher(ws_send=collector.send, session_id=sid)

    # Run dispatcher in background, stream synthesis chunks as they arrive
    pipeline_task = asyncio.create_task(dispatcher.run(decomp, user_context))

    async for chunk in collector.stream_synthesis():
        yield chunk

    # Ensure pipeline finishes cleanly
    try:
        await pipeline_task
    except Exception:
        pass
