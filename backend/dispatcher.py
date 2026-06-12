import asyncio
import time
import json
from backend.schema import DecompositionResult, SubTask, TaskResult
from backend.privacy import privacy_gate, re_inject
from backend.backends import get_backend

class PrismDispatcher:
    def __init__(self, ws_send, session_id: str):
        self.ws_send = ws_send      # async callable: dict -> None
        self.session_id = session_id
        self.results: dict[str, TaskResult] = {}

    async def run(self, decomp: DecompositionResult, user_context: dict) -> str:
        pending = {t.id: t for t in decomp.tasks}
        completed: dict[str, str] = {}  # task_id -> output text

        await self.ws_send({
            "type": "decomp_complete",
            "tasks": [t.model_dump() for t in decomp.tasks],
            "session_id": self.session_id
        })

        while pending:
            ready = [t for t in pending.values()
                     if all(dep in completed for dep in t.depends_on)]
            if not ready:
                raise RuntimeError("Dependency deadlock - check decomp output")

            # Fire all ready tasks simultaneously
            await asyncio.gather(*[
                self._run_task(task, user_context, completed)
                for task in ready
            ])

            for task in ready:
                completed[task.id] = self.results[task.id].output
                del pending[task.id]

        return await self._synthesize(completed, decomp.synthesis_hint, user_context)

    async def _run_task(self, task: SubTask, base_ctx: dict, completed: dict):
        # Build context: base + any required prior outputs
        ctx = {**base_ctx}
        for key in task.context_keys:
            if key in completed:
                ctx[f"result_{key}"] = completed[key]

        sanitized, redaction_map = privacy_gate(task, ctx)

        await self.ws_send({
            "type": "task_start",
            "task_id": task.id,
            "backend": task.backend,
            "redacted_count": len(redaction_map),
            "redacted_keys": list(redaction_map.keys()),
            "session_id": self.session_id
        })

        start = time.monotonic()
        full_raw = ""
        accumulated_restored = ""

        prompt = f"{task.description}\n\nContext:\n{json.dumps(sanitized, indent=2)}"

        # Extract models & token limits from settings
        settings = base_ctx.get("settings", {})
        model_override = None
        max_tokens_override = None
        if task.backend == "groq":
            model_override = settings.get("groq_model")
            max_tokens_override = settings.get("max_tokens_groq")
        elif task.backend == "gemini":
            model_override = settings.get("gemini_model")
            max_tokens_override = settings.get("max_tokens_gemini")
        elif task.backend == "local_qwen3":
            max_tokens_override = settings.get("max_tokens_local")

        try:
            backend_impl = get_backend(task.backend)
            async for chunk in backend_impl.stream(prompt, model=model_override, max_tokens=max_tokens_override):
                full_raw += chunk
                current_restored = re_inject(full_raw, redaction_map)
                new_chunk = current_restored[len(accumulated_restored):]
                accumulated_restored = current_restored
                if new_chunk:
                    await self.ws_send({
                        "type": "task_chunk",
                        "task_id": task.id,
                        "chunk": new_chunk,
                        "session_id": self.session_id
                    })
        except Exception as e:
            error_msg = f"[ERROR: Task {task.id} failed due to: {str(e)}]"
            accumulated_restored = error_msg
            await self.ws_send({
                "type": "task_error",
                "task_id": task.id,
                "error": str(e),
                "session_id": self.session_id
            })
            await self.ws_send({
                "type": "task_chunk",
                "task_id": task.id,
                "chunk": error_msg,
                "session_id": self.session_id
            })

        elapsed = int((time.monotonic() - start) * 1000)
        full_output = accumulated_restored
        token_count = max(1, len(full_output) // 4)
        cost = _estimate_cost(task.backend, token_count)

        self.results[task.id] = TaskResult(
            task_id=task.id,
            output=full_output,
            backend=task.backend,
            latency_ms=elapsed,
            cost_usd=cost,
            redacted_keys=list(redaction_map.keys()),
            token_count=token_count
        )

        await self.ws_send({
            "type": "task_complete",
            "task_id": task.id,
            "latency_ms": elapsed,
            "tokens": token_count,
            "cost_usd": cost,
            "redacted_keys": list(redaction_map.keys()),
            "session_id": self.session_id
        })

    async def _synthesize(self, completed: dict[str, str], hint: str, base_ctx: dict) -> str:
        await self.ws_send({
            "type": "synthesis_start",
            "session_id": self.session_id
        })

        parts = "\n\n".join(f"[{tid}]:\n{_trim_for_synthesis(out)}" for tid, out in completed.items())
        prompt = (
            "You are a local synthesis engine. Combine the results of the sub-tasks into a single coherent, detailed, and polished response.\n"
            f"Guidance: {hint}\n\n"
            "CRITICAL: You must attribute each sentence or section to the task ID it originated from by wrapping it in XML tags. "
            "For example, if a sentence comes from the results of [t1], wrap it like: <t1>This is a sentence from task 1.</t1>. "
            "If it combines info from [t1] and [t2], wrap it like: <t1><t2>This sentence combines both.</t2></t1>. "
            "Ensure that ALL text in the response is wrapped in appropriate task tags (like <t1>...</t1>, <t2>...</t2>, etc.) so we can show sentence-level attribution on the frontend. "
            "If a sentence is general transition or summary that does not directly come from a specific task, wrap it in <synthesis>...</synthesis>.\n\n"
            f"Sub-task outputs:\n{parts}"
        )

        # Extract max tokens for synthesis if set
        settings = base_ctx.get("settings", {})
        max_tokens_override = settings.get("max_tokens_local")

        full = ""
        # HARD REQUIREMENT: Synthesis always runs on local_qwen3
        local_backend = get_backend("local_qwen3")
        async for chunk in local_backend.stream(prompt, max_tokens=max_tokens_override):
            full += chunk
            await self.ws_send({
                "type": "synthesis_chunk",
                "chunk": chunk,
                "session_id": self.session_id
            })

        await self.ws_send({
            "type": "synthesis_complete",
            "audit": [r.model_dump() for r in self.results.values()],
            "session_id": self.session_id
        })
        return full

def _estimate_cost(backend: str, tokens: int) -> float:
    rates = {
        "local_qwen3": 0.0,
        "groq": 0.00000059,
        "gemini": 0.000000075
    }
    return round(rates.get(backend, 0.0) * tokens, 6)


def _trim_for_synthesis(output: str, max_chars: int = 3200) -> str:
    """Trim task output before synthesis to keep the local model fast."""
    if len(output) <= max_chars:
        return output
    return output[:max_chars] + "\n\n[...truncated for synthesis...]"

