# Release signing — Pluto and Luna Select Android app

## Keystore location (DO NOT MOVE)

- Keystore file: `~/workspace/dog-app/release/pluto-luna-release.jks`
- Key alias: `pluto-luna`
- Passwords: `~/workspace/dog-app/release/keystore.env` (chmod 600, never committed)

**The same keystore and alias MUST sign every future release.** Android
refuses to install an update signed with a different key, so losing this
file means existing users can never update — they would have to uninstall
and reinstall, and the package would need a new identity.

## Rules

- Never commit `*.jks`, `keystore.env`, or any password to git.
- The repo's `.gitignore` excludes this entire `release/` directory.
- Back this directory up somewhere durable (it lives in the workspace,
  which persists, but a second copy is cheap insurance).

## Files

| File | Committed? | Purpose |
|---|---|---|
| `pluto-luna-release.jks` | No | Release signing key |
| `keystore.env` | No | `PLS_STORE_PASSWORD`, `PLS_KEY_PASSWORD` |
| `README.md` | Yes (this file) | This documentation |
