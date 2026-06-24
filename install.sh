#!/usr/bin/env bash
set -euo pipefail

UUID="dim-gnome-wayland-screen@user"
TARGET="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"
REPO="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$TARGET"
ln -sf "$REPO/metadata.json" "$TARGET/metadata.json"
ln -sf "$REPO/extension.js" "$TARGET/extension.js"

echo "Installed at $TARGET"
echo "Log out and back in to activate."
