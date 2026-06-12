# Prism

Privacy-aware multi-model AI orchestration. Decomposes queries into parallel sub-tasks, routes each to the right backend based on sensitivity, executes them concurrently, and synthesizes a unified response.

![Demo](https://img.shields.io/badge/demo-live-brightgreen) ![Python](https://img.shields.io/badge/python-3.11+-blue) ![React](https://img.shields.io/badge/react-18-61dafb)

## What it does

1. **Decomposes** — breaks any query into 2-5 atomic parallel tasks with a dependency DAG
2. **Routes** — HIGH sensitivity (code, credentials, private data) → local model only. LOW sensitivity → Groq or Gemini
3. **Executes** — runs independent tasks in parallel, respecting dependencies
4. **Synthesizes** — merges all outputs into one coherent response

## Privacy Gate

Secrets (API keys, passwords, tokens) are redacted before any task leaves the machine. After synthesis, values are re-injected into the final output. The local model never sends your data to the cloud.

## Stack

| Layer | Tech |
|---|---|
| Local model | Qwen3.6-35B-A3B via llama.cpp (MoE CPU offload) |
| Fast inference | Groq (llama-3.3-70b-versatile) |
| Complex reasoning | Gemini 2.0 Flash |
| Backend | FastAPI + WebSockets + uvicorn |
| Frontend | React 18 + TypeScript + Vite |
| Storage | SQLite (session history + audit log) |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/POKEDB10/Prism.git
cd Prism
pip install -r requirements.txt
cd frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your API keys
```

```env
LLAMA_BASE_URL=http://localhost:11434/v1   # local llama-server
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### 3. Run local model (optional but recommended)

Download [llama.cpp](https://github.com/ggerganov/llama.cpp/releases) and [Qwen3.6-35B-A3B-IQ3_M.gguf](https://huggingface.co/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF).

```bash
# Windows one-click launcher
.\start-model.bat
```

Key flags for RTX 4060 (8GB VRAM):
```
--n-gpu-layers 99 --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 -ot ".ffn_.*_exps.=CPU"
```

The `-ot` flag offloads inactive MoE expert weights to CPU RAM — this is what makes a 35B model fit on 8GB VRAM.

### 4. Start Prism

```bash
# Backend
python -m uvicorn backend.main:app --reload

# Frontend (new terminal)
cd frontend && npm run dev
```

Open `http://localhost:3000`

Or use the all-in-one launcher:
```powershell
.\start-prism.ps1
```

## Modes

**Chat mode** — direct conversational interface, hits the local model, no decomposition

**Query mode** — full parallel pipeline: decompose → dispatch → synthesize with live DAG, task cards, audit log, and cost tracking

## API

OpenAI-compatible endpoint (works with Cursor, Continue.dev):
```
POST http://localhost:8000/v1/chat/completions
```

File analysis:
```
POST http://localhost:8000/analyze-file
```

## Lessons learned

- **Dependency graphs deadlock silently** — validate DAGs are acyclic before execution
- **Qwen3 `<think>` blocks break JSON parsers** — need both the API flag (`enable_thinking: false`) and a regex fallback
- **MoE models need the `-ot` flag** on consumer GPUs or they OOM immediately

## License

MIT
