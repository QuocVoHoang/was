#!/usr/bin/env python3
"""
HTTP server with COOP/COEP headers.
Required for SharedArrayBuffer (pthreads/Web Workers).

Headers added:
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
"""

import sys
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler


class COOPCOEPHandler(SimpleHTTPRequestHandler):
    """Adds mandatory cross-origin isolation headers to every response."""

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        # Same format as default but cleaner
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.address_string(),
                          self.log_date_time_string(),
                          format % args))


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8082
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'

    os.chdir(directory)
    httpd = HTTPServer(('localhost', port), COOPCOEPHandler)

    print(f"🚀 Serving on http://localhost:{port}")
    print(f"   COOP/COEP headers enabled (SharedArrayBuffer support)")
    print(f"   Press Ctrl+C to stop.")
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
