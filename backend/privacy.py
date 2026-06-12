import re
import copy

PATTERNS = {
    "AWS_KEY":         r"AKIA[0-9A-Z]{16}",
    "OPENAI_KEY":      r"sk-[A-Za-z0-9]{32,}",
    "GITHUB_PAT":      r"ghp_[A-Za-z0-9]{36,}",
    "BEARER":          r"Bearer\s+[A-Za-z0-9\-._~+/]{20,}",
    "CONN_STR":        r"(?:mongodb|postgres|mysql|redis):\/\/[^\s\"']+",
    "API_KEY_GENERIC": r"(?:api[_-]?key|api[_-]?secret|access[_-]?token)[\"'\s:=]+([A-Za-z0-9_\-]{20,})",
    # New patterns
    "SECRET_KEY":    r"(?:SECRET_KEY|DJANGO_SECRET)[\"'\s:=]+([A-Za-z0-9_\-]{20,})",
    "JWT_SECRET":    r"(?:JWT_SECRET|JWT_KEY)[\"'\s:=]+([A-Za-z0-9_\-]{20,})",
    "DB_PASSWORD":   r"(?:DB_PASS(?:WORD)?|POSTGRES_PASSWORD|MYSQL_PASSWORD)[\"'\s:=]+(\S+)",
    "DATABASE_URL":  r"(?:DATABASE_URL|DB_URL)[\"'\s:=]+((?:postgres|mysql|mongodb|redis):\/\/[^\s]+)",
    "PRIVATE_KEY":   r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----",
    "STRIPE_KEY":    r"(?:sk_live_|sk_test_)[A-Za-z0-9]{24,}",
    "SLACK_TOKEN":   r"xox[baprs]-[A-Za-z0-9\-]+",
    "DISCORD_TOKEN": r"[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}",
    "FIREBASE":      r"AIza[0-9A-Za-z\-_]{35}",
    "TWILIO":        r"SK[0-9a-fA-F]{32}",
    "SENDGRID":      r"SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}",
}

SEVERITY = {
    "AWS_KEY": "critical", "OPENAI_KEY": "critical",
    "PRIVATE_KEY": "critical", "STRIPE_KEY": "critical",
    "GITHUB_PAT": "critical", "DATABASE_URL": "high",
    "DB_PASSWORD": "high", "JWT_SECRET": "high",
    "SECRET_KEY": "high", "BEARER": "high",
    "CONN_STR": "high", "SENDGRID": "high",
    "SLACK_TOKEN": "medium", "DISCORD_TOKEN": "medium",
    "FIREBASE": "medium", "TWILIO": "medium",
    "API_KEY_GENERIC": "medium",
}


def privacy_gate(task, context: dict) -> tuple[dict, dict]:
    """Returns (sanitized_context, redaction_map)."""
    if task.backend == "local_qwen3":
        return context, {}  # nothing leaves the machine, no redaction needed

    sanitized = copy.deepcopy(context)
    redaction_map: dict[str, str] = {}  # placeholder → original
    n = [0]

    def redact(s: str) -> str:
        all_matches = []
        for label, pattern in PATTERNS.items():
            for match in re.finditer(pattern, s, re.IGNORECASE):
                span = match.span(1) if match.groups() and match.group(1) is not None else match.span(0)
                all_matches.append((span[0], span[1], label, s[span[0]:span[1]]))

        if not all_matches:
            return s

        # Sort matches by start position asc, then by length desc
        all_matches.sort(key=lambda x: (x[0], -(x[1] - x[0])))

        filtered_matches = []
        last_end = 0
        for start, end, label, val in all_matches:
            if start >= last_end:
                filtered_matches.append((start, end, label, val))
                last_end = end

        new_s = []
        last_idx = 0
        for start, end, label, val in filtered_matches:
            new_s.append(s[last_idx:start])
            if val not in redaction_map.values():
                n[0] += 1
                placeholder = f"[{label}_{n[0]}]"
                redaction_map[placeholder] = val
            else:
                placeholder = [k for k, v in redaction_map.items() if v == val][0]
            new_s.append(placeholder)
            last_idx = end
        new_s.append(s[last_idx:])
        return "".join(new_s)

    def walk(obj):
        if isinstance(obj, str):
            return redact(obj)
        if isinstance(obj, dict):
            return {k: walk(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [walk(i) for i in obj]
        return obj

    return walk(sanitized), redaction_map


def re_inject(text: str, redaction_map: dict) -> str:
    if not redaction_map:
        return text
    sorted_keys = sorted(redaction_map.keys(), key=len, reverse=True)
    pattern = re.compile("|".join(re.escape(k) for k in sorted_keys))
    return pattern.sub(lambda m: redaction_map[m.group(0)], text)


def scan_content(content: str, filename: str) -> dict:
    """
    Scan file content for secrets line-by-line.
    Returns a structured report with matches, severity counts, and safe flag.
    """
    lines = content.split("\n")
    secrets_found = []
    counters: dict[str, int] = {}  # label -> occurrence count for placeholder numbering

    for line_num, line in enumerate(lines, start=1):
        line_matches = []
        for label, pattern in PATTERNS.items():
            for match in re.finditer(pattern, line, re.IGNORECASE):
                # Extract the captured group value if present, else full match
                if match.groups() and match.group(1) is not None:
                    matched_val = match.group(1)
                else:
                    matched_val = match.group(0)

                # Deduplicate: skip if same type+value already recorded on this line
                already = any(
                    s["type"] == label and s["preview"] == (matched_val[:6] + "***" if len(matched_val) > 6 else matched_val)
                    for s in line_matches
                )
                if already:
                    continue

                counters[label] = counters.get(label, 0) + 1
                placeholder = f"[{label}_{counters[label]}]"
                preview = (matched_val[:6] + "***") if len(matched_val) > 6 else matched_val

                line_matches.append({
                    "type": label,
                    "line": line_num,
                    "preview": preview,
                    "placeholder": placeholder,
                    "severity": SEVERITY.get(label, "medium"),
                })

        secrets_found.extend(line_matches)

    # Build summary counts
    summary = {"critical": 0, "high": 0, "medium": 0}
    for s in secrets_found:
        sev = s["severity"]
        if sev in summary:
            summary[sev] += 1

    return {
        "filename": filename,
        "secrets_found": secrets_found,
        "total": len(secrets_found),
        "safe": len(secrets_found) == 0,
        "summary": summary,
    }
