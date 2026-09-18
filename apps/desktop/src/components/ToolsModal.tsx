import React, { useState, useMemo } from "react";
import {
  X,
  Wrench,
  Search,
  Plus,
  Trash2,
  Edit3,
  Check,
  Copy,
  Sliders,
  Terminal,
  FileText,
  Globe,
  Code,
  Eye,
  Brain,
  Volume2,
  Layers,
  ChevronDown,
  ChevronRight,
  Monitor,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Play,
  CheckCircle2,
  Info,
  Shield,
  HelpCircle
} from "lucide-react";
import { OrbIconBadge, ToolsWrenchIcon } from "./SongbirdIcons";
import defaultToolsCatalog from "./all_tools_catalog.json";

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface HermesTool {
  id: string;
  name: string;
  label: string;
  category: string;
  toolset: string;
  description: string;
  parameters: ToolParameter[];
  enabled: boolean;
  available?: boolean;
  requirementHint?: string | null;
  isCustom?: boolean;
  executionType?: "shell" | "python" | "prompt";
  commandTemplate?: string;
  pythonScript?: string;
}

export const CATEGORIES = [
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

export const INITIAL_HERMES_TOOLS: HermesTool[] = defaultToolsCatalog as HermesTool[];

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  tools: HermesTool[];
  setTools: React.Dispatch<React.SetStateAction<HermesTool[]>>;
  onSaveTools?: (tools: HermesTool[]) => void;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({
  isOpen,
  onClose,
  theme,
  tools,
  setTools,
  onSaveTools,
}) => {
  const isDark = theme === "dark";

  // Navigation & Filtering State
  const [selectedCategory, setSelectedCategory] = useState<string>("All Tools");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "enabled" | "operational">("all");
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom Tool Modal Drawer State
  const [isCustomToolModalOpen, setIsCustomToolModalOpen] = useState(false);
  const [editingCustomToolId, setEditingCustomToolId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState<{
    id: string;
    label: string;
    description: string;
    category: string;
    executionType: "shell" | "python" | "prompt";
    commandTemplate: string;
    pythonScript: string;
    parameters: ToolParameter[];
  }>({
    id: "",
    label: "",
    description: "",
    category: "Custom Tools",
    executionType: "shell",
    commandTemplate: "",
    pythonScript: "",
    parameters: [],
  });

  const [formParamName, setFormParamName] = useState("");
  const [formParamType, setFormParamType] = useState("string");
  const [formParamDesc, setFormParamDesc] = useState("");
  const [formParamReq, setFormParamReq] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Toggle tool enabled state
  const handleToggleTool = (toolId: string) => {
    setTools((prev) => {
      const updated = prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t));
      if (onSaveTools) onSaveTools(updated);
      localStorage.setItem("songbird_tools_config_v1", JSON.stringify(updated));
      return updated;
    });
  };

  // Toggle expand inspector
  const toggleExpand = (toolId: string) => {
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  // Copy sample tool call schema
  const handleCopySchema = (tool: HermesTool) => {
    const sampleArgs: Record<string, any> = {};
    tool.parameters.forEach((p) => {
      sampleArgs[p.name] = p.type === "number" ? 1 : p.type === "boolean" ? true : `<${p.name}>`;
    });
    const sampleCall = `<tool_call>\n${JSON.stringify({ name: tool.name, arguments: sampleArgs }, null, 2)}\n</tool_call>`;
    navigator.clipboard.writeText(sampleCall);
    setCopiedId(tool.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Enable / Disable All in current category
  const handleBatchToggle = (enable: boolean) => {
    setTools((prev) => {
      const updated = prev.map((t) => {
        if (selectedCategory === "All Tools" || t.category === selectedCategory || (selectedCategory === "Custom Tools" && t.isCustom)) {
          return { ...t, enabled: enable };
        }
        return t;
      });
      if (onSaveTools) onSaveTools(updated);
      localStorage.setItem("songbird_tools_config_v1", JSON.stringify(updated));
      return updated;
    });
  };

  // Reset to recommended defaults
  const handleResetDefaults = () => {
    const reset = INITIAL_HERMES_TOOLS.map((t) => ({ ...t }));
    // Preserve custom tools
    const customOnly = tools.filter((t) => t.isCustom);
    const combined = [...reset, ...customOnly];
    setTools(combined);
    if (onSaveTools) onSaveTools(combined);
    localStorage.setItem("songbird_tools_config_v1", JSON.stringify(combined));
  };

  // Open custom tool form for new tool
  const handleOpenNewCustomTool = () => {
    setEditingCustomToolId(null);
    setCustomForm({
      id: "",
      label: "",
      description: "",
      category: "Custom Tools",
      executionType: "shell",
      commandTemplate: "",
      pythonScript: "",
      parameters: [],
    });
    setFormError(null);
    setIsCustomToolModalOpen(true);
  };

  // Open custom tool form for editing
  const handleEditCustomTool = (tool: HermesTool) => {
    setEditingCustomToolId(tool.id);
    setCustomForm({
      id: tool.name,
      label: tool.label,
      description: tool.description,
      category: tool.category,
      executionType: tool.executionType || "shell",
      commandTemplate: tool.commandTemplate || "",
      pythonScript: tool.pythonScript || "",
      parameters: [...tool.parameters],
    });
    setFormError(null);
    setIsCustomToolModalOpen(true);
  };

  // Delete custom tool
  const handleDeleteCustomTool = (toolId: string) => {
    setTools((prev) => {
      const updated = prev.filter((t) => t.id !== toolId);
      if (onSaveTools) onSaveTools(updated);
      localStorage.setItem("songbird_tools_config_v1", JSON.stringify(updated));
      return updated;
    });
  };

  // Add parameter to custom tool form
  const handleAddParamToForm = () => {
    const cleanName = formParamName.trim().replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    if (!cleanName) return;
    if (customForm.parameters.some((p) => p.name === cleanName)) {
      setFormError(`Parameter '${cleanName}' already exists.`);
      return;
    }
    setCustomForm((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          name: cleanName,
          type: formParamType,
          description: formParamDesc.trim(),
          required: formParamReq,
        },
      ],
    }));
    setFormParamName("");
    setFormParamDesc("");
    setFormParamReq(false);
    setFormError(null);
  };

  // Remove parameter from form
  const handleRemoveParamFromForm = (paramName: string) => {
    setCustomForm((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((p) => p.name !== paramName),
    }));
  };

  // Save custom tool
  const handleSaveCustomTool = () => {
    const cleanId = customForm.id.trim().replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    if (!cleanId) {
      setFormError("Tool identifier is required (e.g. query_api, git_diff).");
      return;
    }
    if (!customForm.description.trim()) {
      setFormError("Description is required so the AI knows when to execute this tool.");
      return;
    }

    if (!editingCustomToolId && tools.some((t) => t.name.toLowerCase() === cleanId)) {
      setFormError(`A tool named '${cleanId}' already exists.`);
      return;
    }

    const newTool: HermesTool = {
      id: editingCustomToolId || `custom_${cleanId}_${Date.now()}`,
      name: cleanId,
      label: customForm.label.trim() || cleanId.replace(/_/g, " ").toUpperCase(),
      category: customForm.category || "Custom Tools",
      toolset: "custom",
      description: customForm.description.trim(),
      parameters: customForm.parameters,
      enabled: true,
      available: true,
      isCustom: true,
      executionType: customForm.executionType,
      commandTemplate: customForm.commandTemplate.trim(),
      pythonScript: customForm.pythonScript.trim(),
    };

    setTools((prev) => {
      let updated: HermesTool[];
      if (editingCustomToolId) {
        updated = prev.map((t) => (t.id === editingCustomToolId ? newTool : t));
      } else {
        updated = [...prev, newTool];
      }
      if (onSaveTools) onSaveTools(updated);
      localStorage.setItem("songbird_tools_config_v1", JSON.stringify(updated));
      return updated;
    });

    setIsCustomToolModalOpen(false);
  };

  // Category Icon Resolver
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "OS & Computer Use":
        return <Monitor size={14} className="text-indigo-400" />;
      case "Browser Automation":
        return <Globe size={14} className="text-blue-400" />;
      case "Terminal & Processes":
        return <Terminal size={14} className="text-amber-400" />;
      case "File System & Documents":
        return <FileText size={14} className="text-cyan-400" />;
      case "Code Execution":
        return <Code size={14} className="text-emerald-400" />;
      case "Web & Search":
        return <Globe size={14} className="text-sky-400" />;
      case "Vision & Media":
        return <Eye size={14} className="text-zinc-400" />;
      case "Memory & Planning":
        return <Brain size={14} className="text-violet-400" />;
      case "Voice & Audio":
        return <Volume2 size={14} className="text-yellow-400" />;
      case "Custom Tools":
        return <Sparkles size={14} className="text-teal-400" />;
      default:
        return <Layers size={14} className="text-gray-400" />;
    }
  };

  // Category Badge Colors
  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "OS & Computer Use":
        return "bg-indigo-950/60 border-indigo-700/50 text-indigo-300";
      case "Browser Automation":
        return "bg-blue-950/60 border-blue-700/50 text-blue-300";
      case "Terminal & Processes":
        return "bg-amber-950/60 border-amber-700/50 text-amber-300";
      case "File System & Documents":
        return "bg-cyan-950/60 border-cyan-700/50 text-cyan-300";
      case "Code Execution":
        return "bg-emerald-950/60 border-emerald-700/50 text-emerald-300";
      case "Web & Search":
        return "bg-sky-950/60 border-sky-700/50 text-sky-300";
      case "Vision & Media":
        return "bg-zinc-800/60 border-zinc-700/50 text-zinc-300";
      case "Memory & Planning":
        return "bg-violet-950/60 border-violet-700/50 text-violet-300";
      case "Voice & Audio":
        return "bg-yellow-950/60 border-yellow-700/50 text-yellow-300";
      case "Custom Tools":
        return "bg-teal-950/60 border-teal-700/50 text-teal-300";
      default:
        return "bg-gray-800/60 border-gray-700 text-gray-300";
    }
  };

  // Filtered Tools
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      if (!tool) return false;
      // Category Match
      if (selectedCategory === "Custom Tools") {
        if (!tool.isCustom) return false;
      } else if (selectedCategory !== "All Tools" && tool.category !== selectedCategory) {
        return false;
      }

      // Filter Mode Match
      if (filterMode === "enabled" && !tool.enabled) return false;
      if (filterMode === "operational" && tool.available === false) return false;

      // Search Query Match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (tool.name || "").toLowerCase().includes(q);
        const matchLabel = (tool.label || "").toLowerCase().includes(q);
        const matchDesc = (tool.description || "").toLowerCase().includes(q);
        const matchParams = (tool.parameters || []).some(
          (p) => (p?.name || "").toLowerCase().includes(q) || (p?.description || "").toLowerCase().includes(q)
        );
        return matchName || matchLabel || matchDesc || matchParams;
      }

      return true;
    });
  }, [tools, selectedCategory, filterMode, searchQuery]);

  // Statistics
  const totalCount = tools.length;
  const activeCount = tools.filter((t) => t.enabled).length;
  const customCount = tools.filter((t) => t.isCustom).length;
  const operationalCount = tools.filter((t) => t.available !== false).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden orb-modal-glass transition ${
          isDark ? "border-white/[0.08] text-[#e0e0e0]" : "border-black/[0.08] text-[#1a1a18]"
        }`}
      >
        {/* ==================== MODAL HEADER ==================== */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between transition">
          <div className="flex items-center gap-3.5">
            <OrbIconBadge size="lg" variant="neutral" glow={true}>
              <ToolsWrenchIcon size={22} glow={true} />
            </OrbIconBadge>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight t-shimmer" data-text="Hermes Tools & Custom Capabilities">
                  Hermes Tools & Custom Capabilities
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--sb-text-secondary)] font-mono font-semibold border border-white/15">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-[var(--sb-text-muted)]">
                Manage 80+ built-in autonomous agent tools, toggle capabilities, and configure custom execution tools.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenNewCustomTool}
              className="orb-pill flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Custom Tool</span>
            </button>
            <button
              onClick={onClose}
              className="orb-chip p-2 text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ==================== STATS BAR & QUICK ACTIONS ==================== */}
        <div
          className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? "bg-[#141414] border-[#242424]" : "bg-[#f8f8f6] border-[#e8e8e2]"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--sb-text-muted)]">Total Tools:</span>
              <span className="font-bold text-[var(--sb-text-primary)]">{totalCount}</span>
            </div>
            <div className="w-1 h-3 bg-gray-600/40 rounded-full" />
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--sb-text-muted)]">Active:</span>
              <span className="font-bold text-emerald-400">{activeCount}</span>
            </div>
            <div className="w-1 h-3 bg-gray-600/40 rounded-full" />
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--sb-text-muted)]">Operational:</span>
              <span className="font-bold text-blue-400">{operationalCount}</span>
            </div>
            <div className="w-1 h-3 bg-gray-600/40 rounded-full" />
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--sb-text-muted)]">Custom Tools:</span>
              <span className="font-bold text-teal-400">{customCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchToggle(true)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
                isDark ? "border-[#333] hover:bg-[#252525] text-emerald-400" : "border-[#ccc] hover:bg-[#eee] text-emerald-600"
              }`}
            >
              Enable Category
            </button>
            <button
              onClick={() => handleBatchToggle(false)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
                isDark ? "border-[#333] hover:bg-[#252525] text-amber-400" : "border-[#ccc] hover:bg-[#eee] text-amber-600"
              }`}
            >
              Disable Category
            </button>
            <button
              onClick={handleResetDefaults}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
                isDark ? "border-[#333] hover:bg-[#252525] text-gray-400" : "border-[#ccc] hover:bg-[#eee] text-gray-600"
              }`}
              title="Reset all built-in tools to recommended default states"
            >
              <RefreshCw size={11} />
              <span>Defaults</span>
            </button>
          </div>
        </div>

        {/* ==================== SEARCH & FILTERS ==================== */}
        <div className="px-6 pt-3 pb-2 flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div
            className={`flex-1 min-w-[260px] flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
              isDark ? "bg-[#1e1e1e] border-[#303030] text-gray-200" : "bg-white border-[#d0d0c8] text-gray-800"
            }`}
          >
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search tools by name, parameter, or purpose (e.g. computer_use, screenshot, click, terminal)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                filterMode === "all"
                  ? "bg-white text-black border-white shadow-sm"
                  : isDark
                  ? "bg-[#202020] border-[#303030] text-gray-400 hover:text-white"
                  : "bg-[#f2f2ee] border-[#d8d8d0] text-gray-600 hover:text-black"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilterMode("enabled")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                filterMode === "enabled"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                  : isDark
                  ? "bg-[#202020] border-[#303030] text-gray-400 hover:text-white"
                  : "bg-[#f2f2ee] border-[#d8d8d0] text-gray-600 hover:text-black"
              }`}
            >
              Active Only ({activeCount})
            </button>
            <button
              onClick={() => setFilterMode("operational")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                filterMode === "operational"
                  ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                  : isDark
                  ? "bg-[#202020] border-[#303030] text-gray-400 hover:text-white"
                  : "bg-[#f2f2ee] border-[#d8d8d0] text-gray-600 hover:text-black"
              }`}
            >
              Operational ({operationalCount})
            </button>
          </div>
        </div>

        {/* ==================== CATEGORY TABS ==================== */}
        <div className="px-6 py-2 overflow-x-auto scrollbar-none flex items-center gap-2 border-b border-gray-800/30">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === "All Tools"
                ? totalCount
                : cat === "Custom Tools"
                ? customCount
                : tools.filter((t) => t.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-white/15 border-white/30 text-white shadow-sm font-semibold"
                    : isDark
                    ? "bg-[#1c1c1c] border-[#292929] text-gray-400 hover:text-gray-200 hover:bg-[#242424]"
                    : "bg-[#f0f0ec] border-[#d8d8d0] text-gray-600 hover:text-black hover:bg-[#e4e4de]"
                }`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ==================== TOOLS CARDS GRID ==================== */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin">
          {filteredTools.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto text-gray-500">
                <Wrench size={24} />
              </div>
              <div className="text-sm font-semibold">No matching tools found</div>
              <p className="text-xs max-w-sm mx-auto text-gray-500">
                Try clearing your search query or switching to another category. You can also create a new custom tool.
              </p>
              {selectedCategory === "Custom Tools" && (
                <button
                  onClick={handleOpenNewCustomTool}
                  className="mt-2 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Create Your First Custom Tool</span>
                </button>
              )}
            </div>
          ) : (
            filteredTools.map((tool) => {
              const isExpanded = expandedToolIds.has(tool.id);
              const isCustom = Boolean(tool.isCustom);
              const isOperational = tool.available !== false;

              return (
                <div
                  key={tool.id}
                  className={`p-4 rounded-xl border transition duration-150 ${
                    tool.enabled
                      ? isDark
                        ? "bg-[#1f1f1f] border-[#383838] shadow-sm"
                        : "bg-white border-[#dcdcd0] shadow-sm"
                      : isDark
                      ? "bg-[#181818]/60 border-[#262626] opacity-75"
                      : "bg-[#f6f6f2]/80 border-[#e2e2da] opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Tool Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <span className="font-mono font-bold text-sm text-[var(--sb-text-primary)]">
                          {tool.name}
                        </span>
                        <span className="text-xs text-[var(--sb-text-muted)] font-medium">
                          ({tool.label})
                        </span>

                        {/* Category Badge */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getCategoryBadgeColor(
                            tool.category
                          )}`}
                        >
                          {tool.category}
                        </span>

                        {/* Toolset Tag */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                            isDark ? "bg-[#252525] border-[#383838] text-gray-400" : "bg-[#ecece6] border-[#d4d4cc] text-gray-600"
                          }`}
                        >
                          set: {tool.toolset}
                        </span>

                        {/* Status Badge */}
                        {isCustom ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-teal-950/60 border border-teal-700/50 text-teal-300">
                            Custom ({tool.executionType?.toUpperCase()})
                          </span>
                        ) : isOperational ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Operational
                          </span>
                        ) : (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-300 flex items-center gap-1"
                            title={tool.requirementHint || "Requires external binary or service"}
                          >
                            <AlertTriangle size={10} /> {tool.requirementHint || "Setup Required"}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[var(--sb-text-secondary)] leading-relaxed line-clamp-2">
                        {tool.description}
                      </p>

                      {/* Requirements Hint Alert */}
                      {tool.requirementHint && !isOperational && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                          <Info size={13} className="text-amber-400 flex-shrink-0" />
                          <span>{tool.requirementHint}. To run this tool autonomously, ensure the prerequisite is installed on your host.</span>
                        </div>
                      )}
                    </div>

                    {/* Actions & Switch */}
                    <div className="flex items-center gap-3">
                      {isCustom && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditCustomTool(tool)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                            title="Edit Custom Tool"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomTool(tool.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition"
                            title="Delete Custom Tool"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleCopySchema(tool)}
                        className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
                          copiedId === tool.id
                            ? "bg-emerald-950 border-emerald-600 text-emerald-300"
                            : isDark
                            ? "bg-[#252525] border-[#383838] text-gray-400 hover:text-white"
                            : "bg-[#ecece6] border-[#d4d4cc] text-gray-600 hover:text-black"
                        }`}
                        title="Copy sample <tool_call> JSON format"
                      >
                        {copiedId === tool.id ? <Check size={13} /> : <Copy size={13} />}
                        <span className="text-[10px] hidden sm:inline">Copy Schema</span>
                      </button>

                      {/* Enable / Disable Toggle Switch */}
                      <button
                        onClick={() => handleToggleTool(tool.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          tool.enabled ? "bg-white" : isDark ? "bg-gray-700" : "bg-gray-300"
                        }`}
                        title={tool.enabled ? "Click to Disable" : "Click to Enable"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            tool.enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Inspector Accordion Toggle */}
                  <div className="mt-3 pt-2 border-t border-gray-800/40 flex items-center justify-between text-[11px]">
                    <button
                      onClick={() => toggleExpand(tool.id)}
                      className="text-[var(--sb-text-primary)] hover:underline font-medium flex items-center gap-1 transition"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>{isExpanded ? "Hide Parameters & Schema" : `View Parameters (${tool.parameters.length})`}</span>
                    </button>

                    <span className="text-[var(--sb-text-muted)] text-[10px]">
                      {tool.parameters.length} parameter{tool.parameters.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Expanded Parameters & Schema Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-800/50 space-y-3 animate-in fade-in duration-150">
                      {tool.parameters.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className={`border-b text-[11px] font-semibold ${isDark ? "border-gray-800 text-gray-400" : "border-gray-300 text-gray-600"}`}>
                                <th className="pb-1.5 pr-3">Parameter</th>
                                <th className="pb-1.5 pr-3">Type</th>
                                <th className="pb-1.5 pr-3">Required</th>
                                <th className="pb-1.5">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/40 text-[11px]">
                              {tool.parameters.map((p) => (
                                <tr key={p.name} className={isDark ? "hover:bg-white/[0.02]" : "hover:bg-black/[0.02]"}>
                                  <td className="py-1.5 pr-3 font-mono text-[var(--sb-text-primary)] font-medium">{p.name}</td>
                                  <td className="py-1.5 pr-3 font-mono text-blue-400">{p.type}</td>
                                  <td className="py-1.5 pr-3">
                                    {p.required ? (
                                      <span className="text-amber-400 font-semibold">Yes</span>
                                    ) : (
                                      <span className="text-gray-500">Optional</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-[var(--sb-text-secondary)]">{p.description || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--sb-text-muted)] italic">
                          This tool takes no arguments (e.g. read current state / trigger).
                        </div>
                      )}

                      {/* Custom Tool Execution Code / Template Details */}
                      {isCustom && tool.commandTemplate && (
                        <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-gray-800 text-xs font-mono text-gray-300">
                          <div className="text-[10px] text-gray-400 font-sans mb-1 font-semibold uppercase">Command Template:</div>
                          <code>{tool.commandTemplate}</code>
                        </div>
                      )}

                      {isCustom && tool.pythonScript && (
                        <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-gray-800 text-xs font-mono text-emerald-300">
                          <div className="text-[10px] text-gray-400 font-sans mb-1 font-semibold uppercase">Python Script:</div>
                          <pre className="whitespace-pre-wrap">{tool.pythonScript}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ==================== MODAL FOOTER ==================== */}
        <div
          className={`px-6 py-3 border-t flex items-center justify-between text-xs transition ${
            isDark ? "bg-[#181818] border-[#292929]" : "bg-[#f4f4f0] border-[#deded6]"
          }`}
        >
          <div className="text-[var(--sb-text-muted)] flex items-center gap-1.5">
            <Sparkles size={13} className="text-[var(--sb-text-muted)]" />
            <span>Tools enabled here are dynamically fed to Hermes Agent in autonomous Agent Mode.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-semibold transition shadow-sm text-xs"
          >
            Done
          </button>
        </div>
      </div>

      {/* ==================== ADD / EDIT CUSTOM TOOL DRAWER ==================== */}
      {isCustomToolModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isDark ? "bg-[#1c1c1c] border-[#333] text-[#e0e0e0]" : "bg-white border-[#ccc] text-[#1a1a18]"
            }`}
          >
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-white" />
                <h3 className="text-sm font-bold">
                  {editingCustomToolId ? "Edit Custom Tool" : "Create New Custom Tool"}
                </h3>
              </div>
              <button
                onClick={() => setIsCustomToolModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tool Identifier */}
              <div>
                <label className="block font-semibold mb-1">Tool Name / Identifier (snake_case) *</label>
                <input
                  type="text"
                  placeholder="e.g. check_git_status, query_weather, scan_ports"
                  value={customForm.id}
                  onChange={(e) => setCustomForm({ ...customForm, id: e.target.value })}
                  disabled={Boolean(editingCustomToolId)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${
                    isDark ? "bg-[#252525] border-[#3a3a3a]" : "bg-gray-50 border-gray-300"
                  }`}
                />
              </div>

              {/* Display Label */}
              <div>
                <label className="block font-semibold mb-1">Display Label</label>
                <input
                  type="text"
                  placeholder="e.g. Git Status Scanner"
                  value={customForm.label}
                  onChange={(e) => setCustomForm({ ...customForm, label: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isDark ? "bg-[#252525] border-[#3a3a3a]" : "bg-gray-50 border-gray-300"
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold mb-1">Description & Agent Directives *</label>
                <textarea
                  rows={3}
                  placeholder="Describe what this tool does and when the agent should call it (e.g. Check active Git branch, dirty files, and uncommitted changes)..."
                  value={customForm.description}
                  onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isDark ? "bg-[#252525] border-[#3a3a3a]" : "bg-gray-50 border-gray-300"
                  }`}
                />
              </div>

              {/* Execution Type */}
              <div>
                <label className="block font-semibold mb-1">Execution Mechanism</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "shell", label: "Shell Command", icon: <Terminal size={13} /> },
                    { id: "python", label: "Python Script", icon: <Code size={13} /> },
                    { id: "prompt", label: "Prompt Directive", icon: <Brain size={13} /> },
                  ].map((mech) => (
                    <button
                      key={mech.id}
                      type="button"
                      onClick={() => setCustomForm({ ...customForm, executionType: mech.id as any })}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                        customForm.executionType === mech.id
                          ? "bg-white text-black border-white font-semibold"
                          : isDark
                          ? "bg-[#252525] border-[#3a3a3a] text-gray-400"
                          : "bg-gray-100 border-gray-300 text-gray-700"
                      }`}
                    >
                      {mech.icon}
                      <span>{mech.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shell Command Template */}
              {customForm.executionType === "shell" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold">Shell Command Template *</label>
                    <span className="text-[11px] text-gray-400">Use {'{param_name}'} for substituted args</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. git status -s || curl -s https://api.weatherapi.com/v1/current.json?q={city}"
                    value={customForm.commandTemplate}
                    onChange={(e) => setCustomForm({ ...customForm, commandTemplate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border font-mono text-xs ${
                      isDark ? "bg-[#252525] border-[#3a3a3a]" : "bg-gray-50 border-gray-300"
                    }`}
                  />
                </div>
              )}

              {/* Python Script Template */}
              {customForm.executionType === "python" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold">Python Script *</label>
                    <span className="text-[11px] text-gray-400">`args` dict is injected into execution scope</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder={'import os, json\nprint("Processing: " + str(args.get("target", "default")))'}
                    value={customForm.pythonScript}
                    onChange={(e) => setCustomForm({ ...customForm, pythonScript: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border font-mono text-xs text-emerald-300 ${
                      isDark ? "bg-[#252525] border-[#3a3a3a]" : "bg-gray-50 border-gray-300"
                    }`}
                  />
                </div>
              )}

              {/* Dynamic Parameter Builder */}
              <div className="border-t border-gray-800 pt-3">
                <label className="block font-semibold mb-2">Tool Parameters</label>
                
                {customForm.parameters.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {customForm.parameters.map((p) => (
                      <div
                        key={p.name}
                        className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                          isDark ? "bg-[#242424] border-[#333]" : "bg-gray-100 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[var(--sb-text-primary)] font-bold">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono">
                            {p.type}
                          </span>
                          {p.required && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-semibold">
                              required
                            </span>
                          )}
                          <span className="text-gray-400 truncate max-w-[200px]">{p.description}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParamFromForm(p.name)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Parameter Row */}
                <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "bg-[#222] border-[#333]" : "bg-gray-50 border-gray-200"}`}>
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Param name (e.g. city)"
                      value={formParamName}
                      onChange={(e) => setFormParamName(e.target.value)}
                      className="col-span-4 px-2.5 py-1.5 rounded-lg border bg-transparent text-xs font-mono"
                    />
                    <select
                      value={formParamType}
                      onChange={(e) => setFormParamType(e.target.value)}
                      className="col-span-3 px-2 py-1.5 rounded-lg border bg-transparent text-xs"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Description for model..."
                      value={formParamDesc}
                      onChange={(e) => setFormParamDesc(e.target.value)}
                      className="col-span-5 px-2.5 py-1.5 rounded-lg border bg-transparent text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formParamReq}
                        onChange={(e) => setFormParamReq(e.target.checked)}
                        className="rounded"
                      />
                      <span>Required argument</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleAddParamToForm}
                      className="px-2.5 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium flex items-center gap-1"
                    >
                      <Plus size={12} />
                      <span>Add Param</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Footer */}
            <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-end gap-2 bg-black/20">
              <button
                type="button"
                onClick={() => setIsCustomToolModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomTool}
                className="px-4 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-semibold text-xs shadow-md"
              >
                Save Tool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
