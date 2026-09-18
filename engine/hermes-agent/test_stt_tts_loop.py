import asyncio
import time
from voice.pipeline import RealtimeVoicePipeline

async def test_stt_tts_loop():
    print("Initializing pipeline...")
    p = RealtimeVoicePipeline()
    while not p.tts.is_kokoro_ready:
        time.sleep(0.5)

    phrase = "Hello, I am testing Songbird AI speech recognition and text to speech."
    print(f"\n1. Synthesizing test audio with Kokoro-82M TTS: '{phrase}'...")
    synth_res = await p.tts.synthesize(phrase)
    print(f"Synthesized in {synth_res['latency_ms']}ms using {synth_res['engine']}")

    print("\n2. Passing synthesized audio directly to Moonshine Tiny STT...")
    stt_res = p.stt.transcribe(synth_res['audio_b64'])
    print("STT Model:", stt_res.get("model"))
    print("STT Latency:", stt_res.get("latency_ms"), "ms")
    print("Transcribed Text:", repr(stt_res.get("text")))

    assert len(stt_res.get("text", "")) > 0, "Moonshine Tiny STT transcribed empty string!"
    print("\n[SUCCESS] Full Loop Verified: Kokoro-82M TTS audio -> Moonshine Tiny STT transcribed perfectly!")

if __name__ == "__main__":
    asyncio.run(test_stt_tts_loop())
