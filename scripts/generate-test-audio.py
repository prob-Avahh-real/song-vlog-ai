#!/usr/bin/env python3
"""Generate a 6-second test WAV with tempo pulses for song-vlog-ai E2E tests."""
import math
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "test-fixtures" / "test-beat-120bpm.wav"
OUT.parent.mkdir(parents=True, exist_ok=True)

SR = 44100
BPM = 120
BEAT = 60 / BPM
DURATION = 6.0
N = int(SR * DURATION)

with wave.open(str(OUT), "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = []
    for i in range(N):
        t = i / SR
        beat_phase = (t % BEAT) / BEAT
        kick = 0.6 * math.sin(2 * math.pi * 80 * t) * math.exp(-beat_phase * 8)
        hat = 0.15 * math.sin(2 * math.pi * 8000 * t) * (1 if beat_phase < 0.05 else 0)
        melody = 0.25 * math.sin(2 * math.pi * 440 * t)
        env = 0.5 + 0.5 * math.sin(2 * math.pi * t / DURATION)
        sample = max(-1, min(1, (kick + hat + melody) * env))
        frames.append(struct.pack("<h", int(sample * 32767 * 0.8)))
    w.writeframes(b"".join(frames))

print(f"✅ Generated {OUT} ({DURATION}s, {BPM} BPM)")
