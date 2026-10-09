#!/bin/sh
# Vibe Coding setup for macOS. Usage and options: setup-macos.sh --help
# Runs setup-macos.cjs with Node.js 18+ when available, otherwise with the
# JavaScript runtime that ships inside Visual Studio Code.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ "$(uname -s)" != "Darwin" ]; then
  echo "setup-macos.sh supports macOS only. On Windows use setup.ps1." >&2
  exit 2
fi

if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/setup-macos.cjs" "$@"
fi

for app in "${VIBE_CODE_APP:-}" "/Applications/Visual Studio Code.app" "$HOME/Applications/Visual Studio Code.app"; do
  if [ -z "$app" ] || [ ! -d "$app" ]; then
    continue
  fi
  exe=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist" 2>/dev/null || true)
  if [ -n "$exe" ] && [ -x "$app/Contents/MacOS/$exe" ]; then
    ELECTRON_RUN_AS_NODE=1 exec "$app/Contents/MacOS/$exe" "$SCRIPT_DIR/setup-macos.cjs" "$@"
  fi
done

echo "Install Visual Studio Code into /Applications (https://code.visualstudio.com/) or Node.js 18+, then run this again." >&2
exit 3
