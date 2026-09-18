import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  ArrowUp,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  Download,
  Trash2,
  Volume2,
  VolumeX,
  User,
  Search,
  Sparkles,
  Radio,
  Cpu,
  Square,
  Copy,
  Check,
  RefreshCw,
  Code2,
  Zap,
  BookOpen,
  Key,
  Globe,
  Bot,
  Terminal,
  FileCode,
  Moon,
  Sun,
  Loader2,
  Clock,
  Paperclip,
  Image as ImageIcon,
  FileUp,
  FileText,
  Mic,
  MicOff,
  Waves,
  AudioLines,
  MousePointer2,
  Monitor,
  Target,
  Wrench,
  Layers,
  X,
} from "lucide-react";
import { localTTS } from "@orca/local-tts";
import { memoryEngine, type ChatMessage, type ChatSession, type ToolExecution, type AttachedFile } from "@orca/memory-engine";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { AgentToolCard } from "./components/AgentToolCard";
import { SettingsModal, type AIProvider, PROVIDER_CONFIGS, type SettingsTab } from "./components/SettingsModal";
import { SkillsModal, DEFAULT_SKILLS, type AgentSkill } from "./components/SkillsModal";
import { AgentProgressCard, type AgentProgressState } from "./components/AgentProgressCard";
import {
  SongbirdEmblem,
  NeuralCoreIcon,
  AgentSparkIcon,
  McpHubIcon,
  ToolsWrenchIcon,
  SettingsDialIcon,
  OrbIconBadge
} from "./components/SongbirdIcons";
import { AttachmentList } from "./components/FileAttachmentPreview";
import { KokoroVoiceModal } from "./components/KokoroVoiceModal";
import { ToolsModal, INITIAL_HERMES_TOOLS, type HermesTool } from "./components/ToolsModal";
import { McpModal, DEFAULT_MCP_PRESETS, type McpServerConfig } from "./components/McpModal";
import { CodeEditorPanel } from "./components/CodeEditorPanel";
import { openCodeEditorWindow } from "./utils/windowManager";

const DEFAULT_SYSTEM_PROMPT =
  "You are Songbird, an advanced AI agent specialized in deep reasoning, software architecture, problem-solving, and synthesis. Structure your answers with clear markdown formatting, headings, and syntax-highlighted code blocks.\n\n" +
  "CRITICAL RULES:\n" +
  "1. NO EMOJIS: Do NOT use any emojis or emoticons in your responses under any circumstances. Output clean, plain text only.\n" +
  "2. MATH IN LATEX: Always write all mathematical expressions, formulas, equations, variables, and calculations using standard LaTeX notation ($...$ for inline math, $$...$$ for standalone display equations). Never output raw ASCII pseudo-math.";

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("songbird_theme") as "dark" | "light") || "dark";
  });

  // Skills State (with LocalStorage persistence)
  const [skills, setSkills] = useState<AgentSkill[]>(() => {
    const saved = localStorage.getItem("songbird_skills_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return DEFAULT_SKILLS;
  });
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);

  // Tools State (with LocalStorage persistence and auto-migration of new built-in tools)
  const [tools, setTools] = useState<HermesTool[]>(() => {
    const saved = localStorage.getItem("songbird_tools_config_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((t: HermesTool) => t.id || t.name));
          const missing = INITIAL_HERMES_TOOLS.filter((t) => !existingIds.has(t.id || t.name));
          if (missing.length > 0) {
            const merged = [...parsed, ...missing];
            localStorage.setItem("songbird_tools_config_v1", JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      } catch {
        // Fallback
      }
    }
    return INITIAL_HERMES_TOOLS;
  });
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // MCP (Model Context Protocol) Server State
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isMcpEnabled, setIsMcpEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("songbird_mcp_enabled");
    return saved !== null ? saved === "true" : true; // Turned on by default as requested
  });
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>(() => {
    const saved = localStorage.getItem("songbird_mcp_servers_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // Fallback
      }
    }
    return DEFAULT_MCP_PRESETS;
  });

  // Attachments State (Draft files for current prompt)
  const [draftAttachments, setDraftAttachments] = useState<AttachedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

  // Session & Message State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const loaded = memoryEngine.getSessions();
      if (loaded && loaded.length > 0) return loaded;
    } catch {}
    return [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      return memoryEngine.getActiveSessionId() || "";
    } catch {
      return "";
    }
  });
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Mode Selection: Chat Mode vs Agent Mode
  const [isAgentMode, setIsAgentMode] = useState<boolean>(() => {
    return localStorage.getItem("songbird_agent_mode") === "true";
  });

  // Code Editor Studio State
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState<boolean>(() => {
    return localStorage.getItem("songbird_code_editor_open") === "true";
  });
  const [externalOpenFile, setExternalOpenFile] = useState<{ path: string; content?: string; language?: string } | null>(null);

  useEffect(() => {
    localStorage.setItem("songbird_code_editor_open", String(isCodeEditorOpen));
  }, [isCodeEditorOpen]);

  // Split View Resizing State (Code Studio on Left + Chatbox on Right)
  const [editorSplitRatio, setEditorSplitRatio] = useState<number>(() => {
    const saved = localStorage.getItem("songbird_main_split_ratio");
    return saved ? parseFloat(saved) : 0.58;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newRatio = (moveEvent.clientX - rect.left) / rect.width;
      const clamped = Math.max(0.25, Math.min(0.78, newRatio));
      setEditorSplitRatio(clamped);
      localStorage.setItem("songbird_main_split_ratio", String(clamped));
    };

    const onMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Provider & API Key State (with LocalStorage persistence)
  const [provider, setProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem("orca_provider") as AIProvider) || "openrouter";
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("orca_api_key") || "";
  });
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    return localStorage.getItem("orca_base_url") || PROVIDER_CONFIGS.openrouter.defaultBaseUrl;
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("orca_model") || PROVIDER_CONFIGS.openrouter.models[0].id;
  });

  // Engine & Streaming State
  const [isEngineConnected, setIsEngineConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Agent Mode Task Roadmap & Progress State
  const [agentProgress, setAgentProgress] = useState<AgentProgressState | null>(null);

  // Settings & Audio State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [autoTTS, setAutoTTS] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isSynthesizingSpeech, setIsSynthesizingSpeech] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Realtime Voice Agent State (Stage 1: Moonshine Tiny -> Stage 2: LLM API -> Stage 3: Kokoro TTS)
  const [isVoiceAgentActive, setIsVoiceAgentActive] = useState(false);
  const [voiceAgentStatus, setVoiceAgentStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [voiceStageInfo, setVoiceStageInfo] = useState<string>("");
  const [isRecordingTurn, setIsRecordingTurn] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0); // 0 to 100
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [lastUnderstoodText, setLastUnderstoodText] = useState<string>("");
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const isDictatingRef = useRef<boolean>(false);
  isDictatingRef.current = isDictating;
  const [sttHeardInfo, setSttHeardInfo] = useState<{
    text: string;
    latencyMs?: number;
    timestamp: number;
    source: "dictation" | "voice_agent";
    device?: string;
  } | null>(null);

  // Kokoro Voice Studio State (Voice Selection, Voice Blending & Model Controls)
  const [isKokoroModalOpen, setIsKokoroModalOpen] = useState<boolean>(false);
  const [activeVoiceId, setActiveVoiceId] = useState<string>(() => {
    return localStorage.getItem("songbird_voice_id") || "af_bella";
  });
  const [speechSpeed, setSpeechSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("songbird_voice_speed");
    return saved ? parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    localStorage.setItem("songbird_voice_id", activeVoiceId);
    localStorage.setItem("songbird_voice_speed", String(speechSpeed));
  }, [activeVoiceId, speechSpeed]);

  const [isCapturingScreen, setIsCapturingScreen] = useState<boolean>(false);
  const mainViewContainerRef = useRef<HTMLDivElement | null>(null);

  // Voice Pipeline Audio Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingTurnRef = useRef<boolean>(false);
  isRecordingTurnRef.current = isRecordingTurn;
  const userSpokeOnceRef = useRef<boolean>(false);
  const audioQueueRef = useRef<string[]>([]);
  const isAudioPlayingRef = useRef<boolean>(false);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const isVoiceAgentActiveRef = useRef(false);
  isVoiceAgentActiveRef.current = isVoiceAgentActive;
  const readAloudAudioRef = useRef<HTMLAudioElement | null>(null);
  const readAloudActiveMsgIdRef = useRef<string | null>(null);
  const autoTTSRef = useRef(autoTTS);
  useEffect(() => {
    autoTTSRef.current = autoTTS;
  }, [autoTTS]);

  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist settings & skills
  useEffect(() => {
    localStorage.setItem("songbird_skills_v1", JSON.stringify(skills));
    localStorage.setItem("songbird_theme", theme);
    localStorage.setItem("songbird_agent_mode", String(isAgentMode));
    localStorage.setItem("orca_provider", provider);
    localStorage.setItem("orca_api_key", apiKey);
    localStorage.setItem("orca_base_url", baseUrl);
    localStorage.setItem("orca_model", selectedModel);
  }, [skills, theme, isAgentMode, provider, apiKey, baseUrl, selectedModel]);

  // Ensure title and favicon are dynamically enforced with new Songbird Beta logo
  useEffect(() => {
    document.title = "Songbird Beta";
    const updateIcon = (rel: string, href: string) => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    };
    updateIcon("icon", "/favicon.ico?v=3");
    updateIcon("shortcut icon", "/favicon.ico?v=3");
  }, []);

  // Close attachment dropdown menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    if (isAttachMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAttachMenuOpen]);

  // Elapsed Time Stopwatch for Task Execution
  useEffect(() => {
    if (isStreaming) {
      setElapsedSeconds(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 100) / 10);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreaming]);

  // Toggle Theme helper
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Process raw File object to AttachedFile
  const processFile = async (file: File): Promise<AttachedFile> => {
    const isImage = file.type.startsWith("image/");
    const isTextOrCode =
      file.type.startsWith("text/") ||
      ["json", "js", "ts", "tsx", "jsx", "py", "rs", "cpp", "c", "html", "css", "md", "csv", "yaml", "yml", "sql", "log"].some(
        (ext) => file.name.toLowerCase().endsWith(`.${ext}`)
      );

    return new Promise((resolve) => {
      const reader = new FileReader();

      if (isImage) {
        reader.onload = () => {
          resolve({
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: file.name,
            size: file.size,
            type: file.type || "image/png",
            dataUrl: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else if (isTextOrCode) {
        reader.onload = () => {
          resolve({
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: file.name,
            size: file.size,
            type: file.type || "text/plain",
            textContent: reader.result as string,
          });
        };
        reader.readAsText(file);
      } else {
        reader.onload = () => {
          resolve({
            id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            dataUrl: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Handle file input change
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    const processed = await Promise.all(filesArray.map(processFile));
    setDraftAttachments((prev) => [...prev, ...processed]);
    setIsAttachMenuOpen(false);
    e.target.value = "";
  };

  // Handle Drag and Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      const processed = await Promise.all(filesArray.map(processFile));
      setDraftAttachments((prev) => [...prev, ...processed]);
    }
  };

  // Handle Clipboard Paste (e.g. screenshots)
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const filesArray = Array.from(e.clipboardData.files);
      const processed = await Promise.all(filesArray.map(processFile));
      setDraftAttachments((prev) => [...prev, ...processed]);
    }
  };

  const handleRemoveDraftAttachment = (id: string) => {
    setDraftAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Initialize Sessions
  useEffect(() => {
    const loaded = memoryEngine.getSessions();
    if (loaded.length === 0) {
      const initial = memoryEngine.createNewSession("New Chat", selectedModel);
      setSessions([initial]);
      setActiveSessionId(initial.id);
    } else {
      setSessions(loaded);
      const activeId = memoryEngine.getActiveSessionId() || loaded[0].id;
      setActiveSessionId(activeId);
    }
  }, []);

  const fallbackSession: ChatSession = {
    id: "default-session",
    title: "New conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || fallbackSession;
  const hasMessages = Boolean(activeSession && activeSession.messages && activeSession.messages.length > 0);

  // Auto-scroll (Instant during streaming to prevent visual jitter, smooth otherwise)
  useEffect(() => {
    if (hasMessages) {
      if (isStreaming) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [activeSession?.messages, isStreaming, hasMessages]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsCodeEditorOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedModel]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Track latest state in refs to avoid stale closures in ws.onmessage
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const providerRef = useRef(provider);
  providerRef.current = provider;

  // WebSocket Connection (:18789)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "127.0.0.1"
        : window.location.hostname;
      ws = new WebSocket(`ws://${host}:18789`);
      socketRef.current = ws;
      (window as any).__songbirdSocket = ws;

      ws.onopen = () => {
        setIsEngineConnected(true);
        ws?.send(JSON.stringify({ action: "ping" }));
      };

      ws.onclose = () => {
        setIsEngineConnected(false);
        setIsStreaming(false);
        setAgentProgress(null);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setIsEngineConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "pong") {
            // Server acknowledged
          } else if (data.type === "stream") {
            enqueueStreamToken(data.token, false);
          } else if (data.type === "thought") {
            enqueueStreamToken(data.token, true);
          } else if (data.type === "agent_progress") {
            setAgentProgress({
              step: data.step || 1,
              maxSteps: data.max_steps || 6,
              title: data.title || "Executing agent task...",
              percent: data.percent || 10,
              tasks: data.tasks || [],
            });
          } else if (data.type === "tool_start") {
            handleToolStart(data.tool_id, data.tool, data.input);
          } else if (data.type === "tool_result") {
            handleToolResult(data.tool_id, data.tool, data.output, data.status, data.image_b64);
          } else if (data.type === "editor_agent_sync") {
            setIsCodeEditorOpen(true);
            setExternalOpenFile({
              path: data.file_path,
              content: data.content,
              language: data.language,
            });
          } else if (data.type === "editor_run_output") {
            setIsCodeEditorOpen(true);
          } else if (data.type === "stt_result") {
            handleDictationSTTReceived(data.text, data.latency_ms, data.device);
          } else if (data.type === "stt_error") {
            setIsDictating(false);
            isDictatingRef.current = false;
            setVoiceStageInfo(`STT Notice: ${data.error || "Recognition failed"}`);
          } else if (data.type === "voice_stage") {
            setVoiceStageInfo(`Stage ${data.stage}: ${data.name}`);
          } else if (data.type === "voice_stt") {
            handleVoiceSTTReceived(data.text, data.latency_ms, data.device);
          } else if (data.type === "voice_llm_token") {
            enqueueStreamToken(data.token, false);
          } else if (data.type === "voice_tts_chunk") {
            if (data.audio_b64) {
              enqueueTTSAudio(data.audio_b64, data.mime_type || "audio/wav");
            }
          } else if (data.type === "voice_done") {
            handleStreamDone();
            if (isVoiceAgentActiveRef.current) {
              // If not currently speaking TTS audio, re-arm listening for next user turn
              if (!isAudioPlayingRef.current) {
                setVoiceAgentStatus("listening");
                setVoiceStageInfo("Voice Agent listening for your voice...");
                setTimeout(() => {
                  if (isVoiceAgentActiveRef.current && !isRecordingTurnRef.current) {
                    startTurnRecording();
                  }
                }, 350);
              }
            }
          } else if (data.type === "voice_error") {
            console.warn("Voice agent notice:", data.error);
            setVoiceStageInfo(`Voice Notice: ${data.error}`);
            if (isVoiceAgentActiveRef.current) {
              setVoiceAgentStatus("listening");
              setTimeout(() => {
                if (isVoiceAgentActiveRef.current && !isRecordingTurnRef.current) {
                  startTurnRecording();
                }
              }, 1200);
            } else {
              setVoiceAgentStatus("idle");
            }
          } else if (
            data.type === "kokoro_synthesize_result" ||
            data.type === "chatterbox_synthesize_result"
          ) {
            setIsSynthesizingSpeech(false);
            if (data.audio_b64) {
              const mime = data.mime_type || "audio/wav";
              const audio = new Audio(`data:${mime};base64,${data.audio_b64}`);
              readAloudAudioRef.current = audio;
              if (data.msg_id) setSpeakingMsgId(data.msg_id);

              audio.onended = () => {
                readAloudAudioRef.current = null;
                readAloudActiveMsgIdRef.current = null;
                setSpeakingMsgId(null);
              };

              audio.onerror = (e) => {
                console.warn("Kokoro audio playback error:", e);
                readAloudAudioRef.current = null;
                readAloudActiveMsgIdRef.current = null;
                setSpeakingMsgId(null);
              };

              audio.play().catch((err) => {
                console.warn("Audio play() blocked:", err);
                readAloudAudioRef.current = null;
                readAloudActiveMsgIdRef.current = null;
                setSpeakingMsgId(null);
              });
            }
          } else if (
            data.type === "kokoro_synthesize_error" ||
            data.type === "chatterbox_synthesize_error"
          ) {
            console.warn("Kokoro synthesis error:", data.error);
            setIsSynthesizingSpeech(false);
            if (readAloudActiveMsgIdRef.current === data.msg_id) {
              readAloudActiveMsgIdRef.current = null;
              setSpeakingMsgId(null);
            }
          } else if (data.type === "done") {
            handleStreamDone();
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);

  // Global Keyboard Shortcut for Screenshot (Alt + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "Space") {
        e.preventDefault();
        handleCaptureScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Tool Start Handler
  const handleToolStart = (toolId: string, tool: string, input: any) => {
    setSessions((prev) => {
      const targetId = activeSessionIdRef.current || (prev.length > 0 ? prev[0].id : "");
      const activeIdx = prev.findIndex((s) => s.id === targetId);
      const resolvedIdx = activeIdx === -1 ? (prev.length > 0 ? 0 : -1) : activeIdx;
      if (resolvedIdx === -1) return prev;

      const current = prev[resolvedIdx];
      const msgs = [...current.messages];
      let last = msgs[msgs.length - 1];

      const newTool: ToolExecution = {
        id: toolId,
        tool,
        input,
        status: "running",
        timestamp: Date.now(),
      };

      if (last && last.sender === "hermes") {
        const tools = last.toolExecutions ? [...last.toolExecutions, newTool] : [newTool];
        msgs[msgs.length - 1] = { ...last, toolExecutions: tools };
      } else {
        const newAssistantMsg: ChatMessage = {
          id: "msg_" + Date.now(),
          sender: "hermes",
          text: "",
          toolExecutions: [newTool],
          timestamp: Date.now(),
          model: selectedModelRef.current || providerRef.current,
        };
        msgs.push(newAssistantMsg);
      }

      const updatedSession = { ...current, messages: msgs, updatedAt: Date.now() };
      memoryEngine.saveSession(updatedSession);

      const updatedSessions = [...prev];
      updatedSessions[resolvedIdx] = updatedSession;
      return updatedSessions;
    });
  };

  // Tool Result Handler
  const handleToolResult = (toolId: string, tool: string, output: string, status: "success" | "error", imageB64?: string) => {
    setSessions((prev) => {
      const targetId = activeSessionIdRef.current || (prev.length > 0 ? prev[0].id : "");
      const activeIdx = prev.findIndex((s) => s.id === targetId);
      const resolvedIdx = activeIdx === -1 ? (prev.length > 0 ? 0 : -1) : activeIdx;
      if (resolvedIdx === -1) return prev;

      const current = prev[resolvedIdx];
      const msgs = [...current.messages];
      const last = msgs[msgs.length - 1];

      if (last && last.sender === "hermes" && last.toolExecutions) {
        const updatedTools = last.toolExecutions.map((t) =>
          t.id === toolId ? { ...t, output, status, image_b64: imageB64 || t.image_b64 } : t
        );
        msgs[msgs.length - 1] = { ...last, toolExecutions: updatedTools };
      }

      const updatedSession = { ...current, messages: msgs, updatedAt: Date.now() };
      memoryEngine.saveSession(updatedSession);

      const updatedSessions = [...prev];
      updatedSessions[resolvedIdx] = updatedSession;
      return updatedSessions;
    });
  };

  // Typewriter Token Queues & Engine
  const typingQueueRef = useRef<string>("");
  const typingThoughtQueueRef = useRef<string>("");
  const streamDoneReceivedRef = useRef<boolean>(false);
  const typewriterTimerRef = useRef<number | null>(null);

  const startTypewriterEngine = () => {
    if (typewriterTimerRef.current !== null) return;

    const tick = () => {
      const hasText = typingQueueRef.current.length > 0;
      const hasThought = typingThoughtQueueRef.current.length > 0;

      if (!hasText && !hasThought) {
        if (streamDoneReceivedRef.current) {
          setIsStreaming(false);
          setAgentProgress(null);
          // Persist the final state to localStorage once
          setSessions((prev) => {
            const targetId = activeSessionIdRef.current || (prev.length > 0 ? prev[0].id : "");
            const activeSession = prev.find((s) => s.id === targetId);
            if (activeSession) {
              memoryEngine.saveSession(activeSession);
              if (autoTTSRef.current) {
                const msgs = activeSession.messages;
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.sender === "hermes" && lastMsg.text.trim()) {
                  setTimeout(() => handleToggleSpeech(lastMsg), 150);
                }
              }
            }
            return prev;
          });
          if (typewriterTimerRef.current !== null) {
            cancelAnimationFrame(typewriterTimerRef.current);
            typewriterTimerRef.current = null;
          }
          return;
        }
        typewriterTimerRef.current = requestAnimationFrame(tick);
        return;
      }

      // Smooth human typing speed (1-2 chars per tick), scales smoothly on large bursts
      const qLen = typingQueueRef.current.length;
      let textChunkSize = 1;
      if (qLen > 120) textChunkSize = 8;
      else if (qLen > 50) textChunkSize = 4;
      else if (qLen > 20) textChunkSize = 2;
      else textChunkSize = 1;

      const tqLen = typingThoughtQueueRef.current.length;
      let thoughtChunkSize = 1;
      if (tqLen > 120) thoughtChunkSize = 8;
      else if (tqLen > 50) thoughtChunkSize = 4;
      else if (tqLen > 20) thoughtChunkSize = 2;

      let textSlice = "";
      if (hasText) {
        textSlice = typingQueueRef.current.slice(0, textChunkSize);
        typingQueueRef.current = typingQueueRef.current.slice(textChunkSize);
      }

      let thoughtSlice = "";
      if (hasThought) {
        thoughtSlice = typingThoughtQueueRef.current.slice(0, thoughtChunkSize);
        typingThoughtQueueRef.current = typingThoughtQueueRef.current.slice(thoughtChunkSize);
      }

      setSessions((prev) => {
        const targetId = activeSessionIdRef.current || (prev.length > 0 ? prev[0].id : "");
        const activeIdx = prev.findIndex((s) => s.id === targetId);
        const resolvedIdx = activeIdx === -1 ? (prev.length > 0 ? 0 : -1) : activeIdx;
        if (resolvedIdx === -1) return prev;

        const current = prev[resolvedIdx];
        const msgs = [...current.messages];
        const last = msgs[msgs.length - 1];

        if (last && last.sender === "hermes") {
          const updatedLast: ChatMessage = {
            ...last,
            text: textSlice ? last.text + textSlice : last.text,
            thought: thoughtSlice ? (last.thought || "") + thoughtSlice : last.thought,
          };
          msgs[msgs.length - 1] = updatedLast;
        } else {
          const newAssistantMsg: ChatMessage = {
            id: "msg_" + Date.now(),
            sender: "hermes",
            text: textSlice,
            thought: thoughtSlice,
            timestamp: Date.now(),
            model: selectedModelRef.current || providerRef.current,
          };
          msgs.push(newAssistantMsg);
        }

        const updatedSession = { ...current, messages: msgs, updatedAt: Date.now() };
        const updatedSessions = [...prev];
        updatedSessions[resolvedIdx] = updatedSession;
        return updatedSessions;
      });

      typewriterTimerRef.current = requestAnimationFrame(tick);
    };

    typewriterTimerRef.current = requestAnimationFrame(tick);
  };

  const stripEmojis = (text: string) => {
    return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "");
  };

  const enqueueStreamToken = (token: string, isThought: boolean) => {
    const cleanToken = stripEmojis(token);
    if (!cleanToken) return;
    if (isThought) {
      typingThoughtQueueRef.current += cleanToken;
    } else {
      typingQueueRef.current += cleanToken;
    }
    startTypewriterEngine();
  };

  const handleStreamDone = () => {
    streamDoneReceivedRef.current = true;
    if (!typingQueueRef.current && !typingThoughtQueueRef.current) {
      setIsStreaming(false);
      setAgentProgress(null);
      if (typewriterTimerRef.current !== null) {
        cancelAnimationFrame(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    }
  };

  // ==================== REALTIME VOICE AGENT PIPELINE (STT -> LLM -> TTS) ====================
  const playNextTTSAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isAudioPlayingRef.current = false;
      if (isVoiceAgentActiveRef.current) {
        setVoiceAgentStatus("listening");
        setVoiceStageInfo("Voice Agent listening for your voice...");
        setTimeout(() => {
          if (isVoiceAgentActiveRef.current && !isRecordingTurnRef.current) {
            startTurnRecording();
          }
        }, 400);
      }
      return;
    }

    isAudioPlayingRef.current = true;
    setVoiceAgentStatus("speaking");
    setVoiceStageInfo("Speaking response (Kokoro TTS)...");
    const nextAudioUrl = audioQueueRef.current.shift()!;
    const audio = new Audio(nextAudioUrl);
    activeAudioElementRef.current = audio;

    audio.onended = () => {
      activeAudioElementRef.current = null;
      playNextTTSAudio();
    };

    audio.onerror = (e) => {
      console.warn("TTS Audio playback error:", e);
      activeAudioElementRef.current = null;
      playNextTTSAudio();
    };

    audio.play().catch((err) => {
      console.warn("Audio play() blocked or error:", err);
      playNextTTSAudio();
    });
  };

  const enqueueTTSAudio = (base64Audio: string, mimeType: string = "audio/wav") => {
    const dataUrl = `data:${mimeType};base64,${base64Audio}`;
    audioQueueRef.current.push(dataUrl);
    if (!isAudioPlayingRef.current) {
      playNextTTSAudio();
    }
  };

  const handleVoiceSTTReceived = (text: string, latencyMs?: number, device?: string) => {
    if (!text.trim()) return;

    const clean = text.trim();
    setLastUnderstoodText(clean);
    setSttHeardInfo({
      text: clean,
      latencyMs,
      timestamp: Date.now(),
      source: "voice_agent",
      device,
    });
    // Dictate speech into the chat input so user sees what STT heard
    setInput(clean);
    setVoiceStageInfo(`Understood: "${clean}" via Moonshine Tiny (${latencyMs || 0}ms)`);
    setVoiceAgentStatus("processing");

    const userVoiceMessage: ChatMessage = {
      id: "voice_user_" + Date.now(),
      sender: "user",
      text: text,
      timestamp: Date.now(),
    };

    setSessions((prev) => {
      const targetId = activeSessionIdRef.current || (prev.length > 0 ? prev[0].id : "");
      const activeIdx = prev.findIndex((s) => s.id === targetId);
      const resolvedIdx = activeIdx === -1 ? (prev.length > 0 ? 0 : -1) : activeIdx;
      if (resolvedIdx === -1) return prev;

      const current = prev[resolvedIdx];
      const updatedMessages = [...current.messages, userVoiceMessage];
      const updatedSession = { ...current, messages: updatedMessages, updatedAt: Date.now() };
      memoryEngine.saveSession(updatedSession);

      const updatedSessions = [...prev];
      updatedSessions[resolvedIdx] = updatedSession;
      return updatedSessions;
    });

    setIsStreaming(true);
  };

  // Standard 16kHz Mono WAV encoder for instant STT decoding
  const encodeWavBlob = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true); // 16000 Hz
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  };

  const downsampleTo16k = (inputSamples: Float32Array, inputSampleRate: number): Float32Array => {
    if (inputSampleRate === 16000) return inputSamples;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(inputSamples.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originalIndex = Math.floor(i * ratio);
      result[i] = inputSamples[originalIndex] || 0;
    }
    return result;
  };

  const handleDictationSTTReceived = (text: string, latencyMs?: number, device?: string) => {
    setIsDictating(false);
    isDictatingRef.current = false;
    setVoiceAgentStatus("idle");
    if (!text || !text.trim()) {
      setVoiceStageInfo("No speech detected by Moonshine Tiny.");
      return;
    }
    const clean = text.trim();
    setInput((prev) => (prev ? `${prev} ${clean}` : clean));
    setSttHeardInfo({
      text: clean,
      latencyMs,
      timestamp: Date.now(),
      source: "dictation",
      device,
    });
    setVoiceStageInfo(`Transcribed: "${clean}" via Moonshine Tiny (${latencyMs || 0}ms)`);
  };

  const sendVoiceAudioBlob = (blob: Blob, forDictation: boolean = false) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    setVoiceAgentStatus("processing");
    setVoiceStageInfo("Moonshine Tiny STT transcribing audio...");

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;

      if (forDictation) {
        socketRef.current?.send(
          JSON.stringify({
            action: "stt_transcribe",
            audio: base64Data,
          })
        );
        return;
      }

      const recentMessages = (activeSession?.messages || []).slice(-6).map((m) => ({
        role: m.sender === "hermes" ? "assistant" : "user",
        content: m.text,
      }));

      socketRef.current?.send(
        JSON.stringify({
          action: "voice_turn",
          audio: base64Data,
          provider: providerRef.current,
          api_key: apiKey,
          base_url: baseUrl,
          model: selectedModelRef.current,
          temperature,
          messages: recentMessages,
          voice_config: {
            voice_id: activeVoiceId,
            speed: speechSpeed,
          },
        })
      );
    };
    reader.readAsDataURL(blob);
  };

  const startTurnRecording = async (forDictation: boolean = false) => {
    try {
      if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
      }

      // Reset turn recording tracking
      pcmChunksRef.current = [];
      userSpokeOnceRef.current = false;
      silenceStartRef.current = null;
      isRecordingTurnRef.current = true;
      setIsRecordingTurn(true);

      // Setup AudioContext & Analyser
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.25;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(mediaStreamRef.current);
      source.connect(analyser);

      // Collect raw PCM samples via ScriptProcessor for 16kHz WAV encoding
      try {
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (isRecordingTurnRef.current) {
            const inputData = e.inputBuffer.getChannelData(0);
            pcmChunksRef.current.push(new Float32Array(inputData));
          }
        };
        source.connect(processor);
        // Connect to a silent gain to prevent processor garbage collection
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);
      } catch (procErr) {
        console.warn("ScriptProcessor fallback to MediaRecorder:", procErr);
      }

      // Live volume visualizer and speech end detection loop
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const pollLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          sum += dataArr[i];
        }
        const avg = sum / dataArr.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(normalized);

        // Lower threshold to 5 for high sensitivity
        if (normalized > 5) {
          setIsUserSpeaking(true);
          userSpokeOnceRef.current = true;
          silenceStartRef.current = null;
          setVoiceStageInfo(forDictation ? "Hearing dictation... (Moonshine Tiny active)" : "Hearing your voice... (Moonshine Tiny listening)");
        } else {
          setIsUserSpeaking(false);
          if (userSpokeOnceRef.current && !forDictation) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > 1300) {
              // User finished speaking in Voice Agent mode and 1.3s elapsed
              stopTurnRecording(false);
              return;
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(pollLevel);
      };

      animFrameRef.current = requestAnimationFrame(pollLevel);

      // Also start MediaRecorder as robust fallback
      audioChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      setVoiceAgentStatus("listening");
      setVoiceStageInfo(forDictation ? "Listening for dictation... Click mic again to finish" : "Listening to your voice... Speak anytime");
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Please grant microphone permission to use speech recognition.");
      setIsVoiceAgentActive(false);
      setIsDictating(false);
      isDictatingRef.current = false;
      setVoiceAgentStatus("idle");
    }
  };

  const stopTurnRecording = (forDictation: boolean = false) => {
    isRecordingTurnRef.current = false;
    setIsRecordingTurn(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setMicVolume(0);
    setIsUserSpeaking(false);

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    const dictationMode = forDictation || isDictatingRef.current;

    // Process recorded PCM chunks into 16kHz WAV
    const chunks = pcmChunksRef.current;
    if (chunks.length > 0 && audioContextRef.current) {
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      const sampleRate = audioContextRef.current.sampleRate || 44100;
      const samples16k = downsampleTo16k(merged, sampleRate);

      // Send if speech duration is at least 0.15s (2400 samples)
      if (samples16k.length >= 2400) {
        const wavBlob = encodeWavBlob(samples16k, 16000);
        sendVoiceAudioBlob(wavBlob, dictationMode);
        return;
      }
    }

    // Fallback: check MediaRecorder chunks after brief delay
    setTimeout(() => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      });
      if (audioBlob.size > 800) {
        sendVoiceAudioBlob(audioBlob, dictationMode);
      } else {
        setVoiceAgentStatus("listening");
        if (isVoiceAgentActiveRef.current && !dictationMode) {
          setTimeout(() => {
            if (isVoiceAgentActiveRef.current && !isRecordingTurnRef.current) {
              startTurnRecording(false);
            }
          }, 350);
        }
      }
    }, 150);
  };

  const toggleDictation = async () => {
    if (isDictatingRef.current) {
      isDictatingRef.current = false;
      setIsDictating(false);
      stopTurnRecording(true);
    } else {
      if (isVoiceAgentActive) {
        await toggleVoiceAgent();
      }
      isDictatingRef.current = true;
      setIsDictating(true);
      await startTurnRecording(true);
    }
  };

  const toggleVoiceAgent = async () => {
    if (isVoiceAgentActive) {
      stopTurnRecording(false);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
      setMicVolume(0);
      setIsUserSpeaking(false);
      setLastUnderstoodText("");

      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
        activeAudioElementRef.current = null;
      }
      audioQueueRef.current = [];
      isAudioPlayingRef.current = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsVoiceAgentActive(false);
      setVoiceAgentStatus("idle");
      setVoiceStageInfo("");
    } else {
      if (isDictating) {
        await toggleDictation();
      }
      setIsVoiceAgentActive(true);
      setVoiceAgentStatus("listening");
      setVoiceStageInfo("Moonshine Tiny + LLM API + Kokoro TTS ready");
      await startTurnRecording(false);
    }
  };


  // Clean markdown artifacts for high-fidelity speech synthesis
  const cleanMarkdownForSpeech = (rawText: string): string => {
    if (!rawText) return "";
    return rawText
      .replace(/```[\s\S]*?```/g, " [code snippet] ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/\[(.*?)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>\s+/gm, "")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const stopReadAloud = () => {
    if (readAloudAudioRef.current) {
      try {
        readAloudAudioRef.current.pause();
        readAloudAudioRef.current.currentTime = 0;
      } catch { }
      readAloudAudioRef.current = null;
    }
    localTTS.stop();
    readAloudActiveMsgIdRef.current = null;
    setSpeakingMsgId(null);
    setIsSynthesizingSpeech(false);
  };

  // TTS Read Aloud via Kokoro-82M TTS
  const handleToggleSpeech = (msg: ChatMessage) => {
    // If currently speaking this message, stop
    if (speakingMsgId === msg.id) {
      stopReadAloud();
      return;
    }

    stopReadAloud();

    const cleaned = cleanMarkdownForSpeech(msg.text);
    if (!cleaned) return;

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      setSpeakingMsgId(msg.id);
      setIsSynthesizingSpeech(true);
      readAloudActiveMsgIdRef.current = msg.id;

      ws.send(
        JSON.stringify({
          action: "kokoro_synthesize",
          msg_id: msg.id,
          text: cleaned,
          voice_config: {
            voice_id: activeVoiceId,
            speed: speechSpeed,
          },
        })
      );
    } else {
      // Fallback to local browser speech synthesis
      setSpeakingMsgId(msg.id);
      readAloudActiveMsgIdRef.current = msg.id;
      localTTS.speak(cleaned, {
        onStart: () => setSpeakingMsgId(msg.id),
        onEnd: () => {
          setSpeakingMsgId(null);
          readAloudActiveMsgIdRef.current = null;
        },
        onError: () => {
          setSpeakingMsgId(null);
          readAloudActiveMsgIdRef.current = null;
        },
      });
    }
  };

  // Copy Message text
  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Dispatch prompt
  const handleSend = (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if ((!prompt && draftAttachments.length === 0) || isStreaming) return;

    let augmentedContent = prompt;
    if (draftAttachments.length > 0) {
      const fileContexts = draftAttachments
        .map((a) => {
          if (a.textContent) {
            return `\n\n[Attached File: ${a.name}]\n\`\`\`\n${a.textContent}\n\`\`\``;
          }
          return `\n\n[Attached Document: ${a.name}]`;
        })
        .join("");
      augmentedContent += fileContexts;
    }

    const userMessage: ChatMessage = {
      id: "msg_" + Date.now(),
      sender: "user",
      text: prompt || (draftAttachments.length > 0 ? `Shared ${draftAttachments.length} file(s)` : ""),
      attachments: draftAttachments.length > 0 ? [...draftAttachments] : undefined,
      timestamp: Date.now(),
    };

    const currentMsgs = activeSession ? [...activeSession.messages, userMessage] : [userMessage];
    const sessionTitle =
      activeSession?.messages.length === 0
        ? (prompt || draftAttachments[0]?.name || "New Chat").slice(0, 32) +
        ((prompt || draftAttachments[0]?.name || "").length > 32 ? "..." : "")
        : activeSession?.title || "New Chat";

    const updatedSession: ChatSession = {
      ...activeSession,
      title: sessionTitle,
      messages: currentMsgs,
      updatedAt: Date.now(),
      model: selectedModel,
    };

    typingQueueRef.current = "";
    typingThoughtQueueRef.current = "";
    streamDoneReceivedRef.current = false;
    if (typewriterTimerRef.current !== null) {
      cancelAnimationFrame(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    memoryEngine.saveSession(updatedSession);
    setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
    setInput("");
    setDraftAttachments([]);
    setIsStreaming(true);

    if (isAgentMode) {
      setAgentProgress({
        step: 1,
        maxSteps: 6,
        title: "Initializing Hermes Agent & planning execution roadmap...",
        percent: 10,
        tasks: [
          { id: "plan", title: "Analyze problem & plan execution trajectory", status: "running" },
          { id: "tool_exec", title: "Execute local tools (Python / Shell / Files)", status: "pending" },
          { id: "verify", title: "Inspect tool output & verify result", status: "pending" },
          { id: "synthesize", title: "Synthesize final solution & deliverable", status: "pending" },
        ],
      });
    } else {
      setAgentProgress(null);
    }

    const activeSkills = skills.filter((s) => s.enabled);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: "chat",
          agent_mode: isAgentMode,
          provider,
          api_key: apiKey,
          base_url: baseUrl,
          model: selectedModel,
          skills: activeSkills,
          enabled_tools: tools.filter((t) => t.enabled).map((t) => t.name),
          custom_tools: tools.filter((t) => t.isCustom && t.enabled),
          mcp_servers: isMcpEnabled
            ? Object.fromEntries(
              mcpServers
                .filter((s) => s.enabled)
                .map((s) => [
                  s.name,
                  s.transport === "stdio"
                    ? { command: s.command || "npx", args: s.args || [], env: s.env || {}, enabled: true }
                    : { url: s.url || "", transport: s.transport, enabled: true },
                ])
            )
            : {},
          messages: currentMsgs.map((m, idx) => ({
            sender: m.sender,
            content: idx === currentMsgs.length - 1 ? augmentedContent : m.text,
            attachments: m.attachments,
          })),
          temperature,
          system_prompt: systemPrompt,
          auto_tts: autoTTS,
          voice_config: { voice: activeVoiceId, speed: speechSpeed },
        })
      );
    } else {
      setTimeout(() => {
        enqueueStreamToken(
          "[Notice] Engine daemon is offline (`ws://localhost:18789`). Please start the engine with `pnpm dev:engine`.",
          false
        );
        handleStreamDone();
      }, 500);
    }
  };

  // Screen Capture Helper for Multimodal Analysis
  const captureScreenSnapshot = async (): Promise<AttachedFile | null> => {
    try {
      setIsCapturingScreen(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        track.stop();
        return null;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      track.stop();

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const screenAtt: AttachedFile = {
        id: "screen_" + Date.now(),
        name: `Screen_${new Date().toLocaleTimeString().replace(/:/g, "-")}.jpg`,
        size: Math.round((dataUrl.length * 3) / 4),
        type: "image/jpeg",
        dataUrl,
      };
      return screenAtt;
    } catch (err) {
      console.warn("Screen capture cancelled or failed:", err);
      return null;
    } finally {
      setIsCapturingScreen(false);
    }
  };

  const handleCaptureScreen = async () => {
    const screenAtt = await captureScreenSnapshot();
    if (screenAtt) {
      setDraftAttachments((prev) => [...prev, screenAtt]);
      setIsAttachMenuOpen(false);
    }
  };

  // Stop Generation
  const handleStopGeneration = () => {
    setIsStreaming(false);
    setAgentProgress(null);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: "stop" }));
    }
  };

  // New Chat
  const handleNewChat = () => {
    const newSess = memoryEngine.createNewSession("New Chat", selectedModel);
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
  };

  // Delete Session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    memoryEngine.deleteSession(id);
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        const fresh = memoryEngine.createNewSession("New Chat", selectedModel);
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    }
  };

  // Export Markdown
  const handleExportMarkdown = () => {
    if (!activeSession) return;
    const md = memoryEngine.exportSessionToMarkdown(activeSession);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(activeSession?.title || "chat").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSessions = sessions.filter((s) =>
    (s?.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCloudProvider = provider !== "ollama";
  const hasKey = Boolean(apiKey.trim());
  const isDark = theme === "dark";
  const activeSkillsCount = skills.filter((s) => s.enabled).length;
  const activeToolsCount = tools.filter((t) => t.enabled).length;
  const currentLogo = isDark ? "/songbird-logo-dark.png" : "/songbird-logo-light.png";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingOver(false);
        }
      }}
      onDrop={handleDrop}
      className={`flex h-screen overflow-hidden select-none font-sans transition-colors duration-200 relative ${isDark ? "theme-dark bg-[#212121] text-[#ececec]" : "theme-light bg-[#ffffff] text-[#1c1c1a]"
        }`}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        type="file"
        multiple
        accept="image/*"
        ref={photoInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Full-Screen Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md border-2 border-dashed border-white/40 text-white animate-fade-in pointer-events-none">
          <FileUp size={48} className="text-white animate-bounce mb-3" />
          <h3 className="text-xl font-bold">Drop files or pictures here</h3>
          <p className="text-xs text-zinc-400 mt-1">Images, documents, code files, and datasets supported</p>
        </div>
      )}

      {/* Settings Modal (Centralized suite for General, Skills, Tools, MCP, and Voice) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        provider={provider}
        setProvider={setProvider}
        apiKey={apiKey}
        setApiKey={setApiKey}
        baseUrl={baseUrl}
        setBaseUrl={setBaseUrl}
        model={selectedModel}
        setModel={setSelectedModel}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        temperature={temperature}
        setTemperature={setTemperature}
        autoTTS={autoTTS}
        setAutoTTS={setAutoTTS}
        skills={skills}
        setSkills={setSkills}
        tools={tools}
        setTools={setTools}
        mcpServers={mcpServers}
        setMcpServers={setMcpServers}
        isMcpEnabled={isMcpEnabled}
        setIsMcpEnabled={setIsMcpEnabled}
        ws={socketRef.current}
        activeVoiceId={activeVoiceId}
        setActiveVoiceId={setActiveVoiceId}
        speechSpeed={speechSpeed}
        setSpeechSpeed={setSpeechSpeed}
        initialTab={settingsTab}
      />

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside
        className={`${isSidebarOpen ? "w-[260px]" : "w-0"
          } transition-all duration-200 ease-in-out border-r flex flex-col z-30 overflow-hidden shrink-0 ${isDark ? "bg-[#171717] border-[#282828]" : "bg-[#f9f9f8] border-[#e6e6e0]"
          }`}
      >
        {/* Brand Header */}
        <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 shadow-sm shrink-0 bg-white ring-1 ring-white/10">
              <img
                src="/songbird-logo.png"
                alt="Songbird"
                className="w-full h-full object-cover select-none"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                <span className="t-shimmer" data-text="Songbird">Songbird</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-[var(--sb-text-secondary)] border border-white/10 font-mono font-semibold">
                  Beta
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg transition text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] hover:bg-white/5 cursor-pointer"
            title="Close sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-2">
          <button
            onClick={handleNewChat}
            className="w-full orb-pill flex items-center justify-between px-3.5 py-2.5 text-xs font-medium transition group cursor-pointer hover:scale-[1.01]"
          >
            <div className="flex items-center gap-2.5">
              <OrbIconBadge size="sm" variant="neutral" active={false}>
                <Plus size={13} className="text-[var(--sb-text-primary)] group-hover:rotate-90 transition-transform duration-200" />
              </OrbIconBadge>
              <span className="font-semibold text-[var(--sb-text-primary)]">New chat</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-mono text-[var(--sb-text-muted)] bg-black/20">
              Ctrl K
            </span>
          </button>
        </div>

        {/* Mode Toggle (Chat vs Autonomous Agent) */}
        <div className="px-3 py-1">
          <div className="flex rounded-xl p-1 border border-[var(--sb-border)] bg-[var(--mock-chat-bg)] text-xs">
            <button
              onClick={() => setIsAgentMode(false)}
              className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${!isAgentMode
                ? "orb-pill font-semibold text-[var(--sb-text-primary)]"
                : "text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)]"
                }`}
            >
              <span>Chat</span>
            </button>
            <button
              onClick={() => setIsAgentMode(true)}
              className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${isAgentMode
                ? isDark
                  ? "orb-pill font-semibold text-white border border-white/20"
                  : "orb-pill font-semibold text-black border border-black/20"
                : "text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)]"
                }`}
            >
              <AgentSparkIcon size={13} glow={isAgentMode} />
              <span>Agent</span>
            </button>
          </div>
        </div>



        {/* Code Studio (Monaco Editor) Button in Sidebar */}
        <div className="px-3 py-1">
          <button
            onClick={() => setIsCodeEditorOpen(!isCodeEditorOpen)}
            className="w-full orb-chip flex items-center justify-between px-3 py-2 text-xs font-medium cursor-pointer"
            title="Toggle Split-Screen Code Studio (Ctrl+Shift+E)"
          >
            <div className="flex items-center gap-2">
              <OrbIconBadge size="sm" variant="neutral" active={isCodeEditorOpen}>
                <Code2 size={13} className="text-[var(--sb-text-primary)]" />
              </OrbIconBadge>
              <span>Code Studio</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold text-[var(--sb-text-muted)]">
              {isCodeEditorOpen ? "Active" : "Ctrl+Shift+E"}
            </span>
          </button>
        </div>

        {/* Search Chats Input */}
        <div className="px-3 py-1">
          <div className="orb-chip flex items-center gap-2 px-2.5 py-1.5 text-xs">
            <Search size={13} className="text-[var(--sb-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-transparent text-xs text-[var(--sb-text-primary)] placeholder-[var(--sb-text-muted)] focus:outline-none"
            />
          </div>
        </div>

        {/* Session History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-2 text-xs text-[var(--sb-text-secondary)]">
          <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--sb-text-muted)]">Recent</div>
          {filteredSessions.map((sess) => (
            <div
              key={sess.id}
              onClick={() => {
                setActiveSessionId(sess.id);
                memoryEngine.setActiveSessionId(sess.id);
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${sess.id === activeSessionId
                ? "orb-card font-medium text-white shadow-sm"
                : isDark
                  ? "hover:bg-white/[0.04] hover:text-[#e0e0e0]"
                  : "hover:bg-black/[0.04] hover:text-[#1c1c1a]"
                }`}
            >
              <span className="truncate flex-1">{sess.title || "New Chat"}</span>
              <button
                onClick={(e) => handleDeleteSession(sess.id, e)}
                className="opacity-0 group-hover:opacity-100 text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] p-0.5 transition"
                title="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* User Profile & Footer Toolbar */}
        <div
          className={`p-3 border-t flex items-center justify-between text-xs transition ${isDark ? "bg-[#141414] border-[#282828]" : "bg-[#f4f4f2] border-[#e6e6e0]"
            }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/10 shadow-sm shrink-0 bg-white">
              <img
                src="/songbird-logo.png"
                alt="Songbird"
                className="w-full h-full object-cover select-none"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--sb-text-primary)]">
                {isAgentMode ? "Hermes Agent" : "Songbird Beta"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick 1-Click Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg transition ${isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#eaeae4]"
                }`}
              title={`Switch to ${isDark ? "Light" : "Dark"} Theme`}
            >
              {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
            </button>

            <button
              onClick={() => {
                setSettingsTab("general");
                setIsSettingsOpen(true);
              }}
              className={`p-1.5 rounded-lg transition ${isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#eaeae4]"
                }`}
              title="Configure API Provider & Keys"
            >
              <Sliders size={15} />
            </button>
            <button
              onClick={handleExportMarkdown}
              className={`p-1.5 rounded-lg transition ${isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#eaeae4]"
                }`}
              title="Export Conversation"
            >
              <Download size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <div
        className="flex-1 flex flex-col h-full relative overflow-hidden bg-[var(--sb-bg-canvas)]"
        ref={mainViewContainerRef}
      >
        {/* Top Navbar */}
        <header
          className={`h-13 px-4 flex items-center justify-between border-b z-20 select-none relative transition ${isDark ? "border-[#2b2b2b]/50" : "border-[#e6e6e0]"
            }`}
        >
          {/* Zone 1: Context (Left) */}
          <div className="flex items-center gap-2.5 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <span className="text-xs font-medium text-[var(--sb-text-secondary)] truncate max-w-[180px]">
              {activeSession?.title || "New conversation"}
            </span>
          </div>

          {/* Top-Right Spacer */}
          <div className="w-6" />

          {/* ==================== TOP GLOBAL PROGRESS BAR (AGENT MODE ONLY) ==================== */}
          {isAgentMode && isStreaming && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden z-30">
              <div
                className="h-full bg-gradient-to-r from-zinc-500 via-zinc-300 to-white transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${agentProgress ? Math.max(5, Math.min(agentProgress.percent, 100)) : 100}%` }}
              />
            </div>
          )}
        </header>

        {/* ==================== WORKSPACE SPLIT CONTAINER (CODE STUDIO ON LEFT + CHATBOX ON RIGHT) ==================== */}
        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Left Column: Code Studio Monaco Editor (when open) */}
          {isCodeEditorOpen && (
            <div
              style={{ width: `${editorSplitRatio * 100}%` }}
              className="h-full flex flex-col min-w-[340px] overflow-hidden border-r border-[var(--sb-border)] transition-[width] duration-75"
            >
              <CodeEditorPanel
                theme={theme}
                isOpen={isCodeEditorOpen}
                onClose={() => setIsCodeEditorOpen(false)}
                ws={socketRef.current}
                onSendToChat={(prompt) => {
                  setInput(prompt);
                  setTimeout(() => textareaRef.current?.focus(), 100);
                }}
                externalOpenFile={externalOpenFile}
                onExternalFileOpened={() => setExternalOpenFile(null)}
              />
            </div>
          )}

          {/* Draggable Resizer Splitter between Code Editor (Left) and Chatbox (Right) */}
          {isCodeEditorOpen && (
            <div
              onMouseDown={handleSplitterMouseDown}
              onDoubleClick={() => {
                setEditorSplitRatio(0.58);
                localStorage.setItem("songbird_main_split_ratio", "0.58");
              }}
              className={`w-1.5 hover:w-2 -mx-0.5 relative z-30 cursor-col-resize select-none transition-colors flex items-center justify-center group ${isDraggingSplitter
                ? "bg-white"
                : isDark
                  ? "bg-[#252525] hover:bg-white/30"
                  : "bg-[#e2e2dc] hover:bg-black/20"
                }`}
              title="Drag to resize Code Editor vs Chatbox (Double-click to reset)"
            >
              <div className="w-0.5 h-6 rounded-full bg-stone-500/40 group-hover:bg-white" />
            </div>
          )}

          {/* Right Column: The Same Songbird Chatbox */}
          <div
            style={isCodeEditorOpen ? { width: `${(1 - editorSplitRatio) * 100}%` } : undefined}
            className={`flex flex-col h-full overflow-hidden transition-all duration-100 ${isCodeEditorOpen ? "min-w-[340px]" : "w-full flex-1"
              }`}
          >
            {/* ==================== CENTER CHAT FEED (SCROLLABLE AREA ONLY) ==================== */}
            <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center">
              {!hasMessages ? (
                /* ==================== EMPTY STATE: HERO NEXUS ==================== */
                <div className="w-full max-w-3xl my-auto flex flex-col items-center justify-center space-y-6 pt-2 animate-fade-in">
                  {/* Hero Emblem Pedestal */}
                  <div className="relative flex flex-col items-center">
                    <div className="orb-pedestal w-24 h-24 rounded-3xl overflow-hidden border border-white/15 shadow-2xl transition-all duration-300 select-none hover:scale-105 bg-white ring-1 ring-white/15">
                      <img
                        src="/songbird-logo.png"
                        alt="Songbird"
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-2 max-w-lg">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--sb-text-primary)]">
                      How can Songbird Beta help you today?
                    </h1>
                    <p className="text-xs md:text-sm text-[var(--sb-text-secondary)] leading-relaxed">
                      {isAgentMode
                        ? "Autonomous agent active with Python script execution, shell diagnostics, and file operations."
                        : "Conversational intelligence & software architecture powered by Songbird Beta."}
                    </p>
                  </div>

                </div>
              ) : (
                /* ==================== ACTIVE CONVERSATION FEED ==================== */
                <div className="w-full max-w-3xl mx-auto space-y-6 pt-6 pb-4">
                  {activeSession.messages.map((msg, idx) => {
                    const isUser = msg.sender === "user";
                    const isSpeaking = speakingMsgId === msg.id;
                    const isCopied = copiedMsgId === msg.id;

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
                      >
                        {!isUser && (
                          <div
                            className={`w-8 h-8 rounded-full overflow-hidden shrink-0 select-none shadow-md mt-0.5 border border-white/15 bg-white transition-all duration-300 ${isStreaming && idx === activeSession.messages.length - 1
                                ? "ring-2 ring-white/30 shadow-black/40"
                                : ""
                              }`}
                          >
                            <img
                              src="/songbird-logo.png"
                              alt="Songbird"
                              className="w-full h-full object-cover select-none"
                            />
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] text-[15px] leading-relaxed select-text ${isUser
                            ? "orb-card px-5 py-3.5 text-[var(--sb-text-primary)] shadow-sm"
                            : "text-[var(--sb-text-primary)] flex-1 pt-0.5"
                            }`}
                        >
                          {/* Attachments Display in Message Bubble */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <AttachmentList files={msg.attachments} />
                          )}

                          {/* Minimal typing dots when waiting for first token */}
                          {!isUser &&
                            isStreaming &&
                            idx === activeSession.messages.length - 1 &&
                            !msg.text &&
                            (!msg.toolExecutions || msg.toolExecutions.length === 0) && (
                              <div className="flex items-center gap-1.5 py-2 px-1 text-[var(--sb-text-muted)] animate-fade-in">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:200ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:400ms]" />
                              </div>
                            )}

                          {/* Tool Call Cards for Hermes Agent */}
                          {!isUser &&
                            msg.toolExecutions &&
                            msg.toolExecutions.map((tool) => (
                              <AgentToolCard key={tool.id} execution={tool} />
                            ))}

                          {/* Message Text Content */}
                          {isUser ? (
                            <div>
                              {msg.id.startsWith("voice_user_") && (
                                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-mono font-medium text-[var(--sb-text-muted)]">
                                  <Mic size={11} />
                                  <span>Moonshine Tiny STT</span>
                                </div>
                              )}
                              <div className="whitespace-pre-wrap">{msg.text}</div>
                            </div>
                          ) : (
                            <MarkdownRenderer
                              content={msg.text}
                              isStreaming={isStreaming && idx === activeSession.messages.length - 1}
                              onOpenInEditor={(code, language) => {
                                setIsCodeEditorOpen(true);
                                const ext =
                                  language === "python"
                                    ? "py"
                                    : language === "javascript"
                                      ? "js"
                                      : language === "typescript"
                                        ? "ts"
                                        : "txt";
                                setExternalOpenFile({
                                  path: `snippets/snippet_${Date.now()}.${ext}`,
                                  content: code,
                                  language,
                                });
                              }}
                            />
                          )}

                          {/* Assistant Action Toolbar */}
                          {!isUser && (
                            <div className="mt-3 flex items-center gap-2.5 text-xs text-[var(--sb-text-muted)] select-none pt-1">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{msg.model || selectedModel}</span>
                              <button
                                onClick={() => handleCopyMessage(msg)}
                                className="flex items-center gap-1 hover:text-[var(--sb-text-primary)] transition cursor-pointer"
                                title="Copy message"
                              >
                                {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                <span>{isCopied ? "Copied" : "Copy"}</span>
                              </button>

                              <button
                                onClick={() => handleToggleSpeech(msg)}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition text-xs font-medium border ${isSpeaking
                                  ? "bg-amber-500/15 border-amber-500/40 text-amber-500 animate-pulse"
                                  : isDark
                                    ? "bg-transparent border-transparent hover:bg-[#2e2e2e] text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)]"
                                    : "bg-transparent border-transparent hover:bg-[#eaeae2] text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)]"
                                  }`}
                                title={
                                  isSpeaking
                                    ? "Stop Kokoro Speech"
                                    : `Read Aloud with Kokoro TTS (${activeVoiceId})`
                                }
                              >
                                {isSpeaking ? (
                                  isSynthesizingSpeech ? (
                                    <Loader2 size={13} className="animate-spin text-amber-400" />
                                  ) : (
                                    <VolumeX size={13} className="text-amber-500" />
                                  )
                                ) : (
                                  <Volume2 size={13} className="text-amber-500/80 hover:text-amber-400" />
                                )}
                                <span>
                                  {isSpeaking
                                    ? isSynthesizingSpeech
                                      ? "Synthesizing..."
                                      : "Speaking (Kokoro)..."
                                    : "Read Aloud"}
                                </span>
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase tracking-wider ${isSpeaking
                                    ? "bg-amber-500 text-black font-semibold"
                                    : isDark
                                      ? "bg-[#333333] text-[#aaaaaa]"
                                      : "bg-[#e2e2da] text-[#666660]"
                                    }`}
                                >
                                  Kokoro
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <OrbIconBadge size="sm" variant="neutral" className="mt-0.5">
                            <User size={13} />
                          </OrbIconBadge>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} className="h-4 shrink-0" />
                </div>
              )}
            </main>

            {/* ==================== PINNED BOTTOM CHAT BOX CONTAINER (ALWAYS FIXED IN PLACE) ==================== */}
            <footer className="shrink-0 w-full px-4 pb-3 pt-1.5 z-20 flex flex-col items-center">
              <div className="w-full max-w-3xl">
                {/* Live Agent Execution Plan & Progress Card (AGENT MODE ONLY) */}
                {isAgentMode && isStreaming && agentProgress && (
                  <AgentProgressCard
                    progress={agentProgress}
                    elapsedSeconds={elapsedSeconds}
                    onStop={handleStopGeneration}
                    theme={theme}
                  />
                )}

                <div
                  className={`orb-chat-composer p-4 flex flex-col gap-3 transition-all duration-300 relative ${isAgentMode ? "ring-1 ring-white/20" : ""
                    }`}
                >
                  {/* Draft Attachments Preview inside Composer */}
                  {draftAttachments.length > 0 && (
                    <AttachmentList
                      files={draftAttachments}
                      onRemove={handleRemoveDraftAttachment}
                      isDraft={true}
                    />
                  )}

                  {/* Unified Voice Agent Hearing & Heard Status inside Chat Bar */}
                  {(isVoiceAgentActive || sttHeardInfo) && (
                    <div
                      className={`px-3 py-2 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-fade-in transition shadow-sm ${isUserSpeaking
                        ? isDark
                          ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-emerald-950/20"
                          : "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-emerald-100"
                        : sttHeardInfo
                          ? isDark
                            ? "bg-[#252525] border-emerald-600/50 text-[#f0f0f0]"
                            : "bg-emerald-50/90 border-emerald-300 text-[#1a1a1a]"
                          : voiceAgentStatus === "speaking"
                            ? isDark
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-black/5 border-black/15 text-black"
                            : isDark
                              ? "bg-[#242424] border-[#383838] text-[#dcdcdc]"
                              : "bg-[#f5f5f0] border-[#dcdcd4] text-[#2c2c2a]"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                          {isUserSpeaking ? (
                            <AudioLines size={16} className="text-emerald-400 animate-pulse" />
                          ) : voiceAgentStatus === "speaking" ? (
                            <Waves size={16} className="text-[var(--sb-text-primary)] animate-bounce" />
                          ) : voiceAgentStatus === "processing" ? (
                            <Loader2 size={16} className="text-amber-400 animate-spin" />
                          ) : sttHeardInfo ? (
                            <Check size={14} strokeWidth={3} className="text-emerald-400 relative z-10" />
                          ) : (
                            <Mic size={16} className="text-emerald-400" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {sttHeardInfo ? (
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                                Heard
                              </span>
                              <span className="font-semibold text-xs truncate" title={sttHeardInfo.text}>
                                "{sttHeardInfo.text}"
                              </span>
                              {sttHeardInfo.latencyMs !== undefined && (
                                <span className="text-[10px] font-mono text-[var(--sb-text-muted)] shrink-0 hidden sm:inline">
                                  ⚡ {Math.round(sttHeardInfo.latencyMs)}ms
                                </span>
                              )}
                              {sttHeardInfo.device && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400/90 font-mono shrink-0 hidden md:inline">
                                  {sttHeardInfo.device.toUpperCase()}
                                </span>
                              )}
                            </div>
                          ) : isUserSpeaking ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-xs text-emerald-400">
                                Hearing voice...
                              </span>
                              <span className="text-[10px] font-mono text-[var(--sb-text-muted)]">
                                ({micVolume}%)
                              </span>
                            </div>
                          ) : voiceAgentStatus === "speaking" ? (
                            <span className="font-semibold text-xs text-[var(--sb-text-primary)]">
                              Voice Agent replying (Kokoro TTS)...
                            </span>
                          ) : voiceAgentStatus === "processing" ? (
                            <span className="font-semibold text-xs text-amber-400 animate-pulse">
                              Moonshine Tiny transcribing speech...
                            </span>
                          ) : (
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[11px] font-mono tracking-wide uppercase text-emerald-400 flex items-center gap-1.5">
                                Voice Agent Listening
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-sans font-medium">
                                  Moonshine Tiny
                                </span>
                              </span>
                              <span className="text-[10px] opacity-75 truncate">
                                Speak anytime: transcribes speech to input and responds with voice
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Real-time audio waveform equalizer bars & Dismiss */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-black/10 dark:bg-black/30">
                          {[14, 28, 55, 75, 48, 24, 62].map((baseHeight, idx) => {
                            const factor = isUserSpeaking
                              ? Math.max(0.2, micVolume / 100)
                              : voiceAgentStatus === "speaking"
                                ? 0.45
                                : 0.12;
                            const barHeight = Math.max(4, Math.round(baseHeight * factor * 0.24));
                            return (
                              <span
                                key={idx}
                                className={`w-1 rounded-full transition-all duration-75 ${isUserSpeaking
                                  ? "bg-emerald-400"
                                  : voiceAgentStatus === "speaking"
                                    ? "bg-zinc-200 dark:bg-white"
                                    : "bg-emerald-500/40"
                                  }`}
                                style={{ height: `${barHeight}px` }}
                              />
                            );
                          })}
                        </div>

                        {sttHeardInfo && (
                          <button
                            type="button"
                            onClick={() => {
                              if (input === sttHeardInfo.text) {
                                setInput("");
                              }
                              setSttHeardInfo(null);
                            }}
                            className="p-1 rounded-lg text-[var(--sb-text-muted)] hover:text-white transition cursor-pointer"
                            title="Dismiss heard text"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={
                      isVoiceAgentActive
                        ? isUserSpeaking
                          ? "Hearing your voice... (Moonshine Tiny STT)"
                          : sttHeardInfo
                            ? `Voice heard: "${sttHeardInfo.text}"`
                            : "Voice Agent listening... Speak anytime"
                        : isAgentMode
                          ? "Assign an autonomous task to Hermes Agent (with files & pictures)..."
                          : `Message ${selectedModel}...`
                    }
                    className={`w-full bg-transparent text-sm md:text-[15px] placeholder-[#888888] px-2 py-1 focus:outline-none resize-none max-h-48 min-h-[38px] leading-relaxed ${isDark ? "text-[#f0f0f0]" : "text-[#1c1c1a]"
                      }`}
                  />

                  {/* Bottom Toolbar */}
                  <div className="flex items-center justify-between px-1 pt-1 relative">
                    {/* Left Action Buttons */}
                    <div className="flex items-center gap-2 text-[var(--sb-text-muted)] relative" ref={attachMenuRef}>
                      {/* File / Photo Attachment Menu Button */}
                      <button
                        type="button"
                        onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                        className={`orb-chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition ${
                          isAttachMenuOpen || draftAttachments.length > 0
                            ? isDark
                              ? "bg-white/10 text-white border border-white/20"
                              : "bg-black/10 text-black border border-black/20"
                            : ""
                        }`}
                        title="Attach Photos or Files"
                      >
                        <OrbIconBadge size="sm" variant="neutral">
                          <Plus size={12} className={`transition duration-200 ${isAttachMenuOpen ? (isDark ? "rotate-45 text-white" : "rotate-45 text-black") : ""}`} />
                        </OrbIconBadge>
                        <span>Attach</span>
                        {draftAttachments.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-black font-mono font-semibold">
                            {draftAttachments.length}
                          </span>
                        )}
                      </button>

                      {/* Attachment Popover Action Dropdown Menu */}
                      {isAttachMenuOpen && (
                        <div
                          className={`absolute bottom-full left-0 mb-2 w-60 rounded-2xl border shadow-2xl overflow-hidden p-1.5 z-50 animate-fade-in transition font-sans ${isDark
                            ? "bg-[#1e1e1e] border-[#383838] text-[#ececec] shadow-black/60"
                            : "bg-[#ffffff] border-[#dcdcd4] text-[#1c1c1a] shadow-xl"
                            }`}
                        >
                          <div className="px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider text-[var(--sb-text-muted)] border-b border-[var(--sb-border)] mb-1">
                            Add Attachment
                          </div>

                          {/* 1. Upload Photo / Picture */}
                          <button
                            type="button"
                            onClick={() => {
                              photoInputRef.current?.click();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition group ${isDark ? "hover:bg-[#2a2a2a]" : "hover:bg-[#f3f3ee]"
                              }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-[var(--sb-text-primary)] shrink-0">
                              <ImageIcon size={16} />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-xs font-semibold">Upload Photo</span>
                              <span className="text-[10px] text-[var(--sb-text-muted)] truncate">PNG, JPG, WEBP, GIF, SVG</span>
                            </div>
                          </button>

                          {/* 2. Upload File / Document / Code */}
                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition group ${isDark ? "hover:bg-[#2a2a2a]" : "hover:bg-[#f3f3ee]"
                              }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-xs font-semibold">Upload File / Document</span>
                              <span className="text-[10px] text-[var(--sb-text-muted)] truncate">PDF, CSV, JSON, TXT, Code</span>
                            </div>
                          </button>

                          {/* 3. Capture Screen for Multimodal Analysis */}
                          <button
                            type="button"
                            onClick={handleCaptureScreen}
                            disabled={isCapturingScreen}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition group ${isDark ? "hover:bg-[#2a2a2a]" : "hover:bg-[#f3f3ee]"
                              }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                              <Monitor size={16} />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-xs font-semibold text-cyan-400">Capture Screen</span>
                              <span className="text-[10px] text-[var(--sb-text-muted)] truncate">
                                {isCapturingScreen ? "Capturing..." : "Take snapshot for multimodal analysis"}
                              </span>
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Agent Mode Toggle */}
                      <button
                        onClick={() => setIsAgentMode(!isAgentMode)}
                        className={`orb-chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition ${
                          isAgentMode
                            ? isDark
                              ? "bg-white/15 text-white border border-white/30 font-semibold shadow-sm"
                              : "bg-black/10 text-black border border-black/20 font-semibold shadow-sm"
                            : ""
                        }`}
                        title="Toggle Autonomous Agent Mode"
                      >
                        <OrbIconBadge size="sm" variant="neutral" active={isAgentMode} glow={isAgentMode}>
                          <AgentSparkIcon size={12} glow={isAgentMode} />
                        </OrbIconBadge>
                        <span>{isAgentMode ? "Agent Active" : "Agent Mode"}</span>
                      </button>

                      {/* Unified Voice Agent Button */}
                      <button
                        type="button"
                        onClick={toggleVoiceAgent}
                        className={`orb-chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition ${
                          isVoiceAgentActive
                            ? isDark
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                              : "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 shadow-sm"
                            : ""
                        }`}
                        title={
                          isVoiceAgentActive
                            ? "Voice Agent Active: Dictating speech into chat & replying with Kokoro TTS (Click to stop)"
                            : "Voice Agent (Dictate with Moonshine STT & converse with Kokoro TTS)"
                        }
                      >
                        <OrbIconBadge size="sm" variant="emerald" active={isVoiceAgentActive} glow={isVoiceAgentActive}>
                          {isVoiceAgentActive ? (
                            <AudioLines size={12} className="text-emerald-400 animate-pulse" />
                          ) : (
                            <Mic size={12} className="text-[var(--sb-text-muted)]" />
                          )}
                        </OrbIconBadge>
                        <span>
                          {isVoiceAgentActive
                            ? isUserSpeaking
                              ? "Hearing..."
                              : voiceAgentStatus === "speaking"
                              ? "Speaking..."
                              : "Voice ON"
                            : "Voice Agent"}
                        </span>
                      </button>
                    </div>

                    {/* Right Send or Stop Button */}
                    <div className="flex items-center gap-2">
                      {isStreaming ? (
                        <button
                          onClick={handleStopGeneration}
                          className="orb-pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[var(--sb-text-primary)] border border-white/20 bg-white/10 hover:bg-white/20 transition shadow cursor-pointer"
                        >
                          <Square size={10} className="fill-current" />
                          <span>Stop</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSend()}
                          disabled={!input.trim() && draftAttachments.length === 0}
                          className={`w-8 h-8 rounded-full orb-pill flex items-center justify-center transition-all duration-200 shadow-md ${
                            input.trim() || draftAttachments.length > 0
                              ? "bg-white text-black hover:bg-zinc-200 hover:scale-105 cursor-pointer shadow-lg"
                              : "opacity-30 cursor-not-allowed text-[var(--sb-text-muted)]"
                          }`}
                          title={isAgentMode ? "Run Autonomous Agent" : "Send Message"}
                        >
                          <ArrowUp size={15} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Disclaimer */}
                <div className="text-center text-[11px] text-[var(--sb-text-muted)] mt-2 select-none">
                  Songbird Agent runs local commands & code with your permission. Verify outputs.
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}