#!/bin/bash
# Save the clipboard or a screenshot to the second brain's inbox/ (Mac).
#
#   brain-capture.sh clip        clipboard: text, a link, an image, or a copied image file
#   brain-capture.sh shot        drag to select part of the screen (Space = a window)
#   brain-capture.sh text "..."  send this text
#   brain-capture.sh test        check the key works
# Add --no-note to skip the "Add a note" box.
#
# The key is read from $BRAIN_CAPTURE_KEY or ~/.config/brain-capture/key (install.sh
# writes it there). It never goes in the repo. Bind clip/shot to hotkeys with the
# Shortcuts app; see tools/device-capture/README.md.

set -u
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
ENDPOINT="${BRAIN_CAPTURE_URL:-https://brainy.pxlvzn.in/api/capture}"
KEYFILE="$HOME/.config/brain-capture/key"
KEY="${BRAIN_CAPTURE_KEY:-$(cat "$KEYFILE" 2>/dev/null)}"
VIA="Mac hotkey"
TMP="$(mktemp -d /tmp/brain-capture.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

notify() { osascript -e "display notification \"$(printf '%s' "$1" | sed 's/["\\]/ /g')\" with title \"Brain\"" >/dev/null 2>&1; echo "$1"; }
die() { notify "$1"; exit 1; }
b64() { base64 < "$1" | tr -d '\n'; }

[ -n "$KEY" ] || die "No capture key. Run install.sh first."

MODE="${1:-clip}"; shift || true
ASK=1; ARG_TEXT=""
for a in "$@"; do
  case "$a" in --no-note) ASK=0;; *) ARG_TEXT="$a";; esac
done

if [ "$MODE" = "test" ]; then
  curl -sS --max-time 15 -H "Authorization: Bearer $KEY" "$ENDPOINT"; echo; exit
fi

IMG=""; : > "$TMP/text"
case "$MODE" in
  shot)
    VIA="Mac screenshot"
    screencapture -i -x "$TMP/shot.png"
    [ -s "$TMP/shot.png" ] || exit 0          # Esc pressed: nothing to do
    IMG="$TMP/shot.png"
    ;;
  text)
    printf '%s' "$ARG_TEXT" > "$TMP/text"
    ;;
  clip)
    INFO="$(osascript -e 'clipboard info' 2>/dev/null)"
    if printf '%s' "$INFO" | grep -q 'furl'; then
      # A file copied in Finder: send it if it's an image, otherwise its name.
      F="$(osascript -e 'POSIX path of (the clipboard as «class furl»)' 2>/dev/null)"
      case "$(printf '%s' "$F" | tr 'A-Z' 'a-z')" in
        *.png|*.jpg|*.jpeg|*.heic|*.gif|*.webp|*.tiff|*.tif) IMG="$F";;
        *) printf '%s' "$(basename "$F")" > "$TMP/text";;
      esac
    elif printf '%s' "$INFO" | grep -qE 'PNGf|TIFF|JPEG'; then
      osascript -e "set f to open for access POSIX file \"$TMP/clip.png\" with write permission" \
                -e 'write (the clipboard as «class PNGf») to f' -e 'close access f' >/dev/null 2>&1
      [ -s "$TMP/clip.png" ] && IMG="$TMP/clip.png"
    fi
    [ -n "$IMG" ] || [ -s "$TMP/text" ] || pbpaste > "$TMP/text"
    ;;
  *) die "Unknown mode '$MODE' (use clip, shot, text or test)";;
esac

if [ -z "$IMG" ] && ! grep -q '[^[:space:]]' "$TMP/text"; then die "Clipboard is empty, nothing saved."; fi

if [ "$ASK" = 1 ]; then
  PROMPT="Add a note (why you're saving it). Leave blank to skip."
  # Cancel (error -128) stops; any other dialog failure just saves without a note.
  if ! osascript -e "text returned of (display dialog \"$PROMPT\" default answer \"\" with title \"Save to brain\" buttons {\"Cancel\", \"Save\"} default button \"Save\")" > "$TMP/note" 2> "$TMP/err"; then
    grep -q -- '-128' "$TMP/err" && exit 0
    : > "$TMP/note"
  fi
  # osascript ends its output with a newline; drop it.
  printf '%s' "$(cat "$TMP/note")" > "$TMP/note"
else
  : > "$TMP/note"
fi

# Shrink images to a JPEG under ~1 MB (the endpoint takes up to 4 MB).
IMG_B64=""
if [ -n "$IMG" ]; then
  sips -s format jpeg -s formatOptions 75 -Z 1800 "$IMG" --out "$TMP/up.jpg" >/dev/null 2>&1 || die "Couldn't convert the image."
  IMG_B64="$(b64 "$TMP/up.jpg")"
fi

# Everything is base64, so the JSON needs no escaping.
{
  printf '{"via":"%s","text_b64":"%s","note_b64":"%s"' "$VIA" "$(b64 "$TMP/text")" "$(b64 "$TMP/note")"
  [ -n "$IMG_B64" ] && printf ',"image":"%s"' "$IMG_B64"
  printf '}'
} > "$TMP/body.json"

MSG="$(curl -sS --max-time 45 -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  --data-binary @"$TMP/body.json" "$ENDPOINT" 2>&1)" || MSG="Not saved: $MSG"
notify "$MSG"
