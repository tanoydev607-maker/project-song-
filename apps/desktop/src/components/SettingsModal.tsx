import React, { useState, useMemo, useRef, useEffect } from "react";
import defaultToolsCatalog from "./all_tools_catalog.json";

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

export type SettingsTab = "general" | "skills" | "tools" | "mcp" | "voice";

import type { AgentSkill } from "./SkillsModal";
import type { HermesTool, ToolParameter } from "./ToolsModal";
import type { McpServerConfig } from "./McpModal";
export type { AgentSkill, HermesTool, ToolParameter, McpServerConfig };

export const DEFAULT_MCP_PRESETS: McpServerConfig[] = [
  {
    id: "mcp_filesystem",
    name: "filesystem",
    description: "Local workspace filesystem access for reading, writing, and directory inspection",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    enabled: true,
    isPreset: true,
    status: "connected",
    toolCount: 5,
  },
  {
    id: "mcp_fetch",
    name: "fetch",
    description: "Web scraper and markdown extractor for web pages and documentation",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    enabled: true,
    isPreset: true,
    status: "connected",
    toolCount: 2,
  },
  {
    id: "mcp_github",
    name: "github",
    description: "GitHub repository integration for repositories, issues, and pull requests",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    enabled: false,
    isPreset: true,
    status: "standby",
    toolCount: 12,
  },
  {
    id: "mcp_sqlite",
    name: "sqlite",
    description: "Inspect relational SQLite database tables, run queries, and parse schemas",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "./data.db"],
    enabled: false,
    isPreset: true,
    status: "standby",
    toolCount: 4,
  },
  {
    id: "mcp_brave_search",
    name: "brave-search",
    description: "Web and news search via Brave Search API for live ground-truth citations",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: "" },
    enabled: false,
    isPreset: true,
    status: "standby",
    toolCount: 2,
  },
  {
    id: "mcp_memory",
    name: "memory",
    description: "Persistent knowledge graph memory server for entities and relationships",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    enabled: false,
    isPreset: true,
    status: "standby",
    toolCount: 5,
  },
  {
    id: "mcp_puppeteer",
    name: "puppeteer",
    description: "Headless Chrome browser automation, DOM evaluation, and page screenshots",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    enabled: false,
    isPreset: true,
    status: "standby",
    toolCount: 6,
  }
];

export const TOOL_CATEGORIES = [
  "All Tools",
  "OS & Computer Use",
  "Terminal & Processes",
  "File System & Documents",
  "Code Execution",
  "Browser Automation",
  "Web & Search",
  "Vision & Media",
  "Memory & Planning",
  "Voice & Audio",
  "Integrations & Messaging",
  "Custom Tools",
] as const;

export const KOKORO_VOICE_PRESETS = [
  { id: "af_heart", name: "Heart", description: "Warm and expressive American female" },
  { id: "af_bella", name: "Bella", description: "Clear and fluent American female narrator" },
  { id: "af_nicole", name: "Nicole", description: "Soft and calm American female" },
  { id: "af_sarah", name: "Sarah", description: "Confident and articulate American female" },
  { id: "am_michael", name: "Michael", description: "Natural conversational American male" },
  { id: "am_adam", name: "Adam", description: "Deep and steady American male" },
  { id: "bf_emma", name: "Emma", description: "Crisp and formal British female" },
  { id: "bm_george", name: "George", description: "Distinguished British male narrator" },
];

export interface SettingsModalProps {
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

  // Capability Props
  skills?: AgentSkill[];
  setSkills?: React.Dispatch<React.SetStateAction<AgentSkill[]>>;
  tools?: HermesTool[];
  setTools?: React.Dispatch<React.SetStateAction<HermesTool[]>>;
  mcpServers?: McpServerConfig[];
  setMcpServers?: React.Dispatch<React.SetStateAction<McpServerConfig[]>>;
  isMcpEnabled?: boolean;
  setIsMcpEnabled?: (b: boolean) => void;
  ws?: WebSocket | null;
  activeVoiceId?: string;
  setActiveVoiceId?: (id: string) => void;
  speechSpeed?: number;
  setSpeechSpeed?: (s: number) => void;
  initialTab?: SettingsTab;
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
  skills = [],
  setSkills,
  tools = defaultToolsCatalog as HermesTool[],
  setTools,
  mcpServers = DEFAULT_MCP_PRESETS,
  setMcpServers,
  isMcpEnabled = true,
  setIsMcpEnabled,
  ws,
  activeVoiceId = "af_bella",
  setActiveVoiceId,
  speechSpeed = 1.0,
  setSpeechSpeed,
  initialTab = "general",
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const isDark = theme === "dark";

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // General Settings State
  const [showKey, setShowKey] = useState(false);
  const [customModelInput, setCustomModelInput] = useState(false);

  // Skills State
  const [skillsSearch, setSkillsSearch] = useState("");
  const [skillsCategory, setSkillsCategory] = useState<string>("All");
  const [isSkillFormOpen, setIsSkillFormOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillFormName, setSkillFormName] = useState("");
  const [skillFormDesc, setSkillFormDesc] = useState("");
  const [skillFormCategory, setSkillFormCategory] = useState<AgentSkill["category"]>("Custom");
  const [skillFormInstructions, setSkillFormInstructions] = useState("");

  // Tools State
  const [toolsSearch, setToolsSearch] = useState("");
  const [toolsCategory, setToolsCategory] = useState<string>("All Tools");
  const [toolsFilterMode, setToolsFilterMode] = useState<"all" | "active">("all");
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());
  const [copiedToolId, setCopiedToolId] = useState<string | null>(null);
  const [isCustomToolOpen, setIsCustomToolOpen] = useState(false);
  const [customToolName, setCustomToolName] = useState("");
  const [customToolDesc, setCustomToolDesc] = useState("");
  const [customToolExec, setCustomToolExec] = useState<"shell" | "python" | "prompt">("shell");
  const [customToolCommand, setCustomToolCommand] = useState("");

  // MCP State
  const [mcpSubView, setMcpSubView] = useState<"configured" | "presets" | "custom">("configured");
  const [mcpSyncNotice, setMcpSyncNotice] = useState<string | null>(null);
  const [customMcpName, setCustomMcpName] = useState("");
  const [customMcpDesc, setCustomMcpDesc] = useState("");
  const [customMcpTransport, setCustomMcpTransport] = useState<"stdio" | "sse">("stdio");
  const [customMcpCommand, setCustomMcpCommand] = useState("npx");
  const [customMcpArgs, setCustomMcpArgs] = useState("");

  // Voice State
  const [testPhrase, setTestPhrase] = useState("Kokoro neural speech synthesizer is active and configured.");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openrouter;

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

  // Skills handlers
  const handleToggleSkill = (id: string) => {
    if (!setSkills) return;
    setSkills((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      localStorage.setItem("songbird_skills_v1", JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteSkill = (id: string) => {
    if (!setSkills) return;
    setSkills((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem("songbird_skills_v1", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setSkills || !skillFormName.trim() || !skillFormInstructions.trim()) return;

    if (editingSkillId) {
      setSkills((prev) => {
        const updated = prev.map((s) =>
          s.id === editingSkillId
            ? {
                ...s,
                name: skillFormName.trim(),
                description: skillFormDesc.trim(),
                category: skillFormCategory,
                instructions: skillFormInstructions.trim(),
              }
            : s
        );
        localStorage.setItem("songbird_skills_v1", JSON.stringify(updated));
        return updated;
      });
    } else {
      const newSkill: AgentSkill = {
        id: `custom_skill_${Date.now()}`,
        name: skillFormName.trim(),
        description: skillFormDesc.trim() || "Custom user skill",
        category: skillFormCategory,
        icon: "Custom",
        instructions: skillFormInstructions.trim(),
        enabled: true,
        isCustom: true,
      };
      setSkills((prev) => {
        const updated = [...prev, newSkill];
        localStorage.setItem("songbird_skills_v1", JSON.stringify(updated));
        return updated;
      });
    }
    setIsSkillFormOpen(false);
    setEditingSkillId(null);
  };

  // Tools handlers
  const handleToggleTool = (toolId: string) => {
    if (!setTools) return;
    setTools((prev) => {
      const updated = prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t));
      localStorage.setItem("songbird_tools_config_v1", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleExpandTool = (toolId: string) => {
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  const handleCopyToolSchema = (tool: HermesTool) => {
    const sampleArgs: Record<string, any> = {};
    tool.parameters.forEach((p) => {
      sampleArgs[p.name] = p.type === "number" ? 1 : p.type === "boolean" ? true : `<${p.name}>`;
    });
    const sampleCall = `<tool_call>\n${JSON.stringify({ name: tool.name, arguments: sampleArgs }, null, 2)}\n</tool_call>`;
    navigator.clipboard.writeText(sampleCall);
    setCopiedToolId(tool.id);
    setTimeout(() => setCopiedToolId(null), 2000);
  };

  const handleSaveCustomTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setTools || !customToolName.trim()) return;
    const newTool: HermesTool = {
      id: `custom_tool_${Date.now()}`,
      name: customToolName.trim().toLowerCase().replace(/\s+/g, "_"),
      label: customToolName.trim(),
      category: "Custom Tools",
      toolset: "custom",
      description: customToolDesc.trim() || "User defined custom tool",
      parameters: [],
      enabled: true,
      available: true,
      isCustom: true,
      executionType: customToolExec,
      commandTemplate: customToolCommand.trim(),
    };
    setTools((prev) => {
      const updated = [...prev, newTool];
      localStorage.setItem("songbird_tools_config_v1", JSON.stringify(updated));
      return updated;
    });
    setIsCustomToolOpen(false);
    setCustomToolName("");
    setCustomToolDesc("");
    setCustomToolCommand("");
  };

  // MCP handlers
  const handleToggleMcpServer = (id: string) => {
    if (!setMcpServers) return;
    setMcpServers((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteMcpServer = (id: string) => {
    if (!setMcpServers) return;
    setMcpServers((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
  };

  const handleInstallMcpPreset = (preset: McpServerConfig) => {
    if (!setMcpServers) return;
    if (mcpServers.some((s) => s.id === preset.id || s.name === preset.name)) {
      setMcpSyncNotice(`Server ${preset.name} is already installed`);
      setTimeout(() => setMcpSyncNotice(null), 3000);
      return;
    }
    setMcpServers((prev) => {
      const updated: McpServerConfig[] = [...prev, { ...preset, enabled: true, status: "connected" as const }];
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
    setMcpSyncNotice(`Installed ${preset.name}`);
    setTimeout(() => setMcpSyncNotice(null), 3000);
  };

  const handleSyncMcpWithEngine = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: "sync_mcp_servers",
          enabled: isMcpEnabled,
          servers: mcpServers.filter((s) => s.enabled),
        })
      );
      setMcpSyncNotice("Synchronized active MCP servers with daemon engine");
    } else {
      setMcpSyncNotice("Local daemon on port 18789 is offline; configuration saved locally");
    }
    setTimeout(() => setMcpSyncNotice(null), 3500);
  };

  const handleAddCustomMcpServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setMcpServers || !customMcpName.trim()) return;
    const parsedArgs = customMcpArgs.trim() ? customMcpArgs.trim().split(/\s+/) : [];
    const newServer: McpServerConfig = {
      id: `mcp_custom_${Date.now()}`,
      name: customMcpName.trim().toLowerCase().replace(/\s+/g, "-"),
      description: customMcpDesc.trim() || "Custom MCP server endpoint",
      transport: customMcpTransport,
      command: customMcpCommand.trim(),
      args: parsedArgs,
      enabled: true,
      status: "connected" as const,
      toolCount: 1,
    };
    setMcpServers((prev) => {
      const updated = [...prev, newServer];
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
    setCustomMcpName("");
    setCustomMcpDesc("");
    setCustomMcpArgs("");
    setMcpSubView("configured");
  };

  // Voice Test Handler
  const handleTestVoice = () => {
    if (isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingAudio(false);
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      setIsPlayingAudio(true);
      ws.send(
        JSON.stringify({
          action: "kokoro_synthesize",
          text: testPhrase,
          voice_config: {
            voice_id: activeVoiceId,
            speed: speechSpeed,
          },
          msg_id: `test_speech_${Date.now()}`,
        })
      );
      setTimeout(() => setIsPlayingAudio(false), 4000);
    } else {
      // Browser SpeechSynthesis fallback preview
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(testPhrase);
        u.rate = speechSpeed;
        setIsPlayingAudio(true);
        u.onend = () => setIsPlayingAudio(false);
        u.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(u);
      }
    }
  };

  // Filtered skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesCat = skillsCategory === "All" || s.category === skillsCategory;
      const matchesQuery =
        !skillsSearch ||
        s.name.toLowerCase().includes(skillsSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(skillsSearch.toLowerCase()) ||
        s.instructions.toLowerCase().includes(skillsSearch.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [skills, skillsCategory, skillsSearch]);

  // Filtered tools
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const matchesCat = toolsCategory === "All Tools" || t.category === toolsCategory;
      const matchesFilter = toolsFilterMode === "all" || t.enabled;
      const matchesQuery =
        !toolsSearch ||
        t.name.toLowerCase().includes(toolsSearch.toLowerCase()) ||
        t.label.toLowerCase().includes(toolsSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(toolsSearch.toLowerCase());
      return matchesCat && matchesFilter && matchesQuery;
    });
  }, [tools, toolsCategory, toolsFilterMode, toolsSearch]);

  const activeSkillsCount = skills.filter((s) => s.enabled).length;
  const activeToolsCount = tools.filter((t) => t.enabled).length;
  const activeMcpCount = mcpServers.filter((s) => s.enabled).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div
        className={`w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border transition orb-modal-glass ${
          isDark ? "border-white/[0.08] text-[#f1f3f5] bg-[#131416]" : "border-black/[0.08] text-[#1c1c1a] bg-[#fbfbfa]"
        }`}
      >
        {/* Header (Strictly Text Only - No Icons) */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`}>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--sb-text-primary)]">
              Settings & Capabilities
            </h2>
            <p className="text-xs text-[var(--sb-text-secondary)] mt-0.5">
              Configure inference models, agent skills, Hermes tools, MCP servers, and voice engine.
            </p>
          </div>
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition ${
              isDark
                ? "border-white/10 hover:border-white/20 hover:bg-white/[0.05] text-[#828894] hover:text-white"
                : "border-black/10 hover:border-black/20 hover:bg-black/[0.05] text-[#555] hover:text-black"
            }`}
          >
            Close
          </button>
        </div>

        {/* Navigation Tabs (Pure English Text Only) */}
        <div className={`flex items-center gap-1 px-6 py-2 border-b overflow-x-auto text-xs ${isDark ? "border-white/[0.08] bg-[#17191d]" : "border-black/[0.08] bg-[#f4f4f2]"}`}>
          <button
            onClick={() => setActiveTab("general")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "general"
                ? isDark
                  ? "bg-white text-black font-semibold shadow-sm border border-transparent"
                  : "bg-black text-white font-semibold shadow-sm border border-transparent"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
                : "text-neutral-600 hover:text-black hover:bg-black/5 border border-transparent"
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "skills"
                ? isDark
                  ? "bg-white text-black font-semibold shadow-sm border border-transparent"
                  : "bg-black text-white font-semibold shadow-sm border border-transparent"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
                : "text-neutral-600 hover:text-black hover:bg-black/5 border border-transparent"
            }`}
          >
            Skills Library ({activeSkillsCount} active)
          </button>
          <button
            onClick={() => setActiveTab("tools")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "tools"
                ? isDark
                  ? "bg-white text-black font-semibold shadow-sm border border-transparent"
                  : "bg-black text-white font-semibold shadow-sm border border-transparent"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
                : "text-neutral-600 hover:text-black hover:bg-black/5 border border-transparent"
            }`}
          >
            Hermes Tools ({activeToolsCount} active)
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "mcp"
                ? isDark
                  ? "bg-white text-black font-semibold shadow-sm border border-transparent"
                  : "bg-black text-white font-semibold shadow-sm border border-transparent"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
                : "text-neutral-600 hover:text-black hover:bg-black/5 border border-transparent"
            }`}
          >
            MCP Servers ({isMcpEnabled ? `${activeMcpCount} active` : "Off"})
          </button>
          <button
            onClick={() => setActiveTab("voice")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "voice"
                ? isDark
                  ? "bg-white text-black font-semibold shadow-sm border border-transparent"
                  : "bg-black text-white font-semibold shadow-sm border border-transparent"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
                : "text-neutral-600 hover:text-black hover:bg-black/5 border border-transparent"
            }`}
          >
            Voice & Audio
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-5">
          {/* ==================== TAB 1: GENERAL ==================== */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* App Theme */}
              <div>
                <label className="block font-medium mb-1.5 text-[var(--sb-text-secondary)]">App Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`py-2.5 px-3 rounded-xl border font-medium text-xs transition cursor-pointer ${
                      isDark
                        ? "bg-[#282828] border-white/30 text-white shadow-sm"
                        : "bg-[#f3f3ee] border-[#d8d8d0] text-[#666660] hover:bg-[#eaeae4]"
                    }`}
                  >
                    Dark Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`py-2.5 px-3 rounded-xl border font-medium text-xs transition cursor-pointer ${
                      !isDark
                        ? "bg-[#ffffff] border-black/30 text-[#1c1c1a] shadow-sm ring-1 ring-black/10"
                        : "bg-[#222222] border-[#333333] text-[#888888] hover:bg-[#2a2a2a]"
                    }`}
                  >
                    Light Theme
                  </button>
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block font-medium mb-1.5 text-[var(--sb-text-secondary)]">Inference Provider</label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-white/40 cursor-pointer transition ${
                    isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
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

              {/* API Key */}
              {provider !== "ollama" && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="font-medium text-[var(--sb-text-secondary)]">
                      {currentConfig.name} API Key
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:underline cursor-pointer"
                    >
                      {showKey ? "Hide key" : "Show key"}
                    </button>
                  </div>
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={currentConfig.placeholderKey}
                    className={`w-full border rounded-xl px-3.5 py-2.5 placeholder-[#888888] focus:outline-none focus:border-white/40 font-mono text-xs transition ${
                      isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  />
                  <div className="text-[10px] text-[var(--sb-text-muted)] mt-1">Saved securely in local browser storage</div>
                </div>
              )}

              {/* Model Selection */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-medium text-[var(--sb-text-secondary)]">Model Selection</label>
                  <button
                    type="button"
                    onClick={() => setCustomModelInput(!customModelInput)}
                    className="text-[11px] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:underline cursor-pointer"
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
                    className={`w-full border rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-white/40 transition ${
                      isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  />
                ) : (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-white/40 cursor-pointer transition ${
                      isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  >
                    {currentConfig.models.map((m) => (
                      <option key={m.id} value={m.id} className={isDark ? "bg-[#1e2024] text-white" : "bg-white text-black"}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Base URL */}
              {(provider === "custom" || provider === "openrouter") && (
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--sb-text-secondary)]">API Base URL</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1"
                    className={`w-full border rounded-xl px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-white/40 transition ${
                      isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  />
                </div>
              )}

              {/* Temperature */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-[var(--sb-text-secondary)]">Temperature</label>
                  <span className="text-[var(--sb-text-primary)] font-mono text-xs font-semibold">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-zinc-400 dark:accent-white cursor-pointer"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block font-medium mb-1.5 text-[var(--sb-text-secondary)]">System Instructions</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  placeholder="Instructions for the AI assistant..."
                  className={`w-full border rounded-xl p-3 placeholder-[#888888] focus:outline-none focus:border-white/40 text-xs font-mono resize-none leading-relaxed transition ${
                    isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                  }`}
                />
              </div>

              {/* Auto TTS Toggle */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                  isDark ? "bg-[#1e2024]/60 border-white/10" : "bg-[#f8f8f5] border-[#e2e2dc]"
                }`}
              >
                <div>
                  <div className="font-medium text-xs text-[var(--sb-text-primary)]">Auto Read Aloud (TTS)</div>
                  <div className="text-[10px] text-[var(--sb-text-secondary)]">Automatically speak assistant replies using neural Kokoro audio</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoTTS(!autoTTS)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    autoTTS
                      ? isDark
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-black text-white border-black shadow-sm"
                      : isDark
                      ? "border-white/15 text-neutral-400 hover:text-white hover:bg-white/5"
                      : "border-black/15 text-neutral-500 hover:text-black hover:bg-black/5"
                  }`}
                >
                  {autoTTS ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: SKILLS LIBRARY ==================== */}
          {activeTab === "skills" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-[var(--sb-text-primary)]">Skills Library</h3>
                  <p className="text-xs text-[var(--sb-text-secondary)]">
                    Autonomous agent capabilities and specialized domain behavioral directives.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingSkillId(null);
                    setSkillFormName("");
                    setSkillFormDesc("");
                    setSkillFormCategory("Custom");
                    setSkillFormInstructions("");
                    setIsSkillFormOpen(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-medium text-xs cursor-pointer transition shadow-sm ${
                    isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
                  }`}
                >
                  Create custom skill
                </button>
              </div>

              {/* Search & Category Pills */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={skillsSearch}
                  onChange={(e) => setSkillsSearch(e.target.value)}
                  placeholder="Search skills by name or instructions..."
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-white/40 transition ${
                    isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                  }`}
                />
                <div className="flex flex-wrap gap-1.5">
                  {["All", "Development", "Data & Analysis", "Security", "Automation", "Research", "Design", "Custom"].map(
                    (cat) => (
                      <button
                        key={cat}
                        onClick={() => setSkillsCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition ${
                          skillsCategory === cat
                            ? isDark
                              ? "bg-white text-black border-white font-semibold shadow-sm"
                              : "bg-black text-white border-black font-semibold shadow-sm"
                            : isDark
                            ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                            : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Skills Form Drawer (When open) */}
              {isSkillFormOpen && (
                <form onSubmit={handleSaveSkill} className={`p-4 rounded-2xl border space-y-3 ${isDark ? "bg-[#181a1e] border-white/20" : "bg-[#f4f4f2] border-black/20"}`}>
                  <div className="font-semibold text-xs text-[var(--sb-text-primary)]">
                    {editingSkillId ? "Edit Skill" : "Create New Custom Skill"}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Skill Name</label>
                      <input
                        type="text"
                        required
                        value={skillFormName}
                        onChange={(e) => setSkillFormName(e.target.value)}
                        placeholder="e.g. Kubernetes Expert"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Category</label>
                      <select
                        value={skillFormCategory}
                        onChange={(e) => setSkillFormCategory(e.target.value as any)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      >
                        <option value="Development">Development</option>
                        <option value="Data & Analysis">Data & Analysis</option>
                        <option value="Security">Security</option>
                        <option value="Automation">Automation</option>
                        <option value="Research">Research</option>
                        <option value="Design">Design</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Description</label>
                    <input
                      type="text"
                      value={skillFormDesc}
                      onChange={(e) => setSkillFormDesc(e.target.value)}
                      placeholder="Short summary of this persona's capabilities"
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">System Instructions</label>
                    <textarea
                      required
                      rows={3}
                      value={skillFormInstructions}
                      onChange={(e) => setSkillFormInstructions(e.target.value)}
                      placeholder="Behavioral instructions appended to the AI reasoning prompt..."
                      className={`w-full border rounded-xl p-2.5 font-mono text-xs resize-none focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSkillFormOpen(false)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                        isDark ? "border-white/10 text-neutral-300 hover:text-white" : "border-black/10 text-neutral-700 hover:text-black"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-3.5 py-1.5 rounded-xl font-medium text-xs shadow-sm cursor-pointer transition ${
                        isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
                      }`}
                    >
                      Save skill
                    </button>
                  </div>
                </form>
              )}

              {/* Skills List */}
              <div className="space-y-2">
                {filteredSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className={`p-3.5 rounded-2xl border transition ${
                      skill.enabled
                        ? isDark
                          ? "bg-[#1e2024]/70 border-white/20"
                          : "bg-white border-black/20 shadow-sm"
                        : isDark
                        ? "bg-[#16171a] border-white/[0.05] opacity-70"
                        : "bg-[#f4f4f2] border-black/[0.05] opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-[var(--sb-text-primary)]">{skill.name}</span>
                          <span className={`px-2 py-0.2 rounded-md font-mono text-[10px] border ${
                            isDark ? "bg-white/5 border-white/10 text-neutral-400" : "bg-black/5 border-black/10 text-neutral-600"
                          }`}>
                            {skill.category}
                          </span>
                          {skill.isCustom && (
                            <span className={`px-2 py-0.2 rounded-md font-mono text-[10px] border ${
                              isDark ? "bg-white/10 border-white/15 text-neutral-300" : "bg-black/10 border-black/15 text-neutral-700"
                            }`}>
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--sb-text-secondary)]">{skill.description}</p>
                        <p className={`text-[11px] font-mono p-2 rounded-lg border leading-relaxed ${
                          isDark
                            ? "bg-[#141416] text-neutral-300 border-white/[0.08]"
                            : "bg-[#f5f5f3] text-neutral-800 border-black/[0.08]"
                        }`}>
                          {skill.instructions}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {skill.isCustom && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSkillId(skill.id);
                                setSkillFormName(skill.name);
                                setSkillFormDesc(skill.description);
                                setSkillFormCategory(skill.category);
                                setSkillFormInstructions(skill.instructions);
                                setIsSkillFormOpen(true);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                                isDark
                                  ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                                  : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                              }`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSkill(skill.id)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                                isDark
                                  ? "border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                                  : "border-black/10 text-neutral-600 hover:text-red-600 hover:bg-red-500/10"
                              }`}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleSkill(skill.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            skill.enabled
                              ? isDark
                                ? "bg-white text-black border-white shadow-sm"
                                : "bg-black text-white border-black shadow-sm"
                              : isDark
                              ? "border-white/15 text-neutral-400 hover:text-white hover:bg-white/5"
                              : "border-black/15 text-neutral-500 hover:text-black hover:bg-black/5"
                          }`}
                        >
                          {skill.enabled ? "Active" : "Inactive"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: HERMES TOOLS ==================== */}
          {activeTab === "tools" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-[var(--sb-text-primary)]">Hermes Agent Tools</h3>
                  <p className="text-xs text-[var(--sb-text-secondary)]">
                    Direct tool calling execution capabilities: bash terminal, Python script runner, web research, file I/O.
                  </p>
                </div>
                <button
                  onClick={() => setIsCustomToolOpen(!isCustomToolOpen)}
                  className={`px-3 py-1.5 rounded-xl font-medium text-xs cursor-pointer transition shadow-sm ${
                    isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
                  }`}
                >
                  {isCustomToolOpen ? "Close tool builder" : "Add custom tool"}
                </button>
              </div>

              {/* Filter and Search Bar */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={toolsSearch}
                      onChange={(e) => setToolsSearch(e.target.value)}
                      placeholder="Search tools by label, description, or parameter..."
                      className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-white/40 transition ${
                        isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setToolsFilterMode("all")}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        toolsFilterMode === "all"
                          ? isDark
                            ? "bg-white text-black border-white font-semibold shadow-sm"
                            : "bg-black text-white border-black font-semibold shadow-sm"
                          : isDark
                          ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                          : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                      }`}
                    >
                      All tools
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolsFilterMode("active")}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        toolsFilterMode === "active"
                          ? isDark
                            ? "bg-white text-black border-white font-semibold shadow-sm"
                            : "bg-black text-white border-black font-semibold shadow-sm"
                          : isDark
                          ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                          : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                      }`}
                    >
                      Active only
                    </button>
                  </div>
                </div>

                {/* Category Dropdown */}
                <div>
                  <select
                    value={toolsCategory}
                    onChange={(e) => setToolsCategory(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-white/40 cursor-pointer ${
                      isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  >
                    {TOOL_CATEGORIES.map((c) => (
                      <option key={c} value={c} className={isDark ? "bg-[#1e2024] text-white" : "bg-white text-black"}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Tool Creator Form */}
              {isCustomToolOpen && (
                <form onSubmit={handleSaveCustomTool} className={`p-4 rounded-2xl border space-y-3 ${isDark ? "bg-[#181a1e] border-white/20" : "bg-[#f4f4f2] border-black/20"}`}>
                  <div className="font-semibold text-xs text-[var(--sb-text-primary)]">Add Custom Shell or Script Tool</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Tool Label</label>
                      <input
                        type="text"
                        required
                        value={customToolName}
                        onChange={(e) => setCustomToolName(e.target.value)}
                        placeholder="e.g. Git Pull Workspace"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Execution Pipeline</label>
                      <select
                        value={customToolExec}
                        onChange={(e) => setCustomToolExec(e.target.value as any)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      >
                        <option value="shell">Cross-platform Shell (Bash/PowerShell)</option>
                        <option value="python">Python Subprocess Script</option>
                        <option value="prompt">Prompt Synthesis Directive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Description</label>
                    <input
                      type="text"
                      value={customToolDesc}
                      onChange={(e) => setCustomToolDesc(e.target.value)}
                      placeholder="Explains to the AI agent when and how to call this tool"
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Command / Script</label>
                    <textarea
                      rows={2}
                      value={customToolCommand}
                      onChange={(e) => setCustomToolCommand(e.target.value)}
                      placeholder="git pull origin main"
                      className={`w-full border rounded-xl p-2 font-mono text-xs resize-none focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCustomToolOpen(false)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                        isDark ? "border-white/10 text-neutral-300 hover:text-white" : "border-black/10 text-neutral-700 hover:text-black"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-3.5 py-1.5 rounded-xl font-medium text-xs shadow-sm cursor-pointer transition ${
                        isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
                      }`}
                    >
                      Save tool
                    </button>
                  </div>
                </form>
              )}

              {/* Tools List */}
              <div className="space-y-2">
                {filteredTools.map((tool) => {
                  const isExpanded = expandedToolIds.has(tool.id);
                  return (
                    <div
                      key={tool.id}
                      className={`p-3.5 rounded-2xl border transition ${
                        tool.enabled
                          ? isDark
                            ? "bg-[#1e2024]/70 border-white/20"
                            : "bg-white border-black/20 shadow-sm"
                          : isDark
                          ? "bg-[#16171a] border-white/[0.05] opacity-70"
                          : "bg-[#f4f4f2] border-black/[0.05] opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-[var(--sb-text-primary)]">{tool.label}</span>
                            <span className="font-mono text-[11px] text-[var(--sb-text-muted)]">({tool.name})</span>
                            <span className={`px-2 py-0.2 rounded-md font-mono text-[10px] border ${
                              isDark ? "bg-white/5 border-white/10 text-neutral-400" : "bg-black/5 border-black/10 text-neutral-600"
                            }`}>
                              {tool.category}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--sb-text-secondary)]">{tool.description}</p>
                          {tool.requirementHint && (
                            <div className="text-[10px] font-mono text-amber-400/80">Requirement: {tool.requirementHint}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleExpandTool(tool.id)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                              isDark
                                ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                                : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                            }`}
                          >
                            {isExpanded ? "Hide details" : "Inspect parameters"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTool(tool.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                              tool.enabled
                                ? isDark
                                  ? "bg-white text-black border-white shadow-sm"
                                  : "bg-black text-white border-black shadow-sm"
                                : isDark
                                ? "border-white/15 text-neutral-400 hover:text-white hover:bg-white/5"
                                : "border-black/15 text-neutral-500 hover:text-black hover:bg-black/5"
                            }`}
                          >
                            {tool.enabled ? "Active" : "Disabled"}
                          </button>
                        </div>
                      </div>

                      {/* Tool Parameters Inspector */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[11px] text-[var(--sb-text-secondary)]">
                              Tool Parameters ({tool.parameters.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyToolSchema(tool)}
                              className="px-2.5 py-0.5 rounded text-[10px] border border-white/10 hover:text-white transition cursor-pointer"
                            >
                              {copiedToolId === tool.id ? "Copied call format" : "Copy call schema"}
                            </button>
                          </div>
                          {tool.parameters.length === 0 ? (
                            <div className="text-[11px] text-[var(--sb-text-muted)] font-mono">No parameters required</div>
                          ) : (
                            <div className="space-y-1">
                              {tool.parameters.map((p) => (
                                <div key={p.name} className="flex items-start gap-2 text-[11px] font-mono bg-black/20 p-2 rounded-lg">
                                  <span className="text-[var(--sb-text-primary)] font-semibold">{p.name}</span>
                                  <span className="text-zinc-400">({p.type})</span>
                                  {p.required && <span className="text-zinc-300 font-bold">[required]</span>}
                                  <span className="text-[var(--sb-text-secondary)] font-sans">{p.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB 4: MCP SERVERS ==================== */}
          {activeTab === "mcp" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-[var(--sb-text-primary)]">Model Context Protocol (MCP)</h3>
                  <p className="text-xs text-[var(--sb-text-secondary)]">
                    Local stdio & HTTP servers connecting SQLite, GitHub, Filesystem, and external tools to the agent.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncMcpWithEngine}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition ${
                      isDark
                        ? "border-white/15 text-neutral-300 hover:text-white hover:border-white/30 hover:bg-white/5"
                        : "border-black/15 text-neutral-700 hover:text-black hover:border-black/30 hover:bg-black/5"
                    }`}
                  >
                    Sync with engine
                  </button>
                  {setIsMcpEnabled && (
                    <button
                      type="button"
                      onClick={() => setIsMcpEnabled(!isMcpEnabled)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isMcpEnabled
                          ? isDark
                            ? "bg-white text-black border-white shadow-sm"
                            : "bg-black text-white border-black shadow-sm"
                          : isDark
                          ? "border-white/15 text-neutral-400 hover:text-white hover:bg-white/5"
                          : "border-black/15 text-neutral-500 hover:text-black hover:bg-black/5"
                      }`}
                    >
                      {isMcpEnabled ? "MCP Enabled" : "MCP Disabled"}
                    </button>
                  )}
                </div>
              </div>

              {mcpSyncNotice && (
                <div className={`p-2.5 rounded-xl border text-xs font-medium ${
                  isDark ? "bg-white/10 border-white/20 text-white" : "bg-black/5 border-black/15 text-black"
                }`}>
                  {mcpSyncNotice}
                </div>
              )}

              {/* Sub-Navigation */}
              <div className={`flex items-center gap-1.5 border-b pb-2 ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`}>
                <button
                  type="button"
                  onClick={() => setMcpSubView("configured")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition ${
                    mcpSubView === "configured"
                      ? isDark
                        ? "bg-white text-black border-white font-semibold shadow-sm"
                        : "bg-black text-white border-black font-semibold shadow-sm"
                      : isDark
                      ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                      : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                  }`}
                >
                  Configured servers ({mcpServers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMcpSubView("presets")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition ${
                    mcpSubView === "presets"
                      ? isDark
                        ? "bg-white text-black border-white font-semibold shadow-sm"
                        : "bg-black text-white border-black font-semibold shadow-sm"
                      : isDark
                      ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                      : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                  }`}
                >
                  Preset catalog ({DEFAULT_MCP_PRESETS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMcpSubView("custom")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition ${
                    mcpSubView === "custom"
                      ? isDark
                        ? "bg-white text-black border-white font-semibold shadow-sm"
                        : "bg-black text-white border-black font-semibold shadow-sm"
                      : isDark
                      ? "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
                      : "border-black/10 text-neutral-600 hover:text-black hover:bg-black/5"
                  }`}
                >
                  Add custom server
                </button>
              </div>

              {/* View 1: Configured Servers */}
              {mcpSubView === "configured" && (
                <div className="space-y-2">
                  {mcpServers.length === 0 ? (
                    <div className="p-6 text-center text-[var(--sb-text-muted)]">
                      No MCP servers configured. Choose a server from the Preset catalog.
                    </div>
                  ) : (
                    mcpServers.map((server) => (
                      <div
                        key={server.id}
                        className={`p-3.5 rounded-2xl border transition ${
                          server.enabled
                            ? isDark
                              ? "bg-[#1e2024]/70 border-white/20"
                              : "bg-white border-black/20 shadow-sm"
                            : isDark
                            ? "bg-[#16171a] border-white/[0.05] opacity-70"
                            : "bg-[#f4f4f2] border-black/[0.05] opacity-70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-[var(--sb-text-primary)]">{server.name}</span>
                              <span className={`px-2 py-0.2 rounded-md font-mono text-[10px] border ${
                                isDark ? "bg-white/5 border-white/10 text-neutral-400" : "bg-black/5 border-black/10 text-neutral-600"
                              }`}>
                                {server.transport.toUpperCase()}
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded-md font-mono text-[10px] ${
                                  server.status === "connected"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "bg-stone-500/15 text-[var(--sb-text-muted)] border border-stone-500/30"
                                }`}
                              >
                                {server.status === "connected" ? "Connected" : "Standby"}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--sb-text-secondary)]">{server.description}</p>
                            <div className={`text-[11px] font-mono p-2 rounded-lg border ${
                              isDark
                                ? "bg-[#141416] text-neutral-300 border-white/[0.08]"
                                : "bg-[#f0f0ee] text-neutral-800 border-black/[0.08]"
                            }`}>
                              {server.command} {server.args?.join(" ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDeleteMcpServer(server.id)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                                isDark
                                  ? "border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                                  : "border-black/10 text-neutral-600 hover:text-red-600 hover:bg-red-500/10"
                              }`}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleMcpServer(server.id)}
                              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                server.enabled
                                  ? isDark
                                    ? "bg-white text-black border-white shadow-sm"
                                    : "bg-black text-white border-black shadow-sm"
                                  : isDark
                                  ? "border-white/15 text-neutral-400 hover:text-white hover:bg-white/5"
                                  : "border-black/15 text-neutral-500 hover:text-black hover:bg-black/5"
                              }`}
                            >
                              {server.enabled ? "Active" : "Inactive"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* View 2: Preset Catalog */}
              {mcpSubView === "presets" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEFAULT_MCP_PRESETS.map((preset) => {
                    const isInstalled = mcpServers.some((s) => s.id === preset.id || s.name === preset.name);
                    return (
                      <div key={preset.id} className={`p-3.5 rounded-2xl border ${isDark ? "bg-[#181a1e] border-white/10" : "bg-white border-black/10"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-[var(--sb-text-primary)]">{preset.name}</span>
                          <span className="font-mono text-[10px] text-[var(--sb-text-muted)]">{preset.transport.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-[var(--sb-text-secondary)] mb-2">{preset.description}</p>
                        <div className="flex justify-between items-center pt-1">
                          <span className="font-mono text-[10px] text-[var(--sb-text-muted)]">
                            {preset.toolCount} tools provided
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInstallMcpPreset(preset)}
                            disabled={isInstalled}
                            className={`px-3 py-1 rounded-xl text-xs font-medium border transition cursor-pointer ${
                              isInstalled
                                ? isDark
                                  ? "bg-white/5 border-white/10 text-neutral-500 cursor-not-allowed"
                                  : "bg-black/5 border-black/10 text-neutral-500 cursor-not-allowed"
                                : isDark
                                ? "bg-white text-black hover:bg-zinc-200 border-transparent shadow-sm"
                                : "bg-black text-white hover:bg-zinc-800 border-transparent shadow-sm"
                            }`}
                          >
                            {isInstalled ? "Installed" : "Install preset"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View 3: Add Custom Server Form */}
              {mcpSubView === "custom" && (
                <form onSubmit={handleAddCustomMcpServer} className={`p-4 rounded-2xl border space-y-3 ${isDark ? "bg-[#181a1e] border-white/20" : "bg-[#f4f4f2] border-black/20"}`}>
                  <div className="font-semibold text-xs text-[var(--sb-text-primary)]">Configure Custom MCP Server</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Server Name</label>
                      <input
                        type="text"
                        required
                        value={customMcpName}
                        onChange={(e) => setCustomMcpName(e.target.value)}
                        placeholder="e.g. redis-database"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Transport</label>
                      <select
                        value={customMcpTransport}
                        onChange={(e) => setCustomMcpTransport(e.target.value as any)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      >
                        <option value="stdio">stdio (Local Subprocess)</option>
                        <option value="sse">sse (Server-Sent Events)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Description</label>
                    <input
                      type="text"
                      value={customMcpDesc}
                      onChange={(e) => setCustomMcpDesc(e.target.value)}
                      placeholder="Summary of resources and tools exposed by this server"
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Command</label>
                      <input
                        type="text"
                        required
                        value={customMcpCommand}
                        onChange={(e) => setCustomMcpCommand(e.target.value)}
                        placeholder="npx or uvx or python"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-[var(--sb-text-secondary)] mb-1">Arguments (Space-separated)</label>
                      <input
                        type="text"
                        value={customMcpArgs}
                        onChange={(e) => setCustomMcpArgs(e.target.value)}
                        placeholder="-y @myorg/mcp-server --port 9000"
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white/40 ${isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10"}`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setMcpSubView("configured")}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                        isDark ? "border-white/10 text-neutral-300 hover:text-white" : "border-black/10 text-neutral-700 hover:text-black"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-3.5 py-1.5 rounded-xl font-medium text-xs shadow-sm cursor-pointer transition ${
                        isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
                      }`}
                    >
                      Add server
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ==================== TAB 5: VOICE & AUDIO ==================== */}
          {activeTab === "voice" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-[var(--sb-text-primary)]">Kokoro Neural Speech Engine</h3>
                <p className="text-xs text-[var(--sb-text-secondary)]">
                  High-fidelity 24kHz neural text-to-speech synthesized entirely locally via nazdridoy/kokoro-tts 82M.
                </p>
              </div>

              {/* Voice Selector */}
              <div>
                <label className="block font-medium mb-1.5 text-[var(--sb-text-secondary)]">Active Neural Voice</label>
                <select
                  value={activeVoiceId}
                  onChange={(e) => setActiveVoiceId && setActiveVoiceId(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-white/40 cursor-pointer transition ${
                    isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-[#fbfbfa] border-[#d8d8d0] text-[#1c1c1a]"
                  }`}
                >
                  {KOKORO_VOICE_PRESETS.map((v) => (
                    <option key={v.id} value={v.id} className={isDark ? "bg-[#1e2024] text-white" : "bg-white text-black"}>
                      {v.name} - {v.description} ({v.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Speech Speed */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium text-[var(--sb-text-secondary)]">Speech Rate</label>
                  <span className="text-[var(--sb-text-primary)] font-mono text-xs font-semibold">{speechSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={speechSpeed}
                  onChange={(e) => setSpeechSpeed && setSpeechSpeed(parseFloat(e.target.value))}
                  className="w-full accent-zinc-400 dark:accent-white cursor-pointer"
                />
              </div>

              {/* Test Audio Synthesizer */}
              <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? "bg-[#181a1e] border-white/10" : "bg-[#f4f4f2] border-black/10"}`}>
                <label className="block text-xs font-semibold text-[var(--sb-text-primary)]">Test Voice Preview</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPhrase}
                    onChange={(e) => setTestPhrase(e.target.value)}
                    placeholder="Enter sentence for neural synthesis..."
                    className={`flex-1 border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-white/40 ${
                      isDark ? "bg-[#1e2024] border-white/10 text-white" : "bg-white border-black/10 text-[#1c1c1a]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition shadow-sm ${
                      isPlayingAudio
                        ? isDark
                          ? "bg-white/15 text-white border-white/30"
                          : "bg-black/10 text-black border-black/20"
                        : isDark
                        ? "bg-white text-black hover:bg-zinc-200 border-transparent"
                        : "bg-black text-white hover:bg-zinc-800 border-transparent"
                    }`}
                  >
                    {isPlayingAudio ? "Stop audio" : "Test voice"}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--sb-text-muted)] pt-1">
                  <span>Model: Kokoro-82M ONNX</span>
                  <span>Sample Rate: 24,000 Hz</span>
                  <span>Execution: Local CPU / DirectML</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (Strictly English Text Only - No Icons) */}
        <div className={`px-6 py-3.5 border-t flex items-center justify-between transition ${
          isDark ? "bg-[#121316] border-white/[0.08]" : "bg-[#f4f4f2] border-black/[0.08]"
        }`}>
          <div className="text-[11px] text-[var(--sb-text-muted)] font-mono">
            Songbird Desktop 2.0
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 font-medium rounded-xl text-xs transition shadow-sm cursor-pointer ${
              isDark
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-black text-white hover:bg-zinc-800"
            }`}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};
