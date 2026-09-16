import asyncio
import json
import websockets

async def test_kokoro_synthesis():
    uri = "ws://localhost:18789"
    print(f"[Kokoro Test] Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        # 1. Test Kokoro Capabilities
        print("[Kokoro Test] 1. Requesting kokoro_capabilities...")
        await ws.send(json.dumps({"action": "kokoro_capabilities"}))
        resp = await asyncio.wait_for(ws.recv(), timeout=10.0)
        data = json.loads(resp)
        assert data.get("type") == "kokoro_capabilities", f"Expected kokoro_capabilities, got {data.get('type')}"
        caps = data.get("capabilities", {})
        print(f"  Model: {caps.get('model_name')}")
        print(f"  Device: {caps.get('device')}")
        print(f"  Sample Rate: {caps.get('sample_rate')} Hz")
        print(f"  Presets Count: {len(caps.get('presets', []))}")
        print(f"  Model Ready: {caps.get('model_ready')}")

        # 2. Test Kokoro Model Verification
        print("\n[Kokoro Test] 2. Requesting kokoro_verify_model...")
        await ws.send(json.dumps({
            "action": "kokoro_verify_model",
            "text": "Kokoro TTS is operational on Songbird AI."
        }))
        v_resp = await asyncio.wait_for(ws.recv(), timeout=20.0)
        v_data = json.loads(v_resp)
        assert v_data.get("type") == "kokoro_verification"
        v_res = v_data.get("result", {})
        print(f"  Verified: {v_res.get('verified')}")
        print(f"  Engine: {v_res.get('synthesized_engine')}")
        print(f"  Latency: {v_res.get('latency_ms')} ms")
        print(f"  Proof: {v_res.get('proof_message')}")
        assert len(v_res.get("audio_b64", "")) > 1000

        # 3. Test Kokoro Synthesize (Read Aloud)
        print("\n[Kokoro Test] 3. Requesting kokoro_synthesize...")
        test_payload = {
            "action": "kokoro_synthesize",
            "msg_id": "test_kokoro_msg_001",
            "text": "Songbird AI has switched to Kokoro TTS. This is crystal clear speech synthesized with eighty-two million parameters.",
            "voice_config": {
                "voice_id": "af_bella",
                "speed": 1.0,
                "lang": "en-us"
            }
        }
        await ws.send(json.dumps(test_payload))

        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
            msg = json.loads(raw)
            m_type = msg.get("type")
            if m_type == "kokoro_synthesize_result":
                print(f"\n=== Kokoro Read Aloud Result ===")
                print(f"Message ID: {msg.get('msg_id')}")
                print(f"Engine: {msg.get('engine')}")
                print(f"Voice: {msg.get('voice')}")
                print(f"MIME type: {msg.get('mime_type')}")
                print(f"Latency: {msg.get('latency_ms')} ms")
                audio_len = len(msg.get("audio_b64", ""))
                print(f"Audio Base64 Payload Length: {audio_len:,} chars")
                assert audio_len > 1000, "Audio payload should be valid non-empty base64"
                assert msg.get("msg_id") == "test_kokoro_msg_001"
                print("\n[PASS] SUCCESS: Kokoro TTS synthesis test passed!")
                break
            elif m_type == "kokoro_synthesize_error":
                raise RuntimeError(f"Kokoro synthesize error: {msg.get('error')}")

if __name__ == "__main__":
    asyncio.run(test_kokoro_synthesis())
