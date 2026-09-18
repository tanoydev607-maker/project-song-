import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, CheckCircle2 } from "lucide-react";
import { NeuralCoreIcon, OrbIconBadge } from "./SongbirdIcons";

interface ThoughtAccordionProps {
  thought: string;
  isThinking?: boolean;
}

export const ThoughtAccordion: React.FC<ThoughtAccordionProps> = ({ thought, isThinking }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  if (!thought && !isThinking) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!thought) return;
    await navigator.clipboard.writeText(thought);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={`mb-4 rounded-2xl border transition-all duration-300 overflow-hidden text-xs md:text-sm shadow-sm ${
        isThinking
          ? "border-amber-500/40 bg-[var(--pill-fill)] shadow-[var(--pill-stroke)] ring-1 ring-amber-500/25"
          : "border-[var(--sb-border)] bg-[var(--pill-fill)] shadow-[var(--pill-stroke)]"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.05] transition select-none cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <OrbIconBadge
            size="sm"
            variant={isThinking ? "amber" : "emerald"}
            active={isThinking}
            glow={isThinking}
          >
            <NeuralCoreIcon size={14} glow={isThinking} />
          </OrbIconBadge>

          <div className="flex items-center gap-2 min-w-0">
            {isThinking ? (
              <span
                className="t-shimmer text-xs font-semibold tracking-wide"
                data-text="Reasoning & Cognitive Pathways…"
              >
                Reasoning & Cognitive Pathways…
              </span>
            ) : (
              <span className="text-xs font-semibold tracking-wide text-[var(--sb-text-primary)]">
                Reasoning Process
              </span>
            )}

            {isThinking ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono flex items-center gap-1 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Solving…</span>
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono flex items-center gap-1 border border-emerald-500/30">
                <CheckCircle2 size={10} />
                <span>Solved</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[var(--sb-text-muted)]">
          {thought && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-lg hover:text-[var(--sb-text-primary)] hover:bg-white/10 transition"
              title="Copy reasoning trace"
            >
              {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          )}
          <div>
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 text-[var(--sb-text-secondary)] font-mono text-xs whitespace-pre-wrap leading-relaxed border-t border-[var(--sb-border)] max-h-72 overflow-y-auto bg-black/20">
          {thought || (isThinking ? "Scrambling cognitive solution bands & evaluating multi-step logic pathways..." : "")}
        </div>
      )}
    </div>
  );
};
