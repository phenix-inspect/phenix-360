# PHÉNIX 360 — Vidéos de présentation produit

Deux films de présentation (style Apple / Linear), rendus et livrés :

| Fichier                      | Durée     | Sujet                                                                                            |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `phenix-conducteur-demo.mp4` | ~2 min 47 | Le bureau mobile du conducteur — matin, préparation, copilote, scène signature, fil vivant, soir |
| `phenix-client-demo.mp4`     | ~1 min 50 | L'espace client — vraie conversation avec le concierge Léon                                      |

Chaque film contient déjà : carte d'intro + carte d'outro titrées (fondus + léger
zoom), **musique de fond douce**, **sous-titres cinétiques = la narration**,
curseur animé, transitions, et un montage synchronisé à l'image près. Zéro erreur
console pendant la capture.

## Pourquoi la voix off n'est pas encore incrustée

L'environnement d'exécution **bloque toutes les TTS de qualité** (Google,
Microsoft/edge-tts, ElevenLabs, HuggingFace bloqués par la politique réseau ;
identifiants AWS Polly invalides). Plutôt que d'incruster une voix synthétique
robotique et non vérifiable, les films sont livrés « musique + sous-titres » et
la voix se rajoute **en deux commandes** ci-dessous, avec un calage parfait
(mêmes timings que les sous-titres).

## Ajouter la voix off (2 commandes)

Prérequis : `ffmpeg`, `python3`. La voix la plus simple et **gratuite, sans clé**
est Microsoft Edge TTS (`pip install edge-tts`).

```bash
# 1) Générer la voix off alignée (voix masculine FR premium par défaut)
python3 make_voice.py conducteur --engine edge --voice fr-FR-HenriNeural
python3 make_voice.py client     --engine edge --voice fr-FR-DeniseNeural   # ou HenriNeural

# 2) Ré-injecter la voix dans la vidéo (la musique baisse sous la voix)
./remux.sh conducteur      # → phenix-conducteur-demo-vo.mp4
./remux.sh client          # → phenix-client-demo-vo.mp4
```

### Autres moteurs de voix

```bash
export OPENAI_API_KEY=...    ; python3 make_voice.py conducteur --engine openai --voice onyx
export ELEVENLABS_API_KEY=...; python3 make_voice.py conducteur --engine eleven --voice <voice_id>
python3 make_voice.py conducteur --engine test   # bips, pour vérifier le calage
```

Voix FR Edge recommandées : `fr-FR-HenriNeural`, `fr-FR-DeniseNeural`,
`fr-FR-VivienneMultilingualNeural`, `fr-FR-RemyMultilingualNeural`.

## Contenu du dossier

- `NARRATION-conducteur.md`, `NARRATION-client.md` — les scripts de narration.
- `conducteur.srt`, `client.srt` — sous-titres (déjà incrustés ; fournis pour édition).
- `vo_timeline-*.json` — timings absolus de chaque ligne sur la vidéo finale
  (source de vérité pour `make_voice.py`).
- `make_voice.py` — synthèse voix alignée (moteurs edge / openai / eleven / test).
- `remux.sh` — ré-injecte la voix avec ducking de la musique.

## Régénérer musique / cartes (hors-ligne, sans dépendance)

La musique (`music_bed.m4a`) et les cartes titrées sont générées 100 % hors-ligne
avec ffmpeg (pad ambiant doux en La majeur ; cartes serif or/encre). Voir
`PIPELINE.md`.
