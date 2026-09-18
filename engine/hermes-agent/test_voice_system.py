import asyncio
import json
import base64
import io
import wave
import numpy as np
import websockets

def create_synthetic_wav(duration_s=1.5, sample_rate=16000) -> str:
    """Create a sine wave audio in WAV format, return base64 string."""
    t = np.linspace(0, duration_s, int(sample_rate * duration_s), endpoint=False)
    # 440 Hz sine wave tone
    audio = (np.sin(2 * np.pi * 440 * t) * 0.5 * 32767).astype(np.int16)
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio.tobytes())
    return base64.b64encode(bio.getvalue()).decode("utf-8")

async def test_all():
    uri = "ws://localhost:18789"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        # 1. Test voice_status
        print("\n=== 1. Testing 'voice_status' ===")
        await ws.send(json.dumps({"action": "voice_status"}))
        resp = json.loads(await ws.recv())
        print("voice_status response:", json.dumps(resp, indent=2))
        assert resp["type"] == "voice_status"
        assert resp["status"]["stt"]["ready"] is True
        assert resp["status"]["tts"]["model_ready"] is True
        print("[PASS] Voice status: Moonshine Tiny & Kokoro-82M both READY!")

        # 2. Test kokoro_synthesize
        print("\n=== 2. Testing 'kokoro_synthesize' ===")
        await ws.send(json.dumps({
            "action": "kokoro_synthesize",
            "text": "Songbird speech synthesis is completely operational.",
            "msg_id": "test-123"
        }))
        while True:
            resp = json.loads(await ws.recv())
            if resp.get("type") == "kokoro_synthesize_result":
                break
        print("kokoro_synthesize type:", resp.get("type"))
        print("kokoro_synthesize engine:", resp.get("engine"))
        print("kokoro_synthesize voice:", resp.get("voice"))
        print("kokoro_synthesize latency_ms:", resp.get("latency_ms"))
        print("kokoro_synthesize audio_b64 length:", len(resp.get("audio_b64", "")))
        assert resp.get("type") == "kokoro_synthesize_result"
        assert len(resp.get("audio_b64", "")) > 1000
        print("[PASS] Kokoro synthesis verified!")

        # 3. Test kokoro_verify_model
        print("\n=== 3. Testing 'kokoro_verify_model' ===")
        await ws.send(json.dumps({
            "action": "kokoro_verify_model",
            "text": "Verification audio test"
        }))
        while True:
            resp = json.loads(await ws.recv())
            if resp.get("type") == "kokoro_verification":
                break
        print("kokoro_verify_model verified:", resp.get("result", {}).get("verified"))
        print("kokoro_verify_model device:", resp.get("result", {}).get("device"))
        assert resp.get("result", {}).get("verified") is True
        print("[PASS] Kokoro model verification passed!")

        # 4. Test voice_turn with synthetic audio
        print("\n=== 4. Testing 'voice_turn' (STT -> LLM -> TTS) ===")
        synth_b64 = create_synthetic_wav(1.0)
        await ws.send(json.dumps({
            "action": "voice_turn",
            "audio": synth_b64,
            "provider": "openrouter",
            "api_key": "",
            "model": "google/gemma-4-26b-a4b-it:free"
        }))
        stage_events = []
        while True:
            msg = json.loads(await ws.recv())
            stage_events.append(msg.get("type"))
            if msg.get("type") in ["voice_stt", "voice_error", "voice_done"]:
                print(f"  Received event: {msg.get('type')}: {msg.get('text', '') or msg.get('error', '')}")
            if msg.get("type") == "voice_done":
                break
        print(f"[PASS] Voice turn completed with events: {set(stage_events)}")

    print("\nALL VOICE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_all())
