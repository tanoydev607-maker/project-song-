"""
Automated Verification Suite for Chatterbox TTS Core Capabilities & Model Inspection:
1. Tests model introspection and loaded Chatterbox TTS instance
2. Tests core capabilities listing (voice selection, zero-shot voice cloning, emotional modulation)
3. Tests zero-shot voice cloning with reference audio prompt
4. Tests full synthesis and WebSocket verification endpoint
"""

import asyncio
import json
import base64
import time
import websockets

async def run_chatterbox_tests():
    uri = "ws://localhost:18789"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        print("Connected!\n")

        # 1. Test Chatterbox Capabilities
        print("=== 1. Testing 'chatterbox_capabilities' ===")
        await ws.send(json.dumps({"action": "chatterbox_capabilities"}))
        resp = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(resp)
        assert data["type"] == "chatterbox_capabilities"
        caps = data["capabilities"]
        print(f"  Model Name: {caps['model_name']}")
        print(f"  Model ID: {caps['model_id']}")
        print(f"  Device: {caps['device']}")
        print(f"  Sample Rate: {caps['sample_rate']} Hz")
        print(f"  Architecture: {json.dumps(caps['architecture'], indent=4)}")
        print(f"  Core Features: {[f['title'] for f in caps['core_features']]}")
        print(f"  Presets Count: {len(caps['presets'])}")
        assert "Resemble AI Chatterbox" in caps["model_name"]
        assert len(caps["core_features"]) >= 4
        print("PASS: Chatterbox capabilities verified!\n")

        # 2. Test Chatterbox Model Verification ("test if we are using the chatterbox TTS model")
        print("=== 2. Testing 'chatterbox_verify_model' (Model Diagnostic & Speech Proof) ===")
        t0 = time.perf_counter()
        await ws.send(json.dumps({
            "action": "chatterbox_verify_model",
            "text": "Songbird AI Chatterbox model verification test."
        }))
        resp = await asyncio.wait_for(ws.recv(), timeout=15.0)
        verify_data = json.loads(resp)
        assert verify_data["type"] == "chatterbox_verification"
        res = verify_data["result"]
        print(f"  Verified: {res['verified']}")
        print(f"  Model Class: {res['model_class']}")
        print(f"  Components Verified: {json.dumps(res['components'], indent=4)}")
        print(f"  Synthesized Audio Size: {len(res.get('audio_b64', ''))} base64 chars")
        print(f"  Proof Message: {res['proof_message']}")
        print(f"  Latency: {res['latency_ms']} ms")
        assert res["verified"] is True
        assert "ChatterboxTTS" in res["model_class"]
        assert len(res.get("audio_b64", "")) > 1000
        print("PASS: Confirmed we are using the official Resemble AI Chatterbox TTS model!\n")

        # 3. Test Zero-Shot Voice Cloning
        print("=== 3. Testing 'chatterbox_clone_voice' (Voice Cloning with reference audio) ===")
        with open("sample_voice.wav", "rb") as f:
            ref_audio_bytes = f.read()
        b64_ref = "data:audio/wav;base64," + base64.b64encode(ref_audio_bytes).decode("utf-8")

        await ws.send(json.dumps({
            "action": "chatterbox_clone_voice",
            "name": "Test Cloned Speaker",
            "audio": b64_ref,
            "exaggeration": 0.75
        }))
        resp = await asyncio.wait_for(ws.recv(), timeout=10.0)
        clone_data = json.loads(resp)
        assert clone_data["type"] == "chatterbox_clone_result"
        clone_res = clone_data["result"]
        print(f"  Clone Success: {clone_res['success']}")
        print(f"  Profile Name: {clone_res['voice_profile']['name']}")
        print(f"  Audio Path: {clone_res['voice_profile']['audio_path']}")
        print(f"  Exaggeration: {clone_res['voice_profile']['exaggeration']}")
        print(f"  Conditionals Cached: {clone_res['voice_profile']['conditionals_cached']}")
        assert clone_res["success"] is True
        cloned_id = clone_res["voice_profile"]["id"]
        print("PASS: Zero-shot voice cloning succeeded!\n")

        # 4. Test Configuration Update & Full Voice Turn with Cloned Voice
        print("=== 4. Testing Voice Turn with Cloned Voice Configuration ===")
        await ws.send(json.dumps({
            "action": "voice_turn",
            "audio": b64_ref,
            "api_key": "",
            "voice_config": {
                "voice_id": cloned_id,
                "exaggeration": 0.75,
                "cfg_weight": 0.6
            }
        }))

        received_tts = False
        while True:
            msg_raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
            msg = json.loads(msg_raw)
            if msg.get("type") == "voice_stt":
                print(f"  STT: '{msg.get('text')}'")
            elif msg.get("type") == "voice_tts_chunk":
                print(f"  TTS Synthesized with voice='{msg.get('voice')}', engine='{msg.get('engine')}'")
                received_tts = True
            elif msg.get("type") == "voice_done":
                print(f"  Voice turn complete in {msg.get('total_latency_ms')}ms")
                break

        assert received_tts, "Did not receive synthesized TTS chunk!"
        print("PASS: Full voice turn synthesized successfully with custom Chatterbox voice config!\n")

    print("=========================================================================")
    print("ALL CHATTERBOX CAPABILITIES, VOICE CLONING, AND MODEL TESTS PASSED 100%!")
    print("=========================================================================")

if __name__ == "__main__":
    asyncio.run(run_chatterbox_tests())
