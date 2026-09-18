import React, { useState } from "react";
import { Check, Copy, Code, Sigma } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

const stripEmojis = (text: string): string => {
  if (!text) return "";
  return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "");
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isStreaming }) => {
  const cleanContent = stripEmojis(content);
  return (
    <div className={`space-y-3.5 leading-relaxed text-sm md:text-[15px] font-normal tracking-normal ${isStreaming ? "chat-streaming-cursor" : ""}`}>
      {renderBlocks(cleanContent)}
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

interface MathBlockProps {
  math: string;
}

const MathBlock: React.FC<MathBlockProps> = ({ math }) => {
  const [copied, setCopied] = useState(false);
  const cleanMath = math.trim();

  let html = "";
  let renderError = false;
  try {
    html = katex.renderToString(cleanMath, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    renderError = true;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanMath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-[var(--sb-border)] bg-[var(--sb-code-bg)] shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--sb-code-header)] border-b border-[var(--sb-border)] text-[var(--sb-text-secondary)]">
        <div className="flex items-center gap-1.5 font-sans font-medium text-xs">
          <Sigma size={14} className="text-rose-500" />
          <span>LaTeX Equation</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md hover:bg-[var(--sb-hover-bg)] text-[var(--sb-text-secondary)] hover:text-[var(--sb-text-primary)] transition"
          title="Copy LaTeX formula"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-500" />
              <span className="text-emerald-500 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy LaTeX</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[var(--sb-text-primary)] select-text flex justify-center items-center min-h-[52px]">
        {renderError || !html ? (
          <pre className="font-mono text-xs text-rose-400 select-text">
            <code>{cleanMath}</code>
          </pre>
        ) : (
          <div
            className="w-full text-center overflow-x-auto py-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
};

const InlineMath: React.FC<{ math: string }> = ({ math }) => {
  const cleanMath = math.trim();
  let html = "";
  try {
    html = katex.renderToString(cleanMath, {
      displayMode: false,
      throwOnError: false,
    });
  } catch {
    return (
      <code className="px-1 py-0.5 rounded-md bg-[var(--sb-code-bg)] text-rose-500 font-mono text-xs border border-[var(--sb-code-border)]">
        ${cleanMath}$
      </code>
    );
  }

  return (
    <span
      className="inline-block px-1 align-baseline text-[var(--sb-text-primary)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

  let inMath = false;
  let mathBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      nodes.push(renderTable(tableBuffer, `table-${nodes.length}`));
      tableBuffer = [];
      inTable = false;
    }
  };

  const flushMath = () => {
    if (mathBuffer.length > 0) {
      nodes.push(<MathBlock key={`mathblock-${nodes.length}`} math={mathBuffer.join("\n")} />);
      mathBuffer = [];
      inMath = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code blocks
    if (trimmed.startsWith("```")) {
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
        flushMath();
        inCode = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Check for display math blocks ($$...$$)
    if (inMath) {
      if (trimmed.endsWith("$$")) {
        const content = trimmed.slice(0, -2).trim();
        if (content) mathBuffer.push(content);
        flushMath();
      } else {
        mathBuffer.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("$$")) {
      flushTable();
      if (trimmed.length > 2 && trimmed.endsWith("$$")) {
        // Single-line block equation: $$ formula $$
        nodes.push(
          <MathBlock
            key={`mathblock-${nodes.length}`}
            math={trimmed.slice(2, -2).trim()}
          />
        );
      } else {
        // Multi-line block equation start
        inMath = true;
        const startContent = trimmed.slice(2).trim();
        if (startContent) mathBuffer.push(startContent);
      }
      continue;
    }

    // Check for Markdown tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableBuffer.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
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
    if (!trimmed) {
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
  flushMath();
  flushTable();

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const mathMatch = remaining.match(/(?<!\\)\$([^\$\s\n](?:[^\$\n]*?[^\$\s\n])?)\$/);

    // Find the earliest match by index
    let earliestType: "code" | "bold" | "link" | "math" | null = null;
    let earliestIndex = Infinity;

    if (codeMatch && codeMatch.index !== undefined && codeMatch.index < earliestIndex) {
      earliestType = "code";
      earliestIndex = codeMatch.index;
    }
    if (boldMatch && boldMatch.index !== undefined && boldMatch.index < earliestIndex) {
      earliestType = "bold";
      earliestIndex = boldMatch.index;
    }
    if (linkMatch && linkMatch.index !== undefined && linkMatch.index < earliestIndex) {
      earliestType = "link";
      earliestIndex = linkMatch.index;
    }
    if (mathMatch && mathMatch.index !== undefined && mathMatch.index < earliestIndex) {
      earliestType = "math";
      earliestIndex = mathMatch.index;
    }

    if (!earliestType) {
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }

    // Append preceding text before the match
    if (earliestIndex > 0) {
      parts.push(<span key={keyIdx++}>{remaining.slice(0, earliestIndex)}</span>);
    }

    if (earliestType === "code" && codeMatch) {
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded-md bg-[var(--sb-code-bg)] text-rose-500 font-mono text-xs border border-[var(--sb-code-border)]">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(earliestIndex + codeMatch[0].length);
    } else if (earliestType === "bold" && boldMatch) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-[var(--sb-text-primary)]">
          {renderInline(boldMatch[1])}
        </strong>
      );
      remaining = remaining.slice(earliestIndex + boldMatch[0].length);
    } else if (earliestType === "link" && linkMatch) {
      parts.push(
        <a
          key={keyIdx++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose-500 hover:underline underline-offset-3"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(earliestIndex + linkMatch[0].length);
    } else if (earliestType === "math" && mathMatch) {
      parts.push(
        <InlineMath key={keyIdx++} math={mathMatch[1]} />
      );
      remaining = remaining.slice(earliestIndex + mathMatch[0].length);
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
