"""Makes the store's loudspeaker announcements, for Ruokakauppa and the 3D test, from Sunná's lines (audio/announce-*.mp3, fetched by tools/fetch_voices.py):
a chime first, then the voice as through a small, cheap ceiling speaker in a big hall, with a little hum and hiss, and at the end
a burst of crackling static, as if a cable was loose. Writes audio/pa-*.mp3. Everything but the voice is made here.

    python3 tools/store3d/make_announcements.py   (needs numpy, and ffmpeg: see tools/audio_mp3.py)
"""
import glob, io, os, sys, wave
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from audio_mp3 import mp3_to_wav_bytes, wav_to_mp3

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
RATE = 22050
rng = np.random.default_rng(7)


def read(path):
    with wave.open(io.BytesIO(mp3_to_wav_bytes(path, RATE))) as w:
        assert w.getframerate() == RATE and w.getsampwidth() == 2
        data = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
        return data if w.getnchannels() == 1 else data.reshape(-1, w.getnchannels()).mean(1)


def write(path, data):
    data = np.clip(data, -1, 1)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((data * 32767).astype(np.int16).tobytes())
    wav_to_mp3(buffer.getvalue(), path)


def speaker(x):
    """A small speaker: no bass, no treble, a honk around 1.8 kHz, and a little overdrive."""
    spectrum = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    shape = 1 / (1 + (380 / np.maximum(f, 1)) ** 4) / (1 + (f / 3300) ** 6)
    shape *= 1 + 1.2 * np.exp(-((f - 1800) / 450) ** 2)
    y = np.fft.irfft(spectrum * shape, len(x))
    y /= np.abs(y).max() + 1e-9
    return np.tanh(y * 2.2) / np.tanh(2.2)


def hall(x):
    """A few echoes off the far walls of the shop."""
    out = x.copy()
    for ms, level in ((63, 0.28), (131, 0.16), (217, 0.09), (340, 0.05)):
        d = int(RATE * ms / 1000)
        out[d:] += x[:-d] * level
    return out


def chime():
    """The usual two notes before an announcement, high then low."""
    t = np.arange(int(RATE * 1.3)) / RATE
    out = np.zeros_like(t)
    for freq, start in ((784.0, 0.0), (622.3, 0.42)):
        tt = np.clip(t - start, 0, None)
        on = t >= start
        for ratio, level in ((1, 1.0), (2, 0.25), (3.01, 0.1)):
            out += on * level * np.sin(2 * np.pi * freq * ratio * tt) * np.exp(-tt * (2.6 + ratio))
    return out * 0.5


def static(seconds=0.9):
    """A loose cable: crackle, a buzz that comes and goes, and a last sharp cut."""
    n = int(RATE * seconds)
    t = np.arange(n) / RATE
    hiss = rng.normal(0, 1, n)
    # Bursts of crackle, gated on and off.
    gate = np.repeat(rng.random(n // 220 + 1) > 0.45, 220)[:n] * (0.4 + 0.6 * rng.random(n))
    crackle = hiss * gate
    # The buzz: mains hum and its harmonics, swelling up as the cable shifts.
    buzz = sum(np.sign(np.sin(2 * np.pi * 50 * h * t)) / h for h in (1, 2, 3, 5)) * 0.35
    swell = np.clip(np.sin(np.pi * t / seconds) * 1.6, 0, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    out = crackle * 0.5 + buzz * swell
    out[-int(RATE * 0.02):] *= np.linspace(1, 0, int(RATE * 0.02))
    return speaker(out) * 0.55


for path in sorted(glob.glob(os.path.join(ROOT, "audio", "announce-*.mp3"))):
    voice = read(path)
    voice = speaker(voice) * 0.85
    gap = np.zeros(int(RATE * 0.25))
    body = np.concatenate([speaker(chime()) * 0.5, gap, voice, np.zeros(int(RATE * 0.12)), static()])
    body = hall(body)
    n = len(body)
    t = np.arange(n) / RATE
    body += 0.012 * np.sin(2 * np.pi * 50 * t) + 0.006 * np.sin(2 * np.pi * 150 * t) + rng.normal(0, 0.006, n)  # hum and hiss
    lead = int(RATE * 0.03)
    body[:lead] *= np.linspace(0, 1, lead)
    body /= np.abs(body).max() / 0.8
    name = os.path.basename(path).replace("announce-", "pa-")
    write(os.path.join(ROOT, "audio", name), body)
    print(name, f"{n / RATE:.1f} s")
