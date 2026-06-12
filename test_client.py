import asyncio
import json
import websockets

async def run_client():
    uri = "ws://localhost:8000/ws"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            
            # Send sample query with sensitive context (OpenAI API key) to trigger privacy gate
            query_payload = {
                "type": "query",
                "query": "Review this Flask app for security holes, suggest fixes, estimate refactor effort",
                "context": {
                    "code": """
from flask import Flask, request
app = Flask(__name__)

# Sensitive configuration credentials
OPENAI_KEY = "sk-123456789012345678901234567890123456789012345678"
AWS_SECRET = "AKIAIOSFODNN7EXAMPLE"

@app.route('/user')
def get_user():
    username = request.args.get('name')
    # Vulnerable to XSS
    return f"<h1>Hello {username}</h1>"
"""
                }
            }
            
            print(f"Sending query: {query_payload['query']}")
            await websocket.send(json.dumps(query_payload))
            
            # Read responses
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "decomp_complete":
                    print(f"\n--- Query Decomposed into {len(data['tasks'])} tasks ---")
                    for task in data["tasks"]:
                        print(f" - [{task['id']}] (Backend: {task['backend']}, Sensitivity: {task['sensitivity']}) {task['description']}")
                
                elif msg_type == "task_start":
                    print(f"\n[{data['task_id']}] Started task on {data['backend']}. Redacted {data['redacted_count']} keys: {data['redacted_keys']}")
                
                elif msg_type == "task_chunk":
                    # Print chunks as they stream in
                    print(data["chunk"], end="", flush=True)
                
                elif msg_type == "task_complete":
                    print(f"\n[{data['task_id']}] Completed (Latency: {data['latency_ms']}ms)")
                
                elif msg_type == "synthesis_start":
                    print("\n\n--- Synthesis Started (combining all task outputs locally via local_qwen3) ---")
                
                elif msg_type == "synthesis_chunk":
                    print(data["chunk"], end="", flush=True)
                
                elif msg_type == "synthesis_complete":
                    print("\n\n--- Synthesis Completed ---")
                    print("\n--- Audit Log ---")
                    for result in data["audit"]:
                        print(f"Task {result['task_id']} ({result['backend']}): Cost: ${result['cost_usd']:.6f}, Latency: {result['latency_ms']}ms, Redacted: {result['redacted_keys']}")
                    break
    except Exception as e:
        print(f"Client error: {e}")

if __name__ == "__main__":
    asyncio.run(run_client())
