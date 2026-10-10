#!/usr/bin/env bash
# Re-encodes every race video for mobile streaming.
#
#   720p H.264, ~1.8 Mbps video + 128 kbps AAC, keyframe every 2s,
#   "faststart" (moov atom first) so playback starts before the download ends.
#
# The originals are 1080p @ ~19 Mbps (100–320 MB each) with the moov atom at
# the end — they stall on roaming/cellular data. Output is ~10x smaller.
#
# Usage: scripts/encode-videos.sh [lang] [key]   (no args = everything)
# Sources: videos/<file> if present locally, otherwise downloaded from Storage
# into videos/src/. Output: videos/encoded/<lang>/<key>.mp4
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET_URL='https://firebasestorage.googleapis.com/v0/b/triptailor-71050.firebasestorage.app/o'
MANIFEST=scripts/videos-manifest.json
ONLY_LANG="${1:-}"
ONLY_KEY="${2:-}"

python3 -I -c '
import json, sys
m = json.load(open(sys.argv[1]))
for lang, entries in m.items():
    if lang.startswith("_"): continue
    for key, src in entries.items():
        print(f"{lang}\t{key}\t{src}")
' "$MANIFEST" | while IFS=$'\t' read -r lang key src; do
  [[ -n "$ONLY_LANG" && "$lang" != "$ONLY_LANG" ]] && continue
  [[ -n "$ONLY_KEY" && "$key" != "$ONLY_KEY" ]] && continue

  out="videos/encoded/$lang/$key.mp4"
  if [[ -s "$out" ]]; then echo "✓ $out (exists)"; continue; fi
  mkdir -p "videos/encoded/$lang" "videos/src/$lang"

  input="videos/$src"
  if [[ ! -f "$input" ]]; then
    input="videos/src/$lang/$src"
    if [[ ! -s "$input" ]]; then
      echo "↓ downloading $src"
      enc=$(python3 -I -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$src")
      curl -sSfL --retry 3 -o "$input.part" "$BUCKET_URL/$enc?alt=media"
      mv "$input.part" "$input"
    fi
  fi

  echo "⚙ encoding $lang/$key ← $src"
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$input" \
    -vf "scale=-2:'min(720,ih)':flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -profile:v high -level 4.0 \
    -crf 23 -maxrate 1800k -bufsize 3600k \
    -force_key_frames 'expr:gte(t,n_forced*2)' \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    "$out.part.mp4"
  mv "$out.part.mp4" "$out"
  echo "✓ $out ($(du -h "$out" | cut -f1))"
done
