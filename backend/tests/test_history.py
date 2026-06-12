import pytest
import os
from backend.db import init_db, save_session, get_history, delete_session, DB_PATH

async def test_db_lifecycle():
    # Clear any leftover DB file
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    await init_db()
    
    session_id = "test-session-123"
    query = "Test query prompt"
    context = {"code": "def hello(): pass"}
    results = [{
        "task_id": "t1",
        "output": "sample output",
        "backend": "local_qwen3",
        "latency_ms": 120,
        "cost_usd": 0.0,
        "redacted_keys": [],
        "token_count": 3
    }]
    synthesis = "This is a local compilation."
    
    await save_session(session_id, query, context, results, synthesis)
    
    records = await get_history()
    assert len(records) == 1
    assert records[0]["session_id"] == session_id
    assert records[0]["query"] == query
    assert records[0]["context"] == context
    assert records[0]["results"] == results
    assert records[0]["synthesis"] == synthesis
    
    await delete_session(session_id)
    records_after = await get_history()
    assert len(records_after) == 0
