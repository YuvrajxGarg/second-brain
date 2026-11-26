#!/bin/bash
# One-time Mac setup: copies brain-capture.sh to ~/.brain-capture/ and saves the key.
#   bash install.sh
set -e
DIR="$HOME/.brain-capture"
mkdir -p "$DIR" "$HOME/.config/brain-capture"
SRC="$(cd "$(dirname "$0")" && pwd)/brain-capture.sh"
if [ -f "$SRC" ]; then cp "$SRC" "$DIR/brain-capture.sh"; else
  curl -fsSL https://raw.githubusercontent.com/YuvrajxGarg/second-brain/main/tools/device-capture/mac/brain-capture.sh -o "$DIR/brain-capture.sh"
fi
chmod +x "$DIR/brain-capture.sh"
printf "Paste your capture key (the part after ?key= in the brain connector link), then Enter: "
read -rs KEY < /dev/tty; echo
[ -n "$KEY" ] || { echo "No key given."; exit 1; }
umask 077; printf '%s' "$KEY" > "$HOME/.config/brain-capture/key"
echo "Testing..."
"$DIR/brain-capture.sh" test
echo
echo "Installed: $DIR/brain-capture.sh"
echo "Next: make the two hotkeys in the Shortcuts app (see the README)."
