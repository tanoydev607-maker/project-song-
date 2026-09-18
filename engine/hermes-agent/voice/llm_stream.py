"""
Stage 2: LLM API Streaming Engine
Interfaces with OpenRouter / OpenAI-compatible LLM endpoints with sentence-chunking
optimized for low-latency conversational speech synthesis.
"""

import json
import re
import time
from typing import AsyncGenerator
import httpx

EMOJI_PATTERN = re.compile(
    r"["
    r"\U0001F600-\U0001F64F"  # emoticons
    r"\U0001F300-\U0001F5FF"  # symbols & pictographs
    r"\U0001F680-\U0001F6FF"  # transport & map symbols
    r"\U0001F1E0-\U0001F1FF"  # flags
    r"\U0001F700-\U0001F77F"  # alchemical symbols
    r"\U0001F780-\U0001F7FF"  # geometric shapes extended
    r"\U0001F800-\U0001F8FF"  # supplemental arrows-c
    r"\U0001F900-\U0001F9FF"  # supplemental symbols and pictographs
    r"\U0001FA00-\U0001FA6F"  # chess symbols
    r"\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
    r"\U00002702-\U000027B0"  # dingbats
    r"\U000024C2-\U0001F251"  # enclosed characters
    r"\U0001F004-\U0001F0CF"  # domino, mahjong, playing cards
    r"\U00002600-\U000026FF"  # miscellaneous symbols
    r"\U00002300-\U000023FF"  # miscellaneous technical
    r"\U0000FE0F"              # variation selector-16
    r"\U0000200D"              # zero-width joiner
    r"]+",
    flags=re.UNICODE
)

def strip_emojis(text: str) -> str:
    """Remove any emojis or emoticons from text, preserving regular text and LaTeX math."""
    if not text:
        return ""
    return EMOJI_PATTERN.sub("", text)

VOICE_AGENT_SYSTEM_PROMPT = (
    "You are the real-time voice intelligence of Songbird. You are speaking directly with the user over audio.\n"
    "- Respond in natural, conversational, clear spoken English.\n"
    "- Keep replies concise (1-3 sentences) unless the user asks for detailed explanation.\n"
    "- Do NOT output markdown tables, asterisks, bullet points, hashtags, or code blocks unless explicitly requested, as your text will be read aloud by TTS.\n"
    "- CRITICAL: Do NOT use any emojis or emoticons under any circumstances. Output clean text only.\n"
    "- For any mathematical formulas or equations, speak them clearly and format them with standard LaTeX notation.\n"
    "- Be warm, helpful, responsive, and direct."
)


class VoiceLLMStreamer:
    """
    Streams completions from cloud LLM API (OpenRouter/OpenAI-compatible)
    and segments tokens into speakable sentence units for TTS.
    """

    def __init__(self, default_model: str = "google/gemma-4-26b-a4b-it:free"):
        self.default_model = default_model

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text on sentence boundaries."""
        sentences = re.split(r'(?<=[.?!])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    async def stream_chat_sentences(
        self,
        user_text: str,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = None,
        chat_history: list[dict] = None,
        custom_system_prompt: str = None,
        temperature: float = 0.7
    ) -> AsyncGenerator[dict, None]:
        """
        Stream tokens from LLM and yield dictionaries:
        - {"type": "token", "token": "..."}
        - {"type": "sentence", "sentence": "...", "index": i}
        - {"type": "done", "full_text": "...", "latency_ms": ...}
        """
        start_time = time.perf_counter()
        target_model = model or self.default_model
        endpoint = f"{base_url.rstrip('/')}/chat/completions"

        system_msg = custom_system_prompt or VOICE_AGENT_SYSTEM_PROMPT
        messages = [{"role": "system", "content": system_msg}]

        if chat_history:
            for m in chat_history[-6:]:  # Keep recent context
                messages.append({
                    "role": m.get("role") or m.get("sender") or "user",
                    "content": m.get("content") or m.get("text", "")
                })

        messages.append({"role": "user", "content": user_text})

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else ""
        }
        if "openrouter.ai" in endpoint:
            headers["HTTP-Referer"] = "https://github.com/tanoydev607-maker/Songbird"
            headers["X-Title"] = "Songbird Realtime Voice Agent"

        payload = {
            "model": target_model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
            "max_tokens": 512
        }

        sentence_buffer = ""
        full_text = ""
        sentence_idx = 0
        first_token_received = False
        first_token_latency = 0.0

        # If no API key provided, produce a direct voice response so STT & TTS stages complete
        if not api_key:
            fallback_text = f"I heard you loud and clear! You said: '{user_text}'. To enable real-time AI responses, please add your API key in Settings."
            for word in fallback_text.split():
                yield {"type": "token", "token": word + " "}
                time.sleep(0.01)
            yield {
                "type": "sentence",
                "sentence": fallback_text,
                "index": 1
            }
            yield {
                "type": "done",
                "full_text": fallback_text,
                "first_token_latency_ms": 10.0,
                "total_latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "model": "offline-voice-assistant"
            }
            return

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        err_str = err_body.decode('utf-8', errors='ignore')
                        # If unauthorized or error, deliver friendly voice notification
                        fallback_msg = f"I heard: '{user_text}'. However, the LLM service returned an error ({response.status_code}). Please check your API key."
                        yield {"type": "token", "token": fallback_msg}
                        yield {"type": "sentence", "sentence": fallback_msg, "index": 1}
                        yield {
                            "type": "done",
                            "full_text": fallback_msg,
                            "first_token_latency_ms": 50.0,
                            "total_latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                            "model": target_model
                        }
                        return

                    async for line in response.aiter_lines():
                        line_str = line.strip()
                        if not line_str or not line_str.startswith("data: "):
                            continue
                        data_str = line_str[6:].strip()
                        if data_str == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if not choices:
                                continue
                            raw_token = delta.get("content", "")
                            token = strip_emojis(raw_token)
                            if not token:
                                continue

                            if not first_token_received:
                                first_token_received = True
                                first_token_latency = round((time.perf_counter() - start_time) * 1000, 2)

                            full_text += token
                            sentence_buffer += token

                            yield {"type": "token", "token": token}

                            # Check for sentence termination
                            # Suffix match on '.', '?', '!', or newline with minimum length
                            if len(sentence_buffer) >= 20 and re.search(r'[.?!]\s+$', sentence_buffer):
                                sentence_to_speak = strip_emojis(sentence_buffer.strip())
                                sentence_buffer = ""
                                if sentence_to_speak:
                                    sentence_idx += 1
                                    yield {
                                        "type": "sentence",
                                        "sentence": sentence_to_speak,
                                        "index": sentence_idx
                                    }

                        except json.JSONDecodeError:
                            continue

            # Yield remaining sentence buffer if any
            clean_rem = strip_emojis(sentence_buffer.strip())
            if clean_rem:
                sentence_idx += 1
                yield {
                    "type": "sentence",
                    "sentence": clean_rem,
                    "index": sentence_idx
                }

            total_latency = round((time.perf_counter() - start_time) * 1000, 2)
            yield {
                "type": "done",
                "full_text": strip_emojis(full_text.strip()),
                "first_token_latency_ms": first_token_latency,
                "total_latency_ms": total_latency,
                "model": target_model
            }

        except Exception as e:
            yield {"type": "error", "error": str(e)}
