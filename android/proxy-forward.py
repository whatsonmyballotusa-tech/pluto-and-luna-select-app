#!/usr/bin/env python3
"""Local unauthenticated CONNECT forwarder for the sandbox egress proxy.

Java's HttpURLConnection cannot handle this environment's authenticated
egress proxy, so sdkmanager/Gradle traffic goes through this tiny local
proxy (no auth), which injects Proxy-Authorization upstream.

Reads the upstream proxy (with credentials) from the standard *PROXY env
vars. Listens on 127.0.0.1:8888 by default.

Usage: python3 proxy-forward.py [port]
"""
import base64
import os
import select
import socket
import sys
import threading
import urllib.parse

LISTEN_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888


def upstream():
    for var in ("https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY"):
        val = os.environ.get(var)
        if val:
            return val
    raise SystemExit("no proxy env var set")


def parse_proxy(url):
    u = urllib.parse.urlparse(url)
    auth = ""
    if u.username:
        creds = f"{u.username}:{u.password or ''}"
        auth = "Proxy-Authorization: Basic " + base64.b64encode(
            creds.encode()).decode() + "\r\n"
    return u.hostname, u.port or 3128, auth


UP_HOST, UP_PORT, UP_AUTH = parse_proxy(upstream())


def relay(a, b):
    try:
        while True:
            r, _, _ = select.select([a, b], [], [], 300)
            if not r:
                break
            for s in r:
                data = s.recv(65536)
                if not data:
                    return
                (b if s is a else a).sendall(data)
    except OSError:
        pass
    finally:
        for s in (a, b):
            try:
                s.close()
            except OSError:
                pass


def handle(client):
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            chunk = client.recv(4096)
            if not chunk:
                client.close()
                return
            req += chunk
        line = req.split(b"\r\n", 1)[0].decode("latin1")
        parts = line.split()
        if len(parts) < 2:
            client.close()
            return
        method, target = parts[0], parts[1]
        if method.upper() == "CONNECT":
            hostport = target
            path = target
        else:
            u = urllib.parse.urlparse(target)
            hostport = u.netloc
            path = u.path or "/"
            if u.query:
                path += "?" + u.query
        up = socket.create_connection((UP_HOST, UP_PORT), timeout=30)
        if method.upper() == "CONNECT":
            up.sendall(
                f"CONNECT {hostport} HTTP/1.1\r\nHost: {hostport}\r\n"
                f"{UP_AUTH}\r\n".encode())
            resp = b""
            while b"\r\n\r\n" not in resp:
                chunk = up.recv(4096)
                if not chunk:
                    break
                resp += chunk
            if b" 200 " not in resp.split(b"\r\n", 1)[0]:
                client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                up.close()
                client.close()
                return
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        else:
            headers, _, body = req.partition(b"\r\n\r\n")
            lines = headers.split(b"\r\n")
            out = [f"{method} {path} HTTP/1.1".encode()]
            for h in lines[1:]:
                if h.lower().startswith(b"proxy-"):
                    continue
                out.append(h)
            out.append(f"Proxy-Authorization: Basic {UP_AUTH.split()[-1]}"
                       .encode() if UP_AUTH else b"")
            up.sendall(b"\r\n".join(o for o in out if o) + b"\r\n\r\n" + body)
            # pump the response back without relay loop complexity:
            # fall through to relay() which is bidirectional anyway
            relay_thread = threading.Thread(target=relay, args=(client, up),
                                            daemon=True)
            relay_thread.start()
            relay_thread.join()
            return
        relay(client, up)
    except OSError:
        try:
            client.close()
        except OSError:
            pass


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", LISTEN_PORT))
    srv.listen(50)
    print(f"forwarding proxy on 127.0.0.1:{LISTEN_PORT} -> {UP_HOST}:{UP_PORT}",
          flush=True)
    while True:
        client, _ = srv.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()


if __name__ == "__main__":
    main()
