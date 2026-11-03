#!/bin/sh
# Plain macOS DMG (ALDY.app + Applications shortcut) from an already-built bundle.
# Tauri's `--bundles dmg` styles the window through Finder AppleScript, which times out in headless sessions.
set -eu
app="${1:-desktop/src-tauri/target/release/bundle/macos/ALDY.app}"
out="${2:-desktop/src-tauri/target/release/bundle/dmg/ALDY-macos-arm64.dmg}"
[ -d "$app" ] || { echo "missing app bundle: $app" >&2; exit 1; }
root="$(mktemp -d)"; trap 'rm -rf "$root"' EXIT
ditto "$app" "$root/ALDY.app"; ln -s /Applications "$root/Applications"
mkdir -p "$(dirname "$out")"; rm -f "$out"
hdiutil create -volname ALDY -srcfolder "$root" -ov -format UDZO "$out" >/dev/null
hdiutil verify "$out" >/dev/null && echo "$out"
