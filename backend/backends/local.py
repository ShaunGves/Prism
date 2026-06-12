import httpx
import json
import re
from typing import AsyncIterator
from backend.config import LLAMA_BASE_URL


def _is_think_token(text: str, think_open: bool) -> tuple[str, bool]:
    """
    Filter <think>...</think> tokens from a streaming chunk.
    Returns (clean_text, updated_think_open_state).
    Handles the case where open/close tags arrive in separate chunks.
    """
    result = []
    i = 0
    while i < len(text):
        if not think_open:
            # Look for <think> opening
            idx = text.find("<think>", i)
            if idx == -1:
                result.append(text[i:])
                break
            # Emit everything before <think>
            result.append(text[i:idx])
            i = idx + len("<think>")
            think_open = True
        else:
            # Inside a think block — look for </think>
            idx = text.find("</think>", i)
            if idx == -1:
                # Still inside — discard rest of this chunk
                break
            # Skip past </think>
            i = idx + len("</think>")
            think_open = False
    return "".join(result), think_open


class LocalBackend:
    async def stream(self, prompt: str, model: str = None, max_tokens: int = 2048) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            url = f"{LLAMA_BASE_URL.rstrip('/')}/completions"
            async with client.stream("POST", url, json={
                "prompt": prompt,
                "max_tokens": max_tokens,
                "stream": True,
                # Disable Qwen3 thinking mode — keeps output clean and fast
                "chat_template_kwargs": {"enable_thinking": False}
            }) as resp:
                think_open = False  # tracks if we're inside a <think> block mid-stream

                async for line in resp.aiter_lines():
                    if line.startswith("data: ") and "[DONE]" not in line:
                        try:
                            data = json.loads(line[6:])
                            raw_chunk = data["choices"][0].get("text", "")
                            if not raw_chunk:
                                continue

                            # Strip thinking tokens from stream
                            clean, think_open = _is_think_token(raw_chunk, think_open)
                            if clean:
                                yield clean
                        except Exception:
                            pass
