import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/**
 * Flagship Songbird Emblem
 * An aerodynamic, geometric avian crest crafted with precision SVG facets and radiant neon accents.
 */
export const SongbirdEmblem: React.FC<IconProps & { accent?: "neutral" | "rose" | "sky" | "emerald" | "amber" | "violet"; fillBox?: boolean }> = ({
  size = 24,
  className = "",
  glow = false,
  accent = "neutral",
  fillBox = false,
}) => {
  const glowColors = {
    neutral: "rgba(255, 255, 255, 0.25)",
    rose: "rgba(255, 255, 255, 0.25)",
    sky: "rgba(14, 165, 233, 0.45)",
    emerald: "rgba(16, 185, 129, 0.45)",
    amber: "rgba(245, 158, 11, 0.45)",
    violet: "rgba(139, 92, 246, 0.45)",
  }[accent];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${
        fillBox ? "w-full h-full" : ""
      } ${className}`}
      style={fillBox ? undefined : { width: size, height: size }}
    >
      {glow && (
        <span
          className="absolute -inset-0.5 rounded-full blur-[2px] opacity-60 pointer-events-none transition-all duration-300 animate-pulse"
          style={{ backgroundColor: glowColors }}
        />
      )}
      <img
        src="/songbird-logo.png"
        alt="Songbird Logo"
        className="w-full h-full object-cover select-none bg-white"
        draggable={false}
      />
    </div>
  );
};

/**
 * Neural Cognitive Core Icon (Deep Reasoning & Thought Accordion)
 */
export const NeuralCoreIcon: React.FC<IconProps> = ({ size = 18, className = "", glow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span className="absolute inset-0 rounded-full blur-sm bg-amber-500/50 animate-pulse pointer-events-none" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <line x1="12" y1="3" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="17.5" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="12" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="17.5" y1="12" x2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/**
 * Autonomous Agent Spark Icon (Multi-step Tool Execution & Planning)
 */
export const AgentSparkIcon: React.FC<IconProps> = ({ size = 18, className = "", glow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span className="absolute inset-0 rounded-full blur-sm bg-white/40 animate-pulse pointer-events-none" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <path
          d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </div>
  );
};

/**
 * Geometric MCP Server Hub Icon
 */
export const McpHubIcon: React.FC<IconProps & { accent?: "emerald" | "sky" | "violet" }> = ({
  size = 18,
  className = "",
  glow = false,
  accent = "emerald",
}) => {
  const glowColor = accent === "emerald" ? "rgba(16, 185, 129, 0.5)" : "rgba(14, 165, 233, 0.5)";
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          className="absolute inset-0 rounded-full blur-sm pointer-events-none animate-pulse"
          style={{ backgroundColor: glowColor }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <path
          d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeOpacity="0.8"
        />
        <path
          d="M12 7L16.33 9.5V14.5L12 17L7.67 14.5V9.5L12 7Z"
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
};

/**
 * Autonomous Tools & Diagnostics Icon
 */
export const ToolsWrenchIcon: React.FC<IconProps> = ({ size = 18, className = "", glow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span className="absolute inset-0 rounded-full blur-sm bg-white/40 pointer-events-none animate-pulse" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <path
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <circle cx="18" cy="6" r="1.2" fill="currentColor" />
      </svg>
    </div>
  );
};

/**
 * Skills & Capabilities Matrix Icon
 */
export const SkillsMatrixIcon: React.FC<IconProps> = ({ size = 18, className = "", glow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span className="absolute inset-0 rounded-full blur-sm bg-amber-500/50 pointer-events-none animate-pulse" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </div>
  );
};

/**
 * Kokoro Neural Voice Wave Icon
 */
export const VoiceWaveIcon: React.FC<IconProps> = ({ size = 18, className = "", glow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span className="absolute inset-0 rounded-full blur-sm bg-white/40 pointer-events-none animate-pulse" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <path d="M2 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/**
 * Settings Geometric Dial Icon
 */
export const SettingsDialIcon: React.FC<IconProps> = ({ size = 18, className = "", glow = false }) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span className="absolute inset-0 rounded-full blur-sm bg-stone-400/40 pointer-events-none animate-pulse" />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};

/**
 * Refined Orb Icon Badge Wrapper
 * Encapsulates any Lucide or Custom icon into a thinking-orbs pill frame with inset stroke and ambient aura.
 */
export const OrbIconBadge: React.FC<{
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "neutral" | "rose" | "emerald" | "amber" | "sky" | "indigo" | "violet";
  active?: boolean;
  glow?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({
  children,
  size = "md",
  variant = "neutral",
  active = false,
  glow = false,
  className = "",
  onClick,
}) => {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs p-1",
    md: "w-8 h-8 text-sm p-1.5",
    lg: "w-10 h-10 text-base p-2",
  }[size];

  const variantStyles = {
    neutral: active
      ? "bg-white/15 text-white border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.15)]"
      : "bg-white/[0.04] text-[var(--sb-text-secondary)] border-white/[0.08] hover:bg-white/[0.08] hover:text-[var(--sb-text-primary)]",
    rose: active
      ? "bg-white/15 text-white border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.15)]"
      : "bg-white/[0.04] text-[var(--sb-text-secondary)] border-white/[0.08] hover:bg-white/[0.08] hover:text-[var(--sb-text-primary)]",
    emerald: active
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
      : "bg-emerald-500/10 text-emerald-400/90 border-emerald-500/25 hover:bg-emerald-500/15 hover:text-emerald-300",
    amber: active
      ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
      : "bg-amber-500/10 text-amber-400/90 border-amber-500/25 hover:bg-amber-500/15 hover:text-amber-300",
    sky: active
      ? "bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-[0_0_16px_rgba(14,165,233,0.35)]"
      : "bg-sky-500/10 text-sky-400/90 border-sky-500/25 hover:bg-sky-500/15 hover:text-sky-300",
    indigo: active
      ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_16px_rgba(99,102,241,0.35)]"
      : "bg-indigo-500/10 text-indigo-400/90 border-indigo-500/25 hover:bg-indigo-500/15 hover:text-indigo-300",
    violet: active
      ? "bg-violet-500/20 text-violet-400 border-violet-500/50 shadow-[0_0_16px_rgba(139,92,246,0.35)]"
      : "bg-violet-500/10 text-violet-400/90 border-violet-500/25 hover:bg-violet-500/15 hover:text-violet-300",
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`orb-pill inline-flex items-center justify-center shrink-0 border transition-all duration-200 ${sizeClasses} ${variantStyles} ${
        glow ? "ring-1 ring-white/20" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
