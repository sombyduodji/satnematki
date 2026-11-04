#!/usr/bin/env python3
"""Serves the game for playtesting, telling browsers to check for new files on every load.

A plain http.server lets a browser keep using its old copy of a file it thinks is fresh, which
mixes old styles with new code after an update.
"""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class FreshFiles(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--directory", default=".")
    args = parser.parse_args()
    handler = functools.partial(FreshFiles, directory=args.directory)
    ThreadingHTTPServer((args.bind, args.port), handler).serve_forever()


if __name__ == "__main__":
    main()
