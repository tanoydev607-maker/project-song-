import React, { useState, useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import {
  X,
  Play,
  Save,
  RotateCw,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  Terminal,
  Plus,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  Check,
  AlertCircle,
  Code2,
  PanelLeftClose,
  PanelLeft,
  Columns,
  ExternalLink,
} from "lucide-react";

export interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileTreeNode[];
}

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface CodeEditorPanelProps {
  theme: "dark" | "light";
  isOpen: boolean;
  onClose?: () => void;
  onPopOut?: () => void;
  ws: WebSocket | null;
  onSendToChat?: (prompt: string) => void;
  externalOpenFile?: { path: string; content?: string; language?: string } | null;
  onExternalFileOpened?: () => void;
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "py":
      return "python";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "rs":
      return "rust";
    case "cpp":
    case "c":
    case "h":
      return "cpp";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "bash":
      return "shell";
    case "bat":
    case "ps1":
      return "powershell";
    default:
      return "plaintext";
  }
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  theme,
  isOpen,
  onClose,
  onPopOut,
  ws,
  onSendToChat,
  externalOpenFile,
  onExternalFileOpened,
}) => {
  const isDark = theme === "dark";

  // State
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [tabs, setTabs] = useState<EditorTab[]>([
    {
      path: "scratch.py",
      name: "scratch.py",
      content: `# Songbird Beta Code Studio\n# Press ▶ Run (top-right) to execute code directly on your machine\n\ndef solve():\n    print("Hello from Songbird Studio!")\n    numbers = [x**2 for x in range(1, 11)]\n    print("Squares:", numbers)\n\nif __name__ == "__main__":\n    solve()\n`,
      language: "python",
      isDirty: false,
    },
  ]);
  const [activeTabPath, setActiveTabPath] = useState<string>("scratch.py");
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(true);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [consoleHeight, setConsoleHeight] = useState<number>(180);
  const [showMinimap, setShowMinimap] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ path: string; status: "saving" | "saved" | "error" } | null>(null);

  // Execution Terminal State
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<{ text: string; isError?: boolean }[]>([]);
  const [lastExecutionStats, setLastExecutionStats] = useState<{ exitCode: number; durationMs: number } | null>(null);

  const activeTab = tabs.find((t) => t.path === activeTabPath) || tabs[0];
  const editorRef = useRef<any>(null);

  // Load File Tree from Daemon
  const refreshFileTree = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "editor_list_files" }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshFileTree();
    }
  }, [isOpen]);

  // Handle WebSocket messages for Editor
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "editor_list_files_result") {
          if (Array.isArray(data.tree)) {
            setFileTree(data.tree);
          }
        } else if (data.type === "editor_read_file_result") {
          if (data.success) {
            const path = data.file_path;
            const name = path.split("/").pop() || path;
            const language = detectLanguage(name);

            setTabs((prev) => {
              const existingIdx = prev.findIndex((t) => t.path === path);
              if (existingIdx !== -1) {
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  content: data.content,
                  isDirty: false,
                };
                return updated;
              } else {
                return [
                  ...prev,
                  {
                    path,
                    name,
                    content: data.content,
                    language,
                    isDirty: false,
                  },
                ];
              }
            });
            setActiveTabPath(path);
          }
        } else if (data.type === "editor_save_file_result") {
          if (data.success) {
            setTabs((prev) =>
              prev.map((t) => (t.path === data.file_path ? { ...t, isDirty: false } : t))
            );
            setSaveStatus({ path: data.file_path, status: "saved" });
            setTimeout(() => setSaveStatus(null), 2500);
            refreshFileTree();
          } else {
            setSaveStatus({ path: data.file_path, status: "error" });
            setTimeout(() => setSaveStatus(null), 3500);
          }
        } else if (data.type === "editor_create_file_result") {
          if (data.success) {
            refreshFileTree();
            if (!data.is_dir) {
              openFile(data.file_path);
            }
          }
        } else if (data.type === "editor_agent_sync") {
          const path = data.file_path;
          const name = path.split("/").pop() || path;
          const language = data.language || detectLanguage(name);
          const content = data.content ?? "";

          setTabs((prev) => {
            const existingIdx = prev.findIndex((t) => t.path === path);
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                content,
                isDirty: false,
              };
              return updated;
            } else {
              return [
                ...prev,
                {
                  path,
                  name,
                  content,
                  language,
                  isDirty: false,
                },
              ];
            }
          });
          setActiveTabPath(path);
          refreshFileTree();
        } else if (data.type === "editor_run_output") {
          setIsConsoleOpen(true);
          setIsRunningCode(true);
          setTerminalOutput((prev) => [
            ...prev,
            { text: data.text, isError: data.stream === "stderr" },
          ]);
        } else if (data.type === "editor_run_done") {
          setIsRunningCode(false);
          setLastExecutionStats({
            exitCode: data.exit_code,
            durationMs: data.duration_ms,
          });
        }
      } catch {
        // Ignore non-json or unrelated messages
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  }, [ws]);

  // Handle external open file request (e.g. from chat code block)
  useEffect(() => {
    if (externalOpenFile) {
      const { path, content, language } = externalOpenFile;
      const name = path.split("/").pop() || path;
      const lang = language || detectLanguage(name);

      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path);
        if (idx !== -1) {
          if (content !== undefined) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content, isDirty: false };
            return updated;
          }
          return prev;
        }
        return [
          ...prev,
          {
            path,
            name,
            content: content || "",
            language: lang,
            isDirty: false,
          },
        ];
      });
      setActiveTabPath(path);
      if (onExternalFileOpened) {
        onExternalFileOpened();
      }
    }
  }, [externalOpenFile]);

  // Open file from tree
  const openFile = (filePath: string) => {
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "editor_read_file", file_path: filePath }));
    }
  };

  // Save active file
  const handleSave = () => {
    if (!activeTab || !ws || ws.readyState !== WebSocket.OPEN) return;
    setSaveStatus({ path: activeTab.path, status: "saving" });
    ws.send(
      JSON.stringify({
        action: "editor_save_file",
        file_path: activeTab.path,
        content: activeTab.content,
      })
    );
  };

  // Run active code
  const handleRun = () => {
    if (!activeTab || !ws || ws.readyState !== WebSocket.OPEN) return;
    setIsRunningCode(true);
    setIsConsoleOpen(true);
    setTerminalOutput([
      { text: `[Running ${activeTab.name} on Hermes Engine...]\n` },
    ]);
    setLastExecutionStats(null);

    ws.send(
      JSON.stringify({
        action: "editor_run_code",
        code: activeTab.content,
        language: activeTab.language,
        file_path: activeTab.path,
      })
    );
  };

  // Ask Songbird about code
  const handleAskSongbird = () => {
    if (!activeTab || !onSendToChat) return;
    const prompt = `Here is the code from \`${activeTab.name}\`:\n\n\`\`\`${activeTab.language}\n${activeTab.content}\n\`\`\`\n\nPlease review this code, explain how it works, and suggest any optimizations or improvements.`;
    onSendToChat(prompt);
  };

  // Close a tab
  const closeTab = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newTabs = tabs.filter((t) => t.path !== path);
    if (newTabs.length === 0) {
      const defaultTab: EditorTab = {
        path: "scratch.py",
        name: "scratch.py",
        content: "# New Scratch file\nprint('Hello world!')\n",
        language: "python",
        isDirty: false,
      };
      setTabs([defaultTab]);
      setActiveTabPath("scratch.py");
    } else {
      setTabs(newTabs);
      if (activeTabPath === path) {
        setActiveTabPath(newTabs[newTabs.length - 1].path);
      }
    }
  };

  // Create new file
  const handleCreateFile = () => {
    const filename = prompt("Enter new filename or path (e.g. script.py, src/app.ts):");
    if (!filename || !filename.trim()) return;
    const cleanPath = filename.trim().replace(/^\/+/, "");
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: "editor_create_file",
          file_path: cleanPath,
          is_dir: false,
        })
      );
    }
  };

  // Handle Editor Mount
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Render Tree recursively
  const renderTreeNodes = (nodes: FileTreeNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      if (node.is_dir) {
        return (
          <div key={node.path} className="select-none text-xs">
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded-md transition hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)]`}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {isExpanded ? <FolderOpen size={14} className="text-amber-500" /> : <Folder size={14} className="text-amber-500" />}
              <span className="font-medium truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderTreeNodes(node.children, level + 1)}</div>
            )}
          </div>
        );
      }

      const isCurrent = activeTabPath === node.path;
      return (
        <div
          key={node.path}
          onClick={() => openFile(node.path)}
          style={{ paddingLeft: `${level * 12 + 22}px` }}
          className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer text-xs rounded-md transition select-none ${
            isCurrent
              ? "bg-white/10 text-[var(--sb-text-primary)] font-medium"
              : "text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)]"
          }`}
          title={node.path}
        >
          <FileCode size={13} className={isCurrent ? "text-[var(--sb-text-primary)]" : "text-[var(--sb-text-muted)]"} />
          <span className="truncate">{node.name}</span>
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={`h-full flex flex-col border-l z-20 overflow-hidden transition-all duration-200 ${
        isDark ? "bg-[#181818] border-[#2c2c2c]" : "bg-[#fbfbf9] border-[#e0e0d8]"
      }`}
    >
      {/* ==================== EDITOR TOP TOOLBAR ==================== */}
      <div
        className={`h-11 px-3 border-b flex items-center justify-between shrink-0 select-none text-xs ${
          isDark ? "bg-[#141414] border-[#282828]" : "bg-[#f2f2ee] border-[#dfdfd6]"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFileTreeOpen(!isFileTreeOpen)}
            className={`p-1.5 rounded-lg transition ${
              isFileTreeOpen
                ? "bg-white/10 text-[var(--sb-text-primary)]"
                : "text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover-bg)] hover:text-[var(--sb-text-primary)]"
            }`}
            title={isFileTreeOpen ? "Hide File Explorer" : "Show File Explorer"}
          >
            {isFileTreeOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>

          <div className="flex items-center gap-1.5 font-bold tracking-tight text-sm">
            <Code2 size={16} className="text-[var(--sb-text-primary)]" />
            <span>Code Studio</span>
          </div>

          {saveStatus && (
            <div className="ml-2 flex items-center gap-1 text-[11px] animate-fade-in font-medium">
              {saveStatus.status === "saving" && <span className="text-amber-500">Saving...</span>}
              {saveStatus.status === "saved" && (
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <Check size={12} /> Saved
                </span>
              )}
              {saveStatus.status === "error" && (
                <span className="text-red-400 flex items-center gap-0.5">
                  <AlertCircle size={12} /> Save failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRun}
            disabled={isRunningCode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm transition ${
              isRunningCode
                ? "bg-amber-600/50 text-white cursor-wait"
                : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95"
            }`}
            title="Execute current script (Python / Node / Shell)"
          >
            <Play size={12} className={isRunningCode ? "animate-spin" : "fill-current"} />
            <span>{isRunningCode ? "Running..." : "Run"}</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
              activeTab?.isDirty
                ? "bg-white/15 border-white/30 text-[var(--sb-text-primary)] hover:bg-white/20"
                : "border-[var(--sb-border)] hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-primary)]"
            }`}
            title="Save file (Ctrl+S)"
          >
            <Save size={13} />
            <span>Save</span>
          </button>

          <button
            onClick={handleAskSongbird}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--sb-border)] hover:bg-white/10 hover:border-white/20 text-[var(--sb-text-primary)] text-xs font-medium transition"
            title="Ask Songbird to explain, refactor, or optimize this code"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">Ask Songbird</span>
          </button>

          <div className="h-4 w-[1px] bg-[var(--sb-border)] mx-0.5" />

          <button
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className={`p-1.5 rounded-lg border transition ${
              isConsoleOpen
                ? "bg-white/15 border-white/20 text-[var(--sb-text-primary)]"
                : "border-[var(--sb-border)] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover-bg)]"
            }`}
            title={isConsoleOpen ? "Hide Terminal Console" : "Show Terminal Console"}
          >
            <Terminal size={14} />
          </button>

          {onPopOut && (
            <button
              onClick={onPopOut}
              className="p-1.5 rounded-lg border border-transparent text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-white/5 transition"
              title="Pop out Code Studio into new window"
            >
              <ExternalLink size={14} />
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-transparent text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-white/5 transition"
              title="Close Code Studio"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ==================== EDITOR BODY (TABS + WORKSPACE) ==================== */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sub-Sidebar: Workspace File Tree */}
        {isFileTreeOpen && (
          <div
            className={`w-52 border-r flex flex-col shrink-0 overflow-hidden ${
              isDark ? "bg-[#161616] border-[#252525]" : "bg-[#f5f5f1] border-[#dfdfd7]"
            }`}
          >
            <div className="p-2 border-b border-[var(--sb-border)] flex items-center justify-between text-xs text-[var(--sb-text-secondary)]">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--sb-text-muted)]">
                Files
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCreateFile}
                  className="p-1 rounded hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] transition"
                  title="New File"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={refreshFileTree}
                  className="p-1 rounded hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] transition"
                  title="Refresh File Tree"
                >
                  <RotateCw size={13} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {fileTree.length > 0 ? (
                renderTreeNodes(fileTree)
              ) : (
                <div className="p-3 text-center text-xs text-[var(--sb-text-muted)]">
                  Loading files...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center: Tabs + Monaco Editor Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* File Tabs Bar */}
          <div
            className={`h-9 border-b flex items-center px-1 overflow-x-auto select-none shrink-0 ${
              isDark ? "bg-[#141414] border-[#252525]" : "bg-[#efefe9] border-[#deded6]"
            }`}
          >
            {tabs.map((tab) => {
              const isActive = tab.path === activeTabPath;
              return (
                <div
                  key={tab.path}
                  onClick={() => setActiveTabPath(tab.path)}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md cursor-pointer border-t-2 transition max-w-[170px] ${
                    isActive
                      ? isDark
                        ? "bg-[#1e1e1e] border-white text-white font-medium"
                        : "bg-[#ffffff] border-black text-[#1a1a18] font-medium"
                      : "border-transparent text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)]"
                  }`}
                  title={tab.path}
                >
                  <span className="truncate">{tab.name}</span>
                  {tab.isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                  )}
                  <button
                    onClick={(e) => closeTab(tab.path, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-[var(--sb-text-primary)] p-0.5 rounded transition"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab ? (
              <Editor
                height="100%"
                path={activeTab.path}
                language={activeTab.language}
                value={activeTab.content}
                theme={isDark ? "vs-dark" : "vs"}
                onMount={handleEditorMount}
                onChange={(val) => {
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.path === activeTabPath
                        ? { ...t, content: val || "", isDirty: true }
                        : t
                    )
                  );
                }}
                options={{
                  minimap: { enabled: showMinimap },
                  fontSize: 13,
                  lineNumbers: "on",
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                  tabSize: 2,
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--sb-text-muted)]">
                No active file. Choose a file from the explorer on the left.
              </div>
            )}
          </div>

          {/* ==================== BOTTOM EXECUTION TERMINAL ==================== */}
          {isConsoleOpen && (
            <div
              style={{ height: `${consoleHeight}px` }}
              className={`border-t flex flex-col shrink-0 select-none overflow-hidden ${
                isDark ? "bg-[#111111] border-[#292929]" : "bg-[#f0f0eb] border-[#d8d8d0]"
              }`}
            >
              {/* Terminal Header */}
              <div className="h-7 px-3 border-b border-[var(--sb-border)] flex items-center justify-between text-[11px] text-[var(--sb-text-secondary)] shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal size={12} className="text-[var(--sb-text-primary)]" />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Output Terminal
                  </span>
                  {lastExecutionStats && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                        lastExecutionStats.exitCode === 0
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      Exit: {lastExecutionStats.exitCode} ({lastExecutionStats.durationMs}ms)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTerminalOutput([])}
                    className="p-1 rounded hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] transition"
                    title="Clear Output"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={() => setIsConsoleOpen(false)}
                    className="p-1 rounded hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] transition"
                    title="Close Terminal"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Terminal Content Stream */}
              <pre className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-relaxed select-text space-y-0.5">
                {terminalOutput.length > 0 ? (
                  terminalOutput.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.isError
                          ? "text-red-400 whitespace-pre-wrap"
                          : isDark
                          ? "text-[#e0e0e0] whitespace-pre-wrap"
                          : "text-[#222222] whitespace-pre-wrap"
                      }
                    >
                      {line.text}
                    </div>
                  ))
                ) : (
                  <div className="text-[var(--sb-text-muted)] italic">
                    Press ▶ Run to execute current script on your machine...
                  </div>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
