#!/bin/bash
set -euo pipefail
SRC="${1:-$HOME/Downloads/try_again_no_text.mp4}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/media/hero.mp4"
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
ls -lh "$DEST"
echo "Hero video ready at public/media/hero.mp4"
