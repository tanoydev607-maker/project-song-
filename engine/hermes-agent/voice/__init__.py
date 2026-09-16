"""
Voice Pipeline Subsystem for Songbird / Orca-O1
Three-Stage Realtime Voice Agent:
- Stage 1: Moonshine Tiny STT (Useful Sensors / Moonshine AI)
- Stage 2: LLM API Streaming (OpenRouter / OpenAI-compatible)
- Stage 3: Kokoro TTS (Kokoro-82M / nazdridoy)
"""

from .stt_moonshine import MoonshineTinySTT
from .llm_stream import VoiceLLMStreamer
from .tts_kokoro import KokoroTTSEngine

# Backward-compatibility alias
ChatterboxTTSEngine = KokoroTTSEngine

from .pipeline import RealtimeVoicePipeline

__all__ = [
    "MoonshineTinySTT",
    "VoiceLLMStreamer",
    "KokoroTTSEngine",
    "ChatterboxTTSEngine",
    "RealtimeVoicePipeline",
]

