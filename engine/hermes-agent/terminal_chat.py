import asyncio
import json
import sys
import websockets

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

async def chat_session():
    uri = "ws://localhost:18789"
    print(f"{CYAN}{BOLD}===================================================={RESET}")
    print(f"{CYAN}{BOLD}☤ ORCA-O1 / HERMES AGENT - INTERACTIVE TERMINAL{RESET}")
    print(f"{CYAN}{BOLD}===================================================={RESET}")
    print(f"{DIM}Connecting to engine on {uri}...{RESET}")

    try:
        async with websockets.connect(uri, ping_interval=None, ping_timeout=None, max_size=None) as ws:
            # Ping
            await ws.send(json.dumps({"action": "ping"}))
            pong = json.loads(await ws.recv())
            models = pong.get("models", ["gemma:2b"])
            model_name = models[0] if models else "gemma:2b"
            print(f"{GREEN}✓ Connected to Hermes Engine Daemon{RESET}")
            print(f"{DIM}Model: {model_name} | Type 'exit' or 'quit' to quit.{RESET}\n")

            history = []

            while True:
                try:
                    user_input = input(f"{BOLD}{GREEN}You > {RESET}").strip()
                except (EOFError, KeyboardInterrupt):
                    print(f"\n{YELLOW}Exiting terminal chat...{RESET}")
                    break

                if not user_input:
                    continue
                if user_input.lower() in ("exit", "quit", "q"):
                    print(f"{YELLOW}Goodbye!{RESET}")
                    break

                history.append({"role": "user", "content": user_input})

                payload = {
                    "action": "chat",
                    "messages": history,
                    "model": model_name,
                    "temperature": 0.7
                }
                await ws.send(json.dumps(payload))

                print(f"\n{BOLD}{CYAN}Hermes > {RESET}", end="", flush=True)

                in_thought = False
                assistant_response = []

                while True:
                    raw = await ws.recv()
                    chunk = json.loads(raw)
                    msg_type = chunk.get("type")

                    if msg_type == "thought":
                        if not in_thought:
                            print(f"\n{DIM}{YELLOW}[Thinking: ", end="", flush=True)
                            in_thought = True
                        print(chunk.get("token", ""), end="", flush=True)
                    elif msg_type == "stream":
                        if in_thought:
                            print(f"]{RESET}\n{BOLD}{CYAN}Hermes > {RESET}", end="", flush=True)
                            in_thought = False
                        token = chunk.get("token", "")
                        print(token, end="", flush=True)
                        assistant_response.append(token)
                    elif msg_type == "done":
                        if in_thought:
                            print(f"]{RESET}")
                        print("\n")
                        break

                history.append({"role": "assistant", "content": "".join(assistant_response)})

    except Exception as e:
        print(f"\n{YELLOW}Connection closed: {e}{RESET}")
        print(f"{DIM}Start the daemon with: pnpm dev:engine{RESET}\n")

if __name__ == "__main__":
    asyncio.run(chat_session())
