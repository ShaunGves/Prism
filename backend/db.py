import json
import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prism_history.db")

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS history (
                session_id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                context TEXT,
                results TEXT,
                synthesis TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()

async def save_session(session_id: str, query: str, context: dict, results: list, synthesis: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO history (session_id, query, context, results, synthesis) VALUES (?, ?, ?, ?, ?)",
            (session_id, query, json.dumps(context), json.dumps(results), synthesis)
        )
        await db.commit()

async def get_history() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT 20") as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "session_id": row["session_id"],
                    "query": row["query"],
                    "context": json.loads(row["context"] or "{}"),
                    "results": json.loads(row["results"] or "[]"),
                    "synthesis": row["synthesis"],
                    "created_at": row["created_at"]
                }
                for row in rows
            ]

async def delete_session(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM history WHERE session_id = ?", (session_id,))
        await db.commit()
