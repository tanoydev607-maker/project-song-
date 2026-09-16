import React, { useState } from "react";
import { X, Sliders, Volume2, Key, Globe, Eye, EyeOff, Check, Cpu, Moon, Sun } from "lucide-react";

export type AIProvider = "openrouter" | "groq" | "openai" | "deepseek" | "anthropic" | "gemini" | "custom" | "ollama";

export interface ProviderPreset {
  name: string;
  defaultBaseUrl: string;
  models: { id: string; label: string }[];
  placeholderKey: string;
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderPreset> = {
  openrouter: {
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "google/gemma-4-26b-a4b-it:free", label: "Google Gemma 4 26B Vision (Free)" },
      { id: "google/gemma-4-31b-it:free", label: "Google Gemma 4 31B Vision (Free)" },
      { id: "minimax/minimax-m3:free", label: "MiniMax M3 Vision (Free)" },
      { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "NVIDIA Nemotron Omni Vision (Free)" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Vision)" },
      { id: "openai/gpt-4o", label: "GPT-4o Multi-Modal" },
      { id: "inclusionai/ling-3.0-flash-fin:free", label: "Ling 3.0 Flash Fin (Free)" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct" },
      { id: "deepseek/deepseek-r1", label: "DeepSeek R1 Reasoning" },
      { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" }
    ],
    placeholderKey: "sk-or-v1-...",
  },
  groq: {
    name: "Groq (Fast & Free Tier)",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
      { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
      { id: "gemma2-9b-it", label: "Gemma 2 9B" }
    ],
    placeholderKey: "gsk_...",
  },
  openai: {
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "o3-mini", label: "o3-mini" },
      { id: "o1", label: "o1" }
    ],
    placeholderKey: "sk-proj-...",
  },
  deepseek: {
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3 (Chat)" },
      { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)" }
    ],
    placeholderKey: "sk-...",
  },
  anthropic: {
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" }
    ],
    placeholderKey: "sk-ant-api03-...",
  },
  gemini: {
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" }
    ],
    placeholderKey: "AIzaSy...",
  },
  custom: {
    name: "Custom OpenAI-Compatible",
    defaultBaseUrl: "http://localhost:1234/v1",
    models: [
      { id: "local-model", label: "Default Local Model" }
    ],
    placeholderKey: "sk-...",
  },
  ollama: {
    name: "Local Ollama (Offline)",
    defaultBaseUrl: "http://localhost:11434",
    models: [
      { id: "gemma:2b", label: "Gemma 2B" },
      { id: "llama3.2", label: "Llama 3.2" },
      { id: "deepseek-r1:1.5b", label: "DeepSeek R1 1.5B" }
    ],
    placeholderKey: "None required",
  },
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  provider: AIProvider;
  setProvider: (p: AIProvider) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  model: string;
  setModel: (m: string) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  temperature: number;
  setTemperature: (t: number) => void;
  autoTTS: boolean;
  setAutoTTS: (b: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  model,
  setModel,
  systemPrompt,
  setSystemPrompt,
  temperature,
  setTemperature,
  autoTTS,
  setAutoTTS,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [customModelInput, setCustomModelInput] = useState(false);

  if (!isOpen) return null;

  const currentConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openrouter;
  const isDark = theme === "dark";

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    const cfg = PROVIDER_CONFIGS[newProvider];
    if (cfg) {
      setBaseUrl(cfg.defaultBaseUrl);
      if (cfg.models.length > 0) {
        setModel(cfg.models[0].id);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border transition ${
          isDark
            ? "bg-[#1c1c1c] border-[#333333] text-[#ececec]"
            : "bg-[#ffffff] border-[#e2e2dc] text-[#1c1c1a] shadow-xl"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b transition ${
            isDark ? "bg-[#171717] border-[#2b2b2b]" : "bg-[#f7f7f5] border-[#e8e8e2]"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Sliders size={17} className="text-rose-500" />
            <span>Settings & Preferences</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition ${
              isDark ? "text-[#888888] hover:text-white hover:bg-[#282828]" : "text-[#777777] hover:text-black hover:bg-[#ecece6]"
            }`}
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Theme Selection */}
          <div>
            <label className={`block font-medium mb-1.5 ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>
              App Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-medium text-xs transition ${
                  isDark
                    ? "bg-[#282828] border-rose-500/80 text-white shadow-sm"
                    : "bg-[#f3f3ee] border-[#d8d8d0] text-[#666660] hover:bg-[#eaeae4]"
                }`}
              >
                <Moon size={14} className={isDark ? "text-rose-400" : ""} />
                <span>Dark Theme</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-medium text-xs transition ${
                  !isDark
                    ? "bg-[#ffffff] border-rose-500/80 text-[#1c1c1a] shadow-sm ring-1 ring-rose-500/20"
                    : "bg-[#222222] border-[#333333] text-[#888888] hover:bg-[#2a2a2a]"
                }`}
              >
                <Sun size={14} className={!isDark ? "text-rose-500" : ""} />
                <span>Light Theme</span>
              </button>
            </div>
          </div>

          {/* Provider Selection */}
          <div>
            <label className={`block font-medium mb-1.5 flex items-center gap-1.5 ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>
              <Cpu size={14} className="text-rose-500" />
              <span>Inference Provider</span>
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-rose-500 cursor-pointer transition ${
                isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
              }`}
            >
              <option value="openrouter">OpenRouter (Claude 3.5, GPT-4o, DeepSeek R1, Free models)</option>
              <option value="groq">Groq (Ultra-Fast Inference - Llama 3.3 70B, DeepSeek R1)</option>
              <option value="openai">OpenAI (GPT-4o, o3-mini, o1)</option>
              <option value="deepseek">DeepSeek (DeepSeek-V3, DeepSeek-R1)</option>
              <option value="anthropic">Anthropic (Claude 3.7 / 3.5 Sonnet Native)</option>
              <option value="gemini">Google Gemini (Gemini 2.0 Flash, 1.5 Pro)</option>
              <option value="custom">Custom OpenAI-Compatible Endpoint</option>
              <option value="ollama">Local Ollama (Offline)</option>
            </select>
          </div>

          {/* API Key Input */}
          {provider !== "ollama" && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className={`font-medium flex items-center gap-1.5 ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>
                  <Key size={14} className="text-rose-500" />
                  <span>{currentConfig.name} API Key</span>
                </label>
                <span className="text-[10px] text-[#888888]">Saved in local storage</span>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={currentConfig.placeholderKey}
                  className={`w-full border rounded-xl pl-3.5 pr-10 py-2.5 placeholder-[#888888] focus:outline-none focus:border-rose-500 font-mono text-xs transition ${
                    isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#888888] hover:text-white" : "text-[#777777] hover:text-black"}`}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* Model Selector & Custom Toggle */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className={`font-medium ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>Model Selection</label>
              <button
                type="button"
                onClick={() => setCustomModelInput(!customModelInput)}
                className="text-[11px] text-rose-500 hover:underline"
              >
                {customModelInput ? "Choose from presets" : "Enter custom model ID"}
              </button>
            </div>

            {customModelInput ? (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. inclusionai/ling-3.0-flash-fin:free or anthropic/claude-3.5-sonnet"
                className={`w-full border rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-rose-500 transition ${
                  isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                }`}
              />
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-rose-500 cursor-pointer transition ${
                  isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                }`}
              >
                {currentConfig.models.map((m) => (
                  <option key={m.id} value={m.id} className={isDark ? "bg-[#262626] text-white" : "bg-white text-black"}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Base URL */}
          {(provider === "custom" || provider === "openrouter") && (
            <div>
              <label className={`block font-medium mb-1.5 flex items-center gap-1.5 ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>
                <Globe size={14} className="text-[#888888]" />
                <span>API Base URL</span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                className={`w-full border rounded-xl px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-rose-500 transition ${
                  isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                }`}
              />
            </div>
          )}

          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={`font-medium ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>Temperature</label>
              <span className="text-rose-500 font-mono text-xs">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className={`block font-medium mb-1.5 ${isDark ? "text-[#a0a0a0]" : "text-[#666660]"}`}>System Instructions</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder="Instructions for the AI assistant..."
              className={`w-full border rounded-xl p-3 placeholder-[#888888] focus:outline-none focus:border-rose-500 text-xs font-mono resize-none leading-relaxed transition ${
                isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
              }`}
            />
          </div>

          {/* Voice / Auto TTS */}
          <div className={`flex items-center justify-between p-3 rounded-xl border transition ${
            isDark ? "bg-[#262626]/80 border-[#333333]" : "bg-[#f8f8f5] border-[#e2e2dc]"
          }`}>
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-rose-500" />
              <div>
                <div className="font-medium text-xs">Auto Read Aloud (TTS)</div>
                <div className="text-[10px] text-[#888888]">Automatically speak assistant replies</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoTTS}
              onChange={(e) => setAutoTTS(e.target.checked)}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex justify-end transition ${
          isDark ? "bg-[#171717] border-[#2b2b2b]" : "bg-[#f7f7f5] border-[#e8e8e2]"
        }`}>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs transition shadow-sm"
          >
            <Check size={14} />
            <span>Save & Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
