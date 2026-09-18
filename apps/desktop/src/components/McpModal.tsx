import React, { useState } from "react";
import {
  X,
  Layers,
  Plus,
  Trash2,
  Play,
  RotateCw,
  Check,
  Globe,
  Terminal,
  Database,
  FileCode,
  HardDrive,
  Cpu,
  Shield,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Info
} from "lucide-react";
import { OrbIconBadge, McpHubIcon } from "./SongbirdIcons";

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status?: "connected" | "disconnected" | "standby" | "error";
  toolCount?: number;
  isPreset?: boolean;
}

export const DEFAULT_MCP_PRESETS: McpServerConfig[] = [
  {
    id: "mcp_filesystem",
    name: "filesystem",
    description: "Secure local workspace filesystem access for reading, writing, and listing files",
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
    description: "Web scraper and markdown converter for extracting web pages and API docs",
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
    description: "GitHub integration for searching repositories, reading issues, and PR management",
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
    description: "Query and inspect SQLite databases and relational table schemas directly",
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
    description: "Web and local search via Brave Search API for fast grounding and citations",
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
    description: "Knowledge graph memory server for persisting entities, relations, and context",
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

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  isMcpEnabled: boolean;
  setIsMcpEnabled: (enabled: boolean) => void;
  mcpServers: McpServerConfig[];
  setMcpServers: React.Dispatch<React.SetStateAction<McpServerConfig[]>>;
  ws: WebSocket | null;
}

export const McpModal: React.FC<McpModalProps> = ({
  isOpen,
  onClose,
  theme,
  isMcpEnabled,
  setIsMcpEnabled,
  mcpServers,
  setMcpServers,
  ws,
}) => {
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<"configured" | "presets" | "custom">("configured");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // New Custom Server Form State
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customTransport, setCustomTransport] = useState<"stdio" | "sse">("stdio");
  const [customCommand, setCustomCommand] = useState("npx");
  const [customArgs, setCustomArgs] = useState("");
  const [customUrl, setCustomUrl] = useState("http://localhost:8000/sse");
  const [customEnv, setCustomEnv] = useState("");

  if (!isOpen) return null;

  // Toggle individual server
  const toggleServer = (id: string) => {
    setMcpServers((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
  };

  // Add preset server
  const addPreset = (preset: McpServerConfig) => {
    setMcpServers((prev) => {
      const exists = prev.some((s) => s.name === preset.name);
      if (exists) {
        return prev.map((s) => (s.name === preset.name ? { ...s, enabled: true } : s));
      }
      const updated = [...prev, { ...preset, enabled: true }];
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
    setActiveTab("configured");
  };

  // Delete server
  const deleteServer = (id: string) => {
    setMcpServers((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });
  };

  // Save new custom server
  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    let envObj: Record<string, string> | undefined = undefined;
    if (customEnv.trim()) {
      envObj = {};
      customEnv.split("\n").forEach((line) => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          envObj![parts[0].trim()] = parts.slice(1).join("=").trim();
        }
      });
    }

    const argsArray = customArgs
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0);

    const newServer: McpServerConfig = {
      id: "mcp_custom_" + Date.now(),
      name: customName.trim().toLowerCase().replace(/\s+/g, "-"),
      description: customDesc.trim() || "Custom user-defined MCP server",
      transport: customTransport,
      command: customTransport === "stdio" ? customCommand.trim() : undefined,
      args: customTransport === "stdio" ? argsArray : undefined,
      url: customTransport === "sse" ? customUrl.trim() : undefined,
      env: envObj,
      enabled: true,
      status: "connected",
    };

    setMcpServers((prev) => {
      const updated = [...prev, newServer];
      localStorage.setItem("songbird_mcp_servers_v1", JSON.stringify(updated));
      return updated;
    });

    setCustomName("");
    setCustomDesc("");
    setCustomArgs("");
    setCustomEnv("");
    setActiveTab("configured");
  };

  // Sync / Register with Hermes daemon
  const handleSyncWithDaemon = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setSyncNotice("Daemon is offline. Start engine on port 18789.");
      setTimeout(() => setSyncNotice(null), 3500);
      return;
    }

    setIsSyncing(true);
    const activeServersDict: Record<string, any> = {};

    if (isMcpEnabled) {
      mcpServers
        .filter((s) => s.enabled)
        .forEach((s) => {
          if (s.transport === "stdio") {
            activeServersDict[s.name] = {
              command: s.command || "npx",
              args: s.args || [],
              env: s.env || {},
              enabled: true,
            };
          } else {
            activeServersDict[s.name] = {
              url: s.url || "",
              transport: s.transport,
              enabled: true,
            };
          }
        });
    }

    ws.send(
      JSON.stringify({
        action: "mcp_register_servers",
        servers: activeServersDict,
      })
    );

    setTimeout(() => {
      setIsSyncing(false);
      setSyncNotice(`Synced ${Object.keys(activeServersDict).length} active MCP server(s) with Hermes engine!`);
      setTimeout(() => setSyncNotice(null), 3000);
    }, 600);
  };

  const enabledCount = mcpServers.filter((s) => s.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden orb-modal-glass ${
          isDark ? "border-white/[0.08] text-[#e6e6e6]" : "border-black/[0.08] text-[#1c1c1a]"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <OrbIconBadge size="md" variant="emerald" glow={isMcpEnabled}>
              <McpHubIcon size={18} accent="emerald" glow={isMcpEnabled} />
            </OrbIconBadge>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold t-shimmer" data-text="Model Context Protocol (MCP) Servers">
                  Model Context Protocol (MCP) Servers
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-medium border border-emerald-500/30">
                  v1.0 Standard
                </span>
              </div>
              <p className="text-xs text-[var(--sb-text-muted)] mt-0.5">
                Equip Songbird Agent with external tools, file systems, GitHub repos, databases, and APIs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="orb-chip p-2 text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Master Toggle Banner */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? "bg-[#1f1f1f] border-[#292929]" : "bg-[#f8f8f4] border-[#e8e8e0]"
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isMcpEnabled ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-stone-500"}`} />
            <div>
              <span className="text-xs font-semibold block">
                {isMcpEnabled ? "MCP Server Integration is Active" : "MCP Server Integration is Disabled"}
              </span>
              <span className="text-[11px] text-[var(--sb-text-muted)]">
                {isMcpEnabled
                  ? `${enabledCount} MCP server(s) active & accessible by Songbird Agent.`
                  : "Turn on to allow Songbird Agent to execute tools from connected MCP servers."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !isMcpEnabled;
                setIsMcpEnabled(next);
                localStorage.setItem("songbird_mcp_enabled", String(next));
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${isMcpEnabled ? "bg-emerald-600" : isDark ? "bg-[#383838]" : "bg-[#d0d0c8]"
                }`}
              title="Toggle MCP Server Integration"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMcpEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08]">
          <button
            onClick={() => setActiveTab("configured")}
            className={`orb-chip px-3 py-1.5 text-xs font-medium cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === "configured"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : ""
            }`}
          >
            <span>Configured</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
              {mcpServers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("presets")}
            className={`orb-chip px-3 py-1.5 text-xs font-medium cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === "presets"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : ""
            }`}
          >
            <Sparkles size={12} />
            <span>Recommended Presets</span>
          </button>

          <button
            onClick={() => setActiveTab("custom")}
            className={`orb-chip px-3 py-1.5 text-xs font-medium cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === "custom"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : ""
            }`}
          >
            <Plus size={12} />
            <span>Add Custom Server</span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {syncNotice && (
              <span className="text-[11px] text-emerald-400 font-mono animate-fade-in">
                {syncNotice}
              </span>
            )}
            <button
              onClick={handleSyncWithDaemon}
              disabled={isSyncing}
              className="orb-chip flex items-center gap-1.5 px-3 py-1.5 text-[11px] cursor-pointer hover:text-emerald-400 transition"
              title="Sync MCP servers with Hermes Engine Daemon"
            >
              <RotateCw size={11} className={isSyncing ? "animate-spin text-emerald-400" : ""} />
              <span>Sync Engine</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {/* TAB 1: Configured Servers */}
          {activeTab === "configured" && (
            <div className="space-y-3">
              {mcpServers.length === 0 ? (
                <div className="p-8 text-center border rounded-2xl border-dashed border-white/[0.1] orb-card">
                  <Layers size={32} className="mx-auto text-[var(--sb-text-muted)] mb-2" />
                  <p className="text-sm font-medium">No MCP Servers Configured</p>
                  <p className="text-xs text-[var(--sb-text-muted)] mt-1">
                    Select a preset or add a custom MCP server below.
                  </p>
                  <button
                    onClick={() => setActiveTab("presets")}
                    className="mt-3 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer"
                  >
                    View Recommended Presets
                  </button>
                </div>
              ) : (
                mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className={`p-3.5 rounded-2xl border transition flex items-start justify-between gap-3 orb-card ${
                      server.enabled
                        ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
                        : "opacity-60 border-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <OrbIconBadge size="md" variant={server.enabled ? "emerald" : "neutral"}>
                        {server.name.includes("file") ? (
                          <HardDrive size={15} />
                        ) : server.name.includes("sql") || server.name.includes("data") ? (
                          <Database size={15} />
                        ) : server.name.includes("git") ? (
                          <FileCode size={15} />
                        ) : (
                          <Globe size={15} />
                        )}
                      </OrbIconBadge>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs font-mono">{server.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-stone-500/20 text-[var(--sb-text-muted)] font-mono uppercase">
                            {server.transport}
                          </span>
                          {server.enabled && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[var(--sb-text-secondary)] mt-0.5 line-clamp-1">
                          {server.description}
                        </p>

                        <div className="mt-1.5 font-mono text-[11px] text-[var(--sb-text-muted)] bg-[var(--sb-bg-secondary)] px-2 py-1 rounded border border-[var(--sb-border)] truncate">
                          {server.transport === "stdio"
                            ? `${server.command || "npx"} ${(server.args || []).join(" ")}`
                            : server.url}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {/* Enable Switch */}
                      <button
                        onClick={() => toggleServer(server.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${server.enabled ? "bg-emerald-600" : isDark ? "bg-[#383838]" : "bg-[#d0d0c8]"
                          }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${server.enabled ? "translate-x-4.5" : "translate-x-1"
                            }`}
                        />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteServer(server.id)}
                        className="p-1.5 rounded-lg text-[var(--sb-text-muted)] hover:text-red-400 hover:bg-white/5 transition"
                        title="Remove MCP server"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Recommended Presets */}
          {activeTab === "presets" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEFAULT_MCP_PRESETS.map((preset) => {
                const isAlreadyConfigured = mcpServers.some((s) => s.name === preset.name && s.enabled);

                return (
                  <div
                    key={preset.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${isDark ? "bg-[#202020] border-[#333333]" : "bg-[#ffffff] border-[#e2e2dc]"
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs font-mono text-emerald-400">
                          {preset.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-500/20 text-[var(--sb-text-muted)] font-mono uppercase">
                          {preset.transport}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--sb-text-secondary)] mt-1 leading-snug">
                        {preset.description}
                      </p>
                      <div className="mt-2 font-mono text-[10px] text-[var(--sb-text-muted)] bg-[var(--sb-bg-secondary)] px-2 py-1 rounded truncate border border-[var(--sb-border)]">
                        {preset.command} {preset.args?.join(" ")}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[var(--sb-border)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--sb-text-muted)] font-mono">
                        ~{preset.toolCount} tools provided
                      </span>
                      <button
                        onClick={() => addPreset(preset)}
                        disabled={isAlreadyConfigured}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${isAlreadyConfigured
                          ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                          }`}
                      >
                        {isAlreadyConfigured ? <Check size={12} /> : <Plus size={12} />}
                        <span>{isAlreadyConfigured ? "Added" : "Add Preset"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Add Custom Server */}
          {activeTab === "custom" && (
            <form onSubmit={handleSaveCustom} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Server Name *</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. postgres-db or my-tools"
                    className={`w-full px-3 py-2 rounded-lg border outline-hidden ${isDark ? "bg-[#222222] border-[#383838] focus:border-emerald-500" : "bg-[#ffffff] border-[#d4d4cc] focus:border-emerald-500"
                      }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Transport Protocol *</label>
                  <select
                    value={customTransport}
                    onChange={(e) => setCustomTransport(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border outline-hidden ${isDark ? "bg-[#222222] border-[#383838]" : "bg-[#ffffff] border-[#d4d4cc]"
                      }`}
                  >
                    <option value="stdio">stdio (Local Subprocess / npx / uvx / Python)</option>
                    <option value="sse">sse / HTTP (Remote Server over SSE)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Brief description of what this MCP server does"
                  className={`w-full px-3 py-2 rounded-lg border outline-hidden ${isDark ? "bg-[#222222] border-[#383838]" : "bg-[#ffffff] border-[#d4d4cc]"
                    }`}
                />
              </div>

              {customTransport === "stdio" ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Executable Command *</label>
                      <input
                        type="text"
                        required
                        value={customCommand}
                        onChange={(e) => setCustomCommand(e.target.value)}
                        placeholder="npx, uvx, python, node"
                        className={`w-full px-3 py-2 rounded-lg border outline-hidden ${isDark ? "bg-[#222222] border-[#383838]" : "bg-[#ffffff] border-[#d4d4cc]"
                          }`}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block font-semibold mb-1">Arguments</label>
                      <input
                        type="text"
                        value={customArgs}
                        onChange={(e) => setCustomArgs(e.target.value)}
                        placeholder="-y @modelcontextprotocol/server-postgres postgres://..."
                        className={`w-full px-3 py-2 rounded-lg border outline-hidden ${isDark ? "bg-[#222222] border-[#383838]" : "bg-[#ffffff] border-[#d4d4cc]"
                          }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">
                      Environment Variables (KEY=VALUE per line)
                    </label>
                    <textarea
                      rows={2}
                      value={customEnv}
                      onChange={(e) => setCustomEnv(e.target.value)}
                      placeholder="API_KEY=your_key_here&#10;DATABASE_URL=postgres://..."
                      className={`w-full px-3 py-2 rounded-lg border outline-hidden font-mono text-[11px] ${isDark ? "bg-[#222222] border-[#383838]" : "bg-[#ffffff] border-[#d4d4cc]"
                        }`}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-semibold mb-1">Remote SSE / HTTP Server URL *</label>
                  <input
                    type="url"
                    required
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="http://localhost:8000/sse"
                    className={`w-full px-3 py-2 rounded-lg border outline-hidden ${isDark ? "bg-[#222222] border-[#383838]" : "bg-[#ffffff] border-[#d4d4cc]"
                      }`}
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("configured")}
                  className="px-3 py-1.5 rounded-lg border border-[var(--sb-border)] text-xs text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover-bg)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                >
                  Save & Enable Server
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-3 border-t flex items-center justify-between text-[11px] text-[var(--sb-text-muted)] ${isDark ? "bg-[#141414] border-[#292929]" : "bg-[#f5f5f1] border-[#e8e8e0]"
            }`}
        >
          <div className="flex items-center gap-1.5">
            <Info size={13} className="text-emerald-400 shrink-0" />
            <span>Songbird Agent dynamically discovers tools from active MCP servers on every turn.</span>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-[var(--sb-bg-secondary)] border border-[var(--sb-border)] text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
