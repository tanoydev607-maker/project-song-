import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Volume2,
  Sparkles,
  Square,
  Check,
  Play,
  Sliders,
  Cpu,
  Layers,
  Wand2,
  ShieldCheck,
  Loader2,
  Trash2,
  RotateCcw,
  Gauge,
  Music2,
} from "lucide-react";

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  gender: string;
  lang?: string;
  edge_voice?: string;
  speed: number;
  tag: string;
}

export interface BlendedVoice {
  id: string;
  name: string;
  description: string;
  voice1: string;
  weight1: number;
  voice2: string;
  weight2: number;
  created_at: number;
  tag: string;
}

export interface KokoroVerificationData {
  verified: boolean;
  model_name: string;
  model_id: string;
  model_class: string;
  device: string;
  sample_rate: number;
  components: Record<string, boolean>;
  active_voice: string;
  speed: number;
  synthesized_engine: string;
  audio_b64?: string;
  mime_type?: string;
  latency_ms: number;
  proof_message: string;
}

interface KokoroVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  socket: WebSocket | null;
  activeVoiceId: string;
  setActiveVoiceId: (id: string) => void;
  speechSpeed: number;
  setSpeechSpeed: (v: number) => void;
}

export const KokoroVoiceModal: React.FC<KokoroVoiceModalProps> = ({
  isOpen,
  onClose,
  theme,
  socket,
  activeVoiceId,
  setActiveVoiceId,
  speechSpeed,
  setSpeechSpeed,
}) => {
  const isDark = theme === "dark";

  // Tab State
  const [activeTab, setActiveTab] = useState<"voices" | "blending" | "capabilities" | "verify">("voices");

  // Voice Data
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [blendedVoices, setBlendedVoices] = useState<BlendedVoice[]>([]);
  const [device, setDevice] = useState<string>("ONNX Runtime (CPU)");
  const [isModelReady, setIsModelReady] = useState<boolean>(true);

  // Verification Test State
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<KokoroVerificationData | null>(null);
  const [testPhrase, setTestPhrase] = useState<string>(
    "Kokoro TTS 82M model from nazdridoy is active, verified, and operational on Songbird AI."
  );
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice Blending State
  const [blendName, setBlendName] = useState<string>("");
  const [voice1, setVoice1] = useState<string>("af_bella");
  const [voice2, setVoice2] = useState<string>("af_sarah");
  const [weight1, setWeight1] = useState<number>(0.5);
  const [isBlending, setIsBlending] = useState<boolean>(false);
  const [blendMessage, setBlendMessage] = useState<string | null>(null);

  // Fetch capabilities & presets from backend on open
  useEffect(() => {
    if (isOpen && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: "kokoro_capabilities" }));
    }
  }, [isOpen, socket]);

  // Listen to WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (
          (data.type === "kokoro_capabilities" || data.type === "chatterbox_capabilities") &&
          data.capabilities
        ) {
          const caps = data.capabilities;
          if (caps.presets) setPresets(caps.presets);
          if (caps.blended_voices) setBlendedVoices(caps.blended_voices);
          if (caps.device) setDevice(caps.device);
          if (caps.model_ready !== undefined) setIsModelReady(caps.model_ready);
        } else if (
          data.type === "kokoro_verification" ||
          data.type === "chatterbox_verification"
        ) {
          setIsVerifying(false);
          setVerificationResult(data.result);
          if (data.result?.audio_b64) {
            playAudioBase64(data.result.audio_b64, data.result.mime_type || "audio/wav");
          }
        } else if (
          data.type === "kokoro_blend_result" ||
          data.type === "chatterbox_clone_result"
        ) {
          setIsBlending(false);
          if (data.result?.success) {
            setBlendMessage(data.result.message);
            if (data.result.voice_profile) {
              setBlendedVoices((prev) => [
                ...prev.filter((p) => p.id !== data.result.voice_profile.id),
                data.result.voice_profile,
              ]);
              setActiveVoiceId(data.result.voice_profile.id);
            }
          }
        }
      } catch (err) {
        console.error("Kokoro voice modal WS parse error:", err);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, setActiveVoiceId]);

  const playAudioBase64 = (b64: string, mime: string = "audio/wav") => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audioUrl = `data:${mime};base64,${b64}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlayingTestAudio(true);
      audio.onended = () => setIsPlayingTestAudio(false);
      audio.onerror = () => setIsPlayingTestAudio(false);
      audio.play().catch(() => setIsPlayingTestAudio(false));
    } catch {
      setIsPlayingTestAudio(false);
    }
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingTestAudio(false);
    }
  };

  const handleRunVerification = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    setIsVerifying(true);
    setVerificationResult(null);
    socket.send(
      JSON.stringify({
        action: "kokoro_verify_model",
        text: testPhrase,
      })
    );
  };

  const handleCreateVoiceBlend = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const name = blendName.trim() || `Blend (${voice1} + ${voice2})`;
    setIsBlending(true);
    setBlendMessage(null);
    socket.send(
      JSON.stringify({
        action: "kokoro_blend_voice",
        name,
        voice1,
        weight1,
        voice2,
        weight2: parseFloat((1.0 - weight1).toFixed(2)),
      })
    );
  };

  const handleSelectVoice = (id: string) => {
    setActiveVoiceId(id);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          action: "kokoro_set_config",
          voice_id: id,
          speed: speechSpeed,
        })
      );
    }
  };

  const handleSpeedChange = (val: number) => {
    setSpeechSpeed(val);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          action: "kokoro_set_config",
          voice_id: activeVoiceId,
          speed: val,
        })
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-4xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isDark
            ? "bg-[#161618] border-rose-500/30 text-white shadow-rose-950/40"
            : "bg-[#fcfbf9] border-rose-500/20 text-[#1a1a18] shadow-rose-500/15 ring-1 ring-rose-500/10"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-5 flex items-center justify-between border-b ${
            isDark ? "border-white/10 bg-[#1c1c1f]" : "border-black/10 bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-pink-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
              <Volume2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg tracking-tight">Kokoro TTS Studio</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Kokoro-82M ONNX
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {device}
                </span>
              </div>
              <p className={`text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                High-fidelity 24kHz neural speech, voice blending, and accent control powered by nazdridoy/kokoro-tts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? "hover:bg-white/10 text-neutral-400" : "hover:bg-black/5 text-neutral-600"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex items-center gap-2 px-6 py-2.5 border-b text-xs font-semibold ${
            isDark ? "bg-[#141416] border-white/10" : "bg-[#f7f6f3] border-black/10"
          }`}
        >
          <button
            onClick={() => setActiveTab("voices")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
              activeTab === "voices"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-black/5"
            }`}
          >
            <Volume2 size={14} />
            <span>Voice Presets ({presets.length || 10})</span>
          </button>

          <button
            onClick={() => setActiveTab("blending")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
              activeTab === "blending"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-black/5"
            }`}
          >
            <Wand2 size={14} />
            <span>Voice Blending Studio</span>
            {blendedVoices.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {blendedVoices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("capabilities")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
              activeTab === "capabilities"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-black/5"
            }`}
          >
            <Cpu size={14} />
            <span>Kokoro-82M Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab("verify")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
              activeTab === "verify"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-black/5"
            }`}
          >
            <ShieldCheck size={14} />
            <span>Model Verification Test</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 select-none custom-scrollbar">
          {/* TAB 1: VOICES */}
          {activeTab === "voices" && (
            <div className="space-y-6 animate-fade-in">
              {/* Speed & Global Slider */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDark ? "bg-[#1e1e22] border-white/10" : "bg-white border-black/10 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge size={16} className="text-rose-500" />
                    <span className="text-xs font-semibold">Speech Rate / Speed</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-500">{speechSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={speechSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
                  <span>0.5x (Slow)</span>
                  <span>1.0x (Natural)</span>
                  <span>1.5x (Brisk)</span>
                  <span>2.0x (Rapid)</span>
                </div>
              </div>

              {/* Presets Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-3 flex items-center gap-1.5">
                  <Sparkles size={14} /> Native Kokoro Voice Presets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presets.map((p) => {
                    const isSelected = activeVoiceId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectVoice(p.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "border-rose-500 bg-rose-500/10 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/30"
                            : isDark
                            ? "border-white/10 bg-[#1e1e22] hover:border-white/20 hover:bg-[#25252a]"
                            : "border-black/10 bg-white hover:border-black/20 hover:bg-neutral-50 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                                isSelected
                                  ? "bg-rose-500 text-white"
                                  : isDark
                                  ? "bg-white/10 text-neutral-300"
                                  : "bg-black/5 text-neutral-700"
                              }`}
                            >
                              {p.gender === "female" ? "♀" : "♂"}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold">{p.name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 font-mono">
                                  {p.id}
                                </span>
                              </div>
                              <span className="text-[11px] text-neutral-400 font-mono">
                                Accent: {p.lang === "en-gb" ? "British (RP)" : "American"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {isSelected ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500 px-2 py-0.5 rounded-full bg-rose-500/20">
                                <Check size={12} /> Active
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-500/10 text-neutral-400">
                                {p.tag}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className={`text-xs mt-2.5 line-clamp-2 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                          {p.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Blends Section if present */}
              {blendedVoices.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-3 flex items-center gap-1.5">
                    <Wand2 size={14} /> Custom Blended Voices ({blendedVoices.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {blendedVoices.map((b) => {
                      const isSelected = activeVoiceId === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => handleSelectVoice(b.id)}
                          className={`p-4 rounded-2xl border cursor-pointer transition ${
                            isSelected
                              ? "border-rose-500 bg-rose-500/10 shadow-md ring-1 ring-rose-500/30"
                              : isDark
                              ? "border-white/10 bg-[#1e1e22] hover:bg-[#25252a]"
                              : "border-black/10 bg-white hover:bg-neutral-50 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{b.name}</span>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500 px-2 py-0.5 rounded-full bg-rose-500/20">
                                <Check size={12} /> Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{b.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VOICE BLENDING */}
          {activeTab === "blending" && (
            <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
              <div
                className={`p-5 rounded-3xl border ${
                  isDark ? "bg-[#1e1e22] border-white/10" : "bg-white border-black/10 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <Wand2 size={18} className="text-rose-500" />
                  <h3 className="font-bold text-sm">Kokoro Voice Blending Studio</h3>
                </div>
                <p className={`text-xs mb-4 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  Kokoro-82M allows blending two distinct speaker style embeddings with customizable ratios.
                  Mix distinct voices to craft unique vocal personas.
                </p>

                {/* Blend Name Input */}
                <div className="space-y-1.5 mb-4">
                  <label className="text-xs font-semibold text-neutral-400">Custom Blend Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Studio Executive (Bella + Sarah)"
                    value={blendName}
                    onChange={(e) => setBlendName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none transition ${
                      isDark
                        ? "bg-[#141416] border-white/10 focus:border-rose-500 text-white"
                        : "bg-[#f7f6f3] border-black/10 focus:border-rose-500 text-[#1a1a18]"
                    }`}
                  />
                </div>

                {/* Voice Pickers */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-400">Voice 1 (Primary)</label>
                    <select
                      value={voice1}
                      onChange={(e) => setVoice1(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                        isDark ? "bg-[#141416] border-white/10 text-white" : "bg-[#f7f6f3] border-black/10"
                      }`}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-400">Voice 2 (Secondary)</label>
                    <select
                      value={voice2}
                      onChange={(e) => setVoice2(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                        isDark ? "bg-[#141416] border-white/10 text-white" : "bg-[#f7f6f3] border-black/10"
                      }`}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Ratio Slider */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-400">
                      {voice1}: {Math.round(weight1 * 100)}%
                    </span>
                    <span className="font-mono text-neutral-400">Blend Ratio</span>
                    <span className="font-semibold text-pink-400">
                      {voice2}: {Math.round((1.0 - weight1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={weight1}
                    onChange={(e) => setWeight1(parseFloat(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                {/* Blend Button */}
                <button
                  onClick={handleCreateVoiceBlend}
                  disabled={isBlending}
                  className="w-full py-3 rounded-2xl font-bold text-xs bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isBlending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Computing Style Interpolation...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      <span>Synthesize & Register Blended Voice</span>
                    </>
                  )}
                </button>

                {blendMessage && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
                    <Check size={14} />
                    <span>{blendMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ARCHITECTURE */}
          {activeTab === "capabilities" && (
            <div className="space-y-5 max-w-3xl mx-auto animate-fade-in">
              <div
                className={`p-6 rounded-3xl border ${
                  isDark ? "bg-[#1e1e22] border-white/10" : "bg-white border-black/10 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Kokoro-82M Text-to-Speech Engine</h3>
                    <p className={`text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      Open-weight 82M style diffusion acoustic model developed by hexgrad & packaged by nazdridoy
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#141416] border-white/10" : "bg-[#f7f6f3] border-black/10"}`}>
                    <span className="text-[10px] text-neutral-400 font-mono block">Parameters</span>
                    <span className="text-sm font-bold text-rose-500">82 Million</span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#141416] border-white/10" : "bg-[#f7f6f3] border-black/10"}`}>
                    <span className="text-[10px] text-neutral-400 font-mono block">Sample Rate</span>
                    <span className="text-sm font-bold text-emerald-500">24,000 Hz</span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#141416] border-white/10" : "bg-[#f7f6f3] border-black/10"}`}>
                    <span className="text-[10px] text-neutral-400 font-mono block">Inference Engine</span>
                    <span className="text-sm font-bold text-amber-500">ONNX Runtime</span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${isDark ? "bg-[#141416] border-white/10" : "bg-[#f7f6f3] border-black/10"}`}>
                    <span className="text-[10px] text-neutral-400 font-mono block">License</span>
                    <span className="text-sm font-bold text-purple-500">Apache 2.0 / MIT</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500">Core Subsystem Pipeline</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-500/10">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px]">1</span>
                      <span><strong>Phonemization:</strong> High-precision text-to-phoneme conversion via espeak-ng.</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-500/10">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px]">2</span>
                      <span><strong>Style Diffusion:</strong> Speaker embedding vectors condition vocal pitch, cadence, and breath.</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-500/10">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px]">3</span>
                      <span><strong>Vocoding:</strong> Generates crisp 24kHz audio waveform in real time on standard CPUs without GPU requirements.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VERIFY */}
          {activeTab === "verify" && (
            <div className="space-y-5 max-w-2xl mx-auto animate-fade-in">
              <div
                className={`p-6 rounded-3xl border ${
                  isDark ? "bg-[#1e1e22] border-white/10" : "bg-white border-black/10 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Kokoro Model Verification & Diagnostic Proof</h3>
                    <p className={`text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      Tests live Kokoro-82M ONNX inference and plays synthesized audio to confirm active operational status.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <label className="text-xs font-semibold text-neutral-400">Diagnostic Phrase</label>
                  <input
                    type="text"
                    value={testPhrase}
                    onChange={(e) => setTestPhrase(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${
                      isDark
                        ? "bg-[#141416] border-white/10 text-white focus:border-rose-500"
                        : "bg-[#f7f6f3] border-black/10 focus:border-rose-500"
                    }`}
                  />
                </div>

                <button
                  onClick={handleRunVerification}
                  disabled={isVerifying}
                  className="w-full py-3 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Synthesizing Proof Audio with Kokoro...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Run Kokoro TTS Diagnostic Test</span>
                    </>
                  )}
                </button>

                {verificationResult && (
                  <div className="mt-5 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <Check size={16} />
                        <span>MODEL VERIFIED OPERATIONAL</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        Latency: {verificationResult.latency_ms} ms
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 font-medium">
                      {verificationResult.proof_message}
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-xl bg-black/20 text-neutral-300">
                        <span className="text-[10px] text-neutral-400 block">Model</span>
                        {verificationResult.model_name}
                      </div>
                      <div className="p-2 rounded-xl bg-black/20 text-neutral-300">
                        <span className="text-[10px] text-neutral-400 block">Rate</span>
                        {verificationResult.sample_rate} Hz
                      </div>
                      <div className="p-2 rounded-xl bg-black/20 text-neutral-300">
                        <span className="text-[10px] text-neutral-400 block">Active Voice</span>
                        {verificationResult.active_voice}
                      </div>
                    </div>

                    {verificationResult.audio_b64 && (
                      <div className="pt-2 flex items-center gap-2">
                        {isPlayingTestAudio ? (
                          <button
                            onClick={handleStopAudio}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Square size={13} />
                            <span>Stop Audio Proof</span>
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              playAudioBase64(
                                verificationResult.audio_b64!,
                                verificationResult.mime_type || "audio/wav"
                              )
                            }
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play size={13} />
                            <span>Replay Audio Proof</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark ? "border-white/10 bg-[#1c1c1f]" : "border-black/10 bg-white"
          }`}
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Active Speaker:</span>
            <span className="font-semibold text-rose-500 font-mono">{activeVoiceId}</span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-400">Speed:</span>
            <span className="font-semibold text-neutral-300 font-mono">{speechSpeed}x</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-semibold text-xs bg-rose-500 hover:bg-rose-600 text-white transition shadow-md shadow-rose-500/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
