#!/usr/bin/env bash
# Réinjecte la voix off dans la vidéo livrée en abaissant la musique sous la voix
# (ducking). Entrées : phenix-<name>-demo.mp4 (musique déjà présente) + vo-<name>.m4a.
# Sortie : phenix-<name>-demo-vo.mp4
set -e
cd "$(dirname "$0")"
NAME="$1"
VIDEO="phenix-$NAME-demo.mp4"
VO="vo-$NAME.m4a"
OUT="phenix-$NAME-demo-vo.mp4"
[ -f "$VIDEO" ] || { echo "manque $VIDEO"; exit 1; }
[ -f "$VO" ] || { echo "manque $VO (lance make_voice.py d'abord)"; exit 1; }

ffmpeg -y -i "$VIDEO" -i "$VO" -filter_complex \
  "[0:a]volume=0.55[m];[1:a]volume=1.5,asplit=2[v1][v2];\
   [m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[md];\
   [md][v2]amix=inputs=2:normalize=0:dropout_transition=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k "$OUT" >/dev/null 2>&1
echo "✓ $OUT ($(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$OUT")s)"
