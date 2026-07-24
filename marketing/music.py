#!/usr/bin/env python3
"""Compose deux musiques d'ambiance ORIGINALES (libres de droits), douces,
distinctes, pour les deux vidéos. Synthèse additive : nappe chaude + arpège
type boîte à musique + basse sinusoïdale + réverbération algorithmique.
Sortie : WAV 44.1 kHz stéréo, fondu d'entrée/sortie."""
import sys
import numpy as np

SR = 44100

# --- Théorie : fréquence d'une note (nom + octave), tempérament égal --------
_NOTES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
          'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def freq(name, octave):
    midi = 12 * (octave + 1) + _NOTES[name]
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def env(n, attack, release, sustain_level=1.0, decay_tau=None):
    """Enveloppe : attaque en cosinus, éventuelle décroissance exponentielle,
    relâche en cosinus."""
    e = np.ones(n) * sustain_level
    a = min(int(attack * SR), n)
    if a > 0:
        e[:a] = 0.5 * (1 - np.cos(np.linspace(0, np.pi, a))) * sustain_level
    r = min(int(release * SR), n)
    if r > 0:
        e[n - r:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, r)))
    if decay_tau:
        t = np.arange(n) / SR
        e *= np.exp(-t / decay_tau)
    return e


def tone(f, dur, harmonics, attack, release, decay_tau=None, detune=0.0, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for mult, ha in harmonics:
        ph = 2 * np.pi * f * mult * t
        sig += ha * np.sin(ph)
        if detune:
            sig += ha * 0.5 * np.sin(2 * np.pi * f * mult * (1 + detune) * t)
    sig *= env(n, attack, release, decay_tau=decay_tau)
    return sig * amp


def bell(f, dur, amp=0.5):
    # boîte à musique / célesta : fondamentale + quelques partiels, décroissance rapide
    return tone(f, dur, [(1, 1.0), (2, 0.28), (3, 0.16), (4, 0.06)],
                attack=0.005, release=0.05, decay_tau=dur * 0.32, amp=amp)


def pad(f, dur, amp=0.16):
    # nappe chaude : partiels doux, détune léger, attaque lente
    return tone(f, dur, [(1, 1.0), (2, 0.5), (3, 0.22), (4, 0.08)],
                attack=1.1, release=1.1, detune=0.0018, amp=amp)


def bass(f, dur, amp=0.28):
    return tone(f, dur, [(1, 1.0), (2, 0.18)], attack=0.03, release=0.25,
                decay_tau=dur * 0.8, amp=amp)


def add(buf, sig, start, pan=0.5):
    n = len(sig)
    i = int(start * SR)
    if i + n > buf.shape[0]:
        n = buf.shape[0] - i
        sig = sig[:n]
    buf[i:i + n, 0] += sig * np.sqrt(1 - pan)
    buf[i:i + n, 1] += sig * np.sqrt(pan)


def reverb(buf, ir_len=1.3, tau=0.38, wet=0.32, predelay=0.02):
    rng = np.random.default_rng(7)
    m = int(ir_len * SR)
    t = np.arange(m) / SR
    decay = np.exp(-t / tau)
    out = np.zeros_like(buf)
    pd = int(predelay * SR)
    for ch in range(2):
        ir = rng.standard_normal(m) * decay
        ir[:pd] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        x = buf[:, ch]
        N = 1 << int(np.ceil(np.log2(len(x) + m)))
        y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]
        out[:, ch] = (1 - wet) * x + wet * y
    return out


def sequence(duration, bpm, prog, octave_shift=0, arp_div=2, color='bright', seed=1):
    """prog : liste de (basse_nom, basse_oct, [(nom, oct)...] accord)."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    bar = beat * 4
    n = int((duration + 2) * SR)
    buf = np.zeros((n, 2))
    t = 0.0
    pi = 0
    while t < duration:
        broot, boct, chord = prog[pi % len(prog)]
        pi += 1
        # nappe : accord tenu sur toute la mesure (2 mesures par accord => plus doux)
        for (nm, oc) in chord:
            add(buf, pad(freq(nm, oc + octave_shift), bar * 1.02), t, pan=0.5)
        # basse : racine, tenue
        add(buf, bass(freq(broot, boct + octave_shift), bar * 0.98), t, pan=0.5)
        # arpège : notes de l'accord, montantes, réparties sur la mesure
        steps = int(round(4 * arp_div))
        notes = [freq(nm, oc + octave_shift + (1 if color == 'bright' else 0)) for (nm, oc) in chord]
        for s in range(steps):
            if color == 'sparse' and s % 2 == 1:
                continue  # arpège plus clairsemé pour la vidéo guide
            f = notes[s % len(notes)]
            if s % len(notes) == 0 and s > 0:
                f *= 2  # petite envolée à l'octave
            nt = t + s * (beat * 4 / steps)
            if nt >= duration:
                break
            a = 0.42 if color == 'bright' else 0.34
            a *= 0.75 + 0.25 * rng.random()
            add(buf, bell(f, beat * 4 / steps * 2.2, amp=a), nt, pan=0.35 + 0.3 * rng.random())
        t += bar
    return buf[:int(duration * SR)]


def master(buf, fade_in=2.5, fade_out=4.0):
    buf = reverb(buf)
    peak = np.max(np.abs(buf))
    if peak > 0:
        buf = buf / peak * 0.9
    buf = np.tanh(buf * 1.1) * 0.9  # limiteur doux
    n = buf.shape[0]
    fi = int(fade_in * SR)
    fo = int(fade_out * SR)
    buf[:fi] *= 0.5 * (1 - np.cos(np.linspace(0, np.pi, fi)))[:, None]
    buf[n - fo:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, fo)))[:, None]
    return buf * 0.82  # niveau doux, sous-jacent


def write_wav(path, buf):
    data = np.clip(buf, -1, 1)
    pcm = (data * 32767).astype('<i2')
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ---- Piste A — PRÉSENTATION : ré majeur, 72 BPM, lumineux, plein d'élan -----
def track_a(dur):
    prog = [
        ('D', 2, [('D', 3), ('F#', 3), ('A', 3)]),
        ('A', 2, [('A', 2), ('C#', 3), ('E', 3)]),
        ('B', 2, [('B', 2), ('D', 3), ('F#', 3)]),
        ('G', 2, [('G', 2), ('B', 2), ('D', 3)]),
    ]
    return master(sequence(dur, 72, prog, arp_div=2, color='bright', seed=3))


# ---- Piste B — GUIDE : fa majeur, 60 BPM, contemplatif, clairsemé -----------
def track_b(dur):
    prog = [
        ('F', 2, [('F', 3), ('A', 3), ('C', 4)]),
        ('C', 2, [('C', 3), ('E', 3), ('G', 3)]),
        ('D', 2, [('D', 3), ('F', 3), ('A', 3)]),
        ('Bb', 1, [('Bb', 2), ('D', 3), ('F', 3)]),
    ]
    return master(sequence(dur, 60, prog, arp_div=1, color='sparse', seed=11), fade_in=3.0, fade_out=5.0)


if __name__ == '__main__':
    which = sys.argv[1]
    dur = float(sys.argv[2])
    out = sys.argv[3]
    buf = track_a(dur) if which == 'a' else track_b(dur)
    write_wav(out, buf)
    print(f'✓ {out}  ({dur:.1f}s, {which})')
