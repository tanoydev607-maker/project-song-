import React, { useState } from "react";
import { CheckCircle2, Clock, Circle, ChevronDown, ChevronRight, Square, AlertCircle, Sparkles } from "lucide-react";
import { AgentSparkIcon, OrbIconBadge } from "./SongbirdIcons";

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
          ? "bg-[#1f1f1f]/95 border-white/15 text-white backdrop-blur-md shadow-black/40"
          : "bg-[#ffffff]/95 border-black/15 text-[#1c1c1a] backdrop-blur-md shadow-black/5"
      }`}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`px-4 py-2.5 flex items-center justify-between cursor-pointer select-none transition ${
          isDark ? "bg-[#252525]/90 hover:bg-[#2c2c2c]" : "bg-[#f8f8f6] hover:bg-[#f1f1ec]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button className="text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)]">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className="flex items-center gap-2 font-semibold text-xs min-w-0">
            <OrbIconBadge size="sm" variant="neutral" active={true} glow={true}>
              <AgentSparkIcon size={14} glow={true} />
            </OrbIconBadge>
            <span className="truncate">Hermes Agent Roadmap</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--sb-text-secondary)] border border-white/15 font-mono font-medium shrink-0">
            Step {progress.step} of {progress.maxSteps} ({progress.percent}%)
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-[var(--sb-text-muted)] font-mono">
            <Clock size={12} className="text-[var(--sb-text-muted)]" />
            <span>{elapsedSeconds.toFixed(1)}s</span>
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStop();
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition cursor-pointer"
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
          className="h-full bg-gradient-to-r from-zinc-500 via-zinc-300 to-white transition-all duration-300 ease-out shadow-sm"
          style={{ width: `${Math.max(5, Math.min(progress.percent, 100))}%` }}
        />
      </div>

      {/* Expandable Task Checklist (Roadmap) */}
      {isExpanded && (
        <div className="p-3.5 space-y-2 text-xs">
          {/* Active Status Banner */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[var(--sb-text-primary)] text-[11px] font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <OrbIconBadge size="sm" variant="neutral" active={true} glow={true}>
                <AgentSparkIcon size={12} glow={true} />
              </OrbIconBadge>
              <span className="truncate">{progress.title}</span>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/10 text-[var(--sb-text-secondary)] shrink-0">
              Active Step
            </span>
          </div>

          {/* Subtask Roadmap Items */}
          <div className="space-y-1.5 pt-1">
            {progress.tasks.map((task, idx) => {
              const isCompleted = task.status === "completed";
              const isRunning = task.status === "running";
              const isError = task.status === "error";
              const isPending = task.status === "pending";

              return (
                <div
                  key={task.id || idx}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition ${
                    isRunning
                      ? isDark
                        ? "bg-white/10 border-white/25 text-white font-medium shadow-sm"
                        : "bg-black/5 border-black/20 text-[#1c1c1a] font-medium shadow-sm"
                      : isCompleted
                      ? isDark
                        ? "bg-[#1a1a1a] border-[#2c2c2c] text-[#888888]"
                        : "bg-[#f4f4f0] border-[#e4e4dc] text-[#70706a]"
                      : isError
                      ? isDark
                        ? "bg-red-950/20 border-red-800/40 text-red-400"
                        : "bg-red-50 border-red-300 text-red-700"
                      : isDark
                      ? "bg-[#171717] border-[#252525] text-[#555555]"
                      : "bg-[#fafaf8] border-[#ebebe5] text-[#a0a098]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isCompleted && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                    {isRunning && (
                      <OrbIconBadge size="sm" variant="neutral" active={true} glow={true}>
                        <Sparkles size={11} className="text-white animate-spin" />
                      </OrbIconBadge>
                    )}
                    {isError && <AlertCircle size={16} className="text-red-400 shrink-0" />}
                    {isPending && <Circle size={15} className="text-[var(--sb-text-muted)] opacity-50 shrink-0" />}

                    <span className={`text-[11px] truncate ${isCompleted ? "line-through opacity-80" : ""}`}>
                      {task.title}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono capitalize px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      isRunning
                        ? "bg-white/15 text-white font-semibold"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-500 font-medium"
                        : isError
                        ? "bg-red-500/20 text-red-400"
                        : "text-[var(--sb-text-muted)] opacity-70"
                    }`}
                  >
                    {isRunning ? "Running" : isCompleted ? "Done" : isError ? "Failed" : "Queued"}
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
