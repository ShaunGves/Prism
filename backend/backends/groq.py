from groq import AsyncGroq
from backend.config import GROQ_API_KEY, GROQ_MODEL

class GroqBackend:
    def __init__(self):
        # Allow default fallback to environment if GROQ_API_KEY is empty
        self.client = AsyncGroq(api_key=GROQ_API_KEY or None, timeout=30.0)

    async def stream(self, prompt: str, model: str = None, max_tokens: int = None):
        selected_model = model or GROQ_MODEL
        kwargs = {
            "model": selected_model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True
        }
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        s = await self.client.chat.completions.create(**kwargs)
        async for chunk in s:
            if text := chunk.choices[0].delta.content:
                yield text


