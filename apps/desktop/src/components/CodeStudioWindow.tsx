import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Code2,
  Sparkles,
  Bot,
  ArrowUp,
  Square,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Loader2,
  Paperclip,
  Monitor,
  Mic,
  AudioLines,
  Plus,
  RotateCcw,
  Sun,
  Moon,
  Columns,
  PanelRightClose,
  PanelRight,
  FileCode,
  Terminal,
  Zap,
  BookOpen,
} from "lucide-react";
import { memoryEngine, type ChatMessage, type ChatSession, type ToolExecution, type AttachedFile } from "@orca/memory-engine";
import { localTTS } from "@orca/local-tts";
import { CodeEditorPanel } from "./CodeEditorPanel";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { AgentToolCard } from "./AgentToolCard";
import { AttachmentList } from "./FileAttachmentPreview";
import { type AIProvider, PROVIDER_CONFIGS } from "./SettingsModal";
import { getEditorBroadcastChannel, type ExternalOpenFilePayload } from "../utils/windowManager";

interface CodeStudioWindowProps {
  initialTheme?: "dark" | "light";
  onReturnToMain?: () => void;
}

export const CodeStudioWindow: React.FC<CodeStudioWindowProps> = ({
  initialTheme = "dark",
  onReturnToMain,
}) => {
  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("songbird_theme") as "dark" | "light") || initialTheme;
  });
  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("songbird_theme", theme);
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme, isDark]);

  // AI Settings State (shared with main window via localStorage)
  const [provider] = useState<AIProvider>(() => {
    return (localStorage.getItem("orca_provider") as AIProvider) || "openrouter";
  });
  const [apiKey] = useState<string>(() => {
    return localStorage.getItem("orca_api_key") || "";
  });
  const [baseUrl] = useState<string>(() => {
    return localStorage.getItem("orca_base_url") || PROVIDER_CONFIGS.openrouter.defaultBaseUrl;
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("orca_model") || PROVIDER_CONFIGS.openrouter.models[0].id;
  });
  const [isAgentMode, setIsAgentMode] = useState<boolean>(() => {
    return localStorage.getItem("songbird_agent_mode") === "true";
  });
  const [temperature] = useState<number>(() => {
    const saved = localStorage.getItem("songbird_temperature");
    return saved !== null ? parseFloat(saved) : 0.4;
  });
  const [systemPrompt] = useState<string>(() => {
    return (
      localStorage.getItem("songbird_system_prompt") ||
      "You are Songbird, an advanced AI agent specialized in deep reasoning, software architecture, and coding. Structure your answers with clean markdown, headings, and syntax-highlighted code blocks.\n\n" +
      "CRITICAL RULES:\n" +
      "1. NO EMOJIS: Do NOT use any emojis or emoticons in your responses under any circumstances.\n" +
      "2. MATH IN LATEX: Always write mathematical expressions using standard LaTeX notation ($...$ for inline, $$...$$ for display)."
    );
  });
  const [activeVoiceId] = useState<string>(() => {
    return localStorage.getItem("songbird_active_voice_id") || "af_heart";
  });
  const [speechSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("songbird_speech_speed");
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [autoTTS] = useState<boolean>(() => {
    return localStorage.getItem("songbird_auto_tts") === "true";
  });

  // Sessions and Messages State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<AttachedFile[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isSynthesizingSpeech, setIsSynthesizingSpeech] = useState(false);

  // Split Layout & Resizing
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = localStorage.getItem("songbird_studio_split_ratio");
    return saved ? parseFloat(saved) : 0.58;
  });
  const [isChatVisible, setIsChatVisible] = useState<boolean>(true);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Editor external file opener state
  const [externalOpenFile, setExternalOpenFile] = useState<ExternalOpenFilePayload | null>(null);

  // Daemon WebSocket State
  const [isEngineConnected, setIsEngineConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);

  // Streaming buffers
  const typingQueueRef = useRef("");
  const typingThoughtQueueRef = useRef("");
  const typewriterTimerRef = useRef<number | null>(null);
  const streamDoneReceivedRef = useRef(false);

  // Media references
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readAloudAudioRef = useRef<HTMLAudioElement | null>(null);
  const readAloudActiveMsgIdRef = useRef<string | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);

  // Voice Agent State
  const [isVoiceAgentActive, setIsVoiceAgentActive] = useState(false);
  const [voiceAgentStatus, setVoiceAgentStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const isVoiceAgentActiveRef = useRef(false);
  const isAudioPlayingRef = useRef(false);
  const isRecordingTurnRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // -------------------------------------------------------------
  // 1. Initialize Sessions from memoryEngine
  // -------------------------------------------------------------
  useEffect(() => {
    const loadedSessions = memoryEngine.getSessions();
    if (loadedSessions.length > 0) {
      setSessions(loadedSessions);
      const activeId = memoryEngine.getActiveSessionId() || loadedSessions[0].id;
      setActiveSessionId(activeId);
    } else {
      const newSess = memoryEngine.createNewSession("Code Studio Chat", selectedModel);
      setSessions([newSess]);
      setActiveSessionId(newSess.id);
    }
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // -------------------------------------------------------------
  // 2. Check for pending external file open from localStorage or BroadcastChannel
  // -------------------------------------------------------------
  useEffect(() => {
    // Check localStorage pending file on mount
    try {
      const pending = localStorage.getItem("songbird_editor_pending_file");
      if (pending) {
        localStorage.removeItem("songbird_editor_pending_file");
        const parsed = JSON.parse(pending);
        if (parsed?.path) {
          setExternalOpenFile(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to read pending file:", e);
    }

    // Listen to broadcast events
    const channel = getEditorBroadcastChannel();
    const handleBroadcast = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "open_file" && data.file) {
        setExternalOpenFile(data.file);
      } else if (data?.type === "theme_change" && data.theme) {
        setTheme(data.theme);
      } else if (data?.type === "send_to_chat" && data.prompt) {
        handleSend(data.prompt);
      }
    };

    if (channel) {
      channel.addEventListener("message", handleBroadcast);
    }

    return () => {
      if (channel) {
        channel.removeEventListener("message", handleBroadcast);
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 3. Connect to Hermes Agent Daemon WebSocket (ws://127.0.0.1:18789)
  // -------------------------------------------------------------
  useEffect(() => {
    let reconnectTimeout: any;

    const connect = () => {
      try {
        const ws = new WebSocket("ws://127.0.0.1:18789");
        socketRef.current = ws;

        ws.onopen = () => {
          setIsEngineConnected(true);
          // Heartbeat ping every 10s
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: "ping" }));
            }
          }, 10000);
        };

        ws.onclose = () => {
          setIsEngineConnected(false);
          setIsStreaming(false);
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setIsEngineConnected(false);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "stream") {
              enqueueStreamToken(data.token, false);
            } else if (data.type === "thought") {
              enqueueStreamToken(data.token, true);
            } else if (data.type === "tool_start") {
              handleToolStart(data.tool_id, data.tool, data.input);
            } else if (data.type === "tool_result") {
              handleToolResult(data.tool_id, data.tool, data.output, data.status, data.image_b64);
            } else if (data.type === "editor_agent_sync") {
              setExternalOpenFile({
                path: data.file_path,
                content: data.content,
                language: data.language,
              });
            } else if (data.type === "done") {
              handleStreamDone();
            } else if (data.type === "voice_llm_token") {
              enqueueStreamToken(data.token, false);
            } else if (data.type === "voice_done") {
              handleStreamDone();
            } else if (data.type === "stt_result") {
              if (data.text) {
                setInput((prev) => (prev ? prev + " " + data.text : data.text));
              }
            } else if (data.type === "kokoro_synthesize_result") {
              setIsSynthesizingSpeech(false);
              if (data.audio_b64) {
                playAudioB64(data.audio_b64, data.mime_type || "audio/wav", data.msg_id);
              }
            } else if (data.type === "kokoro_synthesize_error") {
              setIsSynthesizingSpeech(false);
              setSpeakingMsgId(null);
            }
          } catch (e) {
            // Ignore non-json
          }
        };
      } catch (err) {
        setIsEngineConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  // -------------------------------------------------------------
  // 4. Typewriter Streaming Logic
  // -------------------------------------------------------------
  const enqueueStreamToken = (token: string, isThought = false) => {
    if (isThought) {
      typingThoughtQueueRef.current += token;
    } else {
      typingQueueRef.current += token;
    }
    if (typewriterTimerRef.current === null) {
      processTypewriterQueue();
    }
  };

  const processTypewriterQueue = () => {
    if (!typingQueueRef.current && !typingThoughtQueueRef.current) {
      typewriterTimerRef.current = null;
      if (streamDoneReceivedRef.current) {
        finalizeStreamingMessage();
      }
      return;
    }

    const thoughtTake = Math.min(typingThoughtQueueRef.current.length, 12);
    const chunkThought = typingThoughtQueueRef.current.slice(0, thoughtTake);
    typingThoughtQueueRef.current = typingThoughtQueueRef.current.slice(thoughtTake);

    const textTake = Math.min(typingQueueRef.current.length, 14);
    const chunkText = typingQueueRef.current.slice(0, textTake);
    typingQueueRef.current = typingQueueRef.current.slice(textTake);

    setSessions((prev) => {
      return prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const msgs = [...s.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.sender === "hermes") {
          msgs[msgs.length - 1] = {
            ...lastMsg,
            text: (lastMsg.text || "") + chunkText,
            thought: (lastMsg.thought || "") + chunkThought,
          };
          return { ...s, messages: msgs, updatedAt: Date.now() };
        } else {
          msgs.push({
            id: "msg_" + Date.now(),
            sender: "hermes",
            text: chunkText,
            thought: chunkThought,
            timestamp: Date.now(),
            model: selectedModel,
          });
          return { ...s, messages: msgs, updatedAt: Date.now() };
        }
      });
    });

    typewriterTimerRef.current = requestAnimationFrame(processTypewriterQueue);
  };

  const handleStreamDone = () => {
    streamDoneReceivedRef.current = true;
    if (!typingQueueRef.current && !typingThoughtQueueRef.current) {
      finalizeStreamingMessage();
    }
  };

  const finalizeStreamingMessage = () => {
    setIsStreaming(false);
    streamDoneReceivedRef.current = false;
    if (typewriterTimerRef.current !== null) {
      cancelAnimationFrame(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    // Persist session
    setSessions((prev) => {
      const cur = prev.find((s) => s.id === activeSessionId);
      if (cur) {
        memoryEngine.saveSession(cur);
      }
      return prev;
    });

    // Auto-scroll
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // -------------------------------------------------------------
  // 5. Tool Call Handlers
  // -------------------------------------------------------------
  const handleToolStart = (toolId: string, tool: string, inputData: any) => {
    setSessions((prev) => {
      return prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const msgs = [...s.messages];
        const lastMsg = msgs[msgs.length - 1];
        const exec: ToolExecution = {
          id: toolId,
          tool,
          input: inputData,
          status: "running",
          timestamp: Date.now(),
        };

        if (lastMsg && lastMsg.sender === "hermes") {
          const tools = lastMsg.toolExecutions ? [...lastMsg.toolExecutions, exec] : [exec];
          msgs[msgs.length - 1] = { ...lastMsg, toolExecutions: tools };
        } else {
          msgs.push({
            id: "msg_" + Date.now(),
            sender: "hermes",
            text: "",
            toolExecutions: [exec],
            timestamp: Date.now(),
            model: selectedModel,
          });
        }
        return { ...s, messages: msgs, updatedAt: Date.now() };
      });
    });
  };

  const handleToolResult = (
    toolId: string,
    _tool: string,
    output: string,
    status: "success" | "error",
    imageB64?: string
  ) => {
    setSessions((prev) => {
      return prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const msgs = [...s.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.toolExecutions) {
          const updated = lastMsg.toolExecutions.map((t) =>
            t.id === toolId ? { ...t, output, status, image_b64: imageB64 } : t
          );
          msgs[msgs.length - 1] = { ...lastMsg, toolExecutions: updated };
        }
        return { ...s, messages: msgs, updatedAt: Date.now() };
      });
    });
  };

  // -------------------------------------------------------------
  // 6. Send Message Action
  // -------------------------------------------------------------
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

    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      sender: "user",
      text: prompt || (draftAttachments.length > 0 ? `Shared ${draftAttachments.length} file(s)` : ""),
      attachments: draftAttachments.length > 0 ? [...draftAttachments] : undefined,
      timestamp: Date.now(),
    };

    const currentMsgs = activeSession ? [...activeSession.messages, userMsg] : [userMsg];
    const sessionTitle =
      activeSession?.messages.length === 0
        ? (prompt || draftAttachments[0]?.name || "Code Studio Chat").slice(0, 32)
        : activeSession?.title || "Code Studio Chat";

    const updatedSession: ChatSession = {
      ...(activeSession || {
        id: "sess_" + Date.now(),
        createdAt: Date.now(),
      }),
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
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === updatedSession.id);
      if (exists) {
        return prev.map((s) => (s.id === updatedSession.id ? updatedSession : s));
      }
      return [updatedSession, ...prev];
    });

    setInput("");
    setDraftAttachments([]);
    setIsStreaming(true);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: "chat",
          agent_mode: isAgentMode,
          provider,
          api_key: apiKey,
          base_url: baseUrl,
          model: selectedModel,
          skills: [],
          enabled_tools: ["run_code", "read_file", "write_file", "list_dir", "web_search"],
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
          "[Notice] Hermes Engine is offline (`ws://localhost:18789`). Please verify the engine is running.",
          false
        );
        handleStreamDone();
      }, 500);
    }

    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleStopGeneration = () => {
    if (!isStreaming) return;
    setIsStreaming(false);
    typingQueueRef.current = "";
    typingThoughtQueueRef.current = "";
    if (typewriterTimerRef.current !== null) {
      cancelAnimationFrame(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // 7. New Chat / Reset
  // -------------------------------------------------------------
  const handleNewChat = () => {
    const newSess = memoryEngine.createNewSession("New Studio Chat", selectedModel);
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
    setInput("");
    setDraftAttachments([]);
    setIsStreaming(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // -------------------------------------------------------------
  // 8. Copy & Speech Utilities
  // -------------------------------------------------------------
  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleToggleSpeech = (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      if (readAloudAudioRef.current) {
        readAloudAudioRef.current.pause();
        readAloudAudioRef.current = null;
      }
      localTTS.stop();
      setSpeakingMsgId(null);
      readAloudActiveMsgIdRef.current = null;
      return;
    }

    if (readAloudAudioRef.current) {
      readAloudAudioRef.current.pause();
      readAloudAudioRef.current = null;
    }
    localTTS.stop();

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setIsSynthesizingSpeech(true);
      setSpeakingMsgId(msg.id);
      readAloudActiveMsgIdRef.current = msg.id;

      socketRef.current.send(
        JSON.stringify({
          action: "kokoro_synthesize",
          text: msg.text.slice(0, 1500),
          voice: activeVoiceId,
          speed: speechSpeed,
          msg_id: msg.id,
        })
      );
    } else {
      localTTS.speak(msg.text, {
        onStart: () => setSpeakingMsgId(msg.id),
        onEnd: () => setSpeakingMsgId(null),
        onError: () => setSpeakingMsgId(null),
      });
    }
  };

  const playAudioB64 = (b64: string, mime: string, msgId?: string) => {
    const audio = new Audio(`data:${mime};base64,${b64}`);
    readAloudAudioRef.current = audio;
    if (msgId) setSpeakingMsgId(msgId);

    audio.onended = () => {
      readAloudAudioRef.current = null;
      readAloudActiveMsgIdRef.current = null;
      setSpeakingMsgId(null);
    };

    audio.onerror = () => {
      readAloudAudioRef.current = null;
      readAloudActiveMsgIdRef.current = null;
      setSpeakingMsgId(null);
    };

    audio.play().catch(() => {
      readAloudAudioRef.current = null;
      readAloudActiveMsgIdRef.current = null;
      setSpeakingMsgId(null);
    });
  };

  // -------------------------------------------------------------
  // 9. Screen Capture Snapshot
  // -------------------------------------------------------------
  const handleCaptureScreen = async () => {
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
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        const newAttachment: AttachedFile = {
          id: "snap_" + Date.now(),
          name: `screen_snapshot_${Date.now()}.png`,
          size: Math.round(dataUrl.length * 0.75),
          type: "image/png",
          dataUrl,
        };
        setDraftAttachments((prev) => [...prev, newAttachment]);
      }
      track.stop();
    } catch (e) {
      console.warn("Screen capture cancelled or error:", e);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  // -------------------------------------------------------------
  // 10. File Upload Handling
  // -------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isText =
        file.type.startsWith("text/") ||
        file.name.endsWith(".py") ||
        file.name.endsWith(".ts") ||
        file.name.endsWith(".tsx") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".json") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".html") ||
        file.name.endsWith(".css");

      if (isText) {
        const text = await file.text();
        const attached: AttachedFile = {
          id: "file_" + Date.now() + "_" + i,
          name: file.name,
          size: file.size,
          type: file.type || "text/plain",
          textContent: text,
        };
        setDraftAttachments((prev) => [...prev, attached]);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const attached: AttachedFile = {
            id: "file_" + Date.now() + "_" + i,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            dataUrl,
          };
          setDraftAttachments((prev) => [...prev, attached]);
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = "";
  };

  // -------------------------------------------------------------
  // 11. Resizable Split Divider Logic
  // -------------------------------------------------------------
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newRatio = (moveEvent.clientX - rect.left) / rect.width;
      const clamped = Math.max(0.25, Math.min(0.78, newRatio));
      setSplitRatio(clamped);
      localStorage.setItem("songbird_studio_split_ratio", String(clamped));
    };

    const onMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const hasMessages = activeSession && activeSession.messages.length > 0;

  return (
    <div className={`w-full h-screen flex flex-col select-none overflow-hidden ${isDark ? "bg-[#161616] text-[#e6e6e6]" : "bg-[#f5f5f1] text-[#1c1c1a]"}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ==================== TOP IDE TITLEBAR / HEADER ==================== */}
      <header className={`h-11 border-b flex items-center justify-between px-3 shrink-0 select-none z-20 ${
        isDark ? "bg-[#181818] border-[#292929]" : "bg-[#ffffff] border-[#e0e0d8]"
      }`}>
        {/* Left Branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-[var(--sb-text-primary)] font-bold text-xs shadow-sm">
              <Code2 size={14} />
            </div>
            <span className="font-semibold text-xs tracking-wide">Songbird Code Studio</span>
          </div>

          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[var(--sb-text-secondary)] font-mono font-medium">
            Standalone IDE
          </span>

          <div className="h-4 w-[1px] bg-[var(--sb-border)] mx-1" />

          {/* Engine WebSocket Status indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--sb-text-secondary)]">
            <span className={`w-2 h-2 rounded-full ${isEngineConnected ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-500 animate-pulse"}`} />
            <span className="hidden sm:inline font-mono text-[10px]">
              {isEngineConnected ? "ws://127.0.0.1:18789" : "Engine connecting..."}
            </span>
          </div>
        </div>

        {/* Center: Model Indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg-secondary)] text-xs text-[var(--sb-text-secondary)]">
          <Bot size={13} className="text-[var(--sb-text-primary)]" />
          <span className="font-mono text-[11px] truncate max-w-[200px]">{selectedModel}</span>
          {isAgentMode && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-[var(--sb-text-secondary)] font-semibold uppercase tracking-wider">
              Agent Mode
            </span>
          )}
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Reset Split 50/50 Button */}
          <button
            onClick={() => {
              setSplitRatio(0.58);
              localStorage.setItem("songbird_studio_split_ratio", "0.58");
            }}
            className="p-1.5 rounded-lg border border-[var(--sb-border)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition text-xs"
            title="Reset Split View Ratio (58% / 42%)"
          >
            <Columns size={13} />
          </button>

          {/* Toggle Chatbox Column */}
          <button
            onClick={() => setIsChatVisible(!isChatVisible)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              isChatVisible
                ? "bg-white/10 border-white/20 text-[var(--sb-text-primary)]"
                : "border-[var(--sb-border)] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover-bg)]"
            }`}
            title={isChatVisible ? "Hide Chatbox" : "Show Chatbox"}
          >
            {isChatVisible ? <PanelRightClose size={13} /> : <PanelRight size={13} />}
            <span className="hidden sm:inline text-[11px]">{isChatVisible ? "Chatbox ON" : "Show Chat"}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-1.5 rounded-lg border border-[var(--sb-border)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition"
            title="Toggle Dark / Light Theme"
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {onReturnToMain && (
            <button
              onClick={onReturnToMain}
              className="p-1.5 rounded-lg border border-transparent text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-white/5 transition"
              title="Close window or return"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      {/* ==================== WORKSPACE RESIZABLE SPLIT CONTAINER ==================== */}
      <div ref={splitContainerRef} className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* ==================== LEFT PANE: MONACO CODE STUDIO ==================== */}
        <div
          style={{ width: isChatVisible ? `${splitRatio * 100}%` : "100%" }}
          className="h-full flex flex-col overflow-hidden min-w-[320px] transition-[width] duration-75"
        >
          <CodeEditorPanel
            theme={theme}
            isOpen={true}
            ws={socketRef.current}
            onSendToChat={(prompt) => {
              // Expand chatbox if closed
              if (!isChatVisible) setIsChatVisible(true);
              // Send directly or stage in textarea
              handleSend(prompt);
              setTimeout(() => textareaRef.current?.focus(), 150);
            }}
            externalOpenFile={externalOpenFile}
            onExternalFileOpened={() => setExternalOpenFile(null)}
          />
        </div>

        {/* ==================== DRAGGABLE SPLITTER DIVIDER ==================== */}
        {isChatVisible && (
          <div
            onMouseDown={handleSplitterMouseDown}
            onDoubleClick={() => {
              setSplitRatio(0.58);
              localStorage.setItem("songbird_studio_split_ratio", "0.58");
            }}
            className={`w-1.5 hover:w-2 -mx-0.5 relative z-30 cursor-col-resize select-none transition-colors flex items-center justify-center group ${
              isDraggingSplitter
                ? "bg-white"
                : isDark
                ? "bg-[#252525] hover:bg-white/30"
                : "bg-[#e2e2dc] hover:bg-black/20"
            }`}
            title="Drag to resize Editor vs Chatbox (Double-click to reset)"
          >
            <div className="w-0.5 h-6 rounded-full bg-stone-500/40 group-hover:bg-white" />
          </div>
        )}

        {/* ==================== RIGHT PANE: SAME SONGBIRD CHATBOX ==================== */}
        {isChatVisible && (
          <div
            style={{ width: `${(1 - splitRatio) * 100}%` }}
            className={`h-full flex flex-col overflow-hidden min-w-[340px] border-l ${
              isDark ? "bg-[#181818] border-[#292929]" : "bg-[#ffffff] border-[#e0e0d8]"
            }`}
          >
            {/* Chatbox Sub-Header */}
            <div className={`h-9 px-3 border-b flex items-center justify-between shrink-0 select-none text-xs ${
              isDark ? "bg-[#1b1b1b] border-[#272727] text-[#cccccc]" : "bg-[#fafaf7] border-[#e8e8e0] text-[#333330]"
            }`}>
              <div className="flex items-center gap-2 truncate">
                <Sparkles size={13} className="text-[var(--sb-text-primary)] shrink-0" />
                <span className="font-medium truncate">{activeSession?.title || "AI Copilot"}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Agent Mode Toggle Button */}
                <button
                  onClick={() => {
                    const next = !isAgentMode;
                    setIsAgentMode(next);
                    localStorage.setItem("songbird_agent_mode", String(next));
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                    isAgentMode
                      ? "bg-white/10 border-white/20 text-[var(--sb-text-primary)]"
                      : "border-[var(--sb-border)] text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)]"
                  }`}
                  title={isAgentMode ? "Autonomous Agent with tools active" : "Standard Chat mode"}
                >
                  <Bot size={11} />
                  <span>{isAgentMode ? "Agent" : "Chat"}</span>
                </button>

                {/* New Chat Button */}
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[var(--sb-border)] text-[11px] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition"
                  title="Start a new chat conversation"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <main className="flex-1 overflow-y-auto px-4 py-4 space-y-5 select-text">
              {!hasMessages ? (
                /* Empty State with Coding Prompts */
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 space-y-5 animate-fade-in select-none">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-[var(--sb-text-primary)] shadow-md ${
                    isDark ? "bg-[#222222] border-[#333333]" : "bg-[#ffffff] border-[#deded6]"
                  }`}>
                    <Code2 size={28} />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold">Songbird Code Copilot</h3>
                    <p className="text-xs text-[var(--sb-text-secondary)] mt-1 max-w-xs leading-relaxed">
                      Ask Songbird to explain, refactor, debug, or write tests for your code.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 w-full max-w-sm text-left text-xs">
                    {[
                      {
                        icon: <Sparkles size={13} className="text-amber-500" />,
                        title: "Review & Optimize Active Code",
                        prompt: "Review the code currently in my active editor tab, identify performance bottlenecks or bugs, and suggest improvements.",
                      },
                      {
                        icon: <FileCode size={13} className="text-cyan-500" />,
                        title: "Generate Unit Tests",
                        prompt: "Generate comprehensive unit tests with edge cases for the function or script in the active tab.",
                      },
                      {
                        icon: <Terminal size={13} className="text-emerald-500" />,
                        title: "Debug & Explain Errors",
                        prompt: "Explain how to diagnose and resolve errors encountered during script execution in the terminal.",
                      },
                      {
                        icon: <Zap size={13} className="text-[var(--sb-text-primary)]" />,
                        title: "Refactor to Async / Clean Architecture",
                        prompt: "Refactor this script into modular, modern asynchronous code with clean typing and error handling.",
                      },
                    ].map((card, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(card.prompt)}
                        className={`p-2.5 rounded-xl border text-left transition shadow-xs flex items-start gap-2.5 ${
                          isDark
                            ? "bg-[#212121] hover:bg-[#282828] border-[#333333]"
                            : "bg-[#ffffff] hover:bg-[#f7f7f3] border-[#e2e2dc]"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">{card.icon}</div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-[12px] block text-[var(--sb-text-primary)]">{card.title}</span>
                          <span className="text-[11px] text-[var(--sb-text-muted)] line-clamp-1">{card.prompt}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Conversation Message List */
                activeSession.messages.map((msg, idx) => {
                  const isUser = msg.sender === "user";
                  const isSpeaking = speakingMsgId === msg.id;
                  const isCopied = copiedMsgId === msg.id;

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
                    >
                      {!isUser && (
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 shadow-sm mt-0.5 text-[var(--sb-text-primary)] font-bold text-xs select-none ${
                          isDark ? "bg-[#222222] border-[#333333]" : "bg-[#ffffff] border-[#deded6]"
                        }`}>
                          <Bot size={14} />
                        </div>
                      )}

                      <div className={`max-w-[88%] text-[13.5px] leading-relaxed ${
                        isUser
                          ? isDark
                            ? "bg-[#2c2c2c] text-white rounded-2xl px-3.5 py-2.5 border border-[#3b3b3b] shadow-sm"
                            : "bg-[#ecebe6] text-[#1c1c1a] rounded-2xl px-3.5 py-2.5 border border-[#dfdfd7] shadow-sm"
                          : "text-[var(--sb-text-primary)] flex-1 pt-0.5 min-w-0"
                      }`}>
                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <AttachmentList files={msg.attachments} />
                        )}

                        {!isUser &&
                          isStreaming &&
                          idx === activeSession.messages.length - 1 &&
                          !msg.text &&
                          (!msg.toolExecutions || msg.toolExecutions.length === 0) && (
                            <div className="flex items-center gap-1.5 py-1.5 px-1 text-[var(--sb-text-muted)] animate-fade-in">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:200ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:400ms]" />
                            </div>
                          )}

                        {/* Hermes Agent tool executions */}
                        {!isUser &&
                          msg.toolExecutions &&
                          msg.toolExecutions.map((tool) => (
                            <AgentToolCard key={tool.id} execution={tool} />
                          ))}

                        {/* Text message */}
                        {isUser ? (
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <MarkdownRenderer
                            content={msg.text}
                            isStreaming={isStreaming && idx === activeSession.messages.length - 1}
                            onOpenInEditor={(code, language) => {
                              const ext =
                                language === "python"
                                  ? "py"
                                  : language === "javascript"
                                  ? "js"
                                  : language === "typescript"
                                  ? "ts"
                                  : language === "rust"
                                  ? "rs"
                                  : language === "cpp"
                                  ? "cpp"
                                  : "txt";
                              setExternalOpenFile({
                                path: `snippets/snippet_${Date.now()}.${ext}`,
                                content: code,
                                language,
                              });
                            }}
                          />
                        )}

                        {/* Actions Toolbar */}
                        {!isUser && (
                          <div className="mt-2 flex items-center gap-2.5 text-[11px] text-[var(--sb-text-muted)] select-none pt-1">
                            <span className="font-mono text-[10px]">{msg.model || selectedModel}</span>
                            <span>•</span>
                            <button
                              onClick={() => handleCopyMessage(msg)}
                              className="flex items-center gap-1 hover:text-[var(--sb-text-primary)] transition"
                              title="Copy message"
                            >
                              {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              <span>{isCopied ? "Copied" : "Copy"}</span>
                            </button>

                            <button
                              onClick={() => handleToggleSpeech(msg)}
                              className="flex items-center gap-1 hover:text-[var(--sb-text-primary)] transition"
                              title="Read Aloud with Kokoro TTS"
                            >
                              {isSpeaking ? (
                                isSynthesizingSpeech ? (
                                  <Loader2 size={12} className="animate-spin text-amber-500" />
                                ) : (
                                  <VolumeX size={12} className="text-amber-500" />
                                )
                              ) : (
                                <Volume2 size={12} className="text-amber-500/80 hover:text-amber-400" />
                              )}
                              <span>{isSpeaking ? "Stop" : "Speak"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </main>

            {/* Chatbox Input Footer */}
            <footer className={`border-t p-3 shrink-0 select-none ${
              isDark ? "bg-[#181818] border-[#292929]" : "bg-[#ffffff] border-[#e0e0d8]"
            }`}>
              {/* Draft Attachments Preview */}
              {draftAttachments.length > 0 && (
                <div className="mb-2">
                  <AttachmentList
                    files={draftAttachments}
                    onRemove={(id) => setDraftAttachments((prev) => prev.filter((a) => a.id !== id))}
                  />
                </div>
              )}

              <div className={`rounded-2xl border transition-all shadow-sm ${
                isDark ? "bg-[#212121] border-[#363636] focus-within:border-white/40" : "bg-[#f9f9f5] border-[#d8d8d0] focus-within:border-black/30"
              }`}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Songbird about your code, debug, or write features... (Enter to send)"
                  rows={2}
                  className="w-full bg-transparent px-3.5 py-2.5 text-xs md:text-sm outline-hidden resize-none leading-relaxed text-[var(--sb-text-primary)] placeholder-[var(--sb-text-muted)]"
                />

                <div className="flex items-center justify-between px-2.5 pb-2 pt-1 border-t border-[var(--sb-border)]">
                  <div className="flex items-center gap-1.5">
                    {/* Attach File Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded-lg text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition"
                      title="Upload file or script"
                    >
                      <Paperclip size={14} />
                    </button>

                    {/* Screen Snapshot Button */}
                    <button
                      type="button"
                      onClick={handleCaptureScreen}
                      disabled={isCapturingScreen}
                      className="p-1.5 rounded-lg text-[var(--sb-text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                      title="Capture Screen for multimodal visual analysis"
                    >
                      <Monitor size={14} />
                    </button>

                    {/* Agent Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isAgentMode;
                        setIsAgentMode(next);
                        localStorage.setItem("songbird_agent_mode", String(next));
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition ${
                        isAgentMode
                          ? "bg-white/10 border-white/20 text-[var(--sb-text-primary)]"
                          : "border-transparent text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)]"
                      }`}
                      title="Toggle Autonomous Tool Execution Agent"
                    >
                      <Bot size={12} />
                      <span className="hidden sm:inline">Agent</span>
                    </button>
                  </div>

                  {/* Send or Stop Generation Button */}
                  <div className="flex items-center gap-1.5">
                    {isStreaming ? (
                      <button
                        onClick={handleStopGeneration}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition shadow-sm border border-white/20"
                      >
                        <Square size={11} className="fill-current" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() && draftAttachments.length === 0}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-xs ${
                          input.trim() || draftAttachments.length > 0
                            ? "bg-white text-black hover:bg-zinc-200 cursor-pointer"
                            : isDark
                            ? "bg-[#333333] text-[#777777] cursor-not-allowed"
                            : "bg-[#e2e2dc] text-[#999990] cursor-not-allowed"
                        }`}
                        title="Send Message"
                      >
                        <ArrowUp size={14} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-[var(--sb-text-muted)] mt-1.5">
                Songbird Studio Agent can run local commands & tools with your permission.
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
};
