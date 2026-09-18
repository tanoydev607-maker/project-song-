import React, { useState } from "react";
import { Terminal, Code, FileText, Globe, CheckCircle2, XCircle, ChevronDown, ChevronRight, Copy, Check, Monitor, Eye, Brain, Sparkles, Wrench } from "lucide-react";
import { OrbIconBadge } from "./SongbirdIcons";

export interface ToolExecution {
  id: string;
  tool: string;
  input: string | Record<string, any>;
  output?: string;
  image_b64?: string;
  status: "running" | "success" | "error";
  timestamp: number;
}

interface AgentToolCardProps {
  execution: ToolExecution;
}

export const AgentToolCard: React.FC<AgentToolCardProps> = ({ execution }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const getToolMeta = (toolName: string) => {
    const t = toolName.toLowerCase();
    if (t === "computer_use") {
      return {
        icon: <Monitor size={15} className="text-indigo-400" />,
        label: "OS & Desktop Control",
        badgeColor: "bg-indigo-950/60 border-indigo-800/50 text-indigo-300",
      };
    }
    if (t.startsWith("browser_")) {
      return {
        icon: <Globe size={15} className="text-blue-400" />,
        label: "Browser Automation",
        badgeColor: "bg-blue-950/60 border-blue-800/50 text-blue-300",
      };
    }
    if (t.includes("vision") || t.includes("image") || t.includes("video") || t.includes("flux")) {
      return {
        icon: <Eye size={15} className="text-zinc-400" />,
        label: "Vision & Media Pipeline",
        badgeColor: "bg-zinc-800/60 border-zinc-700/50 text-zinc-300",
      };
    }
    if (t.includes("todo") || t.includes("memory") || t.includes("session") || t.includes("clarify") || t.includes("delegate")) {
      return {
        icon: <Brain size={15} className="text-violet-400" />,
        label: "Memory & Planning",
        badgeColor: "bg-violet-950/60 border-violet-800/50 text-violet-300",
      };
    }
    if (t.includes("code") || t.includes("python")) {
      return {
        icon: <Code size={15} className="text-emerald-500" />,
        label: "Python Code Execution",
        badgeColor: "bg-emerald-950/60 border-emerald-800/50 text-emerald-300",
      };
    }
    if (t.includes("document")) {
      return {
        icon: <FileText size={15} className="text-cyan-400" />,
        label: "Document Extraction",
        badgeColor: "bg-cyan-950/60 border-cyan-800/50 text-cyan-300",
      };
    }
    if (t.includes("file") || t.includes("write") || t.includes("read") || t.includes("patch") || t.includes("list")) {
      return {
        icon: <FileText size={15} className="text-cyan-500" />,
        label: "File System Operation",
        badgeColor: "bg-cyan-950/60 border-cyan-800/50 text-cyan-300",
      };
    }
    if (t.includes("web") || t.includes("search")) {
      return {
        icon: <Globe size={15} className="text-sky-400" />,
        label: "Web Search & Fetch",
        badgeColor: "bg-sky-950/60 border-sky-800/50 text-sky-300",
      };
    }
    if (t.includes("custom") || t.startsWith("custom_")) {
      return {
        icon: <Sparkles size={15} className="text-teal-400" />,
        label: "Custom Tool Execution",
        badgeColor: "bg-teal-950/60 border-teal-800/50 text-teal-300",
      };
    }
    return {
      icon: <Terminal size={15} className="text-amber-500" />,
      label: "Terminal & System Command",
      badgeColor: "bg-amber-950/60 border-amber-800/50 text-amber-300",
    };
  };

  const meta = getToolMeta(execution.tool);
  const isRunning = execution.status === "running";

  const formatInput = (inp: any): string => {
    if (typeof inp === "string") return inp;
    try {
      return JSON.stringify(inp, null, 2);
    } catch {
      return String(inp);
    }
  };

  const handleCopy = async () => {
    const text = `Tool: ${execution.tool}\nInput:\n${formatInput(execution.input)}\n\nOutput:\n${execution.output || ""}`;
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={`my-3 rounded-2xl bg-[var(--sb-code-bg)] border overflow-hidden text-xs shadow-sm transition-all duration-200 ${
        isRunning ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-[var(--sb-border)]"
      }`}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--sb-code-header)] hover:bg-[var(--sb-hover-bg)] cursor-pointer select-none transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button className="text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)]">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {isRunning ? (
            <OrbIconBadge size="sm" variant="amber" active={true} glow={true}>
              <Sparkles size={11} className="text-amber-400 animate-spin" />
            </OrbIconBadge>
          ) : (
            <OrbIconBadge size="sm" variant="neutral">
              {meta.icon}
            </OrbIconBadge>
          )}
          <span className="font-semibold text-[var(--sb-text-primary)] truncate">{meta.label}</span>
          <span className="font-mono text-[10px] text-[var(--sb-text-muted)] shrink-0">({execution.tool})</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Executing...</span>
            </span>
          )}
          {execution.status === "success" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-mono">
              <CheckCircle2 size={11} />
              <span>Completed</span>
            </span>
          )}
          {execution.status === "error" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-mono">
              <XCircle size={11} />
              <span>Error</span>
            </span>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] p-1 rounded hover:bg-[var(--sb-hover-bg)] transition cursor-pointer"
            title="Copy tool invocation & output"
          >
            {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-3 space-y-2.5 border-t border-[var(--sb-border)] font-mono text-[11px]">
          {/* Input Args / Code */}
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider text-[var(--sb-text-muted)] mb-1">
              Parameters / Payload
            </div>
            <pre className="p-2.5 rounded-lg bg-[var(--sb-code-bg)] border border-[var(--sb-border)] text-[var(--sb-text-primary)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {formatInput(execution.input)}
            </pre>
          </div>

          {/* Output Result */}
          {execution.output && (
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-[var(--sb-text-muted)] mb-1">
                Execution Output
              </div>
              <pre className="p-2.5 rounded-lg bg-[var(--sb-code-bg)] border border-[var(--sb-border)] text-emerald-500 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                {execution.output}
              </pre>
            </div>
          )}

          {/* Screenshot Image (if computer_use or vision returns base64 image) */}
          {execution.image_b64 && (
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-[var(--sb-text-muted)] mb-1">
                Visual Capture / Screenshot
              </div>
              <div className="rounded-lg overflow-hidden border border-[var(--sb-border)] max-h-72 bg-black/50 flex items-center justify-center">
                <img
                  src={execution.image_b64.startsWith("data:") ? execution.image_b64 : `data:image/png;base64,${execution.image_b64}`}
                  alt="Visual Capture"
                  className="max-h-72 object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
