import asyncio
import json
import websockets
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

async def test_agent():
    print("====================================================")
    print("[INFO] TESTING SONGBIRD HERMES AGENT MODE (LOCAL OLLAMA)")
    print("====================================================\n")

    uri = "ws://localhost:18789"
    print(f"[1/3] Connecting to Hermes Engine on {uri}...")
    try:
        async with websockets.connect(uri, ping_interval=None, ping_timeout=None) as ws:
            print("  [PASS] WebSocket Connected Successfully\n")

            agent_payload = {
                "action": "chat",
                "agent_mode": True,
                "provider": "ollama",
                "model": "gemma:2b",
                "messages": [
                    {
                        "role": "user",
                        "content": "Use tool <tool_call>execute_python\n<arg_key>code</arg_key>\n<arg_value>print(123 * 456)</arg_value></tool_call> to calculate the math."
                    }
                ]
            }

            print("[2/3] Sending Agent Task to Hermes...")
            await ws.send(json.dumps(agent_payload))

            tool_calls_received = []
            tool_results_received = []
            thoughts = []
            stream_tokens = []

            print("\n[3/3] Observing Autonomous Agent Execution Trajectory:")
            print("----------------------------------------------------")

            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=40.0)
                data = json.loads(raw)
                msg_type = data.get("type")

                if msg_type == "thought":
                    thought = data.get("token", "")
                    thoughts.append(thought)
                    sys.stdout.write(f"\033[90m[Thought] {thought.strip()}\033[0m\n")
                    sys.stdout.flush()

                elif msg_type == "tool_start":
                    tool_calls_received.append(data)
                    print(f"\n⚡ \033[93m[TOOL START] {data.get('tool')}\033[0m: {data.get('input')}")

                elif msg_type == "tool_result":
                    tool_results_received.append(data)
                    print(f"✅ \033[92m[TOOL RESULT] {data.get('tool')}\033[0m (Status: {data.get('status')}):")
                    print(f"   Output:\n{data.get('output')}\n")

                elif msg_type == "stream":
                    token = data.get("token", "")
                    stream_tokens.append(token)
                    sys.stdout.write(token)
                    sys.stdout.flush()

                elif msg_type == "done":
                    print("\n----------------------------------------------------")
                    print("  [PASS] Agent Task Completed Successfully")
                    break

            print("\n====================================================")
            print("[AGENT SUMMARY]")
            print(f"- Tool Invocations: {len(tool_calls_received)}")
            print(f"- Tool Results: {len(tool_results_received)}")
            print(f"- Final Response Tokens: {len(stream_tokens)}")
            print("====================================================")

    except Exception as e:
        print(f"\n❌ [FAIL] Error during agent test: {e}")

if __name__ == "__main__":
    asyncio.run(test_agent())
