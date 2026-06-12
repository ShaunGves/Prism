import pytest
from unittest.mock import AsyncMock, patch
from backend.decomp import decompose
from backend.schema import DecompositionResult

@pytest.mark.asyncio
async def test_decompose_success():
    mock_response_data = {
      "choices": [
        {
          "message": {
            "content": """
```json
{
  "tasks": [
    {
      "id": "t1",
      "description": "Scan Flask app",
      "sensitivity": "high",
      "complexity": "medium",
      "backend": "local_qwen3",
      "depends_on": [],
      "context_keys": []
    }
  ],
  "synthesis_hint": "Combine results"
}
```
"""
          }
        }
      ]
    }

    from unittest.mock import MagicMock
    mock_resp = MagicMock()
    mock_resp.json.return_value = mock_response_data
    mock_resp.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        result = await decompose("Review codebase")
        assert isinstance(result, DecompositionResult)
        assert len(result.tasks) == 1
        assert result.tasks[0].id == "t1"
        assert result.tasks[0].backend == "local_qwen3"
        assert result.synthesis_hint == "Combine results"
        mock_post.assert_called_once()
