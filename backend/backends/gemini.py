import asyncio
import google.generativeai as genai
from backend.config import GEMINI_API_KEY, GEMINI_MODEL

class GeminiBackend:
    def __init__(self):
        # Configure the Google GenAI library. If API key is empty, configure will still run but calls will fail.
        genai.configure(api_key=GEMINI_API_KEY or None)

    async def stream(self, prompt: str, model: str = None, max_tokens: int = None):
        selected_model = model or GEMINI_MODEL
        genai_model = genai.GenerativeModel(selected_model)
        kwargs = {
            "contents": prompt,
            "stream": True,
            "request_options": {"timeout": 30.0}
        }
        if max_tokens is not None:
            kwargs["generation_config"] = {"max_output_tokens": max_tokens}
        response = await genai_model.generate_content_async(**kwargs)
        async for chunk in response:
            if chunk.text:
                yield chunk.text


    async def ping(self):
        # Force iteration to trigger the actual network call and measure real latency
        def _call():
            for _ in genai.list_models():
                break
        await asyncio.to_thread(_call)


