#!/usr/bin/env python3
"""Manual release APK build for Pluto and Luna Select (no Gradle).

The sandbox's transparent network proxy breaks Java TCP loopback, which makes
the Gradle daemon unusable ("Could not receive a message from the daemon").
This script performs the same steps Gradle would, directly:

  1. extract AARs (classes.jar, res/)
  2. aapt2 compile + link  -> base APK + R.java (app + capacitor packages)
  3. javac (JDK 21)         -> classes
  4. d8                     -> classes.dex
  5. add dex + assets       -> APK
  6. zipalign + apksigner   -> signed release APK

Usage: manual-build.py [version]   (default 1.0.0)
Output: ~/workspace/dog-app/android/pluto-and-luna-select-v<version>.apk
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import zipfile

HOME = os.path.expanduser("~")
PROJ = os.path.join(HOME, "workspace/dog-app/android")
APP = os.path.join(PROJ, "android/app/src/main")
CAP_SRC = os.path.join(PROJ, "node_modules/@capacitor/android/capacitor/src/main")
AARS = "/tmp/aars"
WORK = "/tmp/pls-build"
RELEASE_DIR = os.path.join(HOME, "workspace/dog-app/release")

BT = os.path.join(HOME, "android-sdk/build-tools/35.0.0")
ANDROID_JAR = os.path.join(HOME, "android-sdk/platforms/android-36/android.jar")
AAPT2 = os.path.join(BT, "aapt2")
D8 = os.path.join(BT, "d8")
ZIPALIGN = os.path.join(BT, "zipalign")
APKSIGNER = os.path.join(BT, "apksigner")
JAVAC = os.path.join(HOME, "jdk21/bin/javac")

APP_ID = "com.plutoandlunaselect.app"
VERSION = sys.argv[1] if len(sys.argv) > 1 else "1.0.0"
VERSION_CODE = "1"


def run(cmd, **kw):
    print("+", " ".join(cmd[:4]), "..." if len(cmd) > 4 else "", flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print(r.stdout[-3000:], file=sys.stderr)
        print(r.stderr[-3000:], file=sys.stderr)
        raise SystemExit(f"FAILED: {cmd[0]}")
    return r


def step(name):
    print(f"\n===== {name} =====", flush=True)


# ---------- signing config ----------
step("signing config")
env = {}
with open(os.path.join(RELEASE_DIR, "keystore.env")) as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k] = v
KEYSTORE = env.get("PLS_KEYSTORE", os.path.join(RELEASE_DIR, "pluto-luna-release.jks"))
STORE_PW = env["PLS_STORE_PASSWORD"]
KEY_ALIAS = env.get("PLS_KEY_ALIAS", "pluto-luna")
# NOTE: keystore is PKCS12, where the key password is the store password
# (keytool ignores distinct -keypass for PKCS12). Prefer an explicit
# PLS_KEY_PASSWORD only for JKS-type stores.
KEY_PW = env["PLS_KEY_PASSWORD"] if env.get(
    "PLS_KEYSTORE_TYPE", "PKCS12") == "JKS" else STORE_PW
assert os.path.exists(KEYSTORE), "keystore missing"

# ---------- fresh work dir ----------
step("work dir")
shutil.rmtree(WORK, ignore_errors=True)
for d in ("libs", "res-app", "res-cap", "res-aar", "compiled", "gen", "classes",
          "dex", "assets", "manifest"):
    os.makedirs(os.path.join(WORK, d), exist_ok=True)

# ---------- 1. extract AARs ----------
step("extract AARs")
aar_res_dirs = []
for aar in sorted(glob.glob(os.path.join(AARS, "*.aar"))):
    name = os.path.basename(aar)[:-4]
    with zipfile.ZipFile(aar) as z:
        # classes.jar
        try:
            data = z.read("classes.jar")
            with open(os.path.join(WORK, "libs", name + ".jar"), "wb") as f:
                f.write(data)
        except KeyError:
            pass
        # res/
        res_names = [n for n in z.namelist()
                     if n.startswith("res/") and not n.endswith("/")]
        if res_names:
            dest = os.path.join(WORK, "res-aar", name)
            for n in res_names:
                out = os.path.join(dest, n)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, "wb") as f:
                    f.write(z.read(n))
            aar_res_dirs.append(os.path.join(dest, "res"))
        # assets/
        asset_names = [n for n in z.namelist()
                       if n.startswith("assets/") and not n.endswith("/")]
        for n in asset_names:
            out = os.path.join(WORK, "assets", n[len("assets/"):])
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "wb") as f:
                f.write(z.read(n))
# plain jars
for jar in sorted(glob.glob(os.path.join(AARS, "*.jar"))):
    base = os.path.basename(jar)
    # kotlin-stdlib-jdk7/jdk8 are subsets already inside kotlin-stdlib >= 1.8;
    # keeping them causes D8 "defined multiple times" errors (Gradle dedupes).
    if "kotlin-stdlib-jdk7" in base or "kotlin-stdlib-jdk8" in base:
        print(f"skip duplicate-subset jar: {base}")
        continue
    shutil.copy(jar, os.path.join(WORK, "libs", base))
print(f"libs: {len(os.listdir(os.path.join(WORK,'libs')))}, "
      f"aar res dirs: {len(aar_res_dirs)}")

# ---------- 2. resources ----------
step("prepare resources")
# app res (verbatim)
shutil.copytree(os.path.join(APP, "res"), os.path.join(WORK, "res-app"),
                dirs_exist_ok=True)
# capacitor res, minus the AppTheme.NoActionBar style the app overrides
shutil.copytree(os.path.join(CAP_SRC, "res"), os.path.join(WORK, "res-cap"),
                dirs_exist_ok=True)
styles = os.path.join(WORK, "res-cap", "values", "styles.xml")
if os.path.exists(styles):
    txt = open(styles).read()
    txt = re.sub(r'\s*<style name="AppTheme\.NoActionBar".*?</style>', "",
                 txt, flags=re.S)
    open(styles, "w").write(txt)

# ---------- 3. merged manifest ----------
step("merged manifest")
manifest = f"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{APP_ID}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="{APP_ID}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="{APP_ID}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

        <provider
            android:name="androidx.startup.InitializationProvider"
            android:authorities="{APP_ID}.androidx-startup"
            android:exported="false">
            <meta-data
                android:name="androidx.emoji2.text.EmojiCompatInitializer"
                android:value="androidx.startup" />
            <meta-data
                android:name="androidx.lifecycle.ProcessLifecycleInitializer"
                android:value="androidx.startup" />
            <meta-data
                android:name="androidx.profileinstaller.ProfileInstallerInitializer"
                android:value="androidx.startup" />
        </provider>

        <receiver
            android:name="androidx.profileinstaller.ProfileInstallReceiver"
            android:exported="true"
            android:enabled="true"
            android:permission="android.permission.DUMP">
            <intent-filter>
                <action android:name="androidx.profileinstaller.action.INSTALL_PROFILE" />
            </intent-filter>
            <intent-filter>
                <action android:name="androidx.profileinstaller.action.SKIP_FILE" />
            </intent-filter>
            <intent-filter>
                <action android:name="androidx.profileinstaller.action.SAVE_PROFILE" />
            </intent-filter>
            <intent-filter>
                <action android:name="androidx.profileinstaller.action.BENCHMARK_OPERATION" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
"""
manifest_path = os.path.join(WORK, "manifest", "AndroidManifest.xml")
open(manifest_path, "w").write(manifest)

# ---------- 4. aapt2 compile ----------
step("aapt2 compile")
compiled = []
res_inputs = ([os.path.join(WORK, "res-app"), os.path.join(WORK, "res-cap")]
              + sorted(aar_res_dirs))
for i, res_dir in enumerate(res_inputs):
    out = os.path.join(WORK, "compiled", f"res{i}.zip")
    run([AAPT2, "compile", "--dir", res_dir, "-o", out])
    compiled.append(out)
print(f"compiled {len(compiled)} res dirs")

# ---------- 5. aapt2 link ----------
step("aapt2 link")
unsigned_apk = os.path.join(WORK, "unsigned.apk")
# app assets (capacitor config + web content)
app_assets = os.path.join(APP, "assets")
if os.path.exists(app_assets):
    for root, _d, files in os.walk(app_assets):
        for fn in files:
            src = os.path.join(root, fn)
            rel = os.path.relpath(src, app_assets)
            dst = os.path.join(WORK, "assets", rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy(src, dst)
link_cmd = [
    AAPT2, "link",
    "-o", unsigned_apk,
    "-I", ANDROID_JAR,
    "--manifest", manifest_path,
    "--java", os.path.join(WORK, "gen"),
    "--extra-packages", "com.getcapacitor.android",
    "--min-sdk-version", "24",
    "--target-sdk-version", "36",
    "--version-code", VERSION_CODE,
    "--version-name", VERSION,
    "-A", os.path.join(WORK, "assets"),
] + compiled
run(link_cmd)
print("linked", os.path.getsize(unsigned_apk), "bytes")

# ---------- 6. javac ----------
step("javac")
sources = []
for src_root in (os.path.join(CAP_SRC, "java"),
                 os.path.join(APP, "java"),
                 os.path.join(WORK, "gen")):
    for root, _d, files in os.walk(src_root):
        for fn in files:
            if fn.endswith(".java"):
                sources.append(os.path.join(root, fn))
print(f"{len(sources)} java sources")
cp = [ANDROID_JAR] + sorted(glob.glob(os.path.join(WORK, "libs", "*.jar")))
listfile = os.path.join(WORK, "sources.txt")
open(listfile, "w").write("\n".join(sources))
run([JAVAC, "-nowarn", "-cp", ":".join(cp), "-d",
     os.path.join(WORK, "classes"), "@" + listfile])

# ---------- 7. d8 ----------
step("d8")
dex_out = os.path.join(WORK, "dex")
class_inputs = []
for root, _d, files in os.walk(os.path.join(WORK, "classes")):
    for fn in files:
        if fn.endswith(".class"):
            class_inputs.append(os.path.join(root, fn))
d8_cmd = [D8, "--lib", ANDROID_JAR, "--min-api", "24",
          "--output", dex_out] + class_inputs + sorted(
              glob.glob(os.path.join(WORK, "libs", "*.jar")))
run(d8_cmd)
dex_file = os.path.join(dex_out, "classes.dex")
print("dex", os.path.getsize(dex_file), "bytes")

# ---------- 8. add dex to APK ----------
step("assemble APK")
with zipfile.ZipFile(unsigned_apk, "a", zipfile.ZIP_DEFLATED) as z:
    z.write(dex_file, "classes.dex")

# ---------- 9. zipalign + sign ----------
step("zipalign + sign")
aligned = os.path.join(WORK, "aligned.apk")
run([ZIPALIGN, "-f", "4", unsigned_apk, aligned])
final_name = f"pluto-and-luna-select-v{VERSION}.apk"
final_apk = os.path.join(PROJ, final_name)
run([APKSIGNER, "sign",
     "--ks", KEYSTORE,
     "--ks-pass", f"pass:{STORE_PW}",
     "--key-pass", f"pass:{KEY_PW}",
     "--ks-key-alias", KEY_ALIAS,
     "--out", final_apk,
     aligned])
r = run([APKSIGNER, "verify", "--print-certs", final_apk])
print(r.stdout[:400])
print(f"\nOK: {final_apk} ({os.path.getsize(final_apk)} bytes)")
