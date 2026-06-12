import pytest
from backend.privacy import scan_content


def test_scan_safe_content():
    """Clean content returns safe=True and empty findings."""
    content = "# Just a comment\nport = 8080\nhost = localhost\n"
    result = scan_content(content, "config.yaml")
    assert result["safe"] is True
    assert result["total"] == 0
    assert result["secrets_found"] == []
    assert result["summary"] == {"critical": 0, "high": 0, "medium": 0}


def test_scan_aws_key():
    """AWS key is detected as critical severity."""
    content = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n"
    result = scan_content(content, ".env")
    assert result["safe"] is False
    assert result["total"] >= 1
    types = [s["type"] for s in result["secrets_found"]]
    assert "AWS_KEY" in types
    aws_finding = next(s for s in result["secrets_found"] if s["type"] == "AWS_KEY")
    assert aws_finding["severity"] == "critical"
    assert aws_finding["line"] == 1
    # preview should be first 6 chars + ***
    assert aws_finding["preview"].endswith("***")
    assert len(aws_finding["preview"]) <= 9  # 6 + 3


def test_scan_multiple_secrets():
    """Multiple secrets across multiple lines are all detected."""
    content = (
        "SECRET_KEY='mysupersecretdjangokeyhere1234'\n"
        "DATABASE_URL=postgres://user:pass@host/db\n"
        "STRIPE_KEY=sk_live_FAKE_TEST_VALUE_NOT_REAL\n"
    )
    result = scan_content(content, ".env")
    assert result["safe"] is False
    types = [s["type"] for s in result["secrets_found"]]
    assert "SECRET_KEY" in types
    assert "DATABASE_URL" in types
    assert "STRIPE_KEY" in types


def test_scan_line_numbers():
    """Line numbers in findings match the actual source line."""
    content = "NORMAL=value\nSECRET_KEY=thisisasecretkey1234567890\nANOTHER=line\n"
    result = scan_content(content, "config.env")
    secret_key_finding = next(
        (s for s in result["secrets_found"] if s["type"] == "SECRET_KEY"), None
    )
    assert secret_key_finding is not None
    assert secret_key_finding["line"] == 2


def test_scan_summary_counts():
    """Summary counts are accurate per severity level."""
    content = (
        "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n"  # critical
        "SECRET_KEY='hardcoded-secret-123456'\n"       # high
        "SLACK_TOKEN=xoxb-my-slack-token-here\n"       # medium
    )
    result = scan_content(content, ".env")
    assert result["summary"]["critical"] >= 1
    assert result["summary"]["high"] >= 1
    assert result["summary"]["medium"] >= 1


def test_scan_placeholder_format():
    """Placeholder format is [TYPE_N] where N starts at 1."""
    content = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n"
    result = scan_content(content, ".env")
    assert result["safe"] is False
    finding = result["secrets_found"][0]
    assert finding["placeholder"].startswith("[")
    assert finding["placeholder"].endswith("]")
    assert "_1]" in finding["placeholder"]


def test_scan_private_key():
    """PEM private key header is detected."""
    content = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n"
    result = scan_content(content, "private.pem")
    assert result["safe"] is False
    types = [s["type"] for s in result["secrets_found"]]
    assert "PRIVATE_KEY" in types
    pk = next(s for s in result["secrets_found"] if s["type"] == "PRIVATE_KEY")
    assert pk["severity"] == "critical"
