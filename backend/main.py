import sys
import asyncio
import json
import time
import uuid
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from backend.decomp import decompose
from backend.dispatcher import PrismDispatcher
from backend.backends import get_backend
from backend.config import LLAMA_BASE_URL, GROQ_MODEL, GEMINI_MODEL
from backend.schema import DecompositionResult, SubTask, TaskResult, DecomposeRequest, HistorySaveRequest
from backend.db import init_db, save_session, get_history, delete_session
from backend.privacy import scan_content

# Apply Windows event loop policy to avoid issues on Windows platforms
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except AttributeError:
        pass

app = FastAPI(title="Prism Async Dispatch Engine")

# Add CORS middleware to support dashboard interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/health")
async def health():
    results = {}
    
    # 1. Check Local Qwen
    try:
        start = time.monotonic()
        local_url = f"{LLAMA_BASE_URL.rstrip('/')}/health"
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(local_url)
            # If standard /health is not found, verify completions endpoint instead
            if resp.status_code == 404:
                comp_url = f"{LLAMA_BASE_URL.rstrip('/')}/completions"
                resp = await client.post(comp_url, json={"prompt": "ping", "max_tokens": 1})
            
            resp.raise_for_status()
            latency = int((time.monotonic() - start) * 1000)
            results["local_qwen3"] = {"online": True, "latency_ms": latency}
    except Exception as e:
        results["local_qwen3"] = {"online": False, "latency_ms": 0, "error": str(e)}

    # 2. Check Groq
    try:
        start = time.monotonic()
        groq_backend = get_backend("groq")
        # Send a 1-token chat completion request
        async for _ in groq_backend.stream(prompt="ping", max_tokens=1):
            break
        latency = int((time.monotonic() - start) * 1000)
        results["groq"] = {"online": True, "latency_ms": latency}
    except Exception as e:
        results["groq"] = {"online": False, "latency_ms": 0, "error": str(e)}

    # 3. Check Gemini — use list_models (no tokens consumed)
    try:
        import google.generativeai as genai
        from backend.config import GEMINI_API_KEY
        if not GEMINI_API_KEY:
            results["gemini"] = {"online": False, "latency_ms": 0, "error": "API key not configured"}
        else:
            start = time.monotonic()
            def _list():
                for _ in genai.list_models():
                    break
            await asyncio.to_thread(_list)
            latency = int((time.monotonic() - start) * 1000)
            results["gemini"] = {"online": True, "latency_ms": latency}
    except Exception as e:
        results["gemini"] = {"online": False, "latency_ms": 0, "error": str(e)}

    return results

@app.post("/decompose", response_model=DecompositionResult)
async def api_decompose(req: DecomposeRequest):
    try:
        return await decompose(req.query, req.temperature)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decomposition failed: {str(e)}")

@app.post("/history")
async def api_save_history(req: HistorySaveRequest):
    try:
        results_dump = [r.model_dump() for r in req.results]
        await save_session(req.session_id, req.query, req.context, results_dump, req.synthesis)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save history: {str(e)}")

@app.get("/history")
async def api_get_history():
    try:
        return await get_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load history: {str(e)}")

@app.delete("/history/{session_id}")
async def api_delete_history(session_id: str):
    try:
        await delete_session(session_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete history: {str(e)}")

@app.get("/presets")
async def api_get_presets():
    return [
        {
            "id": "security_review",
            "label": "Security Review",
            "name": "Security Review",
            "query": "Review this Flask app for security vulnerabilities, write specific code fixes for each issue, and estimate the sprint effort to implement them",
            "context": {
                "code": """from flask import Flask, request, render_template_string
import sqlite3, os

app = Flask(__name__)
SECRET_KEY = 'hardcoded-secret-123'
AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'

@app.route('/user')
def get_user():
    user_id = request.args.get('id')
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute(f'SELECT * FROM users WHERE id = {user_id}')
    user = cursor.fetchone()
    return render_template_string(f'<h1>Hello {user[1]}</h1>')

@app.route('/admin')
def admin():
    if request.args.get('password') == 'admin123':
        return 'Welcome admin'
    return 'Access denied'
"""
            }
        },
        {
            "id": "api_design",
            "label": "API Design Review",
            "name": "API Design Review",
            "query": "Analyze this REST API design for architectural issues, suggest specific improvements with code examples, and estimate implementation complexity",
            "context": {
                "spec": "POST /api/user/create, POST /api/user/delete, POST /api/user/getAll, POST /api/getData?type=orders, GET /api/process"
            }
        },
        {
            "id": "perf_debug",
            "label": "Performance Debug",
            "name": "Performance Debug",
            "query": "Identify performance bottlenecks in this code, suggest optimized implementations, and estimate the performance gain from each fix",
            "context": {
                "code": """def get_user_orders(user_id):
    orders = []
    all_orders = db.query('SELECT * FROM orders')
    for order in all_orders:
        if order['user_id'] == user_id:
            user = db.query(f'SELECT * FROM users WHERE id = {order["user_id"]}')[0]
            items = db.query(f'SELECT * FROM items WHERE order_id = {order["id"]}')
            order['user'] = user
            order['items'] = items
            orders.append(order)
    return orders
"""
            }
        },
        {
            "id": "tech_debt",
            "label": "Tech Debt Audit",
            "name": "Tech Debt Audit",
            "query": "Identify the top technical debt issues in this codebase, prioritize them by business impact, and create a remediation roadmap with time estimates",
            "context": {
                "description": "Node.js monolith, 6 years old, 180k LOC, no tests, MySQL with raw queries, jQuery frontend, deployed manually via FTP, 3 developers maintaining it, 50k daily active users"
            }
        }
    ]


# ─── Secret Scanner ─────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    content: str
    filename: str = "unknown"


@app.post("/scan")
async def api_scan(req: ScanRequest):
    """Scan file content for secrets and return structured report."""
    return scan_content(req.content, req.filename)


# ─── Auto-scan: walk the working directory ──────────────────────────────────

import os
import pathlib

# File patterns that commonly contain secrets — ordered by risk
AUTO_SCAN_PATTERNS = [
    "**/.env",
    "**/.env.*",
    "**/config.yaml", "**/config.yml",
    "**/config.json",
    "**/settings.py", "**/settings/*.py",
    "**/secrets.yaml", "**/secrets.yml", "**/secrets.json",
    "**/*.pem", "**/*.key",
    "**/docker-compose.yml", "**/docker-compose.yaml",
    "**/.envrc",
    "**/application.properties", "**/application.yml",
    "**/terraform.tfvars", "**/*.tfvars",
    "**/Makefile",
]

# Directories to always skip
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".pytest_cache",
    "venv", ".venv", "env", "dist", "build", ".next",
    ".tox", "coverage", "htmlcov", ".mypy_cache",
}

MAX_FILE_SIZE_BYTES = 512 * 1024  # 512 KB — skip binary/large files
MAX_FILES = 100                   # safety cap


def _collect_auto_scan_files(root: pathlib.Path) -> list[pathlib.Path]:
    """Return list of candidate files relative to root, skipping ignored dirs."""
    seen: set[pathlib.Path] = set()
    for pattern in AUTO_SCAN_PATTERNS:
        try:
            for p in root.glob(pattern):
                # Skip if inside a blocked directory
                if any(part in SKIP_DIRS for part in p.parts):
                    continue
                if p.is_file() and p not in seen:
                    seen.add(p)
                    if len(seen) >= MAX_FILES:
                        return list(seen)
        except Exception:
            pass
    return list(seen)


@app.get("/scan/auto")
async def api_scan_auto(root: str = "."):
    """
    Automatically scan the working directory for secrets.
    Optional ?root=<path> to specify a subdirectory.
    Returns aggregated findings across all scanned files.
    """
    try:
        base = pathlib.Path(root).resolve()
        if not base.exists():
            raise HTTPException(status_code=400, detail=f"Path does not exist: {root}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    files = await asyncio.to_thread(_collect_auto_scan_files, base)

    file_results = []
    total_secrets = 0
    grand_summary = {"critical": 0, "high": 0, "medium": 0}

    for filepath in sorted(files):
        try:
            size = filepath.stat().st_size
            if size > MAX_FILE_SIZE_BYTES:
                continue  # skip large files silently
            content = filepath.read_text(encoding="utf-8", errors="ignore")
            rel = str(filepath.relative_to(base)).replace("\\", "/")
            result = scan_content(content, rel)
            if not result["safe"]:
                file_results.append(result)
                total_secrets += result["total"]
                for sev in ("critical", "high", "medium"):
                    grand_summary[sev] += result["summary"][sev]
        except Exception:
            continue  # skip unreadable files

    return {
        "root": str(base),
        "files_scanned": len(files),
        "files_with_secrets": len(file_results),
        "total_secrets": total_secrets,
        "safe": total_secrets == 0,
        "summary": grand_summary,
        "results": file_results,          # per-file ScanResult list
    }



PRE_COMMIT_SCRIPT = r"""#!/bin/sh
# Generated by Prism Secret Scanner
# Install: cp pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

PRISM_URL="${PRISM_URL:-http://localhost:8000}"
STAGED=$(git diff --cached --name-only)
FOUND=0

for FILE in $STAGED; do
  [ -f "$FILE" ] || continue
  CONTENT=$(python3 -c "import json,sys; print(json.dumps(open('$FILE').read()))" 2>/dev/null)
  [ -z "$CONTENT" ] && continue
  
  RESULT=$(curl -sf -X POST "$PRISM_URL/scan" \
    -H "Content-Type: application/json" \
    -d "{\"content\": $CONTENT, \"filename\": \"$FILE\"}" 2>/dev/null)
  
  [ -z "$RESULT" ] && continue
  
  SAFE=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(d['safe']).lower())")
  
  if [ "$SAFE" = "false" ]; then
    echo "PRISM GUARD: Secrets detected in $FILE"
    echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['secrets_found']:
    print(f'  [{s[\"severity\"].upper()}] Line {s[\"line\"]}: {s[\"type\"]} ({s[\"preview\"]})')
print(f'  Total: {d[\"total\"]} secret(s) found. Commit blocked.')
"
    FOUND=1
  fi
done

[ $FOUND -eq 1 ] && echo "" && echo "Scan with Prism before committing: $PRISM_URL" && exit 1
exit 0
"""


@app.get("/scan/hook")
async def api_scan_hook():
    """Download the Prism pre-commit git hook shell script."""
    from fastapi.responses import Response
    return Response(
        content=PRE_COMMIT_SCRIPT,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=\"pre-commit\""},
    )


PRE_PUSH_SCRIPT = r"""#!/bin/sh
# Generated by Prism Secret Scanner — pre-push hook
# Intercepts: git push (scans ALL commits being pushed, not just staged files)
#
# Install:
#   cp pre-push .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# Override server URL:
#   export PRISM_URL=http://localhost:8000

PRISM_URL="${PRISM_URL:-http://localhost:8000}"
REMOTE="$1"
FOUND=0

# Git passes lines of: <local_ref> <local_sha> <remote_ref> <remote_sha>
while read LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA; do
  # Skip branch deletion pushes
  [ "$LOCAL_SHA" = "0000000000000000000000000000000000000000" ] && continue

  # Range of new commits being pushed
  if [ "$REMOTE_SHA" = "0000000000000000000000000000000000000000" ]; then
    # New branch — compare against the initial commit
    RANGE="$LOCAL_SHA"
    FILES=$(git diff-tree --no-commit-id -r --name-only "$LOCAL_SHA" 2>/dev/null)
  else
    RANGE="$REMOTE_SHA..$LOCAL_SHA"
    # All files touched in any commit within the range
    FILES=$(git diff --name-only "$REMOTE_SHA" "$LOCAL_SHA" 2>/dev/null)
  fi

  for FILE in $FILES; do
    [ -f "$FILE" ] || continue

    # Read file at HEAD (current working tree)
    CONTENT=$(python3 -c "import json,sys; print(json.dumps(open('$FILE').read()))" 2>/dev/null)
    [ -z "$CONTENT" ] && continue

    RESULT=$(curl -sf -X POST "$PRISM_URL/scan" \
      -H "Content-Type: application/json" \
      -d "{\"content\": $CONTENT, \"filename\": \"$FILE\"}" 2>/dev/null)

    [ -z "$RESULT" ] && continue

    SAFE=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(d['safe']).lower())")

    if [ "$SAFE" = "false" ]; then
      echo ""
      echo "╔══════════════════════════════════════════════════════════╗"
      echo "║  PRISM GUARD — PUSH BLOCKED: Secrets detected            ║"
      echo "╠══════════════════════════════════════════════════════════╣"
      echo "║  File: $FILE"
      echo "$RESULT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['secrets_found']:
    sev = s['severity'].upper()
    print(f\"  [{sev}] Line {s['line']}: {s['type']} → {s['preview']}\")
print(f\"  Total: {d['total']} secret(s) found.\")
"
      echo "╚══════════════════════════════════════════════════════════╝"
      echo ""
      echo "  Fix the secrets above before pushing."
      echo "  Scan in browser: $PRISM_URL"
      echo ""
      FOUND=1
    fi
  done
done

[ $FOUND -eq 1 ] && exit 1
exit 0
"""


@app.get("/scan/hook/push")
async def api_scan_hook_push():
    """Download the Prism pre-push git hook shell script."""
    from fastapi.responses import Response
    return Response(
        content=PRE_PUSH_SCRIPT,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=\"pre-push\""},
    )



# ─── File Upload Analysis ────────────────────────────────────────────────────

ALLOWED_UPLOAD_EXTENSIONS = {
    ".txt", ".py", ".js", ".ts", ".md", ".json",
    ".yaml", ".yml", ".csv", ".env", ".jsx", ".tsx",
}

SUGGESTED_QUERIES = {
    ".py": "Review this Python code for bugs, security vulnerabilities, and best practice violations.",
    ".js": "Review this JavaScript code for security issues, bugs, and performance problems.",
    ".ts": "Review this TypeScript code for type safety issues, bugs, and architectural concerns.",
    ".jsx": "Review this React JSX code for bugs, accessibility issues, and performance problems.",
    ".tsx": "Review this React TypeScript code for type safety, bugs, and component architecture issues.",
    ".env": "Verify if any sensitive credentials are present and whether this configuration is secure for production.",
    ".json": "Analyze this JSON configuration file for security misconfigurations and sensitive data exposure.",
    ".yaml": "Analyze this YAML configuration for security misconfigurations, sensitive values, and best practices.",
    ".yml": "Analyze this YAML configuration for security misconfigurations, sensitive values, and best practices.",
    ".md": "Summarize the key points in this document and identify any action items or technical concerns.",
    ".csv": "Analyze the structure and content of this CSV data and identify any data quality or privacy concerns.",
    ".txt": "Analyze this text file and summarize its contents, identifying any action items or important information.",
}


# ─── Direct Chat Endpoint ────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = (
    "You are Prism, a helpful and concise AI assistant. "
    "Respond naturally and conversationally. Do not use XML tags, "
    "<think> blocks, or special markup. Just talk."
)


class ChatDirectRequest(BaseModel):
    message: str
    history: list = []   # list of {"role": "user"|"assistant", "content": str}


@app.post("/chat")
async def chat_direct(req: ChatDirectRequest):
    """
    Direct conversational chat — bypasses the decomposition pipeline entirely.
    Used by Chat mode in the frontend.
    Streams the local model's response as SSE.
    """
    import re as _re

    # Build message list with system prompt
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    for h in req.history[-20:]:          # keep last 20 messages for context
        role = h.get("role", "user")
        content = h.get("content", "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.message})

    url = f"{LLAMA_BASE_URL.rstrip('/')}/chat/completions"

    async def event_stream():
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", url, json={
                    "model": "qwen3",
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.7,
                    "chat_template_kwargs": {"enable_thinking": False},
                }) as resp:
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: ") or "[DONE]" in line:
                            continue
                        try:
                            data = json.loads(line[6:])
                            chunk = data["choices"][0].get("delta", {}).get("content", "")
                            # Belt-and-suspenders: strip any leaked think tokens
                            chunk = _re.sub(r"</?think>", "", chunk)
                            if chunk:
                                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                        except Exception:
                            pass
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/analyze-file")
async def api_analyze_file(file: UploadFile = File(...)):
    """
    Accept a file upload, scan for secrets, return scan results + text content.
    Supports: .txt .py .js .ts .md .json .yaml .yml .csv .env
    """
    import pathlib

    ext = pathlib.Path(file.filename or "unknown").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}"
        )

    raw_bytes = await file.read()

    # Enforce size limit (512 KB)
    if len(raw_bytes) > 512 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 512 KB.")

    try:
        text_content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File appears to be binary. Only text-based files are supported.")

    scan_result = scan_content(text_content, file.filename or "uploaded_file")
    suggested_query = SUGGESTED_QUERIES.get(ext, f"Analyze this {ext or 'text'} file and summarize its key contents.")

    return {
        "filename": file.filename,
        "text_content": text_content,
        "safe": scan_result["safe"],
        "scan_result": scan_result,
        "suggested_query": suggested_query,
    }


# ─── OpenAI-Compatible Endpoint ─────────────────────────────────────────────

from typing import Optional, List as TypingList
from fastapi import Request
from fastapi.responses import StreamingResponse


class OpenAIChatMessage(BaseModel):
    role: str
    content: str

class OpenAIChatRequest(BaseModel):
    model: str = "prism"
    messages: TypingList[OpenAIChatMessage]
    stream: bool = False
    temperature: float = 0.1
    max_tokens: Optional[int] = None


@app.post("/v1/chat/completions")
async def openai_chat_completions(request: OpenAIChatRequest):
    """
    OpenAI-compatible chat completions endpoint.
    Routes through the full Prism pipeline (decompose → dispatch → synthesize).
    Supports streaming via SSE (stream=true) compatible with Cursor and Continue.dev.
    """
    from backend.openai_compat import run_pipeline_http, run_pipeline_streaming
    import re

    sid = str(uuid.uuid4())
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    settings = {"temperature": request.temperature}
    if request.max_tokens:
        settings["max_tokens"] = request.max_tokens

    def strip_tags(text: str) -> str:
        return re.sub(r"<\/?(t\d+|synthesis)>", "", text)

    if request.stream:
        # SSE streaming response — compatible with Cursor/Continue.dev
        async def event_stream():
            try:
                async for chunk in run_pipeline_streaming(messages, settings, sid):
                    clean = strip_tags(chunk)
                    if not clean:
                        continue
                    payload = {
                        "id": f"prism-{sid[:8]}",
                        "object": "chat.completion.chunk",
                        "model": "prism",
                        "choices": [{
                            "index": 0,
                            "delta": {"content": clean},
                            "finish_reason": None,
                        }],
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
                # Final done message
                final = {
                    "id": f"prism-{sid[:8]}",
                    "object": "chat.completion.chunk",
                    "model": "prism",
                    "choices": [{
                        "index": 0,
                        "delta": {},
                        "finish_reason": "stop",
                    }],
                }
                yield f"data: {json.dumps(final)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                err_payload = {"error": {"message": str(e), "type": "server_error"}}
                yield f"data: {json.dumps(err_payload)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            }
        )

    else:
        # Non-streaming — run pipeline and return complete response
        try:
            synthesis, audit_results = await run_pipeline_http(messages, settings, sid)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Prism pipeline error: {str(e)}")

        clean_synthesis = strip_tags(synthesis)
        total_tokens = sum(r.token_count for r in audit_results)

        return {
            "id": f"prism-{sid[:8]}",
            "object": "chat.completion",
            "model": "prism",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": clean_synthesis,
                },
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": total_tokens,
                "total_tokens": total_tokens,
            },
        }


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    session_id = None
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "query":
                session_id = msg.get("session_id") or str(uuid.uuid4())
                
                async def send(event: dict):
                    if "session_id" not in event:
                        event["session_id"] = session_id
                    await websocket.send_text(json.dumps(event))

                try:
                    # Check for client decomposition overrides
                    override = msg.get("decomp_override")
                    if override and "tasks" in override:
                        decomp = DecompositionResult(
                            tasks=[SubTask(**t) for t in override["tasks"]],
                            synthesis_hint=override.get("synthesis_hint", "Combine results")
                        )
                    else:
                        temp = msg.get("settings", {}).get("temperature", 0.1)
                        decomp = await decompose(msg["query"], temperature=temp)

                    # Build user_context including settings
                    user_context = {
                        **msg.get("context", {}),
                        "settings": msg.get("settings", {})
                    }

                    dispatcher = PrismDispatcher(ws_send=send, session_id=session_id)
                    await dispatcher.run(decomp, user_context)
                except Exception as e:
                    print(f"Execution failed for query in session {session_id}: {e}")
                    await send({
                        "type": "error",
                        "message": f"Execution error: {str(e)}",
                        "session_id": session_id
                    })
    except WebSocketDisconnect:
        print(f"WebSocket client disconnected gracefully. Session: {session_id}")
    except Exception as e:
        print(f"WS Exception in session {session_id}: {e}")
