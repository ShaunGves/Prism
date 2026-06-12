from pydantic import BaseModel
from typing import Literal, List

class SubTask(BaseModel):
    id: str
    description: str
    sensitivity: Literal["high", "low"]
    complexity: Literal["low", "medium", "high"]
    backend: Literal["local_qwen3", "groq", "gemini"]
    depends_on: List[str] = []
    context_keys: List[str] = []   # IDs of prior tasks whose output this needs

class DecompositionResult(BaseModel):
    tasks: List[SubTask]
    synthesis_hint: str

class TaskResult(BaseModel):
    task_id: str
    output: str
    backend: str
    latency_ms: int
    cost_usd: float
    redacted_keys: List[str]
    token_count: int

class DecomposeRequest(BaseModel):
    query: str
    context: dict = {}
    temperature: float = 0.1

class HistorySaveRequest(BaseModel):
    session_id: str
    query: str
    context: dict = {}
    results: List[TaskResult] = []
    synthesis: str

