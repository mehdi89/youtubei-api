#!/usr/bin/env python3
"""Lightweight YouTube proxy server for extra servers (no dependencies)."""

import json
import http.server
import urllib.request
import os
import sys

PORT = int(os.environ.get("PROXY_PORT", 8080))
SECRET = os.environ.get("PROXY_SECRET", "")

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "googlevideo.com", "www.googlevideo.com"}


def is_allowed(url):
    try:
        from urllib.parse import urlparse
        host = urlparse(url).hostname or ""
        return any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS)
    except Exception:
        return False


class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/fetch":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if SECRET and body.get("secret") != SECRET:
            self.send_error(401, "Unauthorized")
            return

        url = body.get("url", "")
        if not url or not is_allowed(url):
            self.send_error(400, "Invalid or disallowed URL")
            return

        headers = body.get("headers", {})
        req = urllib.request.Request(url, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read().decode("utf-8", errors="replace")
                content_type = resp.headers.get("Content-Type", "text/plain")
                result = json.dumps({"status": resp.status, "body": data, "contentType": content_type})
        except urllib.error.HTTPError as e:
            result = json.dumps({"status": e.code, "body": "", "contentType": "text/plain"})
        except Exception as e:
            self.send_error(502, str(e))
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(result.encode())

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[proxy] {fmt % args}\n")


if __name__ == "__main__":
    print(f"Proxy server starting on port {PORT}")
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
