import pytest
from backend.privacy import privacy_gate, re_inject
from backend.schema import SubTask

class MockTask:
    def __init__(self, backend: str):
        self.backend = backend

def test_privacy_gate_local():
    task = MockTask(backend="local_qwen3")
    context = {
        "api_key": "sk-123456789012345678901234567890123456789012345678",
        "nested": {
            "aws": "AKIAIOSFODNN7EXAMPLE"
        }
    }
    sanitized, redaction_map = privacy_gate(task, context)
    assert sanitized == context
    assert redaction_map == {}

def test_privacy_gate_external_redaction():
    task = MockTask(backend="gemini")
    context = {
        "secret_aws": "AKIAIOSFODNN7EXAMPLE",
        "secret_openai": "sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST123456",
        "conn": "postgres://user:password@localhost:5432/dbname",
        "bearer": "Bearer mytoken_with_enough_length_character_sequence_here",
        "safe_value": "hello world"
    }
    sanitized, redaction_map = privacy_gate(task, context)
    
    # Assert keys were redacted in sanitized context
    assert sanitized["secret_aws"] == "[AWS_KEY_1]"
    assert sanitized["secret_openai"] == "[OPENAI_KEY_2]"
    assert sanitized["conn"] == "[CONN_STR_3]"
    assert sanitized["bearer"] == "[BEARER_4]"
    assert sanitized["safe_value"] == "hello world"
    
    # Assert redaction map matches original values
    assert redaction_map["[AWS_KEY_1]"] == "AKIAIOSFODNN7EXAMPLE"
    assert redaction_map["[OPENAI_KEY_2]"] == "sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST123456"
    assert redaction_map["[CONN_STR_3]"] == "postgres://user:password@localhost:5432/dbname"
    assert redaction_map["[BEARER_4]"] == "Bearer mytoken_with_enough_length_character_sequence_here"

def test_re_injection():
    redaction_map = {
        "[AWS_KEY_1]": "AKIAIOSFODNN7EXAMPLE",
        "[OPENAI_KEY_2]": "sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST123456"
    }
    text = "Please check this key: [AWS_KEY_1] and that key: [OPENAI_KEY_2]."
    restored = re_inject(text, redaction_map)
    assert restored == "Please check this key: AKIAIOSFODNN7EXAMPLE and that key: sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST123456."
