import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";

interface ThoughtAccordionProps {
  thought: string;
  isThinking?: boolean;
}

export const ThoughtAccordion: React.FC<ThoughtAccordionProps> = ({ thought, isThinking }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!thought && !isThinking) return null;

  return (
    <div className="mb-4 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-code-bg)] overflow-hidden text-xs md:text-sm shadow-sm transition">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--sb-code-header)] hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] font-medium transition select-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={`text-rose-500 ${isThinking ? "animate-spin" : ""}`} />
          <span className="text-xs font-semibold tracking-wide text-[var(--sb-text-primary)]">
            {isThinking ? "Thinking Process..." : "Reasoning Process"}
          </span>
          {isThinking && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 font-mono">
              In progress
            </span>
          )}
        </div>
        <div className="text-[var(--sb-text-muted)]">
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3.5 text-[var(--sb-text-secondary)] font-mono text-xs whitespace-pre-wrap leading-relaxed border-t border-[var(--sb-border)] max-h-60 overflow-y-auto bg-[var(--sb-code-bg)]">
          {thought || (isThinking ? "Analyzing problem structure and context..." : "")}
        </div>
      )}
    </div>
  );
};
