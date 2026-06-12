import httpx
import asyncio
import json
import re
from backend.schema import DecompositionResult
from backend.config import LLAMA_BASE_URL

DECOMP_SYSTEM = """You are a query decomposition engine. Split the user request into 2-5 atomic sub-tasks.

Rules:
- depends_on: IDs of tasks that must finish before this one starts. Empty = runs immediately.
- context_keys: IDs of prior tasks whose output this task needs as input.
- sensitivity HIGH: task touches source code, API keys, passwords, personal data, internal company info.
- sensitivity LOW: task needs only general knowledge, no user-specific private data.
- backend: HIGH sensitivity → local_qwen3 | complex reasoning + LOW sensitivity → gemini | fast/cheap → groq

Respond with ONLY valid JSON. No explanation. No markdown. No backticks.

Schema:
{
  "tasks": [
    {
      "id": "t1",
      "description": "what to do",
      "sensitivity": "high" | "low",
      "complexity": "low" | "medium" | "high",
      "backend": "local_qwen3" | "groq" | "gemini",
      "depends_on": [],
      "context_keys": []
    }
  ],
  "synthesis_hint": "how to combine results into one coherent answer"
}"""


def _strip_think(text: str) -> str:
    """
    Remove Qwen3 <think>...</think> blocks from model output.
    Qwen3.6 (and Qwen3-8B) may emit these even when enable_thinking=False
    if --jinja is not used or if the model ignores the flag.
    """
    # Remove full <think>...</think> blocks (can be multiline)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # Strip any orphaned opening/closing tags
    text = re.sub(r"</?think>", "", text)
    return text.strip()


async def decompose(query: str, temperature: float = 0.1) -> DecompositionResult:
    url = f"{LLAMA_BASE_URL.rstrip('/')}/chat/completions"

    last_err = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json={
                    "model": "qwen3",
                    "messages": [
                        {"role": "system", "content": DECOMP_SYSTEM},
                        {"role": "user", "content": query}
                    ],
                    "max_tokens": 1024,
                    "temperature": temperature,
                    "stream": False,
                    # Disable Qwen3 extended thinking — without this the model
                    # emits <think>...</think> blocks before the JSON, which
                    # breaks the parser and adds 5-15s latency per decomp call.
                    "chat_template_kwargs": {"enable_thinking": False}
                })
                resp.raise_for_status()

            raw = resp.json()["choices"][0]["message"]["content"].strip()

            # Strip think blocks (belt-and-suspenders: flag + regex)
            raw = _strip_think(raw)

            # Strip any markdown fences Qwen sneaks in anyway
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            if raw.endswith("```"):
                raw = raw.rsplit("```", 1)[0]

            return DecompositionResult.model_validate(json.loads(raw.strip()))
        except Exception as e:
            last_err = e
            print(f"Decomposition attempt {attempt + 1} failed: {e}")
            await asyncio.sleep(0.5)  # small delay before retry

    raise RuntimeError(f"Decomposition failed to generate valid JSON after 3 retries. Last error: {last_err}")
