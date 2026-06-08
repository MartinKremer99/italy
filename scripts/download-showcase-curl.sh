#!/bin/bash
set -euo pipefail
UA='ItalyRoadtrip2026/1.0 (personal trip showcase)'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/showcase/images"
HOTELS="$OUT/hotels"
MANIFEST="$ROOT/scripts/showcase-image-urls.json"
mkdir -p "$HOTELS"

download() {
  local dest="$1" url="$2"
  echo "→ $dest"
  sleep 4
  curl -fsSL -A "$UA" -o "$dest" "$url"
  local size
  size=$(wc -c < "$dest" | tr -d ' ')
  if [[ "$size" -lt 15000 ]]; then
    echo "Too small ($size bytes): $dest" >&2
    return 1
  fi
  echo "  OK ${size} bytes"
}

node -e "
const m=require('$MANIFEST');
for (const [f,u] of Object.entries(m.places)) console.log('place',f,u);
for (const [f,u] of Object.entries(m.hotels)) console.log('hotel',f,u);
" | while read -r kind file url; do
  if [[ "$kind" == place ]]; then
    download "$OUT/$file" "$url"
  else
    download "$HOTELS/$file" "$url"
  fi
done

cp -R "$ROOT/showcase" "$ROOT/public/showcase"
echo "Copied to public/showcase"
