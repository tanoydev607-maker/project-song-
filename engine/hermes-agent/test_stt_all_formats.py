import os
import sys
import time
from voice.stt_moonshine import MoonshineTinySTT

def test_stt():
    print("Initializing MoonshineTinySTT...")
    stt = MoonshineTinySTT()
    assert stt.is_ready, "STT engine not ready"

    formats = [
        ("WAV", "sample_voice.wav"),
        ("WEBM", "sample_voice.webm"),
        ("MP3", "sample_voice.mp3"),
    ]

    for fmt_name, filename in formats:
        if not os.path.exists(filename):
            print(f"Skipping {filename}: file not found")
            continue
        with open(filename, "rb") as f:
            audio_bytes = f.read()
        print(f"\n--- Testing {fmt_name} ({len(audio_bytes)} bytes) ---")
        t0 = time.perf_counter()
        res = stt.transcribe(audio_bytes)
        t1 = time.perf_counter()
        print(f"Result: {res}")
        print(f"Elapsed: {(t1 - t0)*1000:.2f}ms")
        text = res.get("text", "")
        print(f"Transcribed Text: '{text}'")
        assert len(text) > 0, f"STT failed for {fmt_name}: empty transcription!"
        print(f"SUCCESS for {fmt_name}!")

if __name__ == "__main__":
    test_stt()
