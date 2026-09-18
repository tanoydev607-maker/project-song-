import React, { useState } from "react";
import { X, Sparkles, Plus, Trash2, Edit2, Check, Search, Wrench, Shield, Code, Cpu, Database, Globe, Palette, Terminal, BookOpen } from "lucide-react";
import { OrbIconBadge, SkillsMatrixIcon } from "./SongbirdIcons";

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  category: "Development" | "Data & Analysis" | "Security" | "Automation" | "Research" | "Design" | "Custom";
  icon: string;
  instructions: string;
  enabled: boolean;
  isCustom?: boolean;
}

export const DEFAULT_SKILLS: AgentSkill[] = [
  {
    id: "skill_software_architect",
    name: "Senior Software Architect",
    description: "Enforces clean architecture, SOLID principles, robust TypeScript typing, and defensive design.",
    category: "Development",
    icon: "Code",
    instructions: "Apply senior software engineering standards. Write modular, highly maintainable, and type-safe code. Provide architectural rationale, trade-offs, and clear directory organization.",
    enabled: true,
  },
  {
    id: "skill_python_math",
    name: "Python & Data Science",
    description: "Specializes in high-performance Python scripts, mathematical modeling, and data pipelines.",
    category: "Data & Analysis",
    icon: "Database",
    instructions: "When writing Python, prioritize performance, clean idiomatic code, vectorization, and structured error handling. Execute scripts autonomously using the Python execution tool when in agent mode.",
    enabled: true,
  },
  {
    id: "skill_security_audit",
    name: "Security & Vulnerability Auditor",
    description: "Detects security risks, API key leaks, injection flaws, and unsafe shell commands.",
    category: "Security",
    icon: "Shield",
    instructions: "Inspect code for common vulnerabilities (OWASP top 10, command injection, path traversal, hardcoded secrets). Proactively recommend secure alternatives and sanitization.",
    enabled: false,
  },
  {
    id: "skill_devops_automation",
    name: "Terminal & DevOps Automation",
    description: "Automates shell tasks, package scripts, PowerShell diagnostics, and workflow setups.",
    category: "Automation",
    icon: "Terminal",
    instructions: "Leverage terminal commands safely. Write robust cross-platform shell commands (PowerShell for Windows, Bash for Linux/macOS) with output validation and cleanup.",
    enabled: true,
  },
  {
    id: "skill_web_research",
    name: "Deep Web Researcher",
    description: "Conducts structured technical research, fact-checking, and literature synthesis.",
    category: "Research",
    icon: "Globe",
    instructions: "Structure research findings with executive summaries, key takeaways, source citations, and comparison matrices. Use web search tools to gather up-to-date documentation.",
    enabled: false,
  },
  {
    id: "skill_ui_design",
    name: "UI/UX & Frontend Specialist",
    description: "Crafts state-of-the-art web interfaces with modern aesthetics, animations, and typography.",
    category: "Design",
    icon: "Palette",
    instructions: "Design stunning, accessible interfaces with rich color harmony, smooth transitions, responsive layouts, and thoughtful micro-interactions. Avoid bland or default styling.",
    enabled: true,
  },
];

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: AgentSkill[];
  setSkills: React.Dispatch<React.SetStateAction<AgentSkill[]>>;
  theme: "dark" | "light";
}

export const SkillsModal: React.FC<SkillsModalProps> = ({
  isOpen,
  onClose,
  skills,
  setSkills,
  theme,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [isCreating, setIsCreating] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // Form State for New / Edited Custom Skill
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState<AgentSkill["category"]>("Custom");
  const [formInstructions, setFormInstructions] = useState("");

  if (!isOpen) return null;

  const isDark = theme === "dark";

  const getSkillIcon = (iconName: string) => {
    switch (iconName) {
      case "Code":
        return <Code size={16} className="text-emerald-500" />;
      case "Database":
        return <Database size={16} className="text-blue-500" />;
      case "Shield":
        return <Shield size={16} className="text-zinc-400" />;
      case "Terminal":
        return <Terminal size={16} className="text-amber-500" />;
      case "Globe":
        return <Globe size={16} className="text-cyan-500" />;
      case "Palette":
        return <Palette size={16} className="text-purple-500" />;
      default:
        return <Wrench size={16} className="text-zinc-400" />;
    }
  };

  const handleToggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleDeleteSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const handleStartCreate = () => {
    setEditingSkillId(null);
    setFormName("");
    setFormDesc("");
    setFormCategory("Custom");
    setFormInstructions("");
    setIsCreating(true);
  };

  const handleStartEdit = (skill: AgentSkill) => {
    setEditingSkillId(skill.id);
    setFormName(skill.name);
    setFormDesc(skill.description);
    setFormCategory(skill.category);
    setFormInstructions(skill.instructions);
    setIsCreating(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formInstructions.trim()) return;

    if (editingSkillId) {
      setSkills((prev) =>
        prev.map((s) =>
          s.id === editingSkillId
            ? {
                ...s,
                name: formName.trim(),
                description: formDesc.trim(),
                category: formCategory,
                instructions: formInstructions.trim(),
              }
            : s
        )
      );
    } else {
      const newSkill: AgentSkill = {
        id: "skill_custom_" + Date.now(),
        name: formName.trim(),
        description: formDesc.trim() || "Custom user skill",
        category: formCategory,
        icon: "Wrench",
        instructions: formInstructions.trim(),
        enabled: true,
        isCustom: true,
      };
      setSkills((prev) => [newSkill, ...prev]);
    }

    setIsCreating(false);
    setEditingSkillId(null);
  };

  const categories = ["All", "Development", "Data & Analysis", "Security", "Automation", "Research", "Design", "Custom"];

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.instructions.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const activeCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div
        className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border transition orb-modal-glass ${
          isDark ? "border-white/[0.08] text-[#ececec]" : "border-black/[0.08] text-[#1c1c1a]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] transition">
          <div className="flex items-center gap-3 font-semibold text-sm">
            <OrbIconBadge size="md" variant="amber" glow={true}>
              <SkillsMatrixIcon size={18} glow={true} />
            </OrbIconBadge>
            <span className="t-shimmer" data-text="Agent Skills & Custom Capabilities">
              Agent Skills & Custom Capabilities
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
              {activeCount} Active
            </span>
          </div>
          <button
            onClick={onClose}
            className="orb-chip p-2 text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className={`p-4 border-b space-y-3 ${isDark ? "border-[#282828] bg-[#1a1a1a]" : "border-[#eeeeea] bg-[#fafaf8]"}`}>
          <div className="flex items-center gap-2">
            <div
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                isDark ? "bg-[#242424] border-[#333333] text-[#888888]" : "bg-[#ffffff] border-[#d8d8d0] text-[#70706a]"
              }`}
            >
              <Search size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills, triggers, and instructions..."
                className={`w-full bg-transparent text-xs placeholder-[#888888] focus:outline-none ${
                  isDark ? "text-white" : "text-[#1c1c1a]"
                }`}
              />
            </div>

            <button
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 font-medium text-xs transition shadow-sm shrink-0"
            >
              <Plus size={14} />
              <span>Create Custom Skill</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                  activeCategory === cat
                    ? "bg-white/10 text-white border border-white/20"
                    : isDark
                    ? "text-[#888888] hover:text-white hover:bg-[#262626]"
                    : "text-[#70706a] hover:text-black hover:bg-[#eaeae4]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: List or Form */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {isCreating ? (
            /* ==================== CREATE / EDIT SKILL FORM ==================== */
            <form onSubmit={handleSaveForm} className="space-y-4 p-4 rounded-xl border border-white/20 bg-white/5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-1.5 text-white">
                  <Sparkles size={15} />
                  <span>{editingSkillId ? "Edit Custom Skill" : "Define New Custom Skill"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-[var(--sb-text-muted)] hover:underline"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block font-medium mb-1 text-[var(--sb-text-secondary)]">Skill Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Rust Microservice Architect, Rust Code Reviewer"
                  required
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/40 ${
                    isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-white border-[#d8d8d0] text-[#1c1c1a]"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-[var(--sb-text-secondary)]">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as AgentSkill["category"])}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/40 cursor-pointer ${
                      isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-white border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  >
                    <option value="Custom">Custom</option>
                    <option value="Development">Development</option>
                    <option value="Data & Analysis">Data & Analysis</option>
                    <option value="Security">Security</option>
                    <option value="Automation">Automation</option>
                    <option value="Research">Research</option>
                    <option value="Design">Design</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-[var(--sb-text-secondary)]">Brief Description</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Short description of what this skill does"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/40 ${
                      isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-white border-[#d8d8d0] text-[#1c1c1a]"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 text-[var(--sb-text-secondary)]">
                  Skill Instructions / System Directive
                </label>
                <textarea
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  rows={4}
                  required
                  placeholder="Describe in detail how the agent should think, what rules it should follow, domain knowledge to use, or output formats to produce..."
                  className={`w-full border rounded-xl p-3 text-xs font-mono resize-none focus:outline-none focus:border-white/40 leading-relaxed ${
                    isDark ? "bg-[#262626] border-[#383838] text-white" : "bg-white border-[#d8d8d0] text-[#1c1c1a]"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium transition ${
                    isDark ? "border-[#3a3a3a] hover:bg-[#282828]" : "border-[#d8d8d0] hover:bg-[#ecece6]"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-medium text-xs transition shadow-sm"
                >
                  <Check size={14} />
                  <span>{editingSkillId ? "Save Changes" : "Create Skill"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* ==================== SKILLS LIST ==================== */
            <div className="grid grid-cols-1 gap-2.5">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  className={`p-3.5 rounded-2xl border transition shadow-sm flex items-start justify-between gap-3 ${
                    skill.enabled
                      ? isDark
                        ? "bg-[#232323] border-white/30"
                        : "bg-[#ffffff] border-black/20"
                      : isDark
                      ? "bg-[#1f1f1f] border-[#2e2e2e] opacity-75 hover:opacity-100"
                      : "bg-[#fafaf8] border-[#e2e2dc] opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                        skill.enabled
                          ? "bg-white/10 border-white/20 text-white"
                          : isDark
                          ? "bg-[#282828] border-[#383838]"
                          : "bg-[#ecece6] border-[#d8d8d0]"
                      }`}
                    >
                      {getSkillIcon(skill.icon)}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[var(--sb-text-primary)]">{skill.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-medium ${
                            isDark
                              ? "bg-[#181818] border-[#333333] text-[#888888]"
                              : "bg-[#f0f0ea] border-[#dcdcd4] text-[#666660]"
                          }`}
                        >
                          {skill.category}
                        </span>
                        {skill.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Custom
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[var(--sb-text-secondary)] leading-relaxed">
                        {skill.description}
                      </p>

                      <div className="pt-1">
                        <div
                          className={`p-2 rounded-lg font-mono text-[10px] leading-relaxed border line-clamp-2 ${
                            isDark ? "bg-[#171717] border-[#282828] text-[#a0a0a0]" : "bg-[#f4f4f0] border-[#e2e2dc] text-[#666660]"
                          }`}
                          title={skill.instructions}
                        >
                          <strong>Directives:</strong> {skill.instructions}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions & Toggle */}
                  <div className="flex flex-col items-end gap-2.5 shrink-0">
                    <button
                      onClick={() => handleToggleSkill(skill.id)}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer flex items-center ${
                        skill.enabled ? "bg-white justify-end" : isDark ? "bg-[#333333] justify-start" : "bg-[#d0d0c8] justify-start"
                      }`}
                      title={skill.enabled ? "Disable Skill" : "Enable Skill"}
                    >
                      <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition" />
                    </button>

                    {skill.isCustom && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(skill)}
                          className="p-1 rounded text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition"
                          title="Edit Custom Skill"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="p-1 rounded text-[var(--sb-text-muted)] hover:text-red-400 hover:bg-[var(--sb-hover-bg)] transition"
                          title="Delete Custom Skill"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredSkills.length === 0 && (
                <div className="text-center py-8 space-y-2 text-[var(--sb-text-muted)]">
                  <Sparkles size={24} className="mx-auto text-zinc-500" />
                  <p>No skills found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between transition ${
            isDark ? "bg-[#171717] border-[#2b2b2b]" : "bg-[#f7f7f5] border-[#e8e8e2]"
          }`}
        >
          <span className="text-[11px] text-[var(--sb-text-muted)]">
            Active skills are automatically injected into the Hermes Agent prompt.
          </span>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-zinc-200 font-medium rounded-xl text-xs transition shadow-sm"
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
