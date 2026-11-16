"""
Hosted Social Reader MCP endpoint (Vercel Python function).

Speaks MCP "Streamable HTTP" in stateless JSON mode, which is what claude.ai
custom connectors use. URL:  https://<project>.vercel.app/mcp/<MCP_TOKEN>

If the MCP_TOKEN env var is set, requests must use that secret in the path,
so only people with the full URL can use your connector.
"""

from __future__ import annotations

import base64
import hmac
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

os.environ.setdefault("SOCIAL_READER_DIR", "/tmp/social-reader")
os.environ.setdefault("SOCIAL_READER_HIDE_PATHS", "1")
os.environ.setdefault("SOCIAL_READER_MAX_VIDEO_MB", "60")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

import reader_core  # noqa: E402

SERVER_INFO = {"name": "social-reader", "version": "1.1.0"}
SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]
MAX_RESPONSE_BYTES = 3_500_000  # Vercel caps responses at 4.5 MB

TOOL = {
    "name": "read_social_link",
    "title": "Read tweet / thread / Instagram reel",
    "description": reader_core.TOOL_DESCRIPTION,
    "inputSchema": {
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "The x.com / twitter.com status link or instagram.com post/reel link."},
            "include_images": {"type": "boolean", "default": True, "description": "Return photos/thumbnails as images."},
            "video_frames": {"type": "integer", "default": 4, "minimum": 0, "maximum": 8,
                             "description": "Frames to sample from each video (0 = none)."},
        },
        "required": ["url"],
    },
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}

INSTRUCTIONS = ("Use read_social_link whenever the user shares an X/Twitter status link or an Instagram post/reel link, "
                "even without instructions. Returned images are the post's photos or frames sampled from its video.")


def _call_tool(args: dict) -> dict:
    url = str(args.get("url") or "").strip()
    if not url:
        return {"content": [{"type": "text", "text": "Missing `url`."}], "isError": True}
    frames = max(0, min(int(args.get("video_frames", 4) or 0), 8))
    parts = reader_core.read_social_link(url, bool(args.get("include_images", True)), frames, frames > 0)

    content, used, dropped = [], 0, 0
    for p in parts:
        if isinstance(p, reader_core.Image):
            b64 = base64.b64encode(p.data).decode()
            if used + len(b64) > MAX_RESPONSE_BYTES:
                dropped += 1
                continue
            used += len(b64)
            content.append({"type": "image", "data": b64, "mimeType": p.mime})
        else:
            used += len(p)
            content.append({"type": "text", "text": p})
    if dropped:
        content.append({"type": "text", "text": f"({dropped} more image(s) omitted to stay under the size limit.)"})
    return {"content": content, "isError": False}


def _handle(msg: dict) -> dict | None:
    method, mid = msg.get("method"), msg.get("id")
    if mid is None:  # notification
        return None
    try:
        if method == "initialize":
            requested = (msg.get("params") or {}).get("protocolVersion")
            result = {
                "protocolVersion": requested if requested in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0],
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
                "instructions": INSTRUCTIONS,
            }
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": [TOOL]}
        elif method == "tools/call":
            params = msg.get("params") or {}
            if params.get("name") != TOOL["name"]:
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": f"Unknown tool {params.get('name')}"}}
            try:
                result = _call_tool(params.get("arguments") or {})
            except Exception as e:  # report tool failures to the model, not as protocol errors
                traceback.print_exc()
                result = {"content": [{"type": "text", "text": f"Error reading link: {e}"}], "isError": True}
        elif method in ("resources/list", "prompts/list"):
            result = {method.split("/")[0]: []}
        else:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {method}"}}
        return {"jsonrpc": "2.0", "id": mid, "result": result}
    except Exception as e:
        traceback.print_exc()
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": str(e)}}


class handler(BaseHTTPRequestHandler):
    def _authorized(self) -> bool:
        # OAuth discovery probes (e.g. /.well-known/oauth-protected-resource/mcp/<token>) must get a 404,
        # or claude.ai thinks this server needs OAuth and refuses to add it as a connector.
        if "/.well-known/" in urlparse(self.path).path:
            return False
        secret = os.environ.get("MCP_TOKEN", "")
        if not secret:
            return True
        q = parse_qs(urlparse(self.path).query)
        token = (q.get("token") or [""])[0] or urlparse(self.path).path.rstrip("/").split("/")[-1]
        return hmac.compare_digest(token, secret)

    def _send(self, status: int, body: bytes = b"", ctype: str = "application/json", extra: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204)

    def do_GET(self):
        if not self._authorized():
            return self._send(404, b'{"error":"not found"}')
        accept = self.headers.get("Accept", "")
        if "text/event-stream" in accept:
            return self._send(405, b"", extra={"Allow": "POST"})  # stateless: no server-initiated stream
        self._send(200, json.dumps({"ok": True, "server": SERVER_INFO,
                                    "usage": "Add this URL as a custom connector in claude.ai."}).encode())

    def do_DELETE(self):
        self._send(405, b"", extra={"Allow": "POST"})

    def do_POST(self):
        if not self._authorized():
            return self._send(404, b'{"error":"not found"}')
        try:
            raw = self.rfile.read(int(self.headers.get("Content-Length") or 0))
            payload = json.loads(raw or b"null")
        except Exception:
            return self._send(400, json.dumps({"jsonrpc": "2.0", "id": None,
                                               "error": {"code": -32700, "message": "Parse error"}}).encode())
        if isinstance(payload, list):
            replies = [r for r in (_handle(m) for m in payload if isinstance(m, dict)) if r]
            body = replies if replies else None
        elif isinstance(payload, dict):
            body = _handle(payload)
        else:
            return self._send(400, b'{"error":"invalid request"}')
        if body is None:
            return self._send(202)
        self._send(200, json.dumps(body).encode())
