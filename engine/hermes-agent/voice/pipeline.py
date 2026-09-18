"""
Three-Stage Realtime Voice Agent Pipeline Orchestrator:
Stage 1: Moonshine Tiny Speech-to-Text (STT)
Stage 2: Cloud LLM API Completion & Sentence Chunking
Stage 3: Kokoro Text-to-Speech (TTS)
"""

import asyncio
import time
from typing import AsyncGenerator

from .stt_moonshine import MoonshineTinySTT
from .llm_stream import VoiceLLMStreamer
from .tts_kokoro import KokoroTTSEngine


class RealtimeVoicePipeline:
    """
    Coordinates real-time audio input -> Moonshine Tiny STT -> LLM streaming -> Kokoro TTS.
    """

    def __init__(self, language: str = "en", default_model: str = "google/gemma-4-26b-a4b-it:free"):
        self.stt = MoonshineTinySTT(language=language)
        self.llm = VoiceLLMStreamer(default_model=default_model)
        self.tts = KokoroTTSEngine()

    def get_status(self) -> dict:
        """Health check status of the 3 pipeline stages."""
        return {
            "stt": self.stt.get_capabilities(),
            "llm": {
                "engine": "Cloud LLM API Streaming",
                "default_model": self.llm.default_model
            },
            "tts": self.tts.get_capabilities()
        }

    async def process_voice_turn(
        self,
        audio_payload: bytes | str,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = None,
        chat_history: list[dict] = None,
        custom_system_prompt: str = None,
        temperature: float = 0.7,
        voice_config: dict = None
    ) -> AsyncGenerator[dict, None]:
        """
        Execute the full 3-stage pipeline:
        1. STT: Transcribe user audio with Moonshine Tiny
        2. LLM: Stream answer and chunk sentences
        3. TTS: Synthesize speech for each sentence with Kokoro TTS
        """
        pipeline_start = time.perf_counter()

        # ================= STAGE 1: Moonshine Tiny STT =================
        yield {
            "type": "voice_stage",
            "stage": 1,
            "name": "STT (Moonshine Tiny)",
            "status": "processing"
        }

        stt_result = self.stt.transcribe(audio_payload)
        user_text = (stt_result.get("text") or "").strip()
        stt_latency = stt_result.get("latency_ms", 0.0)

        yield {
            "type": "voice_stt",
            "text": user_text,
            "latency_ms": stt_latency,
            "model": stt_result.get("model", "Moonshine Tiny"),
            "device": stt_result.get("device", "Hardware-Optimized INT8 SIMD")
        }

        if not user_text:
            yield {
                "type": "voice_error",
                "error": "No speech detected in audio input."
            }
            yield {
                "type": "voice_done",
                "total_latency_ms": round((time.perf_counter() - pipeline_start) * 1000, 2)
            }
            return

        # ================= STAGE 2: LLM API Streaming =================
        yield {
            "type": "voice_stage",
            "stage": 2,
            "name": "LLM API Streaming",
            "status": "processing"
        }

        # Background queue to feed Stage 3 (TTS) concurrently
        sentence_queue = asyncio.Queue()
        llm_done_event = asyncio.Event()

        async def run_llm_producer():
            try:
                async for event in self.llm.stream_chat_sentences(
                    user_text=user_text,
                    api_key=api_key,
                    base_url=base_url,
                    model=model,
                    chat_history=chat_history,
                    custom_system_prompt=custom_system_prompt,
                    temperature=temperature
                ):
                    if event["type"] == "token":
                        await sentence_queue.put({"type": "token", "token": event["token"]})
                    elif event["type"] == "sentence":
                        await sentence_queue.put({"type": "sentence", "sentence": event["sentence"], "index": event["index"]})
                    elif event["type"] == "done":
                        await sentence_queue.put(event)
                    elif event["type"] == "error":
                        await sentence_queue.put(event)
            finally:
                llm_done_event.set()
                await sentence_queue.put(None)  # Sentinel

        llm_task = asyncio.create_task(run_llm_producer())

        # ================= STAGE 3: Kokoro TTS Synthesis =================
        yield {
            "type": "voice_stage",
            "stage": 3,
            "name": "Kokoro TTS",
            "status": "ready"
        }

        full_llm_text = ""
        first_audio_emitted = False

        while True:
            item = await sentence_queue.get()
            if item is None:
                break

            item_type = item.get("type")

            if item_type == "token":
                yield {
                    "type": "voice_llm_token",
                    "token": item["token"]
                }

            elif item_type == "sentence":
                sentence = item["sentence"]
                sentence_idx = item["index"]
                
                tts_text = sentence.strip()
                if tts_text:
                    tts_result = await self.tts.synthesize(tts_text, voice_config=voice_config)
                    
                    if not first_audio_emitted:
                        first_audio_emitted = True
                        time_to_first_audio = round((time.perf_counter() - pipeline_start) * 1000, 2)
                        yield {
                            "type": "voice_metrics",
                            "time_to_first_audio_ms": time_to_first_audio
                        }

                    yield {
                        "type": "voice_tts_chunk",
                        "index": sentence_idx,
                        "text": tts_text,
                        "audio_b64": tts_result["audio_b64"],
                        "mime_type": tts_result["mime_type"],
                        "latency_ms": tts_result["latency_ms"],
                        "engine": tts_result["engine"],
                        "voice": tts_result.get("voice", "")
                    }

            elif item_type == "done":
                full_llm_text = item.get("full_text", "")
                yield {
                    "type": "voice_llm_done",
                    "full_text": full_llm_text,
                    "first_token_latency_ms": item.get("first_token_latency_ms", 0),
                    "total_latency_ms": item.get("total_latency_ms", 0)
                }

            elif item_type == "error":
                yield {
                    "type": "voice_error",
                    "error": item.get("error", "LLM streaming failed")
                }

        await llm_task

        total_pipeline_latency = round((time.perf_counter() - pipeline_start) * 1000, 2)
        yield {
            "type": "voice_done",
            "user_prompt": user_text,
            "assistant_response": full_llm_text,
            "total_latency_ms": total_pipeline_latency
        }
