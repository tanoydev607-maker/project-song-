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
} from "lucide-react";
import { localTTS } from "@orca/local-tts";
import { memoryEngine, type ChatMessage, type ChatSession, type ToolExecution, type AttachedFile } from "@orca/memory-engine";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { ThoughtAccordion } from "./components/ThoughtAccordion";
import { AgentToolCard } from "./components/AgentToolCard";
import { SettingsModal, type AIProvider, PROVIDER_CONFIGS } from "./components/SettingsModal";
import { SkillsModal, DEFAULT_SKILLS, type AgentSkill } from "./components/SkillsModal";
import { AgentProgressCard, type AgentProgressState } from "./components/AgentProgressCard";
import { AttachmentList } from "./components/FileAttachmentPreview";
import { KokoroVoiceModal } from "./components/KokoroVoiceModal";

const DEFAULT_SYSTEM_PROMPT =
  "You are Songbird, an advanced AI agent specialized in deep reasoning, software architecture, problem-solving, and synthesis. Structure your answers with clear markdown formatting, headings, and syntax-highlighted code blocks.";

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

  // Attachments State (Draft files for current prompt)
  const [draftAttachments, setDraftAttachments] = useState<AttachedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

  // Session & Message State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Mode Selection: Chat Mode vs Agent Mode
  const [isAgentMode, setIsAgentMode] = useState<boolean>(() => {
    return localStorage.getItem("songbird_agent_mode") === "true";
  });

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

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
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
      ws = new WebSocket("ws://localhost:18789");
      socketRef.current = ws;

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
            handleToolResult(data.tool_id, data.tool, data.output, data.status);
          } else if (data.type === "voice_stage") {
            setVoiceStageInfo(`Stage ${data.stage}: ${data.name}`);
          } else if (data.type === "voice_stt") {
            handleVoiceSTTReceived(data.text, data.latency_ms);
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
            if (readAloudActiveMsgIdRef.current === data.msg_id && data.audio_b64) {
              const mime = data.mime_type || "audio/wav";
              const audio = new Audio(`data:${mime};base64,${data.audio_b64}`);
              readAloudAudioRef.current = audio;
              setSpeakingMsgId(data.msg_id);

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
  const handleToolResult = (toolId: string, tool: string, output: string, status: "success" | "error") => {
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
          t.id === toolId ? { ...t, output, status } : t
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

  const enqueueStreamToken = (token: string, isThought: boolean) => {
    if (isThought) {
      typingThoughtQueueRef.current += token;
    } else {
      typingQueueRef.current += token;
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

  const handleVoiceSTTReceived = (text: string, latencyMs?: number) => {
    if (!text.trim()) return;

    setLastUnderstoodText(text);
    setVoiceStageInfo(`Understood: "${text}" via Moonshine Tiny (${latencyMs || 0}ms)`);
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

  const sendVoiceAudioBlob = (blob: Blob) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    setVoiceAgentStatus("processing");
    setVoiceStageInfo("Stage 1: Moonshine Tiny STT transcribing audio...");

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
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

  const startTurnRecording = async () => {
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

        if (normalized > 10) {
          setIsUserSpeaking(true);
          userSpokeOnceRef.current = true;
          silenceStartRef.current = null;
          setVoiceStageInfo("Hearing your voice... (Moonshine Tiny listening)");
        } else {
          setIsUserSpeaking(false);
          if (userSpokeOnceRef.current) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > 1300) {
              // User finished speaking and 1.3s elapsed: auto-finish and send turn!
              stopTurnRecording();
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
      setIsRecordingTurn(true);
      setVoiceAgentStatus("listening");
      setVoiceStageInfo("Listening to your voice... Speak anytime");
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Please grant microphone permission to use the Realtime Voice Agent.");
      setIsVoiceAgentActive(false);
      setVoiceAgentStatus("idle");
    }
  };

  const stopTurnRecording = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setMicVolume(0);
    setIsUserSpeaking(false);
    setIsRecordingTurn(false);

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

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

      // Only send if speech duration is at least 0.25 seconds
      if (samples16k.length >= 4000) {
        const wavBlob = encodeWavBlob(samples16k, 16000);
        sendVoiceAudioBlob(wavBlob);
        return;
      }
    }

    // Fallback: check MediaRecorder chunks after brief delay
    setTimeout(() => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      });
      if (audioBlob.size > 1200) {
        sendVoiceAudioBlob(audioBlob);
      } else {
        setVoiceAgentStatus("listening");
        if (isVoiceAgentActiveRef.current) {
          setTimeout(() => {
            if (isVoiceAgentActiveRef.current && !isRecordingTurnRef.current) {
              startTurnRecording();
            }
          }, 350);
        }
      }
    }, 150);
  };

  const toggleVoiceAgent = async () => {
    if (isVoiceAgentActive) {
      stopTurnRecording();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
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
      setIsVoiceAgentActive(true);
      setVoiceAgentStatus("listening");
      setVoiceStageInfo("Moonshine Tiny + LLM API + Kokoro TTS ready");
      await startTurnRecording();
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
      } catch {}
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
          messages: currentMsgs.map((m, idx) => ({
            sender: m.sender,
            content: idx === currentMsgs.length - 1 ? augmentedContent : m.text,
            attachments: m.attachments,
          })),
          temperature,
          system_prompt: systemPrompt,
        })
      );
    } else {
      setTimeout(() => {
        enqueueStreamToken(
          "⚠️ Engine daemon is offline (`ws://localhost:18789`). Please start the engine with `pnpm dev:engine`.",
          false
        );
        handleStreamDone();
      }, 500);
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
    a.download = `${activeSession.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeProviderConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openrouter;
  const isCloudProvider = provider !== "ollama";
  const hasKey = Boolean(apiKey.trim());
  const isDark = theme === "dark";
  const activeSkillsCount = skills.filter((s) => s.enabled).length;
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
      className={`flex h-screen overflow-hidden select-none font-sans transition-colors duration-200 relative ${
        isDark ? "theme-dark bg-[#212121] text-[#ececec]" : "theme-light bg-[#ffffff] text-[#1c1c1a]"
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md border-2 border-dashed border-rose-500 text-white animate-fade-in pointer-events-none">
          <FileUp size={48} className="text-rose-500 animate-bounce mb-3" />
          <h3 className="text-xl font-bold">Drop files or pictures here</h3>
          <p className="text-xs text-rose-300 mt-1">Images, documents, code files, and datasets supported</p>
        </div>
      )}

      {/* Settings Modal */}
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
      />

      {/* Skills Modal (Opened from Sidebar) */}
      <SkillsModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        skills={skills}
        setSkills={setSkills}
        theme={theme}
      />

      {/* Kokoro TTS Studio Modal (Voice Selection, Voice Blending & Model Verification) */}
      <KokoroVoiceModal
        isOpen={isKokoroModalOpen}
        onClose={() => setIsKokoroModalOpen(false)}
        theme={theme}
        socket={socketRef.current}
        activeVoiceId={activeVoiceId}
        setActiveVoiceId={setActiveVoiceId}
        speechSpeed={speechSpeed}
        setSpeechSpeed={setSpeechSpeed}
      />

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside
        className={`${
          isSidebarOpen ? "w-[260px]" : "w-0"
        } transition-all duration-200 ease-in-out border-r flex flex-col z-30 overflow-hidden shrink-0 ${
          isDark ? "bg-[#171717] border-[#282828]" : "bg-[#f9f9f8] border-[#e6e6e0]"
        }`}
      >
        {/* Brand Header */}
        <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm overflow-hidden select-none p-1 transition ${
                isDark ? "bg-[#222222] border-[#333333]" : "bg-[#ffffff] border-[#d8d8d0]"
              }`}
            >
              <img
                src={currentLogo}
                alt="Songbird Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                Songbird{" "}
                <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-[var(--sb-text-secondary)]">
                {activeProviderConfig.name}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className={`p-1 rounded-md transition ${
              isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#e8e8e2]"
            }`}
            title="Close sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-2">
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition shadow-sm group ${
              isDark
                ? "bg-[#212121] hover:bg-[#2b2b2b] border-[#333333] text-white"
                : "bg-[#ffffff] hover:bg-[#f3f3f0] border-[#d8d8d0] text-[#1c1c1a]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Plus size={15} className={isDark ? "text-[#a0a0a0] group-hover:text-white" : "text-[#70706a] group-hover:text-black"} />
              <span>New chat</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                isDark ? "text-[#888888] bg-[#171717] border-[#2b2b2b]" : "text-[#777770] bg-[#f4f4f0] border-[#e0e0d8]"
              }`}
            >
              Ctrl K
            </span>
          </button>
        </div>

        {/* Mode Toggle (Chat vs Autonomous Agent) */}
        <div className="px-3 py-1">
          <div
            className={`flex rounded-xl p-1 border text-xs transition ${
              isDark ? "bg-[#222222] border-[#333333]" : "bg-[#efefe9] border-[#deded6]"
            }`}
          >
            <button
              onClick={() => setIsAgentMode(false)}
              className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                !isAgentMode
                  ? isDark
                    ? "bg-[#2f2f2f] text-white shadow-sm"
                    : "bg-[#ffffff] text-[#1c1c1a] shadow-sm"
                  : "text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)]"
              }`}
            >
              <span>Chat</span>
            </button>
            <button
              onClick={() => setIsAgentMode(true)}
              className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                isAgentMode
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)]"
              }`}
            >
              <Bot size={13} />
              <span>Agent</span>
            </button>
          </div>
        </div>

        {/* Skills Library Button in Sidebar */}
        <div className="px-3 py-1">
          <button
            onClick={() => setIsSkillsOpen(true)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition ${
              isDark
                ? "bg-[#222222] hover:bg-[#282828] border-[#333333] text-[#dcdcdc]"
                : "bg-[#ffffff] hover:bg-[#f4f4f0] border-[#d8d8d0] text-[#333330]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-rose-500" />
              <span>Skills Library</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-500 font-mono font-semibold">
              {activeSkillsCount} Active
            </span>
          </button>
        </div>

        {/* Search Chats Input */}
        <div className="px-3 py-1">
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
              isDark ? "bg-[#212121] border-[#2d2d2d] text-[#888888]" : "bg-[#ffffff] border-[#d8d8d0] text-[#70706a]"
            }`}
          >
            <Search size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className={`w-full bg-transparent text-xs placeholder-[#888888] focus:outline-none ${
                isDark ? "text-[#dcdcdc]" : "text-[#1c1c1a]"
              }`}
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
              className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                sess.id === activeSessionId
                  ? isDark
                    ? "bg-[#2b2b2b] text-white font-medium shadow-sm"
                    : "bg-[#ebebe5] text-[#1c1c1a] font-medium shadow-sm"
                  : isDark
                  ? "hover:bg-[#212121] hover:text-[#e0e0e0]"
                  : "hover:bg-[#f2f2ee] hover:text-[#1c1c1a]"
              }`}
            >
              <span className="truncate flex-1">{sess.title || "New Chat"}</span>
              <button
                onClick={(e) => handleDeleteSession(sess.id, e)}
                className="opacity-0 group-hover:opacity-100 text-[var(--sb-text-muted)] hover:text-rose-500 p-0.5 transition"
                title="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* User Profile & Footer Toolbar */}
        <div
          className={`p-3 border-t flex items-center justify-between text-xs transition ${
            isDark ? "bg-[#141414] border-[#282828]" : "bg-[#f4f4f2] border-[#e6e6e0]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold ${
                isDark ? "bg-[#2a2a2a] border-[#383838] text-white" : "bg-[#ffffff] border-[#d4d4cc] text-[#1c1c1a]"
              }`}
            >
              <User size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium">{isAgentMode ? "Hermes Agent" : "Songbird"}</span>
              <span className="text-[10px] text-[var(--sb-text-muted)]">{activeProviderConfig.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick 1-Click Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg transition ${
                isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#eaeae4]"
              }`}
              title={`Switch to ${isDark ? "Light" : "Dark"} Theme`}
            >
              {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-1.5 rounded-lg transition ${
                isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#eaeae4]"
              }`}
              title="Configure API Provider & Keys"
            >
              <Sliders size={15} />
            </button>
            <button
              onClick={handleExportMarkdown}
              className={`p-1.5 rounded-lg transition ${
                isDark ? "text-[#888888] hover:text-white hover:bg-[#262626]" : "text-[#777777] hover:text-black hover:bg-[#eaeae4]"
              }`}
              title="Export Conversation"
            >
              <Download size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[var(--sb-bg-canvas)]">
        {/* Top Navbar */}
        <header
          className={`h-13 px-4 flex items-center justify-between border-b z-20 select-none relative transition ${
            isDark ? "border-[#2b2b2b]/50" : "border-[#e6e6e0]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-1.5 rounded-lg transition ${
                  isDark ? "text-[#888888] hover:text-white hover:bg-[#2a2a2a]" : "text-[#777777] hover:text-black hover:bg-[#ecece6]"
                }`}
                title="Open Sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}

            {/* Provider & Model Switcher Pill */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition shadow-sm ${
                isDark
                  ? "bg-[#2a2a2a] hover:bg-[#333333] border-[#3a3a3a] text-[#e0e0e0]"
                  : "bg-[#f4f4f0] hover:bg-[#ebebe5] border-[#d8d8d0] text-[#1c1c1a]"
              }`}
            >
              <img
                src={currentLogo}
                alt="Songbird"
                className="w-4 h-4 object-contain"
              />
              <span className="font-semibold">{activeProviderConfig.name}:</span>
              <span className="text-[var(--sb-text-secondary)] max-w-[140px] truncate">{selectedModel}</span>
              <Sliders size={12} className="text-[var(--sb-text-muted)] ml-0.5" />
            </button>

            {/* Agent Mode Indicator Pill */}
            <button
              onClick={() => setIsAgentMode(!isAgentMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                isAgentMode
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-500 shadow-sm"
                  : isDark
                  ? "bg-[#262626] border-[#383838] text-[#888888] hover:text-white"
                  : "bg-[#f4f4f0] border-[#d8d8d0] text-[#70706a] hover:text-black"
              }`}
            >
              <Bot size={13} className={isAgentMode ? "text-rose-500 animate-pulse" : ""} />
              <span>{isAgentMode ? "Hermes Agent" : "Chat Mode"}</span>
            </button>

            {/* Realtime Voice Agent Activation Button (Moonshine Tiny + LLM + Kokoro TTS) */}
            <button
              onClick={toggleVoiceAgent}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                isVoiceAgentActive
                  ? isUserSpeaking
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md animate-voice-hearing"
                    : voiceAgentStatus === "speaking"
                    ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-md animate-voice-rose-ripple"
                    : "bg-rose-500/15 border-rose-500/70 text-rose-500 shadow-md animate-voice-glow"
                  : isDark
                  ? "bg-[#262626] border-[#383838] text-[#888888] hover:text-white hover:border-[#555555]"
                  : "bg-[#f4f4f0] border-[#d8d8d0] text-[#70706a] hover:text-black hover:border-[#b5b5ad]"
              }`}
              title={
                isVoiceAgentActive
                  ? isUserSpeaking
                    ? `Hearing your voice! (Volume: ${micVolume}%) - Moonshine Tiny active`
                    : `Voice Agent Active (${voiceAgentStatus}) - Click to turn OFF`
                  : "Turn ON Realtime Voice Agent (Moonshine Tiny STT + LLM API + Kokoro TTS)"
              }
            >
              {isVoiceAgentActive ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 h-3.5 px-0.5">
                    <span
                      className={`w-0.5 rounded-full transition-all ${isUserSpeaking ? "bg-emerald-400" : "bg-rose-500 voice-wave-bar-1"}`}
                      style={isUserSpeaking ? { height: `${Math.max(4, Math.min(18, micVolume * 0.25))}px` } : undefined}
                    />
                    <span
                      className={`w-0.5 rounded-full transition-all ${isUserSpeaking ? "bg-emerald-400" : "bg-rose-500 voice-wave-bar-2"}`}
                      style={isUserSpeaking ? { height: `${Math.max(6, Math.min(18, micVolume * 0.35))}px` } : undefined}
                    />
                    <span
                      className={`w-0.5 rounded-full transition-all ${isUserSpeaking ? "bg-emerald-400" : "bg-rose-500 voice-wave-bar-3"}`}
                      style={isUserSpeaking ? { height: `${Math.max(8, Math.min(18, micVolume * 0.3))}px` } : undefined}
                    />
                    <span
                      className={`w-0.5 rounded-full transition-all ${isUserSpeaking ? "bg-emerald-400" : "bg-rose-500 voice-wave-bar-4"}`}
                      style={isUserSpeaking ? { height: `${Math.max(4, Math.min(18, micVolume * 0.2))}px` } : undefined}
                    />
                  </div>
                  <span className={`font-semibold ${isUserSpeaking ? "text-emerald-400" : "text-rose-500"}`}>
                    {isUserSpeaking
                      ? `Hearing You (${micVolume}%)`
                      : voiceAgentStatus === "speaking"
                      ? "Speaking..."
                      : voiceAgentStatus === "processing"
                      ? "Thinking..."
                      : "Listening..."}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Mic size={13} className="text-[var(--sb-text-muted)]" />
                  <span>Voice Agent</span>
                </div>
              )}
            </button>

            {/* Kokoro TTS Voice Studio & Diagnostic Verification Button */}
            <button
              onClick={() => setIsKokoroModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                isDark
                  ? "bg-[#262626] hover:bg-[#303030] border-[#383838] hover:border-amber-500/50 text-[#dcdcd0] hover:text-amber-400"
                  : "bg-[#f4f4f0] hover:bg-[#eaeae4] border-[#d8d8d0] hover:border-amber-500/50 text-[#60605a] hover:text-black"
              }`}
              title="Open Kokoro TTS Studio (Voice Selection, Voice Blending & Model Verification)"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Kokoro Studio</span>
            </button>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-2.5 text-xs">
            {/* Quick Theme Switcher Button in Header */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
                isDark
                  ? "bg-[#1b1b1b] border-[#303030] text-amber-400 hover:bg-[#252525]"
                  : "bg-[#f4f4f0] border-[#dcdcd4] text-indigo-600 hover:bg-[#ebebe4]"
              }`}
              title={`Switch to ${isDark ? "Light" : "Dark"} Theme`}
            >
              {isDark ? <Sun size={12} /> : <Moon size={12} />}
              <span>{isDark ? "Dark" : "Light"}</span>
            </button>

            {/* API Key Status Pill */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition ${
                isCloudProvider
                  ? hasKey
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300 animate-pulse"
                  : isDark
                  ? "bg-[#1b1b1b] border-[#303030] text-[#999999]"
                  : "bg-[#f4f4f0] border-[#d8d8d0] text-[#777770]"
              }`}
            >
              <Key size={11} />
              <span>{isCloudProvider ? (hasKey ? "Key Connected" : "Key Missing") : "Local Offline"}</span>
            </button>

            {/* WS Engine Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${
                isDark ? "bg-[#1b1b1b] border-[#303030] text-[#999999]" : "bg-[#f4f4f0] border-[#d8d8d0] text-[#777770]"
              }`}
            >
              <Radio size={11} className={isEngineConnected ? "text-emerald-500 animate-pulse" : "text-rose-500"} />
              <span>WS :18789</span>
            </div>
          </div>

          {/* ==================== TOP GLOBAL PROGRESS BAR (AGENT MODE ONLY) ==================== */}
          {isAgentMode && isStreaming && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-rose-500/15 overflow-hidden z-30">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-emerald-400 transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${agentProgress ? Math.max(5, Math.min(agentProgress.percent, 100)) : 100}%` }}
              />
            </div>
          )}
        </header>

        {/* ==================== CENTER CHAT FEED (SCROLLABLE AREA ONLY) ==================== */}
        <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center">
          {!hasMessages ? (
            /* ==================== EMPTY STATE ==================== */
            <div className="w-full max-w-3xl my-auto flex flex-col items-center justify-center space-y-6 pt-2 animate-fade-in">
              <div
                className={`w-24 h-24 rounded-3xl border flex items-center justify-center p-3 shadow-2xl animate-songbird select-none ${
                  isDark
                    ? "bg-[#1c1c1c] border-[#333333] shadow-rose-950/40"
                    : "bg-[#ffffff] border-[#e2e2dc] shadow-rose-500/10"
                }`}
              >
                <img
                  src={currentLogo}
                  alt="Songbird Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-center space-y-1.5">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center justify-center gap-2">
                  <span>Songbird</span>
                  {isAgentMode && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-500">
                      Hermes Agent Active
                    </span>
                  )}
                </h1>
                <p className="text-sm text-[var(--sb-text-secondary)]">
                  {isAgentMode
                    ? "Autonomous agent active with Python execution, shell commands, file & picture tools."
                    : "Conversational intelligence powered by " + activeProviderConfig.name}
                </p>
              </div>

              {/* Prompt Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                {(isAgentMode
                  ? [
                      {
                        icon: <Code2 size={16} className="text-emerald-500" />,
                        title: "Execute Python Script",
                        desc: "Write a script that benchmarks prime factor calculation & print runtime",
                        prompt: "Write and execute a Python script to calculate the first 10,000 prime numbers and benchmark execution time.",
                      },
                      {
                        icon: <FileCode size={16} className="text-cyan-500" />,
                        title: "Analyze & Write Files",
                        desc: "Inspect the project structure and create a report.json file",
                        prompt: "List the directory structure and write a summary of this project into a new file called 'project_summary.md'.",
                      },
                      {
                        icon: <Terminal size={16} className="text-amber-500" />,
                        title: "Run Terminal Diagnostic",
                        desc: "Run system probe and print active OS environment parameters",
                        prompt: "Run a system diagnostic command to inspect available memory, disk space, and Python environment.",
                      },
                      {
                        icon: <Globe size={16} className="text-rose-500" />,
                        title: "Web Research & Synthesize",
                        desc: "Search for current AI agent benchmarks and summarize takeaways",
                        prompt: "Search the web for the latest autonomous agent architectures and summarize the core paradigms.",
                      },
                    ]
                  : [
                      {
                        icon: <Zap size={16} className="text-rose-500" />,
                        title: "Architecture Planning",
                        desc: "Design a high-concurrency event stream system with Rust and React",
                        prompt: "Design a high-concurrency event streaming architecture with Rust and React.",
                      },
                      {
                        icon: <Code2 size={16} className="text-emerald-500" />,
                        title: "Python Algorithm",
                        desc: "Write an async task scheduler with retry & exponential backoff",
                        prompt: "Write a high-performance Python async task scheduler with exponential backoff and jitter.",
                      },
                      {
                        icon: <Sparkles size={16} className="text-amber-500" />,
                        title: "Deep Reasoning",
                        desc: "Explain how autonomous agents evaluate and refine trajectories",
                        prompt: "Explain how autonomous self-improving agents evaluate and refine execution trajectories.",
                      },
                      {
                        icon: <BookOpen size={16} className="text-cyan-500" />,
                        title: "Code Refactoring",
                        desc: "Analyze and suggest optimizations for modern TypeScript interfaces",
                        prompt: "Analyze and suggest optimizations for modern TypeScript state management and type safety.",
                      },
                    ]
                ).map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(card.prompt)}
                    className={`p-4 rounded-2xl border text-left transition group shadow-sm flex flex-col justify-between min-h-[90px] ${
                      isDark
                        ? "bg-[#2a2a2a] hover:bg-[#323232] border-[#383838] hover:border-[#4f4f4f]"
                        : "bg-[#ffffff] hover:bg-[#f5f5f1] border-[#e2e2dc] hover:border-[#c8c8be]"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-xs text-[var(--sb-text-primary)]">
                      {card.icon}
                      <span>{card.title}</span>
                    </div>
                    <div className="text-xs text-[var(--sb-text-secondary)] mt-1.5 leading-snug">
                      {card.desc}
                    </div>
                  </button>
                ))}
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
                        className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 select-none shadow-sm mt-0.5 p-1 overflow-hidden ${
                          isDark ? "bg-[#1c1c1c] border-[#333333]" : "bg-[#ffffff] border-[#dcdcd4]"
                        }`}
                      >
                        <img
                          src={currentLogo}
                          alt="Songbird"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] text-[15px] leading-relaxed select-text ${
                        isUser
                          ? isDark
                            ? "bg-[#2f2f2f] text-white rounded-3xl px-5 py-3.5 border border-[#3d3d3d] shadow-sm"
                            : "bg-[#f2f1ee] text-[#1c1c1a] rounded-3xl px-5 py-3.5 border border-[#e2e2dc] shadow-sm"
                          : "text-[var(--sb-text-primary)] flex-1 pt-0.5"
                      }`}
                    >
                      {/* Attachments Display in Message Bubble */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <AttachmentList files={msg.attachments} />
                      )}

                      {/* Thought Accordion */}
                      {!isUser && msg.thought && (
                        <ThoughtAccordion
                          thought={msg.thought}
                          isThinking={isStreaming && idx === activeSession.messages.length - 1 && !msg.text}
                        />
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
                            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-mono font-medium text-rose-500">
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
                        />
                      )}

                      {/* Assistant Action Toolbar */}
                      {!isUser && (
                        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--sb-text-muted)] select-none pt-1">
                          <span className="font-mono text-[11px]">{msg.model || selectedModel}</span>
                          <span>•</span>
                          <button
                            onClick={() => handleCopyMessage(msg)}
                            className="flex items-center gap-1 hover:text-[var(--sb-text-primary)] transition"
                            title="Copy message"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            <span>{isCopied ? "Copied" : "Copy"}</span>
                          </button>

                          <button
                            onClick={() => handleToggleSpeech(msg)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition text-xs font-medium border ${
                              isSpeaking
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
                                <Loader2 size={13} className="animate-spin text-amber-500" />
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
                              className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase tracking-wider ${
                                isSpeaking
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
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 select-none mt-0.5 border ${
                          isDark ? "bg-[#383838] border-[#444444] text-[#dcdcdc]" : "bg-[#e8e8e2] border-[#d0d0c8] text-[#555550]"
                        }`}
                      >
                        <User size={15} />
                      </div>
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

            {/* Realtime Voice Agent Live Status Bar with Live Hearing Indicator & Understood Preview */}
            {isVoiceAgentActive && (
              <div
                className={`mb-2 px-4 py-3 rounded-2xl border flex flex-col gap-2 shadow-xl animate-fade-in transition-all ${
                  isDark
                    ? isUserSpeaking
                      ? "bg-[#182a20] border-emerald-500/70 shadow-emerald-950/30"
                      : "bg-[#252525] border-rose-900/50 text-rose-300"
                    : isUserSpeaking
                    ? "bg-emerald-50 border-emerald-400 shadow-emerald-500/10"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Live 12-bar audio spectrum visualizer */}
                    <div className="flex items-center gap-0.5 h-4 px-1 shrink-0">
                      {[0.8, 1.2, 0.6, 1.4, 1.0, 0.7, 1.3, 0.9, 1.5, 0.5, 1.1, 0.8].map((mult, barIdx) => {
                        const barHeight = isUserSpeaking
                          ? Math.max(3, Math.min(18, Math.round(micVolume * mult * 0.22)))
                          : voiceAgentStatus === "speaking"
                          ? (barIdx % 2 === 0 ? 12 : 5)
                          : 3;
                        return (
                          <span
                            key={barIdx}
                            className={`w-0.5 rounded-full transition-all duration-75 ${
                              isUserSpeaking
                                ? "bg-emerald-400"
                                : voiceAgentStatus === "speaking"
                                ? "bg-rose-500"
                                : isDark
                                ? "bg-[#555555]"
                                : "bg-[#c0c0b8]"
                            }`}
                            style={{ height: `${barHeight}px` }}
                          />
                        );
                      })}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold tracking-wide">Realtime Voice Agent</span>
                        {isUserSpeaking ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 font-mono text-[10px] font-bold uppercase animate-voice-hearing flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Hearing You ({micVolume}%)
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium uppercase ${
                              voiceAgentStatus === "speaking"
                                ? "bg-rose-500/20 text-rose-500 border border-rose-500/40"
                                : "bg-neutral-500/20 text-neutral-400"
                            }`}
                          >
                            {voiceAgentStatus === "speaking" ? "Speaking Response" : voiceAgentStatus === "processing" ? "Processing" : "Listening"}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] opacity-80 truncate mt-0.5">
                        {isUserSpeaking
                          ? "Microphone detecting your voice in real time... (Moonshine Tiny STT active)"
                          : voiceStageInfo || "Speak naturally — Moonshine Tiny STT & Kokoro TTS are ready."}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isRecordingTurn ? (
                      <button
                        onClick={stopTurnRecording}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                        title="Finish speaking and process turn"
                      >
                        <Square size={10} className="fill-current" />
                        <span>Finish Speaking</span>
                      </button>
                    ) : (
                      <button
                        onClick={startTurnRecording}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 text-xs font-semibold border border-rose-500/40 transition cursor-pointer"
                        title="Start recording voice turn"
                      >
                        <Mic size={12} />
                        <span>Speak Now</span>
                      </button>
                    )}

                    <button
                      onClick={() => setIsKokoroModalOpen(true)}
                      className="p-1.5 rounded-lg text-xs opacity-75 hover:opacity-100 hover:text-amber-400 transition cursor-pointer"
                      title="Kokoro Voice Settings & Blending"
                    >
                      <Sparkles size={14} />
                    </button>

                    <button
                      onClick={toggleVoiceAgent}
                      className="p-1.5 rounded-lg text-xs opacity-60 hover:opacity-100 hover:text-rose-500 transition cursor-pointer"
                      title="Turn OFF Voice Agent"
                    >
                      <MicOff size={14} />
                    </button>
                  </div>
                </div>

                {/* Understood Speech Preview Chip */}
                {lastUnderstoodText && (
                  <div
                    className={`mt-1 px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-sans transition animate-fade-in ${
                      isDark ? "bg-[#1f1f1f] border-emerald-800/40 text-emerald-300" : "bg-white border-emerald-300 text-emerald-800 shadow-sm"
                    }`}
                  >
                    <Check size={13} className="text-emerald-400 shrink-0" />
                    <span className="text-[11px] font-semibold shrink-0 text-emerald-400 uppercase font-mono">Understood:</span>
                    <span className="truncate italic">"{lastUnderstoodText}"</span>
                  </div>
                )}
              </div>
            )}

            <div
              className={`rounded-3xl p-3.5 flex flex-col gap-2.5 shadow-xl border transition relative ${
                isDark
                  ? isAgentMode
                    ? "bg-[#2f2f2f] border-rose-900/60 focus-within:border-rose-500 shadow-rose-950/20"
                    : "bg-[#2f2f2f] border-[#3c3c3c] focus-within:border-[#555555]"
                  : isAgentMode
                  ? "bg-[#ffffff] border-rose-400 focus-within:border-rose-500 shadow-rose-500/10"
                  : "bg-[#ffffff] border-[#dcdcd6] focus-within:border-[#a0a098] shadow-sm"
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
                  isAgentMode
                    ? "Assign an autonomous task to Hermes Agent (with files & pictures)..."
                    : `Message ${selectedModel}...`
                }
                className={`w-full bg-transparent text-sm md:text-[15px] placeholder-[#888888] px-2 py-1 focus:outline-none resize-none max-h-48 min-h-[38px] leading-relaxed ${
                  isDark ? "text-[#f0f0f0]" : "text-[#1c1c1a]"
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition shadow-sm ${
                      isAttachMenuOpen || draftAttachments.length > 0
                        ? "bg-rose-500/20 text-rose-500 border-rose-500/50"
                        : isDark
                        ? "bg-[#282828] hover:bg-[#333333] border-[#383838] text-[#dcdcdc]"
                        : "bg-[#f4f4f0] hover:bg-[#ebebe4] border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                    title="Attach Photos or Files"
                  >
                    <Plus size={15} className={`transition duration-200 ${isAttachMenuOpen ? "rotate-45 text-rose-500" : ""}`} />
                    <span>Attach</span>
                    {draftAttachments.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono">
                        {draftAttachments.length}
                      </span>
                    )}
                  </button>

                  {/* Attachment Popover Action Dropdown Menu */}
                  {isAttachMenuOpen && (
                    <div
                      className={`absolute bottom-full left-0 mb-2 w-60 rounded-2xl border shadow-2xl overflow-hidden p-1.5 z-50 animate-fade-in transition font-sans ${
                        isDark
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
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition group ${
                          isDark ? "hover:bg-[#2a2a2a]" : "hover:bg-[#f3f3ee]"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
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
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition group ${
                          isDark ? "hover:bg-[#2a2a2a]" : "hover:bg-[#f3f3ee]"
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
                    </div>
                  )}

                  {/* Agent Mode Toggle */}
                  <button
                    onClick={() => setIsAgentMode(!isAgentMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      isAgentMode
                        ? "bg-rose-600 text-white shadow-sm"
                        : isDark
                        ? "bg-[#282828] hover:bg-[#333333] border-[#383838] text-[#888888] hover:text-white"
                        : "bg-[#f4f4f0] hover:bg-[#ebebe4] border-[#d8d8d0] text-[#70706a] hover:text-black"
                    }`}
                    title="Toggle Autonomous Agent Mode"
                  >
                    <Bot size={14} />
                    <span>Agent Mode</span>
                  </button>

                  {/* Realtime Voice Agent Quick Toggle */}
                  <button
                    onClick={toggleVoiceAgent}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                      isVoiceAgentActive
                        ? "bg-rose-500/20 border-rose-500/60 text-rose-500 shadow-sm animate-voice-glow"
                        : isDark
                        ? "bg-[#282828] hover:bg-[#333333] border-[#383838] text-[#888888] hover:text-white"
                        : "bg-[#f4f4f0] hover:bg-[#ebebe4] border-[#d8d8d0] text-[#70706a] hover:text-black"
                    }`}
                    title="Toggle Realtime Voice Agent (Moonshine Tiny STT + LLM API + Kokoro TTS)"
                  >
                    {isVoiceAgentActive ? (
                      <>
                        <AudioLines size={14} className="text-rose-500" />
                        <span>Voice ON</span>
                      </>
                    ) : (
                      <>
                        <Mic size={14} />
                        <span>Voice Agent</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right Send or Stop Button */}
                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <button
                      onClick={handleStopGeneration}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition shadow"
                    >
                      <Square size={12} className="fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() && draftAttachments.length === 0}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-md ${
                        input.trim() || draftAttachments.length > 0
                          ? isAgentMode
                            ? "bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                            : isDark
                            ? "bg-white text-black hover:bg-[#e6e6e6] cursor-pointer"
                            : "bg-black text-white hover:bg-[#222222] cursor-pointer"
                          : isDark
                          ? "bg-[#3f3f3f] text-[#777777] cursor-not-allowed"
                          : "bg-[#e5e5de] text-[#a0a098] cursor-not-allowed"
                      }`}
                      title={isAgentMode ? "Run Agent Task" : "Send Message"}
                    >
                      <ArrowUp size={16} strokeWidth={2.5} />
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
  );
}