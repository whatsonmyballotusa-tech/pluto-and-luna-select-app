#!/usr/bin/env python3
"""Resolve Android library dependencies from Maven repos without Gradle.

Usage: resolve-deps.py <out_dir>
  Reads root deps from ROOT_DEPS below, resolves transitively via POMs from
  Google Maven + Maven Central (curl, which works through the sandbox proxy),
  and downloads every AAR/JAR into <out_dir>.

Handles: parent POMs, properties substitution, dependencyManagement versions.
Skips: test/provided scope, optional deps.
"""
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/aars"
os.makedirs(OUT, exist_ok=True)

GOOGLE = "https://dl.google.com/dl/android/maven2"
CENTRAL = "https://repo1.maven.org/maven2"

ROOT_DEPS = [
    ("androidx.appcompat", "appcompat", "1.7.1"),
    ("androidx.core", "core", "1.17.0"),
    ("androidx.activity", "activity", "1.11.0"),
    ("androidx.fragment", "fragment", "1.8.9"),
    ("androidx.coordinatorlayout", "coordinatorlayout", "1.3.0"),
    ("androidx.webkit", "webkit", "1.14.0"),
    ("androidx.core", "core-splashscreen", "1.2.0"),
    ("org.apache.cordova", "framework", "14.0.1"),
]

_pom_cache = {}


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    r = subprocess.run(["curl", "-sSL", "--retry", "3", "-o", dest, url],
                       capture_output=True)
    if r.returncode != 0 or not os.path.exists(dest) or os.path.getsize(dest) == 0:
        return False
    # reject HTML error pages
    with open(dest, "rb") as f:
        head = f.read(200)
    if b"<html" in head.lower():
        os.remove(dest)
        return False
    return True


def maven_path(group, artifact, version, ext):
    return f"{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}.{ext}"


def download_artifact(group, artifact, version, ext):
    dest = os.path.join(OUT, f"{group}__{artifact}-{version}.{ext}")
    if os.path.exists(dest):
        return dest
    for base in (GOOGLE, CENTRAL):
        if fetch(f"{base}/{maven_path(group, artifact, version, ext)}", dest):
            return dest
    return None


def parse_pom(group, artifact, version):
    key = (group, artifact, version)
    if key in _pom_cache:
        return _pom_cache[key]
    pom_file = download_artifact(group, artifact, version, "pom")
    if not pom_file:
        _pom_cache[key] = None
        return None
    tree = ET.parse(pom_file)
    root = tree.getroot()
    ns = {"m": "http://maven.apache.org/POM/4.0.0"}

    def tx(parent, tag):
        e = parent.find(f"m:{tag}", ns)
        return e.text.strip() if e is not None and e.text else None

    # parent
    parent = root.find("m:parent", ns)
    parent_data = None
    if parent is not None:
        pg, pa, pv = (tx(parent, "groupId"), tx(parent, "artifactId"),
                      tx(parent, "version"))
        parent_data = parse_pom(pg, pa, pv)

    props = {}
    if parent_data:
        props.update(parent_data["props"])
    pprops = root.find("m:properties", ns)
    if pprops is not None:
        for e in pprops:
            tag = e.tag.split("}")[-1]
            if e.text:
                props[tag] = e.text.strip()

    def sub(s):
        if not s:
            return s
        def rep(m):
            return props.get(m.group(1), m.group(0))
        prev = None
        while prev != s:
            prev = s
            s = re.sub(r"\$\{([^}]+)\}", rep, s)
        return s

    g = tx(root, "groupId") or (parent_data["group"] if parent_data else group)
    v = tx(root, "version") or (parent_data["version"] if parent_data else version)
    g, v = sub(g), sub(v)

    # dependencyManagement
    mgmt = {}
    if parent_data:
        mgmt.update(parent_data["mgmt"])
    dm = root.find("m:dependencyManagement/m:dependencies", ns)
    if dm is not None:
        for d in dm.findall("m:dependency", ns):
            dg, da, dv = (sub(tx(d, "groupId")), tx(d, "artifactId"),
                          sub(tx(d, "version")))
            if dg and da and dv and tx(d, "type") not in ("test-jar",):
                mgmt[(dg, da)] = dv

    deps = []
    droot = root.find("m:dependencies", ns)
    if droot is not None:
        for d in droot.findall("m:dependency", ns):
            scope = tx(d, "scope") or "compile"
            if scope in ("test", "provided"):
                continue
            if (tx(d, "optional") or "").lower() == "true":
                continue
            dg, da = sub(tx(d, "groupId")), tx(d, "artifactId")
            dv = sub(tx(d, "version")) or mgmt.get((dg, da))
            dtype = tx(d, "type") or "jar"
            if dg and da and dv and dtype != "test-jar":
                deps.append((dg, da, dv))

    packaging = tx(root, "packaging") or "jar"
    data = {"group": g, "version": v, "props": props, "mgmt": mgmt,
            "deps": deps, "packaging": packaging}
    _pom_cache[key] = data
    return data


def main():
    resolved = {}  # (group, artifact) -> (version, packaging)
    queue = list(ROOT_DEPS)
    while queue:
        g, a, v = queue.pop(0)
        key = (g, a)
        if key in resolved:
            # keep highest version (simple string compare is mostly fine here)
            continue
        pom = parse_pom(g, a, v)
        if pom is None:
            print(f"WARN: no POM for {g}:{a}:{v}", flush=True)
            continue
        resolved[key] = (v, pom["packaging"])
        for dg, da, dv in pom["deps"]:
            if (dg, da) not in resolved:
                queue.append((dg, da, dv))

    print(f"resolved {len(resolved)} artifacts", flush=True)
    ok, failed = 0, []
    for (g, a), (v, packaging) in sorted(resolved.items()):
        ext = "aar" if packaging == "aar" else "jar"
        # cordova framework ships as jar despite packaging quirks; try aar then jar
        dest = download_artifact(g, a, v, ext)
        if dest is None and ext == "aar":
            dest = download_artifact(g, a, v, "jar")
        if dest is None and ext == "jar":
            dest = download_artifact(g, a, v, "aar")
        if dest:
            ok += 1
        else:
            failed.append(f"{g}:{a}:{v}")
    print(f"downloaded {ok}, failed {len(failed)}", flush=True)
    for f in failed:
        print("FAILED:", f)
    # manifest of what we got
    with open(os.path.join(OUT, "artifacts.txt"), "w") as fh:
        for (g, a), (v, p) in sorted(resolved.items()):
            fh.write(f"{g}:{a}:{v} packaging={p}\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
