# Pluto and Luna Select — Android wrapper

Capacitor wrapper that turns the PWA into a sideloadable Android APK.

## How it works

- The app is **not bundled** into the APK. `capacitor.config.json` sets
  `server.url` to the live site
  (`https://whatsonmyballotusa-tech.github.io/pluto-and-luna-select-app/`),
  so the APK never goes stale — every site deploy is instantly the new
  "app update".
- External links (Shopify checkout, knowledge-base sources, etc.) are opened
  in the system browser by Capacitor's default `launchIntent` handling:
  any host other than the app host leaves the WebView. Checkout is never
  trapped in-app.
- Android back button navigates WebView history, standard Capacitor behavior.

## Identity

- App name: **Pluto and Luna Select**
- Package: `com.plutoandlunaselect.app`
- Launcher icons generated from `../app/icons/icon-512.png` (PWA icon).

## Building locally (one command)

```bash
./build-apk.sh [version]   # e.g. ./build-apk.sh 1.0.0
```

Signing credentials come from `~/workspace/dog-app/release/keystore.env`
(never committed). Output: `pluto-and-luna-select-v<version>.apk`.

## CI

`.github/workflows/build-apk.yml` builds on `android-v*` tags or manual
dispatch. It needs these repository secrets (same keystore as local builds):

- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

## Publishing a new version

1. `./build-apk.sh 1.1.0`
2. `python3 make-release.py android-v1.1.0 pluto-and-luna-select-v1.1.0.apk
   --name "Android v1.1.0" --notes "..."`
3. Update the download link in `../app/index.html` (`#android-app-card`)
   and push to the `gh-pages` branch.
