#!/usr/bin/env python3
"""Cut the background tracks in audio/ambience/ out of CC0 recordings from Freesound (see CREDITS.md).

MP3 is cut between its frames, so nothing is decoded or encoded again. The game blends each track's
end into its start when it loads it, so that the loop has no audible join.

Usage: python3 tools/make_ambience.py RAW_FOLDER
"""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio/ambience"
# Place: where to start and how long, in seconds. Mostly the steadiest stretch of a recording, with quiet ends for
# the loop's join.
TRACKS = {"forest": (71.5, 30.2), "city": (20, 30.2), "home": (279, 30.2), "library": (241, 30.2), "classroom": (13, 30.2), "store": (9.5, 30.2)}
BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
RATES = [44100, 48000, 32000]


def frames(data):
    """Where each MPEG-1 layer III frame starts, its length and its seconds."""
    at = 0
    if data[:3] == b"ID3":
        at = 10 + ((data[6] & 127) << 21 | (data[7] & 127) << 14 | (data[8] & 127) << 7 | (data[9] & 127))
    while at + 4 <= len(data):
        if data[at] != 0xFF or data[at + 1] & 0xFE != 0xFA:
            at += 1
            continue
        bitrate, rate = BITRATES[data[at + 2] >> 4], RATES[(data[at + 2] >> 2) & 3]
        if not bitrate:
            at += 1
            continue
        length = 144000 * bitrate // rate + ((data[at + 2] >> 1) & 1)
        yield at, length, 1152 / rate
        at += length


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", type=Path)
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    for place, (start, long) in TRACKS.items():
        data = (args.raw / f"{place}.mp3").read_bytes()
        kept, seconds, clock = bytearray(), 0.0, 0.0
        for at, length, duration in frames(data):
            if clock >= start and seconds < long and at + length <= len(data):
                kept += data[at:at + length]
                seconds += duration
            clock += duration
        (OUT / f"{place}.mp3").write_bytes(kept)
        print(f"{place}: {seconds:.1f} s of {clock:.1f} s, {len(kept) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
