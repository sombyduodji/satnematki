"""The game's sound files are MP3: mono, 48 kbit/s, which every browser and phone plays and which sounds the same as the
WAV the voices come as, at about a seventh of the size. This turns WAV into MP3 and back, with ffmpeg.

ffmpeg is looked for in $FFMPEG, then on the PATH, then in ~/.cache/audio-tools (pip's imageio-ffmpeg, for a computer
without one installed system-wide).
"""
import glob
import os
import shutil
import subprocess
from pathlib import Path

BITRATE = "48k"


def ffmpeg():
    found = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not found:
        found = next(iter(sorted(glob.glob(str(Path.home() / ".cache/audio-tools/lib/python*/site-packages/imageio_ffmpeg/binaries/ffmpeg-*")))), None)
    if not found:
        raise SystemExit("ffmpeg is needed: install it, or set FFMPEG to where it is.")
    return found


def wav_to_mp3(wav, out):
    """WAV as bytes or a path, to an MP3 file at out (written whole or not at all)."""
    out = Path(out)
    partial = out.with_suffix(".part.mp3")
    source = ["-i", "pipe:0"] if isinstance(wav, (bytes, bytearray)) else ["-i", str(wav)]
    subprocess.run([ffmpeg(), "-v", "error", "-y", *source, "-ac", "1", "-c:a", "libmp3lame", "-b:a", BITRATE, str(partial)],
                   input=wav if isinstance(wav, (bytes, bytearray)) else None, check=True)
    partial.replace(out)


def mp3_to_wav_bytes(path, rate=22050):
    """An MP3 file as 16-bit mono WAV bytes at the given rate, for tools that work on the sound itself."""
    return subprocess.run([ffmpeg(), "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(rate), "-f", "wav", "pipe:1"],
                          capture_output=True, check=True).stdout
