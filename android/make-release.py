#!/usr/bin/env python3
"""Create a GitHub Release and upload the signed APK as an asset.

Usage:
  make-release.py <tag> <apk_path> [--name TEXT] [--notes TEXT]

Auth: credential `custom.github` from authd (surrogate, bearer header),
same pattern as ~/workspace/skills/github/bin/gh.py.

Note: GitHub's API design requires binary asset uploads to go to
uploads.github.com (the upload_url returned when the release is created).
That host is GitHub-owned; the same stored credential is attached there and
nowhere else. Release metadata itself stays on api.github.com.
"""
import json
import os
import sys
import urllib.request
import urllib.error

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
import dynamic_credentials as dc  # noqa: E402

API = "https://api.github.com"
CRED = "custom.github"
OWNER = "whatsonmyballotusa-tech"
REPO = "pluto-and-luna-select-app"


def api_request(method, url, body=None, headers=None, allowed=("api.github.com",)):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "luna-github-skill")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if data:
        req.add_header("Content-Type", "application/json")
    dc.add_surrogate_to_request(req, CRED, allowed_hosts=allowed)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        return resp.status, dc.read_json_response(resp)
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode())
        except Exception:
            payload = {"message": f"HTTP {e.code}"}
        return e.code, payload


def create_release(tag, name, notes):
    # Return existing release if the tag already has one (idempotent).
    s, existing = api_request("GET", f"{API}/repos/{OWNER}/{REPO}/releases/tags/{tag}")
    if s == 200:
        print(f"release {tag} already exists (id {existing['id']})")
        return existing
    s, rel = api_request("POST", f"{API}/repos/{OWNER}/{REPO}/releases", {
        "tag_name": tag,
        "name": name,
        "body": notes,
        "draft": False,
        "prerelease": False,
    })
    if s not in (200, 201):
        print(f"ERROR {s} creating release: {rel}", file=sys.stderr)
        sys.exit(1)
    print(f"created release {tag} (id {rel['id']})")
    return rel


def upload_asset(release, apk_path):
    upload_url = release["upload_url"].split("{")[0]
    filename = os.path.basename(apk_path)
    with open(apk_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        f"{upload_url}?name={filename}", data=data, method="POST")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "luna-github-skill")
    req.add_header("Content-Type", "application/vnd.android.package-archive")
    req.add_header("Content-Length", str(len(data)))
    dc.add_surrogate_to_request(
        req, CRED, allowed_hosts=("api.github.com", "uploads.github.com"))
    try:
        resp = urllib.request.urlopen(req, timeout=300)
        body = dc.read_json_response(resp)
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode())
        except Exception:
            payload = {"message": f"HTTP {e.code}"}
        print(f"ERROR {e.code} uploading asset: {payload}", file=sys.stderr)
        sys.exit(1)
    print(f"uploaded {filename} ({body.get('size')} bytes)")
    print(f"download: {body.get('browser_download_url')}")


def main(argv):
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    tag, apk_path = argv[1], argv[2]
    name = tag
    notes = ""
    if "--name" in argv:
        name = argv[argv.index("--name") + 1]
    if "--notes" in argv:
        notes = argv[argv.index("--notes") + 1]
    if not os.path.isfile(apk_path):
        print(f"ERROR: APK not found: {apk_path}", file=sys.stderr)
        return 1
    rel = create_release(tag, name, notes)
    upload_asset(rel, apk_path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
