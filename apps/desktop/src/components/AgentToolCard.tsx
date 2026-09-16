import React, { useState } from "react";
import { Terminal, Code, FileText, Globe, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

export interface ToolExecution {
  id: string;
  tool: string;
  input: string | Record<string, any>;
  output?: string;
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
    if (t.includes("code") || t.includes("python")) {
      return {
        icon: <Code size={15} className="text-emerald-500" />,
        label: "Python Code Execution",
        badgeColor: "bg-emerald-950/60 border-emerald-800/50 text-emerald-300",
      };
    }
    if (t.includes("file") || t.includes("write") || t.includes("read")) {
      return {
        icon: <FileText size={15} className="text-cyan-500" />,
        label: "File System Operation",
        badgeColor: "bg-cyan-950/60 border-cyan-800/50 text-cyan-300",
      };
    }
    if (t.includes("web") || t.includes("search")) {
      return {
        icon: <Globe size={15} className="text-blue-500" />,
        label: "Web Search & Fetch",
        badgeColor: "bg-blue-950/60 border-blue-800/50 text-blue-300",
      };
    }
    return {
      icon: <Terminal size={15} className="text-amber-500" />,
      label: "Terminal Command",
      badgeColor: "bg-amber-950/60 border-amber-800/50 text-amber-300",
    };
  };

  const meta = getToolMeta(execution.tool);

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
    <div className="my-3 rounded-xl bg-[var(--sb-code-bg)] border border-[var(--sb-border)] overflow-hidden text-xs shadow-sm transition">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--sb-code-header)] hover:bg-[var(--sb-hover-bg)] cursor-pointer select-none transition"
      >
        <div className="flex items-center gap-2.5">
          <button className="text-[var(--sb-text-muted)]">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {meta.icon}
          <span className="font-semibold text-[var(--sb-text-primary)]">{meta.label}</span>
          <span className="font-mono text-[10px] text-[var(--sb-text-muted)]">({execution.tool})</span>
        </div>

        <div className="flex items-center gap-2">
          {execution.status === "running" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-500 text-[10px]">
              <Loader2 size={10} className="animate-spin" />
              <span>Running...</span>
            </span>
          )}
          {execution.status === "success" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 text-[10px]">
              <CheckCircle2 size={10} />
              <span>Completed</span>
            </span>
          )}
          {execution.status === "error" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-500 text-[10px]">
              <XCircle size={10} />
              <span>Error</span>
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] p-1 rounded hover:bg-[var(--sb-hover-bg)] transition"
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
        </div>
      )}
    </div>
  );
};
