#!/usr/bin/env python3
"""Static file server for development that disables caching.

Wraps http.server's SimpleHTTPRequestHandler and adds headers that stop
the browser (and any proxy in front of it) from serving stale HTML/CSS/JS
while iterating on the app.
"""
import http.server
import os

PORT = int(os.environ.get("PORT", 5000))


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHTTPRequestHandler)
    print(f"Serving HTTP on 0.0.0.0 port {PORT} (no-cache mode) ...")
    server.serve_forever()
