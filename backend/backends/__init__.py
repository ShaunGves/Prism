from .local import LocalBackend
from .groq import GroqBackend
from .gemini import GeminiBackend

_registry = {
    "local_qwen3": LocalBackend(),
    "groq": GroqBackend(),
    "gemini": GeminiBackend()
}

def get_backend(name: str):
    if name not in _registry:
        raise ValueError(f"Unknown backend: {name}")
    return _registry[name]
