#!/usr/bin/env python3
"""
Génère la VOIX OFF alignée sur la vidéo livrée, à partir de vo_timeline-<name>.json.
Chaque ligne est synthétisée puis placée à son instant exact ; on obtient
vo-<name>.m4a (même durée que la vidéo). Ensuite : ./remux.sh <name>.

Moteurs (--engine) :
  edge   (défaut) — Microsoft Edge TTS, neural, GRATUIT, sans clé (pip install edge-tts)
  openai          — OpenAI TTS   (export OPENAI_API_KEY=...)
  eleven          — ElevenLabs   (export ELEVENLABS_API_KEY=...  --voice <id>)
  test            — bips (validation de calage, sans voix)

Exemples :
  python3 make_voice.py conducteur --engine edge   --voice fr-FR-HenriNeural
  python3 make_voice.py client     --engine openai --voice onyx
"""
import argparse, json, os, subprocess, sys, tempfile

def dur_of(path):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nk=1:nw=1", path]))

def synth_edge(text, voice, out):
    import asyncio, edge_tts
    async def go(): await edge_tts.Communicate(text, voice=voice).save(out)
    asyncio.run(go())

def synth_openai(text, voice, out):
    from openai import OpenAI
    r = OpenAI().audio.speech.create(model=os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
                                     voice=voice, input=text)
    r.stream_to_file(out)

def synth_eleven(text, voice, out):
    import requests
    vid = voice or "EXAVITQu4vr4xnSDxMaL"
    r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
                      headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
                      json={"text": text, "model_id": "eleven_multilingual_v2"})
    r.raise_for_status(); open(out, "wb").write(r.content)

def synth_test(text, voice, out):
    # bip court proportionnel — sert à vérifier le calage (pas une vraie voix)
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i",
                    "sine=frequency=330:duration=0.5", "-ac", "2", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

ENGINES = {"edge": synth_edge, "openai": synth_openai, "eleven": synth_eleven, "test": synth_test}
DEFAULT_VOICE = {"edge": "fr-FR-HenriNeural", "openai": "onyx", "eleven": None, "test": None}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--engine", default="edge", choices=ENGINES)
    ap.add_argument("--voice", default=None)
    a = ap.parse_args()
    voice = a.voice or DEFAULT_VOICE[a.engine]
    tl = json.load(open(f"vo_timeline-{a.name}.json"))
    video_dur = dur_of(tl["video"])
    synth = ENGINES[a.engine]

    tmp = tempfile.mkdtemp(prefix=f"vo_{a.name}_")
    inputs, filt, labels = [], [], []
    for i, ln in enumerate(tl["lines"]):
        raw = f"{tmp}/{i:02d}.mp3"
        synth(ln["text"], voice, raw)
        # léger fondu + placement à l'instant exact (adelay en ms)
        delay = int(ln["start"] * 1000)
        inputs += ["-i", raw]
        filt.append(f"[{i}:a]aresample=44100,afade=t=in:d=0.05,adelay={delay}|{delay}[a{i}]")
        labels.append(f"[a{i}]")
        print(f"  {ln['start']:7.2f}s  {ln['text'][:60]}")

    fc = ";".join(filt) + ";" + "".join(labels) + \
        f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0[mix];" + \
        f"[mix]apad,atrim=0:{video_dur:.3f},aresample=44100[out]"
    out = f"vo-{a.name}.m4a"
    subprocess.run(["ffmpeg", "-y", *inputs, "-filter_complex", fc,
                    "-map", "[out]", "-c:a", "aac", "-b:a", "192k", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"\n✓ {out}  ({dur_of(out):.1f}s, vidéo {video_dur:.1f}s)\n→ ./remux.sh {a.name}")

if __name__ == "__main__":
    main()
