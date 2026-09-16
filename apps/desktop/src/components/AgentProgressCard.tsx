import React, { useState } from "react";
import { Bot, Loader2, CheckCircle2, Clock, Circle, ChevronDown, ChevronRight, Square, Sparkles } from "lucide-react";

export interface AgentSubtask {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface AgentProgressState {
  step: number;
  maxSteps: number;
  title: string;
  percent: number;
  tasks: AgentSubtask[];
}

interface AgentProgressCardProps {
  progress: AgentProgressState;
  elapsedSeconds: number;
  onStop: () => void;
  theme: "dark" | "light";
}

export const AgentProgressCard: React.FC<AgentProgressCardProps> = ({
  progress,
  elapsedSeconds,
  onStop,
  theme,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isDark = theme === "dark";

  return (
    <div
      className={`mb-3 rounded-2xl border shadow-xl overflow-hidden transition-all duration-200 animate-fade-in ${
        isDark
          ? "bg-[#1f1f1f]/95 border-rose-500/40 text-white backdrop-blur-md shadow-rose-950/20"
          : "bg-[#ffffff]/95 border-rose-500/40 text-[#1c1c1a] backdrop-blur-md shadow-rose-500/10 ring-1 ring-rose-500/10"
      }`}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`px-4 py-2.5 flex items-center justify-between cursor-pointer select-none transition ${
          isDark ? "bg-[#252525]/90 hover:bg-[#2c2c2c]" : "bg-[#f8f8f6] hover:bg-[#f1f1ec]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <button className="text-[var(--sb-text-muted)]">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <Bot size={15} className="text-rose-500 animate-pulse" />
            <span>Agent Execution Roadmap</span>
          </div>
          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30 font-mono font-medium">
            Step {progress.step} of {progress.maxSteps} • {progress.percent}%
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-[11px] text-[var(--sb-text-muted)] font-mono">
            <Clock size={12} className="text-rose-500" />
            <span>{elapsedSeconds.toFixed(1)}s</span>
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onStop();
            }}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 text-[10px] font-medium transition"
            title="Stop Agent Execution"
          >
            <Square size={9} className="fill-current" />
            <span>Stop</span>
          </button>
        </div>
      </div>

      {/* Main Progress Bar Fill */}
      <div className="w-full h-1.5 bg-[var(--sb-progress-track)] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-emerald-400 transition-all duration-300 ease-out shadow-sm"
          style={{ width: `${Math.max(5, Math.min(progress.percent, 100))}%` }}
        />
      </div>

      {/* Expandable Task Checklist (Roadmap) */}
      {isExpanded && (
        <div className="p-3.5 space-y-2 text-xs">
          {/* Active Status Banner */}
          <div className="flex items-center gap-2 font-medium text-[11px] text-rose-500 mb-2">
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span className="truncate">{progress.title}</span>
          </div>

          {/* Subtask Roadmap Items */}
          <div className="space-y-1.5">
            {progress.tasks.map((task, idx) => {
              const isCompleted = task.status === "completed";
              const isRunning = task.status === "running";
              const isPending = task.status === "pending";

              return (
                <div
                  key={task.id || idx}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition ${
                    isRunning
                      ? isDark
                        ? "bg-rose-500/10 border-rose-500/40 text-white font-medium"
                        : "bg-rose-500/10 border-rose-500/40 text-[#1c1c1a] font-medium"
                      : isCompleted
                      ? isDark
                        ? "bg-[#1a1a1a] border-[#2c2c2c] text-[#888888]"
                        : "bg-[#f4f4f0] border-[#e4e4dc] text-[#70706a]"
                      : isDark
                      ? "bg-[#171717] border-[#252525] text-[#555555]"
                      : "bg-[#fafaf8] border-[#ebebe5] text-[#a0a098]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isCompleted && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                    {isRunning && <Loader2 size={14} className="text-rose-500 animate-spin shrink-0" />}
                    {isPending && <Circle size={14} className="text-[var(--sb-text-muted)] opacity-50 shrink-0" />}

                    <span className={`text-[11px] ${isCompleted ? "line-through opacity-80" : ""}`}>
                      {task.title}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono capitalize px-1.5 py-0.2 rounded ${
                      isRunning
                        ? "bg-rose-500/20 text-rose-500"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "text-[var(--sb-text-muted)] opacity-70"
                    }`}
                  >
                    {isRunning ? "Running" : isCompleted ? "Done" : "Queued"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
