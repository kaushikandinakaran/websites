#!/usr/bin/env python3
"""Demo web server for the showcase sites.

Why not `python -m http.server`? Its listen queue holds only 5 waiting connections, so the burst of
module requests a 3D page makes (three.js plus its add-ons, models, textures) can get connections
refused, and the page then silently falls back to the poster with no 3D. This server keeps the same
behaviour (static files, threaded) with a large queue, and sends the right types for .glb/.gltf/.hdr.

Usage:  python serve.py [port]      (default 8800, bound to 127.0.0.1 only)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
        '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
        '.hdr': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
        '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    }

    def end_headers(self):
        # local demo: always serve the current files
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # quiet

class Server(ThreadingHTTPServer):
    request_queue_size = 256   # the default is 5
    daemon_threads = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
    root = os.path.dirname(os.path.abspath(__file__))
    srv = Server(('127.0.0.1', port), partial(Handler, directory=root))
    print(f'Serving {root} at http://localhost:{port}/  (Ctrl+C to stop)')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
