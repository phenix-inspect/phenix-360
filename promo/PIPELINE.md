# Comment les vidéos ont été produites (référence)

1. **Capture** — Playwright pilote l'app réelle (build de prod servi en `preview`),
   curseur animé, chaque « beat » de narration journalisé (timing précis).
2. **Sous-titres** — `drawtext` (ffmpeg), lower-third premium, calés sur la
   timeline (mise à l'échelle vidéo/horloge pour un sync exact).
3. **Cartes** — intro/outro serif or/encre, fondus + léger zoom (ffmpeg drawtext + zoompan).
4. **Musique** — pad ambiant doux en La majeur, généré hors-ligne (ffmpeg aevalsrc
   - acrossfade + reverb + EQ), niveau bas (pic ~-18 dBFS).
5. **Montage** — concat intro + corps + outro, mux musique, fondus.
6. **Voix off** — `make_voice.py` (aligné) + `remux.sh` (ducking). Voir README.

Aucune donnée client réelle. Zéro erreur console pendant la capture.
