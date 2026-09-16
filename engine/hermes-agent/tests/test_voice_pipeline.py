"""
Automated Integration Tests for the Three-Stage Realtime Voice Agent Pipeline:
- Stage 1: Moonshine Tiny STT
- Stage 2: LLM API Streamer
- Stage 3: Chatterbox TTS Engine
- Orchestrator: RealtimeVoicePipeline
"""

import asyncio
import base64
import io
import unittest
import numpy as np
import wave
import sys
import os

# Add parent directory to path so voice package can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from voice.stt_moonshine import MoonshineTinySTT
from voice.llm_stream import VoiceLLMStreamer
from voice.tts_chatterbox import ChatterboxTTSEngine
from voice.pipeline import RealtimeVoicePipeline


class TestRealtimeVoicePipeline(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.pipeline = RealtimeVoicePipeline()

    def test_01_moonshine_tiny_initialization(self):
        """Verify Moonshine Tiny model loads and transcriber is ready."""
        stt = self.pipeline.stt
        self.assertIsNotNone(stt)
        self.assertTrue(stt.is_ready, "Moonshine Tiny STT should be ready")
        self.assertIsNotNone(stt.model_path, "Moonshine Tiny model path must exist")
        print(f"\n[Test] Moonshine Tiny initialized successfully at: {stt.model_path}")

    def test_02_moonshine_tiny_audio_transcription(self):
        """Test Moonshine Tiny STT on a generated 16kHz WAV sample."""
        stt = self.pipeline.stt

        # Generate a 1-second 16kHz audio signal
        sample_rate = 16000
        duration = 1.0
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

        # Convert to WAV bytes
        bio = io.BytesIO()
        with wave.open(bio, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes((audio * 32767).astype(np.int16).tobytes())
        wav_bytes = bio.getvalue()

        result = stt.transcribe(wav_bytes)
        self.assertIn("text", result)
        self.assertIn("latency_ms", result)
        self.assertLess(result["latency_ms"], 5000, "Moonshine Tiny transcription should be fast")
        print(f"[Test] Moonshine Tiny STT processed audio in {result['latency_ms']}ms: '{result['text']}'")

    async def test_03_chatterbox_tts_synthesis(self):
        """Verify Chatterbox TTS synthesizes text to base64 audio."""
        tts = self.pipeline.tts
        text_to_speak = "Hello! Songbird realtime voice agent is active."
        result = await tts.synthesize(text_to_speak)

        self.assertIn("audio_b64", result)
        self.assertTrue(len(result["audio_b64"]) > 0, "Synthesized audio base64 must not be empty")
        self.assertIn(result["mime_type"], ["audio/wav", "audio/mp3"])

        # Decode base64 to verify valid audio header
        audio_bytes = base64.b64decode(result["audio_b64"])
        self.assertTrue(len(audio_bytes) > 100, "Audio output must have substantial bytes")
        print(f"[Test] Chatterbox TTS ({result['engine']}) synthesized in {result['latency_ms']}ms, size={len(audio_bytes)} bytes")

    def test_04_voice_pipeline_status(self):
        """Verify pipeline status reporting."""
        status = self.pipeline.get_status()
        self.assertIn("stt", status)
        self.assertIn("llm", status)
        self.assertIn("tts", status)
        self.assertEqual(status["stt"]["engine"], "Moonshine Tiny")
        self.assertEqual(status["tts"]["engine"], "Chatterbox TTS")
        print(f"[Test] Pipeline status: {status}")

    async def test_05_end_to_end_voice_turn_simulation(self):
        """Simulate a complete voice turn through the 3-stage pipeline."""
        # Generate test audio
        sample_rate = 16000
        duration = 0.8
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        audio = (0.3 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)

        bio = io.BytesIO()
        with wave.open(bio, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes((audio * 32767).astype(np.int16).tobytes())
        b64_audio = base64.b64encode(bio.getvalue()).decode("utf-8")

        events = []
        async for event in self.pipeline.process_voice_turn(
            audio_payload=b64_audio,
            api_key="mock_key",
            base_url="https://openrouter.ai/api/v1",
            model="google/gemma-4-26b-a4b-it:free"
        ):
            events.append(event)

        event_types = [e["type"] for e in events]
        self.assertIn("voice_stage", event_types)
        self.assertIn("voice_stt", event_types)
        print(f"[Test] End-to-end voice turn emitted {len(events)} events: {set(event_types)}")


if __name__ == "__main__":
    unittest.main()
