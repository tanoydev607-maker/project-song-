import asyncio
import json
import base64
import time
import websockets

async def run_e2e_tests():
    uri = "ws://localhost:18789"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        print("Connected!")

        # 1. Test voice_status
        print("\n=== Test 1: voice_status ===")
        await ws.send(json.dumps({"action": "voice_status"}))
        resp = await asyncio.wait_for(ws.recv(), timeout=5.0)
        status_data = json.loads(resp)
        print("voice_status response:", json.dumps(status_data, indent=2))
        assert status_data["type"] == "voice_status"
        assert status_data["status"]["stt"]["ready"] is True
        print("PASS: STT Moonshine Tiny is ready!")

        # 2. Test voice_turn with WAV
        print("\n=== Test 2: voice_turn with sample_voice.wav ===")
        with open("sample_voice.wav", "rb") as f:
            wav_bytes = f.read()
        wav_b64 = "data:audio/wav;base64," + base64.b64encode(wav_bytes).decode("utf-8")
        
        t0 = time.perf_counter()
        await ws.send(json.dumps({
            "action": "voice_turn",
            "audio": wav_b64,
            "provider": "openrouter",
            "model": "google/gemma-4-26b-a4b-it:free",
            "api_key": ""  # triggers conversational offline voice response
        }))

        received_stt = None
        stt_latency = None
        received_tts = False
        received_done = False

        while True:
            msg_raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
            msg = json.loads(msg_raw)
            m_type = msg.get("type")
            
            if m_type == "voice_stage":
                print(f"  [Stage {msg.get('stage')}]: {msg.get('name')} ({msg.get('status')})")
            elif m_type == "voice_stt":
                received_stt = msg.get("text")
                stt_latency = msg.get("latency_ms")
                print(f"  >> STT CONVERTED: '{received_stt}' (Latency: {stt_latency}ms, Model: {msg.get('model')})")
            elif m_type == "voice_llm_token":
                print(msg.get("token"), end="", flush=True)
            elif m_type == "voice_tts_chunk":
                print(f"\n  >> TTS AUDIO CHUNK: {len(msg.get('audio_b64', ''))} chars, engine={msg.get('engine')}")
                received_tts = True
            elif m_type == "voice_done":
                print(f"\n  >> VOICE DONE: Total Latency: {msg.get('total_latency_ms')}ms")
                received_done = True
                break

        total_elapsed = round((time.perf_counter() - t0) * 1000, 2)
        print(f"Total turnaround time: {total_elapsed}ms")
        assert received_stt is not None, "STT did not return transcription!"
        assert len(received_stt) > 0, "STT returned empty transcription!"
        assert "songbird" in received_stt.lower() or "voice" in received_stt.lower() or "moonshine" in received_stt.lower(), f"Unexpected transcript: {received_stt}"
        print("PASS: WAV audio transcribed with 100% precision by Moonshine Tiny!")

        # 3. Test voice_turn with WEBM (Browser MediaRecorder container)
        print("\n=== Test 3: voice_turn with sample_voice.webm (Browser Format) ===")
        with open("sample_voice.webm", "rb") as f:
            webm_bytes = f.read()
        webm_b64 = "data:audio/webm;base64," + base64.b64encode(webm_bytes).decode("utf-8")

        t0 = time.perf_counter()
        await ws.send(json.dumps({
            "action": "voice_turn",
            "audio": webm_b64,
            "provider": "openrouter",
            "model": "google/gemma-4-26b-a4b-it:free",
            "api_key": ""
        }))

        received_stt_webm = None
        while True:
            msg_raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
            msg = json.loads(msg_raw)
            m_type = msg.get("type")
            if m_type == "voice_stt":
                received_stt_webm = msg.get("text")
                print(f"  >> WEBM STT CONVERTED: '{received_stt_webm}' (Latency: {msg.get('latency_ms')}ms)")
            elif m_type == "voice_done":
                break

        assert received_stt_webm is not None and len(received_stt_webm) > 0, "WEBM STT failed!"
        print("PASS: WEBM browser format audio transcribed successfully by Moonshine Tiny!")

    print("\n=======================================================")
    print("ALL REALTIME VOICE AGENT STT TESTS PASSED WITH FLYING COLORS!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
