# Supports client PHÉNIX 360

Kit marketing de l'espace client (charte exacte de l'app : or #b5893c, encre #1c1915, Newsreader).

## Livrables (dossier `output/`, non versionné)
- `PHENIX360-presentation-1min.mp4` — vidéo de présentation (toutes les fonctions).
- `PHENIX360-guide-2min.mp4` — vidéo explicative (comment ça marche, 8 étapes).
- `PHENIX360-presentation.pdf` — brochure de présentation (A4, 3 pages).
- `PHENIX360-guide-pratique.pdf` — guide de prise en main (A4, 3 pages).

## Régénérer
```bash
pip3 install imageio-ffmpeg   # ffmpeg avec libx264 (webm → mp4)
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
node record.mjs      # vidéos motion → output/*.mp4 (1080p H.264)
node render-pdf.mjs  # brochures → output/*.pdf (A4 vectoriel)
node shoot.mjs video-presentation.html 0 1   # captures de contrôle par scène
```

## Sources
- `brand.css` — kit commun (polices, palette, maquette téléphone, primitives motion).
- `video-presentation.html` / `video-explainer.html` — timelines motion (auto-play, `window.__TOTAL__`).
- `pdf-presentation.html` / `pdf-explainer.html` — brochures print A4.
- `assets/` — logos + polices embarquées.
