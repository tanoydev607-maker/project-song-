import asyncio
import json
import websockets

async def test_read_aloud_synthesis():
    uri = "ws://localhost:18789"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        # 1. Test Chatterbox Synthesize for Read Aloud
        test_payload = {
            "action": "chatterbox_synthesize",
            "msg_id": "test_msg_read_aloud_123",
            "text": "Songbird is reading this aloud with Resemble AI Chatterbox TTS engine. All systems are operational.",
            "voice_config": {
                "voice_id": "resemble_studio",
                "exaggeration": 0.65,
                "cfg_weight": 0.5,
                "temperature": 0.8
            }
        }
        print("Sending chatterbox_synthesize request...")
        await ws.send(json.dumps(test_payload))

        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
            data = json.loads(raw)
            msg_type = data.get("type")
            print(f"Received message type: {msg_type}")

            if msg_type == "chatterbox_synthesize_result":
                print("\n=== Chatterbox Read Aloud Result ===")
                print(f"Message ID: {data.get('msg_id')}")
                print(f"Engine: {data.get('engine')}")
                print(f"Voice: {data.get('voice')}")
                print(f"MIME type: {data.get('mime_type')}")
                print(f"Latency: {data.get('latency_ms')} ms")
                audio_len = len(data.get("audio_b64", ""))
                print(f"Audio Base64 Payload Length: {audio_len} chars")
                assert audio_len > 1000, "Audio payload should be valid non-empty base64"
                assert data.get("msg_id") == "test_msg_read_aloud_123"
                print("\n[PASS] SUCCESS: Chatterbox Read Aloud synthesis test passed!")
                break
            elif msg_type == "chatterbox_synthesize_error":
                raise RuntimeError(f"Chatterbox synthesize failed: {data.get('error')}")

if __name__ == "__main__":
    asyncio.run(test_read_aloud_synthesis())
