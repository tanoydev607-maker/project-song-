"""
Stage 1: Moonshine Tiny Speech-to-Text (STT) Engine
Using Useful Sensors / Moonshine AI 'Moonshine Tiny' ONNX model.
"""

import io
import time
import base64
import numpy as np
import soundfile as sf
import subprocess

try:
    import moonshine_voice as mv
    MOONSHINE_AVAILABLE = True
except ImportError:
    MOONSHINE_AVAILABLE = False


class MoonshineTinySTT:
    """
    Speech-to-Text Engine powered by Moonshine Tiny.
    Optimized for ultra low-latency edge speech recognition.
    """

    def __init__(self, language: str = "en"):
        self.language = language
        self.model_path = None
        self.model_arch = None
        self.transcriber = None
        self._is_ready = False

        if MOONSHINE_AVAILABLE:
            try:
                print(f"[STT: Moonshine Tiny] Initializing model for language: '{language}'...")
                self.model_path, self.model_arch = mv.get_model_for_language(
                    wanted_language=language,
                    wanted_model_arch=mv.ModelArch.TINY
                )
                self.transcriber = mv.Transcriber(self.model_path, self.model_arch)
                self._is_ready = True
                print(f"[STT: Moonshine Tiny] Loaded model successfully at {self.model_path}")
            except Exception as e:
                print(f"[STT: Moonshine Tiny] Initialization warning: {e}")
                self._is_ready = False
        else:
            print("[STT: Moonshine Tiny] moonshine-voice package not detected.")

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    def _convert_to_16k_mono_float32(self, audio_data, sample_rate: int) -> np.ndarray:
        """Ensure audio array is mono, float32, and resampled to 16000 Hz."""
        if audio_data.ndim > 1:
            # Average multi-channel to mono
            audio_data = np.mean(audio_data, axis=1)

        # Ensure float32 in range [-1.0, 1.0]
        if audio_data.dtype != np.float32:
            if np.issubdtype(audio_data.dtype, np.integer):
                max_val = float(np.iinfo(audio_data.dtype).max)
                audio_data = audio_data.astype(np.float32) / max_val
            else:
                audio_data = audio_data.astype(np.float32)

        # Resample if not 16000 Hz
        target_sr = 16000
        if sample_rate != target_sr and len(audio_data) > 0:
            duration = len(audio_data) / float(sample_rate)
            target_samples = int(duration * target_sr)
            if target_samples > 0:
                audio_data = np.interp(
                    np.linspace(0, len(audio_data), target_samples, endpoint=False),
                    np.arange(len(audio_data)),
                    audio_data
                ).astype(np.float32)

        return audio_data

    def decode_audio_payload(self, payload: bytes | str) -> tuple[np.ndarray, int]:
        """
        Decode incoming audio payload (Base64 string, WAV bytes, or raw PCM).
        Returns (audio_float32_array, sample_rate).
        """
        raw_bytes = payload
        if isinstance(payload, str):
            # Check for data URL header e.g. "data:audio/wav;base64,..."
            if "base64," in payload:
                payload = payload.split("base64,")[1]
            raw_bytes = base64.b64decode(payload)

        # Try parsing as container format (WAV, FLAC, OGG) via soundfile
        try:
            with io.BytesIO(raw_bytes) as bio:
                audio_arr, sr = sf.read(bio, dtype="float32")
                return self._convert_to_16k_mono_float32(audio_arr, sr), 16000
        except Exception:
            pass

        # Try FFmpeg decoding (universal support for WebM, Opus, MP3, AAC, etc.)
        try:
            p = subprocess.Popen(
                ["ffmpeg", "-y", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL
            )
            out, _ = p.communicate(raw_bytes, timeout=5)
            if out and len(out) > 0:
                pcm_data = np.frombuffer(out, dtype=np.int16)
                audio_arr = pcm_data.astype(np.float32) / 32768.0
                return audio_arr, 16000
        except Exception:
            pass

        # Fallback: assume raw PCM 16-bit mono 16kHz
        try:
            pcm_data = np.frombuffer(raw_bytes, dtype=np.int16)
            audio_arr = pcm_data.astype(np.float32) / 32768.0
            return audio_arr, 16000
        except Exception:
            return np.zeros(0, dtype=np.float32), 16000

    def transcribe(self, audio_input: bytes | str | np.ndarray, sample_rate: int = 16000) -> dict:
        """
        Transcribe audio input using Moonshine Tiny.
        Returns dict with keys: 'text', 'latency_ms', 'model'.
        """
        start_time = time.perf_counter()

        if isinstance(audio_input, (bytes, str)):
            audio_data, sample_rate = self.decode_audio_payload(audio_input)
        elif isinstance(audio_input, np.ndarray):
            audio_data = self._convert_to_16k_mono_float32(audio_input, sample_rate)
        else:
            audio_data = np.zeros(0, dtype=np.float32)

        if len(audio_data) < 1600:  # Less than 0.1s
            return {
                "text": "",
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "model": "Moonshine Tiny (usefulsensors)"
            }

        if not self._is_ready or self.transcriber is None:
            return {
                "text": "",
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "error": "Moonshine Tiny transcriber not initialized",
                "model": "Moonshine Tiny"
            }

        try:
            transcript = self.transcriber.transcribe_without_streaming(audio_data, 16000)
            text_lines = []
            if hasattr(transcript, "lines"):
                for line in transcript.lines:
                    if hasattr(line, "text") and line.text:
                        text_lines.append(line.text.strip())
            
            full_text = " ".join(text_lines).strip()
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "text": full_text,
                "latency_ms": latency,
                "model": "Moonshine Tiny"
            }
        except Exception as e:
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "text": "",
                "error": str(e),
                "latency_ms": latency,
                "model": "Moonshine Tiny"
            }
