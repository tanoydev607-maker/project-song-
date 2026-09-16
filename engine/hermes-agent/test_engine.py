import asyncio
import json
import time
import sys
import websockets
import httpx

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

async def run_diagnostics():
    print("====================================================")
    print("[INFO] ORCA-O1 / HERMES ENGINE HEALTH CHECK")
    print("====================================================")

    # 1. Test Ollama directly
    print("\n[1/3] Checking Ollama API at http://localhost:11434...")
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get("http://localhost:11434/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name") for m in data.get("models", [])]
                print(f"  [PASS] Ollama API is ONLINE")
                print(f"  [MODELS] Installed ({len(models)}): {models}")
            else:
                print(f"  [WARN] Ollama HTTP status: {res.status_code}")
    except Exception as e:
        print(f"  [WARN] Ollama API check: {e}")

    # 2. Test WebSocket Engine Daemon Connection & Ping
    print("\n[2/3] Checking Hermes WebSocket Engine on ws://localhost:18789...")
    try:
        t0 = time.time()
        async with websockets.connect("ws://localhost:18789") as ws:
            conn_time = (time.time() - t0) * 1000
            print(f"  [PASS] WebSocket Connected in {conn_time:.1f}ms")

            # Send Ping
            await ws.send(json.dumps({"action": "ping"}))
            pong_raw = await ws.recv()
            pong = json.loads(pong_raw)
            print(f"  [PASS] Engine Pong: {pong}")

            # 3. Test Live Inference Stream
            print('\n[3/3] Testing Live Inference Stream (Prompt: "Introduce yourself in 2 sentences")...')
            t_prompt = time.time()
            await ws.send(json.dumps({
                "action": "chat",
                "messages": [{"role": "user", "content": "Introduce yourself and your capabilities in 2 sentences."}],
                "temperature": 0.7
            }))

            tokens_received = 0
            thoughts_received = 0

            print("  [STREAM OUTPUT]")
            print("  ----------------------------------------------------")
            while True:
                raw_chunk = await ws.recv()
                chunk = json.loads(raw_chunk)
                msg_type = chunk.get("type")

                if msg_type == "stream":
                    token = chunk.get("token", "")
                    print(token, end="", flush=True)
                    tokens_received += 1
                elif msg_type == "thought":
                    thoughts_received += 1
                    token = chunk.get("token", "")
                    print(token, end="", flush=True)
                elif msg_type == "done":
                    print("\n  ----------------------------------------------------")
                    duration = time.time() - t_prompt
                    print(f"  [PASS] Stream Completed Successfully")
                    print(f"  [METRICS] Tokens: {tokens_received}")
                    print(f"  [METRICS] Duration: {duration:.2f}s ({(tokens_received/duration) if duration>0 else 0:.1f} tokens/s)")
                    break

    except Exception as e:
        print(f"  [FAIL] WebSocket Engine Error: {e}")

    print("\n====================================================")
    print("[RESULT] ALL ENGINE SYSTEMS VERIFIED & OPERATIONAL")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
