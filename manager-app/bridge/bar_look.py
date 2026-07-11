#!/usr/bin/env python3
"""Live "check in on the bar" for the manager dashboard.

The dashboard's "Look now" button writes a luna_messages control row whose content == CMD. The
bridge routes that row here (one `elif` in process_pending): we pull LIVE snapshots from the
customer-facing cameras, describe each with the LOCAL vision model, and post the digest back as
Luna's reply. The dashboard card shows that reply.

This is why a plain chat message can't do it: the bridge's normal Q&A path is text-only and the
knowledge pack forbids tools. This module IS the tool — it runs on PC1, reaches the cameras via
the owner cloud connector (transport), and keeps perception LOCAL (qwen2.5vl). Digest-only:
frames live in memory for the VLM call and are dropped. Full-room scope, no name-level ID.
"""
import os
import json
import base64
import urllib.request

CMD = "__look_at_bar__"  # sentinel the dashboard "Look now" button writes to luna_messages

_ENV = os.path.expanduser("~/.local-agent/luna-api.env")
OLLAMA = os.environ.get("OLLAMA_BASE", "http://localhost:11434")
VLM = os.environ.get("VISION_MODEL", "qwen2.5vl:7b")

# Customer-facing cameras, friendly names, in the order a manager cares about. A fast subset (a
# full 13-cam sweep would block the bridge poll too long) — the floor, patio, lottery, and bar.
CAMS = [
    ("Front dining", "63e400870398c403e7000542"),   # West Dining South
    ("Back dining", "63e402a303a6c403e700056c"),     # East Dining North
    ("Patio / fire pit", "64779932014fee03e4052212"),
    ("Lottery room", "6a308e4000494003e4113d8a"),
    ("The bar", "63e43c6702895603e4000552"),         # Beverage area
]


def _creds():
    key = os.environ.get("BAR_EYE_OWNER_KEY")
    cid = os.environ.get("BAR_EYE_CONSOLE_ID")
    if key and cid:
        return key, cid
    try:
        for line in open(_ENV):
            line = line.strip()
            if line.startswith("BAR_EYE_OWNER_KEY=") and not key:
                key = line.split("=", 1)[1]
            elif line.startswith("BAR_EYE_CONSOLE_ID=") and not cid:
                cid = line.split("=", 1)[1]
    except Exception:
        pass
    return key, cid


def _snapshot(base, key, cid):
    req = urllib.request.Request(f"{base}/cameras/{cid}/snapshot", headers={"X-API-KEY": key})
    with urllib.request.urlopen(req, timeout=30) as x:
        return x.read()


def _vlm(jpg, name):
    p = (f"This is a live security-camera view of the '{name}' area of a bar/restaurant. In ONE short "
         "sentence: roughly how many people are there and the vibe (busy / steady / quiet). Be natural "
         "and specific. Do not name or identify anyone.")
    body = json.dumps({"model": VLM, "prompt": p, "images": [base64.b64encode(jpg).decode()],
                       "stream": False, "options": {"temperature": 0}}).encode()
    req = urllib.request.Request(OLLAMA + "/api/generate", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as x:
        return json.loads(x.read()).get("response", "").strip()


def look_at_bar() -> str:
    key, cid = _creds()
    if not key or not cid:
        return "I can't reach the cameras right now — the owner key isn't configured on this host."
    base = f"https://api.ui.com/v1/connector/consoles/{cid}/protect/api"
    lines = []
    for name, c in CAMS:
        try:
            lines.append(f"• {name}: {_vlm(_snapshot(base, key, c), name) or '(no read)'}")
        except Exception as e:
            lines.append(f"• {name}: (couldn't see it — {e})")
    return "Here's the bar right now:\n" + "\n".join(lines)


def handle(conn, qid) -> None:
    """Bridge routes a CMD control row here: run the look, post Luna's reply, close the row.
    Mirrors handle_question's reply-insert; self-contained so the bridge edit stays 2 lines."""
    try:
        digest = look_at_bar()
    except Exception as e:
        digest = f"I tried to look at the bar but hit an error: {e}"
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO luna_messages (role, content, reply_to, status) "
            "VALUES ('luna', %s, %s, 'answered')",
            (digest, qid),
        )
        cur.execute("UPDATE luna_messages SET status = 'answered' WHERE id = %s", (qid,))
    conn.commit()
