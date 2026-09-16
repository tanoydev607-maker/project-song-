import React, { useState } from "react";
import { Check, Copy, Code } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isStreaming }) => {
  return (
    <div className={`space-y-3.5 leading-relaxed text-sm md:text-[15px] font-normal tracking-normal ${isStreaming ? "chat-streaming-cursor" : ""}`}>
      {renderBlocks(content)}
    </div>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-[var(--sb-code-border)] bg-[var(--sb-code-bg)] font-mono text-xs md:text-sm shadow-sm transition">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--sb-code-header)] border-b border-[var(--sb-code-border)] text-[var(--sb-text-secondary)]">
        <div className="flex items-center gap-1.5 font-sans font-medium text-xs">
          <Code size={14} className="text-rose-500" />
          <span>{language || "code"}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] transition"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-500" />
              <span className="text-emerald-500 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[var(--sb-text-primary)] font-mono leading-normal select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
};

function renderBlocks(markdown: string): React.ReactNode[] {
  if (!markdown) return [];

  const lines = markdown.split("\n");
  const nodes: React.ReactNode[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuffer: string[] = [];

  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      nodes.push(renderTable(tableBuffer, `table-${nodes.length}`));
      tableBuffer = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for code blocks
    if (line.trim().startsWith("```")) {
      if (inCode) {
        nodes.push(
          <CodeBlock
            key={`code-${nodes.length}`}
            language={codeLang}
            code={codeBuffer.join("\n")}
          />
        );
        codeBuffer = [];
        inCode = false;
        codeLang = "";
      } else {
        flushTable();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Check for Markdown tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      inTable = true;
      tableBuffer.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      nodes.push(<hr key={`hr-${i}`} className="my-4 border-[var(--sb-border)]" />);
      continue;
    }

    // Headers
    if (line.startsWith("# ")) {
      nodes.push(<h1 key={`h1-${i}`} className="text-xl md:text-2xl font-bold mt-5 mb-2.5 tracking-tight text-[var(--sb-text-primary)]">{renderInline(line.slice(2))}</h1>);
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push(<h2 key={`h2-${i}`} className="text-lg md:text-xl font-semibold mt-4 mb-2 tracking-tight text-[var(--sb-text-primary)]">{renderInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith("### ")) {
      nodes.push(<h3 key={`h3-${i}`} className="text-base md:text-lg font-medium mt-3 mb-1.5 text-[var(--sb-text-primary)]">{renderInline(line.slice(4))}</h3>);
      continue;
    }
    if (line.startsWith("#### ")) {
      nodes.push(<h4 key={`h4-${i}`} className="text-sm md:text-base font-medium mt-2.5 mb-1 text-[var(--sb-text-primary)]">{renderInline(line.slice(5))}</h4>);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      nodes.push(
        <blockquote key={`bq-${i}`} className="border-l-3 border-rose-500 pl-4 py-1 italic bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] rounded-r-md my-2.5">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Unordered List
    if (/^\s*[-*+]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*+]\s+/, "");
      nodes.push(
        <div key={`li-${i}`} className="flex items-start gap-2.5 ml-2 my-1 text-[var(--sb-text-primary)]">
          <span className="text-rose-500 mt-1 select-none font-bold text-sm">•</span>
          <span className="flex-1">{renderInline(text)}</span>
        </div>
      );
      continue;
    }

    // Ordered List
    const numMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (numMatch) {
      nodes.push(
        <div key={`oli-${i}`} className="flex items-start gap-2.5 ml-2 my-1 text-[var(--sb-text-primary)]">
          <span className="text-[var(--sb-text-muted)] font-mono text-xs mt-1 select-none">{numMatch[1]}.</span>
          <span className="flex-1">{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="my-2 leading-relaxed text-[var(--sb-text-primary)]">
        {renderInline(line)}
      </p>
    );
  }

  if (inCode) {
    nodes.push(
      <CodeBlock
        key={`code-${nodes.length}`}
        language={codeLang}
        code={codeBuffer.join("\n")}
      />
    );
  }
  flushTable();

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);

    if (codeMatch && (!boldMatch || codeMatch[1].length < boldMatch[1].length)) {
      if (codeMatch[1]) parts.push(<span key={keyIdx++}>{codeMatch[1]}</span>);
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded-md bg-[var(--sb-code-bg)] text-rose-500 font-mono text-xs border border-[var(--sb-code-border)]">
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
    } else if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={keyIdx++}>{boldMatch[1]}</span>);
      parts.push(<strong key={keyIdx++} className="font-semibold text-[var(--sb-text-primary)]">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
    } else if (linkMatch) {
      if (linkMatch[1]) parts.push(<span key={keyIdx++}>{linkMatch[1]}</span>);
      parts.push(
        <a
          key={keyIdx++}
          href={linkMatch[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose-500 hover:underline underline-offset-3"
        >
          {linkMatch[2]}
        </a>
      );
      remaining = linkMatch[4];
    } else {
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderTable(tableLines: string[], key: string): React.ReactNode {
  if (tableLines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(2).map(parseRow);

  return (
    <div key={key} className="overflow-x-auto my-4 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-code-bg)]">
      <table className="min-w-full divide-y divide-[var(--sb-border)] text-left text-xs md:text-sm">
        <thead className="bg-[var(--sb-code-header)] text-[var(--sb-text-primary)]">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--sb-border)] text-[var(--sb-text-primary)]">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-[var(--sb-hover-bg)]">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-4 py-2.5">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
