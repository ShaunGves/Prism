import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    # Mock decomposition result
    decomp_result = {
        "tasks": [
            {
                "id": "t1",
                "description": "Scan the provided Flask source code for security vulnerabilities (SQLi, XSS, auth issues, exposed secrets)",
                "sensitivity": "high",
                "complexity": "medium",
                "backend": "local_qwen3",
                "depends_on": [],
                "context_keys": []
            },
            {
                "id": "t2",
                "description": "Write specific code fixes for each identified vulnerability",
                "sensitivity": "high",
                "complexity": "high",
                "backend": "local_qwen3",
                "depends_on": ["t1"],
                "context_keys": ["t1"]
            },
            {
                "id": "t3",
                "description": "Estimate sprint story points and effort breakdown for implementing the fixes",
                "sensitivity": "low",
                "complexity": "medium",
                "backend": "groq",
                "depends_on": ["t1"],
                "context_keys": ["t1"]
            }
        ],
        "synthesis_hint": "Combine vulnerability report, fix implementations, and effort estimate into a unified engineering report"
    }
    
    response_data = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps(decomp_result)
                }
            }
        ]
    }
    return response_data

@app.post("/v1/completions")
async def completions(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    
    async def event_generator():
        # Yield streaming chunks depending on prompt context
        if "Combine these results" in prompt:
            chunks = [
                "Synthesis Report:\n\n",
                "1. Vulnerabilities identified in t1: Hardcoded credentials (AWS_SECRET) and XSS.\n",
                "2. Recommended fixes from t2: Use environment variables, and escape HTML inputs.\n",
                "3. Effort estimate from t3: Estimated 3 story points.\n\n",
                "Summary: The application requires quick configuration upgrades to secure endpoints."
            ]
        elif "Scan the provided Flask source code" in prompt:
            chunks = [
                "Vulnerability Scan Results:\n",
                "- Found AWS_SECRET exposed key: AKIAIOSFODNN7EXAMPLE\n",
                "- Found XSS vulnerability in /user endpoint rendering unescaped username.\n"
            ]
        elif "Write specific code fixes" in prompt:
            chunks = [
                "Code Fix Suggestions:\n",
                "1. Redact AWS_SECRET: load from environment config.\n",
                "2. Escape user inputs using html.escape() or Jinja templates.\n"
            ]
        else:
            chunks = [
                f"Processing task with prompt context length {len(prompt)}...\n",
                "Generated sample output for task backend logic.\n"
            ]
            
        for chunk in chunks:
            data = {"choices": [{"text": chunk}]}
            yield f"data: {json.dumps(data)}\n"
            await asyncio.sleep(0.1)
        yield "data: [DONE]\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8090)
