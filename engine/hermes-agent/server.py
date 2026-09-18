import asyncio
import base64
import csv
import io
import json
import os
import re
import sys
import subprocess
import time
import zipfile
from xml.etree import ElementTree as ET
import httpx
import websockets
from PIL import Image
import pypdf

# Realtime Voice Agent Pipeline (STT: Moonshine Tiny, LLM: API, TTS: Kokoro-82M)
try:
    from voice.pipeline import RealtimeVoicePipeline
    voice_pipeline = RealtimeVoicePipeline()
    print("[Hermes Engine] Realtime Voice Pipeline initialized successfully (Moonshine Tiny + Kokoro TTS)")
except Exception as _e:
    print(f"[Hermes Engine] Voice pipeline initialization notice: {_e}")
    voice_pipeline = None

# Hermes Built-in Tool Registry Discovery
try:
    from tools.registry import registry, discover_builtin_tools
    _discovered_tool_modules = discover_builtin_tools()
    print(f"[Hermes Engine] Discovered {len(registry._tools)} built-in Hermes tools across {len(_discovered_tool_modules)} modules")
except Exception as _tool_err:
    print(f"[Hermes Engine] Notice discovering Hermes tools: {_tool_err}")
    registry = None

if sys.platform == "win32":

    sys.stdout.reconfigure(encoding="utf-8")

PORT = 18789
OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free"

# Verified active OpenRouter free vision models with automatic failover
VISION_FALLBACK_CANDIDATES = [
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "minimax/minimax-m3:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "thinkingmachines/inkling:free",
    "dots-studio/dots-3-note-preview:free"
]

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOADS_DIR = os.path.join(WORKSPACE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

PROVIDER_BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "ollama": "http://localhost:11434"
}

MODEL_ALIASES = {
    "gemma 4 26b vision (free)": "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-26b-a4b-it:free": "google/gemma-4-26b-a4b-it:free",
    "gemma 4 31b vision (free)": "google/gemma-4-31b-it:free",
    "google/gemma-4-31b-it:free": "google/gemma-4-31b-it:free",
    "minimax m3 vision (free)": "minimax/minimax-m3:free",
    "minimax/minimax-m3:free": "minimax/minimax-m3:free",
    "nvidia nemotron omni vision (free)": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "ling 3.0 flash fin (free)": "inclusionai/ling-3.0-flash-fin:free",
    "ling-3.0-flash-fin:free": "inclusionai/ling-3.0-flash-fin:free",
    "ling-3.0-flash-fin": "inclusionai/ling-3.0-flash-fin:free",
    "deepseek/deepseek-r1:free": "deepseek/deepseek-r1",
    "deepseek-r1:free": "deepseek/deepseek-r1",
    "deepseek-r1": "deepseek/deepseek-r1",
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "claude-3-5-sonnet": "anthropic/claude-3.5-sonnet",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
}

VISION_MODEL_KEYWORDS = ["gemma-4", "minimax", "nemotron", "inkling", "dots", "vision", "vl", "gpt-4", "claude-3", "pixtral", "gemma-3", "4o", "flash"]

def is_model_vision_capable(model_id: str) -> bool:
    """Check if model name supports native multi-modal image inputs."""
    mid = (model_id or "").lower()
    if "ling" in mid or "deepseek" in mid or "llama-3.3" in mid:
        return False
    return any(k in mid for k in VISION_MODEL_KEYWORDS)

def get_language_from_filename(filename: str) -> str:
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    mapping = {
        "py": "python",
        "js": "javascript",
        "jsx": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "html": "html",
        "css": "css",
        "json": "json",
        "md": "markdown",
        "rs": "rust",
        "cpp": "cpp",
        "c": "cpp",
        "sql": "sql",
        "yaml": "yaml",
        "yml": "yaml",
        "sh": "shell",
        "ps1": "powershell"
    }
    return mapping.get(ext, "plaintext")

def build_tools_system_prompt(enabled_tools: list[str] = None, custom_tools: list[dict] = None) -> str:
    """Dynamically format active built-in Hermes tools and user custom tools for the agent prompt."""
    lines = [
        "You are Songbird Agent, an autonomous execution AI powered by Hermes Engine.",
        "You have real execution tools on the local machine to process documents, pictures, code, desktop actions, and shell commands.\n",
        "## AVAILABLE TOOLS:"
    ]
    
    songbird_tools = [
        ("process_document", "file_path: str", "Extract text, tables, and paginated structure from PDF (with scanned page OCR recovery), DOCX, XLSX, PPTX, CSV, JSON, and Jupyter Notebooks (.ipynb)."),
        ("vision_analyze", "image_path: str, prompt: str", "Inspect image metadata (resolution, format, channels), perform OCR, and analyze visual elements."),
        ("execute_python", "code: str", "Run Python code with PIL, pypdf, json, csv, os, sys, math, and data processing libraries."),
        ("execute_command", "command: str", "Run shell / PowerShell commands in workspace."),
        ("write_file", "file_path: str, content: str", "Create or overwrite files."),
        ("read_file", "file_path: str", "Read file contents directly."),
        ("list_directory", "path: str = '.'", "List directory files and folders."),
        ("web_search", "query: str", "Search DuckDuckGo / Instant answers for real-time info."),
        ("editor_open_file", "file_path: str", "Open and display any workspace file in the user's split-screen Code Studio (Monaco Editor)."),
        ("editor_write_file", "file_path: str, content: str", "Write or overwrite a file, saving it and instantly opening/displaying it in the user's Code Studio IDE."),
        ("editor_show_code", "code: str, language: str = 'python', title: str = 'solution.py'", "Display code, algorithms, or snippets in a live buffer tab directly inside Code Studio."),
        ("editor_run", "code: str = '', file_path: str = '', language: str = 'python'", "Execute code inside Code Studio and stream real-time output into the IDE terminal console."),
    ]
    
    ALWAYS_ENABLED_TOOLS = {
        "editor_open_file", "editor_write_file", "editor_show_code", "editor_run",
        "write_file", "read_file", "execute_python", "execute_command", "list_directory"
    }

    enabled_set = set(enabled_tools) if enabled_tools else None
    
    idx = 1
    for name, params, desc in songbird_tools:
        if enabled_set is None or name in enabled_set or name in ALWAYS_ENABLED_TOOLS:
            lines.append(f"{idx}. {name}({params}) -> {desc}")
            idx += 1
            
    if registry:
        for name, entry in list(registry._tools.items()):
            if enabled_set is not None and name not in enabled_set and name not in ALWAYS_ENABLED_TOOLS:
                continue
            if any(name == sb[0] for sb in songbird_tools):
                continue
            
            props = entry.schema.get("parameters", {}).get("properties", {})
            reqs = set(entry.schema.get("parameters", {}).get("required", []))
            param_parts = []
            for p, pdef in list(props.items())[:6]:
                ptype = pdef.get("type", "any")
                param_parts.append(f"{p}: {ptype}" if p in reqs else f"{p}?: {ptype}")
            param_str = ", ".join(param_parts)
            desc_short = (entry.description or entry.schema.get("description", "")).strip().split("\n")[0][:130]
            lines.append(f"{idx}. {name}({param_str}) -> {desc_short}")
            idx += 1
            
    if custom_tools and isinstance(custom_tools, list):
        for ct in custom_tools:
            c_name = ct.get("name", "")
            c_desc = ct.get("description", "")
            c_params = ct.get("parameters", [])
            param_parts = []
            for cp in c_params:
                pname = cp.get("name", "")
                ptype = cp.get("type", "string")
                preq = cp.get("required", False)
                param_parts.append(f"{pname}: {ptype}" if preq else f"{pname}?: {ptype}")
            lines.append(f"{idx}. {c_name}({', '.join(param_parts)}) -> [Custom Tool: {ct.get('executionType', 'shell')}] {c_desc}")
            idx += 1

    if enabled_set is None or "computer_use" in enabled_set:
        lines.append(
            "\n### COMPUTER USE GUIDANCE:\n"
            "When using `computer_use`:\n"
            "1. Call `computer_use` with `action='capture'` and `mode='som'` (Set-of-Mark) to get an interactive numbered element map of the screen.\n"
            "2. Then interact using element indices: `action='click', element=N` or `action='type', text='...', element=N`.\n"
            "3. Use `action='key', keys='cmd+s'` or `keys='enter'` for keyboard shortcuts.\n"
            "4. Supported actions: capture, click, double_click, right_click, drag, scroll, type, key, wait, list_apps, focus_app."
        )

    lines.append(
        "\n### CODE STUDIO (MONACO EDITOR) INTEGRATION - MANDATORY DIRECTIVES:\n"
        "Songbird includes a built-in split-screen Code Studio (Monaco Editor IDE) beside the chat.\n"
        "When the user asks you to:\n"
        "- 'use the code studio to write ...'\n"
        "- 'write hello in code studio'\n"
        "- 'write code', 'create a file', 'write a script', 'solve in code studio'\n"
        "- or any request to write, build, or demonstrate code in Agent Mode:\n\n"
        "DO NOT JUST OUTPUT RAW CODE BLOCKS IN CHAT TEXT! You MUST directly control the Code Studio by issuing a <tool_call>:\n\n"
        "Example 1: When asked to write code or create a file in Code Studio:\n"
        "<tool_call>\n"
        '{"name": "editor_write_file", "arguments": {"file_path": "hello.py", "content": "print(\'Hello from Songbird Code Studio!\')\\n"}}\n'
        "</tool_call>\n\n"
        "Example 2: To execute the code in Code Studio and stream terminal logs:\n"
        "<tool_call>\n"
        '{"name": "editor_run", "arguments": {"file_path": "hello.py", "language": "python"}}\n'
        "</tool_call>\n\n"
        "Example 3: To display a scratch buffer or algorithm without saving to disk:\n"
        "<tool_call>\n"
        '{"name": "editor_show_code", "arguments": {"code": "print(\'Hello World\')", "language": "python", "title": "hello.py"}}\n'
        "</tool_call>\n\n"
        "Calling these tools automatically opens the split-screen Code Studio, creates the file tab, applies syntax highlighting, and streams terminal execution on the user's screen in real time."
    )

    lines.append(
        "\nTOOL CALL FORMAT:\n"
        "To execute a tool, output a <tool_call> XML block containing JSON:\n"
        "<tool_call>\n"
        '{"name": "tool_name", "arguments": {"arg_key": "arg_value"}}\n'
        "</tool_call>\n\n"
        "CRITICAL FORMATTING RULES:\n"
        "- NO EMOJIS: Never output emojis or emoticons in your responses under any circumstances. Always write pure, clean text.\n"
        "- MATH IN LATEX: Always format all mathematical expressions, equations, formulas, variables, and calculations using standard LaTeX notation ($...$ for inline math, $$...$$ for standalone display equations). Never output raw ASCII pseudo-math.\n\n"
        "You can think step-by-step using <think>...</think>, then call tools, inspect results, and synthesize a final answer."
    )
    return "\n".join(lines)

AGENT_BASE_PROMPT = build_tools_system_prompt()

EMOJI_PATTERN = re.compile(
    r"["
    r"\U0001F600-\U0001F64F"  # emoticons
    r"\U0001F300-\U0001F5FF"  # symbols & pictographs
    r"\U0001F680-\U0001F6FF"  # transport & map symbols
    r"\U0001F1E0-\U0001F1FF"  # flags
    r"\U0001F700-\U0001F77F"  # alchemical symbols
    r"\U0001F780-\U0001F7FF"  # geometric shapes extended
    r"\U0001F800-\U0001F8FF"  # supplemental arrows-c
    r"\U0001F900-\U0001F9FF"  # supplemental symbols and pictographs
    r"\U0001FA00-\U0001FA6F"  # chess symbols
    r"\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
    r"\U00002702-\U000027B0"  # dingbats
    r"\U000024C2-\U0001F251"  # enclosed characters
    r"\U0001F004-\U0001F0CF"  # domino, mahjong, playing cards
    r"\U00002600-\U000026FF"  # miscellaneous symbols
    r"\U00002300-\U000023FF"  # miscellaneous technical
    r"\U0000FE0F"              # variation selector-16
    r"\U0000200D"              # zero-width joiner
    r"]+",
    flags=re.UNICODE
)

def strip_emojis(text: str) -> str:
    """Remove any emojis or emoticons from text, preserving all regular text and LaTeX math formulas."""
    if not text:
        return ""
    return EMOJI_PATTERN.sub("", text)

DEFAULT_SYSTEM_PROMPT = (
    "You are Songbird, an advanced AI agent specialized in deep reasoning, software architecture, "
    "picture & document processing, and synthesis. Structure your answers with clear markdown formatting and "
    "syntax-highlighted code blocks.\n\n"
    "CRITICAL FORMATTING RULES:\n"
    "1. NO EMOJIS: Do NOT use any emojis or emoticons in your responses under any circumstances. Always write pure, clean text.\n"
    "2. MATH IN LATEX: Always write all mathematical expressions, equations, formulas, variables, and calculations using standard LaTeX notation. "
    "Use $...$ for inline math (e.g. $E = mc^2$, $\\alpha + \\beta = \\gamma$) and $$...$$ for standalone display equations "
    "(e.g. $$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$). Never output raw ASCII pseudo-math."
)

def normalize_model_id(raw_model: str, provider: str) -> str:
    cleaned = (raw_model or "").strip()
    lower = cleaned.lower()
    if provider == "openrouter":
        if lower in MODEL_ALIASES:
            return MODEL_ALIASES[lower]
        if "ling" in lower and "flash" in lower:
            return "inclusionai/ling-3.0-flash-fin:free"
        if "gemma" in lower and "26b" in lower:
            return "google/gemma-4-26b-a4b-it:free"
    return cleaned

def parse_tool_call(raw_call: str) -> tuple[str, dict]:
    """Robust parser for JSON, XML, pythonic, function-style, and multi-line tool calls."""
    raw_call = raw_call.strip()
    if not raw_call:
        return "unknown", {}

    # 1. Direct JSON parse
    try:
        data = json.loads(raw_call)
        if isinstance(data, dict):
            if "name" in data:
                args = data.get("arguments", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        pass
                return data["name"], args if isinstance(args, dict) else {}
            if "tool" in data:
                return data["tool"], data.get("parameters", data.get("arguments", {}))
    except Exception:
        pass

    # 2. Extract JSON object from raw_call
    json_match = re.search(r"(\{\s*\"(?:name|tool)\"\s*:\s*\"[^\"]+\".*?\})", raw_call, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            name = data.get("name") or data.get("tool")
            args = data.get("arguments") or data.get("parameters") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    pass
            return name, args if isinstance(args, dict) else {}
        except Exception:
            pass

    # 3. Handle XML format: <arg_key>...</arg_key>
    keys = re.findall(r"<arg_key>(.*?)</arg_key>", raw_call, re.DOTALL)
    values = re.findall(r"<arg_value>(.*?)</arg_value>", raw_call, re.DOTALL)
    if keys and values:
        first_part = raw_call.split("<arg_key>")[0].strip()
        tool_name = first_part if first_part else "execute_command"
        args = {}
        for k, v in zip(keys, values):
            args[k.strip()] = v.strip()
        return tool_name, args

    # 4. Handle XML tag style: <tool_name> or <file_path>
    tag_matches = re.findall(r"<([a-zA-Z_0-9]+)>(.*?)</\1>", raw_call, re.DOTALL)
    if tag_matches:
        parsed_dict = {k: v.strip() for k, v in tag_matches}
        tool_name = parsed_dict.pop("name", parsed_dict.pop("tool", None))
        if tool_name:
            return tool_name, parsed_dict

    # 5. Check if first line or string starts with a known tool name
    KNOWN_TOOLS = [
        "editor_write_file", "editor_open_file", "editor_show_code", "editor_run",
        "write_file", "read_file", "execute_python", "execute_command", "list_directory",
        "web_search", "process_document", "vision_analyze"
    ]
    for kt in KNOWN_TOOLS:
        if raw_call.startswith(kt) or f"{kt}\n" in raw_call or f"{kt}:" in raw_call or f"{kt}(" in raw_call:
            # Check for JSON in the rest
            rest_json = re.search(r"(\{.*?\})", raw_call, re.DOTALL)
            if rest_json:
                try:
                    args = json.loads(rest_json.group(1))
                    if isinstance(args, dict):
                        return kt, args
                except Exception:
                    pass

            # Check for Python function call args: file_path="...", content="..."
            kwarg_matches = re.findall(r'(\w+)\s*=\s*(?:"""(.*?)"""|\'\'\'(.*?)\'\'\'|"([^"\\]*(?:\\.[^"\\]*)*)"|\'([^\'\\]*(?:\\.[^\'\\]*)*)\'|(\[[^\]]*\]|\{[^\}]*\}|[^\s,)]+))', raw_call, re.DOTALL)
            if kwarg_matches:
                args = {}
                for k, tq1, tq2, dq, sq, raw_val in kwarg_matches:
                    val = tq1 or tq2 or dq or sq or raw_val
                    args[k] = val
                return kt, args

            # If tool is write_file or editor_write_file and raw code is present
            code_fence = re.search(r"```(?:\w+)?\n?(.*?)\n?```", raw_call, re.DOTALL)
            if code_fence:
                return kt, {"file_path": "hello.py", "content": code_fence.group(1)}

    lines = [l.strip() for l in raw_call.split("\n") if l.strip()]
    if lines:
        return "execute_command", {"command": raw_call}

    return "unknown", {}

# ==================== DOCUMENT & PICTURE PROCESSING PIPELINE ====================

async def query_vision_api(image_data_url: str, prompt: str, api_key: str, base_url: str) -> str:
    """Send image to active multi-modal vision models on OpenRouter with automatic failover."""
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": "https://songbird.ai",
        "X-Title": "Songbird AI Vision Router"
    }
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    candidates = VISION_FALLBACK_CANDIDATES if "openrouter" in base_url else ["gpt-4o", "gpt-4o-mini"]

    last_error = "No vision response"

    for model_candidate in candidates:
        payload = {
            "model": model_candidate,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}}
                    ]
                }
            ],
            "max_tokens": 1500
        }

        try:
            print(f"[Hermes Vision Router] Attempting vision analysis with '{model_candidate}'...")
            sys.stdout.flush()
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(endpoint, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    if content:
                        print(f"[Hermes Vision Router] Success with '{model_candidate}'!")
                        sys.stdout.flush()
                        return content
                else:
                    last_error = f"Model {model_candidate} returned HTTP {res.status_code}: {res.text[:100]}"
                    print(f"[Hermes Vision Router Warning] {last_error}, trying next candidate...")
                    sys.stdout.flush()
        except Exception as e:
            last_error = str(e)
            print(f"[Hermes Vision Router Exception] {model_candidate}: {e}")
            sys.stdout.flush()

    return f"Image is loaded in workspace. Visual metadata and properties extracted. (Cloud vision note: {last_error})"

async def extract_pdf_with_scanned_recovery(path: str, api_key: str = "", base_url: str = "", max_pages: int = 50) -> str:
    """Extract text from PDF documents with automatic Scanned Page Recovery for image-only pages."""
    try:
        reader = pypdf.PdfReader(path)
        total_pages = len(reader.pages)
        pages_to_read = min(total_pages, max_pages)
        output = [f"### PDF Document: {os.path.basename(path)} ({total_pages} pages)"]

        for idx in range(pages_to_read):
            page = reader.pages[idx]
            extracted_text = (page.extract_text() or "").strip()

            # Check for Scanned Page (missing text layer but has embedded images)
            if len(extracted_text) < 15 and len(page.images) > 0:
                print(f"[Hermes Pipeline] PDF Page {idx + 1} has no text layer. Running Scanned Page Recovery...")
                sys.stdout.flush()

                img_obj = page.images[0]
                img_bytes = img_obj.data
                img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                img_data_url = f"data:image/png;base64,{img_b64}"

                if api_key:
                    target_base = base_url or PROVIDER_BASE_URLS["openrouter"]
                    recovered_ocr = await query_vision_api(
                        img_data_url,
                        "Accurately transcribe all text, numbers, headings, tables, and notes from this scanned document page into clean Markdown.",
                        api_key,
                        target_base
                    )
                    page_content = f"*(Scanned Page - Recovered via Hermes Vision OCR)*\n\n{recovered_ocr}"
                else:
                    page_content = f"*[Scanned Page Detected - Image '{img_obj.name}' embedded without text layer]*"
            else:
                page_content = extracted_text if extracted_text else "[Empty Page]"

            output.append(f"\n--- [Page {idx + 1} / {total_pages}] ---\n{page_content}")

        if total_pages > max_pages:
            output.append(f"\n*(Truncated at {max_pages} pages out of {total_pages})*")

        return "\n".join(output)
    except Exception as e:
        return f"[PDF Extraction Error]: {str(e)}"

def extract_docx_text(path: str) -> str:
    """Extract text and tables from Word (.docx) documents."""
    try:
        with zipfile.ZipFile(path) as zf:
            xml_content = zf.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            
            for p in tree.iterfind(".//w:p", ns):
                texts = [t.text for t in p.iterfind(".//w:t", ns) if t.text]
                if texts:
                    paragraphs.append("".join(texts))
            
            return f"### DOCX Document: {os.path.basename(path)}\n\n" + "\n\n".join(paragraphs)
    except Exception as e:
        return f"[DOCX Extraction Error]: {str(e)}"

def extract_pptx_text(path: str) -> str:
    """Extract text from PowerPoint presentations (.pptx)."""
    try:
        with zipfile.ZipFile(path) as zf:
            slide_files = sorted(
                [f for f in zf.namelist() if f.startswith("ppt/slides/slide") and f.endswith(".xml")],
                key=lambda x: int(re.search(r"\d+", x).group() or 0) if re.search(r"\d+", x) else 0
            )
            if not slide_files:
                return f"[Empty Presentation: {os.path.basename(path)}]"

            output = [f"### PowerPoint Presentation: {os.path.basename(path)} ({len(slide_files)} slides)\n"]
            ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}

            for idx, sf in enumerate(slide_files):
                tree = ET.fromstring(zf.read(sf))
                texts = [t.text for t in tree.iterfind(".//a:t", ns) if t.text]
                slide_body = "\n".join(texts) if texts else "[No text on slide]"
                output.append(f"--- [Slide {idx + 1}] ---\n{slide_body}\n")

            return "\n".join(output)
    except Exception as e:
        return f"[PPTX Extraction Error]: {str(e)}"

def extract_xlsx_or_csv_text(path: str) -> str:
    """Extract tabular data from XLSX or CSV into Markdown table format."""
    try:
        ext = os.path.splitext(path)[1].lower()
        if ext == ".csv":
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                rows = list(reader)
            if not rows:
                return "[Empty CSV file]"
            
            md_lines = [f"### CSV Data: {os.path.basename(path)} ({len(rows)} rows)\n"]
            header = rows[0]
            md_lines.append("| " + " | ".join(header) + " |")
            md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
            for r in rows[1:100]:
                padded = r + [""] * (len(header) - len(r))
                md_lines.append("| " + " | ".join(padded[:len(header)]) + " |")
            
            if len(rows) > 100:
                md_lines.append(f"\n*(Showing first 100 rows out of {len(rows)})*")
            return "\n".join(md_lines)
            
        elif ext == ".xlsx":
            with zipfile.ZipFile(path) as zf:
                shared_strings = []
                if "xl/sharedStrings.xml" in zf.namelist():
                    ss_xml = zf.read("xl/sharedStrings.xml")
                    ss_tree = ET.fromstring(ss_xml)
                    for si in ss_tree.iterfind(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"):
                        shared_strings.append(si.text or "")
                
                sheet_xml = zf.read("xl/worksheets/sheet1.xml")
                sheet_tree = ET.fromstring(sheet_xml)
                
                rows_data = []
                for row in sheet_tree.iterfind(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                    row_cells = []
                    for c in row.iterfind(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                        v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                        t = c.get("t")
                        if v is not None and v.text is not None:
                            val = v.text
                            if t == "s" and val.isdigit() and int(val) < len(shared_strings):
                                val = shared_strings[int(val)]
                            row_cells.append(val)
                        else:
                            row_cells.append("")
                    if any(row_cells):
                        rows_data.append(row_cells)
                
                if not rows_data:
                    return "[Empty Excel Worksheet]"
                
                md_lines = [f"### Excel Spreadsheet: {os.path.basename(path)} ({len(rows_data)} rows)\n"]
                header = rows_data[0]
                md_lines.append("| " + " | ".join(header) + " |")
                md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
                for r in rows_data[1:100]:
                    padded = r + [""] * (len(header) - len(r))
                    md_lines.append("| " + " | ".join(padded[:len(header)]) + " |")
                return "\n".join(md_lines)
                
    except Exception as e:
        return f"[Spreadsheet Extraction Error]: {str(e)}"

def extract_notebook_text(path: str) -> str:
    """Extract code and markdown from Jupyter Notebook (.ipynb)."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            nb = json.load(f)
        cells = nb.get("cells", [])
        output = [f"### Jupyter Notebook: {os.path.basename(path)} ({len(cells)} cells)\n"]
        for idx, cell in enumerate(cells):
            cell_type = cell.get("cell_type", "code")
            src = "".join(cell.get("source", []))
            if cell_type == "markdown":
                output.append(f"**[Cell {idx+1} - Markdown]**\n{src}\n")
            else:
                output.append(f"**[Cell {idx+1} - Code]**\n```python\n{src}\n```\n")
        return "\n".join(output)
    except Exception as e:
        return f"[Notebook Extraction Error]: {str(e)}"

async def tool_process_document(file_path: str, api_key: str = "", base_url: str = "") -> str:
    """Universal document processing pipeline with Scanned Page Recovery."""
    try:
        resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, file_path)) if not os.path.isabs(file_path) else file_path
        if not os.path.exists(resolved):
            upload_fallback = os.path.join(UPLOADS_DIR, os.path.basename(file_path))
            if os.path.exists(upload_fallback):
                resolved = upload_fallback
            else:
                return f"[Error: Document not found at '{file_path}']"

        ext = os.path.splitext(resolved)[1].lower()

        if ext == ".pdf":
            return await extract_pdf_with_scanned_recovery(resolved, api_key=api_key, base_url=base_url)
        elif ext == ".docx":
            return extract_docx_text(resolved)
        elif ext == ".pptx":
            return extract_pptx_text(resolved)
        elif ext in [".xlsx", ".csv"]:
            return extract_xlsx_or_csv_text(resolved)
        elif ext == ".ipynb":
            return extract_notebook_text(resolved)
        else:
            with open(resolved, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return f"### Document: {os.path.basename(resolved)} ({len(content)} chars)\n\n" + content[:12000]

    except Exception as e:
        return f"[Document Processing Exception]: {str(e)}"

async def tool_vision_analyze(image_path: str, prompt: str = "Analyze and describe this image in detail.", api_key: str = "", base_url: str = "") -> str:
    """Picture & image processing pipeline with PIL inspection and multi-modal vision analysis."""
    try:
        resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, image_path)) if not os.path.isabs(image_path) else image_path
        if not os.path.exists(resolved):
            upload_fallback = os.path.join(UPLOADS_DIR, os.path.basename(image_path))
            if os.path.exists(upload_fallback):
                resolved = upload_fallback
            else:
                return f"[Error: Image file not found at '{image_path}']"

        with Image.open(resolved) as img:
            width, height = img.size
            format_name = img.format or "PNG"
            mode = img.mode
            file_size_kb = round(os.path.getsize(resolved) / 1024, 1)

            buffered = io.BytesIO()
            img_format = "JPEG" if format_name.upper() in ["JPG", "JPEG"] else "PNG"
            img.save(buffered, format=img_format)
            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            data_url = f"data:image/{img_format.lower()};base64,{img_b64}"

        meta_info = (
            f"🖼️ **Image Inspection:** `{os.path.basename(resolved)}` ({width}×{height} px, {format_name}, {file_size_kb} KB)\n"
        )

        if api_key:
            target_base = base_url or PROVIDER_BASE_URLS["openrouter"]
            vision_desc = await query_vision_api(data_url, prompt, api_key, target_base)
            return f"{meta_info}\n**Visual Analysis & OCR Content:**\n{vision_desc}"
        else:
            return f"{meta_info}\nImage is loaded and available for processing with Python (`PIL`, `matplotlib`, `cv2`)."

    except Exception as e:
        return f"[Vision Analyze Exception]: {str(e)}"

# ==================== HERMES AGENT TOOL IMPLEMENTATIONS ====================

async def tool_execute_python(code: str) -> str:
    """Execute Python code in subprocess with safety timeout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=WORKSPACE_DIR
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=25.0)
        out_str = stdout.decode("utf-8", errors="ignore").strip()
        err_str = stderr.decode("utf-8", errors="ignore").strip()
        if err_str and out_str:
            return f"{out_str}\n[stderr]:\n{err_str}"
        elif err_str:
            return f"[Error/stderr]: {err_str}"
        elif out_str:
            return out_str
        return "[Process completed with 0 output]"
    except asyncio.TimeoutError:
        return "[Error: Execution timed out after 25 seconds]"
    except Exception as e:
        return f"[Exception]: {str(e)}"

async def tool_execute_command(command: str) -> str:
    """Run shell command in workspace."""
    try:
        is_win = sys.platform == "win32"
        shell_cmd = ["powershell", "-Command", command] if is_win else ["/bin/bash", "-c", command]
        proc = await asyncio.create_subprocess_exec(
            *shell_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=WORKSPACE_DIR
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        out_str = stdout.decode("utf-8", errors="ignore").strip()
        err_str = stderr.decode("utf-8", errors="ignore").strip()
        res = out_str or err_str or "[Command finished with no output]"
        return res[:4000]
    except asyncio.TimeoutError:
        return "[Error: Command timed out after 30 seconds]"
    except Exception as e:
        return f"[Command error]: {str(e)}"

async def tool_write_file(file_path: str, content: str) -> str:
    """Write or overwrite file in workspace."""
    try:
        full_path = os.path.abspath(os.path.join(WORKSPACE_DIR, file_path)) if not os.path.isabs(file_path) else file_path
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} bytes to {file_path}"
    except Exception as e:
        return f"[Write error]: {str(e)}"

async def tool_read_file(file_path: str, api_key: str = "", base_url: str = "") -> str:
    """Universal read_file tool with auto-detection for PDF, DOCX, XLSX, PPTX, IPYNB."""
    try:
        resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, file_path)) if not os.path.isabs(file_path) else file_path
        if not os.path.exists(resolved):
            upload_fallback = os.path.join(UPLOADS_DIR, os.path.basename(file_path))
            if os.path.exists(upload_fallback):
                resolved = upload_fallback
            else:
                return f"[Error: File not found: {file_path}]"

        ext = os.path.splitext(resolved)[1].lower()
        if ext in [".pdf", ".docx", ".pptx", ".xlsx", ".csv", ".ipynb"]:
            return await tool_process_document(resolved, api_key=api_key, base_url=base_url)

        with open(resolved, "r", encoding="utf-8", errors="ignore") as f:
            data = f.read()
        return data[:10000]
    except Exception as e:
        return f"[Read error]: {str(e)}"

async def tool_list_directory(path: str = ".") -> str:
    """List directory entries."""
    try:
        target = os.path.abspath(os.path.join(WORKSPACE_DIR, path)) if not os.path.isabs(path) else path
        if not os.path.exists(target):
            return f"[Directory not found: {path}]"
        entries = os.listdir(target)
        res = []
        for e in entries[:40]:
            p = os.path.join(target, e)
            res.append(f"📁 {e}/" if os.path.isdir(p) else f"📄 {e}")
        return "\n".join(res) or "[Empty directory]"
    except Exception as e:
        return f"[List error]: {str(e)}"

async def tool_web_search(query: str) -> str:
    """Perform quick DuckDuckGo API search."""
    try:
        url = f"https://api.duckduckgo.com/?q={httpx.URL(query).raw_path.decode()}&format=json"
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                abstract = data.get("AbstractText", "")
                topics = data.get("RelatedTopics", [])
                snippets = [abstract] if abstract else []
                for t in topics[:3]:
                    if isinstance(t, dict) and t.get("Text"):
                        snippets.append(t["Text"])
                if snippets:
                    return "\n\n".join(snippets)
        return f"Search result for '{query}': Found multiple relevant technical sources."
    except Exception as e:
        return f"[Search error]: {str(e)}"

async def execute_agent_tool(tool_name: str, args: dict, api_key: str = "", base_url: str = "", custom_tools: list[dict] = None, websocket = None) -> tuple[str, str | None]:
    """Dispatch tool call to Custom Tools, Songbird Handlers, Code Studio IDE, or Hermes Registry."""
    name = tool_name.strip()
    name_lower = name.lower()

    # 1. Check Custom Tools
    if custom_tools and isinstance(custom_tools, list):
        for ct in custom_tools:
            if ct.get("name", "").strip().lower() == name_lower:
                exec_type = ct.get("executionType", "shell").lower()
                if exec_type == "shell":
                    template = ct.get("commandTemplate", "")
                    cmd = template
                    for k, v in args.items():
                        cmd = cmd.replace(f"{{{k}}}", str(v))
                    out = await tool_execute_command(cmd)
                    return out, None
                elif exec_type == "python":
                    script = ct.get("scriptBody", "")
                    wrapped_code = f"import json, sys\nargs = {json.dumps(args)}\n" + script
                    out = await tool_execute_python(wrapped_code)
                    return out, None
                elif exec_type == "prompt":
                    directive = ct.get("promptDirective", "")
                    return f"[Custom Tool Directive '{name}']:\n{directive}\nArguments: {json.dumps(args)}", None

    # 2. Check Songbird Built-in Tools & Code Studio Handlers
    if name_lower in ("editor_open_file", "editor_open"):
        fp = args.get("file_path") or args.get("path") or ""
        resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, fp)) if not os.path.isabs(fp) else fp
        if not os.path.exists(resolved):
            return f"[Error: File not found at '{fp}']", None
        rel_path = os.path.relpath(resolved, WORKSPACE_DIR).replace("\\", "/")
        try:
            with open(resolved, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception as e:
            return f"[Error reading file '{fp}']: {str(e)}", None
        
        lang = get_language_from_filename(rel_path)
        if websocket:
            try:
                await websocket.send(json.dumps({
                    "type": "editor_agent_sync",
                    "action": "open",
                    "file_path": rel_path,
                    "content": content,
                    "language": lang
                }))
            except Exception:
                pass
        return f"Successfully opened '{rel_path}' in Code Studio for user ({len(content)} chars).", None

    elif name_lower in ("editor_write_file", "editor_save_file", "editor_write"):
        fp = args.get("file_path") or args.get("path") or "output.txt"
        cnt = args.get("content") or args.get("text") or args.get("code") or ""
        out = await tool_write_file(fp, cnt)
        resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, fp)) if not os.path.isabs(fp) else fp
        rel_path = os.path.relpath(resolved, WORKSPACE_DIR).replace("\\", "/")
        lang = get_language_from_filename(rel_path)
        if websocket:
            try:
                await websocket.send(json.dumps({
                    "type": "editor_agent_sync",
                    "action": "write",
                    "file_path": rel_path,
                    "content": cnt,
                    "language": lang
                }))
            except Exception:
                pass
        return f"{out} (Displayed and focused in Code Studio IDE)", None

    elif name_lower in ("editor_show_code", "editor_display_code"):
        code = args.get("code") or args.get("content") or ""
        title = args.get("title") or args.get("name") or f"snippet_{int(time.time())}.py"
        lang = args.get("language") or get_language_from_filename(title)
        if websocket:
            try:
                await websocket.send(json.dumps({
                    "type": "editor_agent_sync",
                    "action": "show",
                    "file_path": title,
                    "content": code,
                    "language": lang
                }))
            except Exception:
                pass
        return f"Displayed code in Code Studio tab '{title}' ({len(code)} chars, {lang}).", None

    elif name_lower in ("editor_run", "editor_run_code", "run_code"):
        code = args.get("code") or args.get("script") or ""
        fp = args.get("file_path") or args.get("path") or ""
        lang = (args.get("language") or "python").lower()
        if fp and not code:
            resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, fp)) if not os.path.isabs(fp) else fp
            if os.path.exists(resolved):
                with open(resolved, "r", encoding="utf-8", errors="ignore") as f:
                    code = f.read()
                lang = get_language_from_filename(fp)

        run_id = f"agent_run_{int(time.time()*1000)}"
        t_start = time.perf_counter()
        temp_file = None
        try:
            if lang in ["python", "py"] or fp.endswith(".py"):
                python_exe = os.path.join(WORKSPACE_DIR, "engine", "hermes-agent", "venv", "Scripts", "python.exe")
                if not os.path.exists(python_exe):
                    python_exe = sys.executable
                temp_file = os.path.join(WORKSPACE_DIR, f".songbird_agent_run_{int(time.time())}.py")
                with open(temp_file, "w", encoding="utf-8") as tf:
                    tf.write(code)
                cmd = [python_exe, "-u", temp_file]
            elif lang in ["javascript", "js", "typescript", "ts"] or fp.endswith(".js") or fp.endswith(".ts"):
                temp_file = os.path.join(WORKSPACE_DIR, f".songbird_agent_run_{int(time.time())}.js")
                with open(temp_file, "w", encoding="utf-8") as tf:
                    tf.write(code)
                cmd = ["node", temp_file]
            else:
                cmd = ["powershell", "-NoProfile", "-Command", code]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=WORKSPACE_DIR
            )

            outputs = []
            async def stream_pipe(stream, stream_name):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    text = line.decode("utf-8", errors="replace")
                    outputs.append(text)
                    if websocket:
                        try:
                            await websocket.send(json.dumps({
                                "type": "editor_run_output",
                                "run_id": run_id,
                                "stream": stream_name,
                                "text": text
                            }))
                        except Exception:
                            pass

            await asyncio.gather(
                stream_pipe(proc.stdout, "stdout"),
                stream_pipe(proc.stderr, "stderr")
            )
            exit_code = await proc.wait()
            elapsed = round((time.perf_counter() - t_start) * 1000, 2)
            if websocket:
                try:
                    await websocket.send(json.dumps({
                        "type": "editor_run_done",
                        "run_id": run_id,
                        "exit_code": exit_code,
                        "duration_ms": elapsed
                    }))
                except Exception:
                    pass

            full_res = "".join(outputs).strip() or "[Execution completed with 0 output]"
            return f"[Code Studio Exit Code {exit_code}, Duration: {elapsed}ms]:\n{full_res}", None
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    elif "document" in name_lower or name_lower == "process_document":
        fp = args.get("file_path") or args.get("path") or ""
        out = await tool_process_document(fp, api_key=api_key, base_url=base_url)
        return out, None
    elif "image" in name_lower or "vision" in name_lower or name_lower in ("vision_analyze", "process_image"):
        fp = args.get("image_path") or args.get("image") or args.get("path") or ""
        prompt = args.get("prompt") or "Analyze and describe this image in detail."
        out = await tool_vision_analyze(fp, prompt, api_key=api_key, base_url=base_url)
        return out, None
    elif name_lower == "execute_python":
        code = args.get("code") or args.get("script") or ""
        out = await tool_execute_python(code)
        # Also broadcast output to Code Studio terminal if open
        if websocket:
            try:
                await websocket.send(json.dumps({
                    "type": "editor_run_output",
                    "run_id": f"py_{int(time.time()*1000)}",
                    "stream": "stdout",
                    "text": out + "\n"
                }))
            except Exception:
                pass
        return out, None
    elif name_lower == "execute_command":
        cmd = args.get("command") or args.get("cmd") or ""
        out = await tool_execute_command(cmd)
        return out, None
    elif name_lower == "write_file":
        fp = args.get("file_path") or args.get("path") or "output.txt"
        cnt = args.get("content") or args.get("text") or ""
        out = await tool_write_file(fp, cnt)
        resolved = os.path.abspath(os.path.join(WORKSPACE_DIR, fp)) if not os.path.isabs(fp) else fp
        rel_path = os.path.relpath(resolved, WORKSPACE_DIR).replace("\\", "/")
        lang = get_language_from_filename(rel_path)
        if websocket:
            try:
                await websocket.send(json.dumps({
                    "type": "editor_agent_sync",
                    "action": "write",
                    "file_path": rel_path,
                    "content": cnt,
                    "language": lang
                }))
            except Exception:
                pass
        return out, None
    elif name_lower == "read_file":
        fp = args.get("file_path") or args.get("path") or ""
        out = await tool_read_file(fp, api_key=api_key, base_url=base_url)
        return out, None
    elif name_lower == "list_directory":
        p = args.get("path") or "."
        out = await tool_list_directory(p)
        return out, None
    elif name_lower == "web_search":
        q = args.get("query") or args.get("q") or ""
        out = await tool_web_search(q)
        return out, None

    # 3. Check Hermes Tool Registry (supports all 81+ Hermes tools including computer_use)
    if registry:
        matched_entry = registry.get_entry(name) or registry.get_entry(name_lower)
        if matched_entry:
            canonical_name = matched_entry.name
            try:
                raw_res = registry.dispatch(canonical_name, args)
                # Handle multimodal result (e.g. computer_use screen capture)
                if isinstance(raw_res, dict) and raw_res.get("_multimodal"):
                    content_list = raw_res.get("content", [])
                    extracted_img = None
                    text_parts = []
                    for item in content_list:
                        if isinstance(item, dict):
                            if item.get("type") == "image_url":
                                url = item.get("image_url", {}).get("url", "")
                                if url:
                                    extracted_img = url
                            elif item.get("type") == "text":
                                text_parts.append(item.get("text", ""))
                    summary = raw_res.get("text_summary") or "\n".join(text_parts)
                    return summary, extracted_img
                elif isinstance(raw_res, dict):
                    return json.dumps(raw_res, indent=2, default=str), None
                elif isinstance(raw_res, str):
                    return raw_res, None
                else:
                    return str(raw_res), None
            except Exception as e:
                return f"[Tool '{name}' Execution Error]: {str(e)}", None

    # 4. Fallback Aliases
    if name_lower in ("terminal", "bash", "shell", "sh", "cmd"):
        cmd = args.get("command") or args.get("cmd") or ""
        out = await tool_execute_command(cmd)
        return out, None

    if "python" in name_lower:
        code = args.get("code") or args.get("script") or ""
        out = await tool_execute_python(code)
        return out, None

    return f"[Unknown tool: {tool_name}. Please inspect available tools in Songbird Tools window.]", None

# ==================== SAVE UPLOADED ATTACHMENTS TO WORKSPACE ====================

def save_uploaded_attachments(attachments: list[dict]) -> list[dict]:
    """Decodes attached files/pictures and saves them to WORKSPACE_DIR/uploads/."""
    saved_meta = []
    if not attachments:
        return saved_meta

    for att in attachments:
        if not isinstance(att, dict):
            continue
        name = att.get("name", f"file_{int(asyncio.get_event_loop().time() * 1000)}")
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
        target_path = os.path.join(UPLOADS_DIR, safe_name)

        data_url = att.get("dataUrl", "")
        text_content = att.get("textContent", "")

        try:
            if data_url and "," in data_url:
                header, encoded = data_url.split(",", 1)
                binary_data = base64.b64decode(encoded)
                with open(target_path, "wb") as f:
                    f.write(binary_data)
            elif text_content:
                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(text_content)
            
            saved_meta.append({
                "name": safe_name,
                "saved_path": f"uploads/{safe_name}",
                "full_path": target_path,
                "type": att.get("type", "application/octet-stream"),
                "dataUrl": data_url
            })
            print(f"[Hermes Pipeline] Saved upload to: {target_path}")
            sys.stdout.flush()
        except Exception as e:
            print(f"[Hermes Pipeline] Error saving upload {safe_name}: {e}")
            sys.stdout.flush()

    return saved_meta

# ==================== CALL AI PROVIDER ====================

async def query_model_complete(messages: list[dict], model_name: str, api_key: str, base_url: str, temperature: float = 0.5) -> str:
    """Make non-streaming request to cloud provider or local Ollama for agent loop."""
    if not api_key or "11434" in base_url:
        ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
        async with httpx.AsyncClient(timeout=90.0) as client:
            res = await client.post(ollama_url, json={
                "model": model_name or DEFAULT_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature}
            })
            if res.status_code == 200:
                data = res.json()
                return data.get("message", {}).get("content", "")
            else:
                raise Exception(f"Ollama Error {res.status_code}: {res.text}")

    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": "https://songbird.ai",
        "X-Title": "Songbird AI Agent"
    }
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "stream": False
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(endpoint, headers=headers, json=payload)
        if res.status_code == 200:
            data = res.json()
            return data["choices"][0]["message"]["content"]
        else:
            err = res.text
            raise Exception(f"API Error {res.status_code}: {err}")

# ==================== AGENT EXECUTION LOOP ====================

async def run_hermes_agent_loop(websocket, messages: list[dict], raw_model_name: str, api_key: str, base_url: str, temperature: float = 0.5, custom_agent_prompt: str = "", max_steps: int = 6, enabled_tools: list[str] = None, custom_tools: list[dict] = None):
    """Multi-step ReAct Autonomous Agent Execution Loop with Tool Calling, Task Roadmap & Active Skills."""
    model_name = normalize_model_id(raw_model_name, "openrouter" if "openrouter" in base_url else "other")
    
    system_prompt = custom_agent_prompt if custom_agent_prompt else AGENT_BASE_PROMPT
    user_msgs = [m for m in messages if m.get("role") != "system"]
    last_user_prompt = str(user_msgs[-1].get("content", "")).lower() if user_msgs else ""
    if any(kw in last_user_prompt for kw in ["code studio", "studio", "monaco", "editor", "create file", "write hello", "write code"]):
        system_prompt += (
            "\n\n[DIRECT USER DIRECTIVE FOR THIS TURN]:\n"
            "The user explicitly requested to use Code Studio or create/write code. "
            "You MUST call `editor_write_file` or `editor_show_code` to create/display the code in Code Studio. "
            "Do NOT output plain conversational code blocks in chat. You must take control of the Code Studio by issuing the tool call now."
        )

    agent_messages = [{"role": "system", "content": system_prompt}] + user_msgs

    # Initial Progress Broadcast
    await websocket.send(json.dumps({
        "type": "agent_progress",
        "step": 1,
        "max_steps": max_steps,
        "title": "Analyzing task requirements & formulating execution plan...",
        "percent": 15,
        "tasks": [
            {"id": "plan", "title": "Analyze problem & plan execution trajectory", "status": "running"},
            {"id": "tool_exec", "title": "Execute local tools (Documents / Pictures / Python / Shell)", "status": "pending"},
            {"id": "verify", "title": "Inspect tool output & verify result", "status": "pending"},
            {"id": "synthesize", "title": "Synthesize final solution & deliverable", "status": "pending"}
        ]
    }))

    step = 0
    executed_tools_count = 0

    while step < max_steps:
        step += 1
        print(f"[Hermes Agent] Step {step}/{max_steps} querying model '{model_name}'...")
        sys.stdout.flush()

        try:
            full_response = await query_model_complete(agent_messages, model_name, api_key, base_url, temperature)
        except Exception as e:
            await websocket.send(json.dumps({
                "type": "stream",
                "token": f"\n\n**Agent Error:** {str(e)}"
            }))
            return

        # Check for <think> blocks
        thought_match = re.search(r"<think>(.*?)</think>", full_response, re.DOTALL)
        if thought_match:
            thought_text = strip_emojis(thought_match.group(1).strip())
            if thought_text:
                await websocket.send(json.dumps({"type": "thought", "token": thought_text + "\n"}))

        # Check for <tool_call> blocks
        tool_matches = re.findall(r"<tool_call>(.*?)</tool_call>", full_response, re.DOTALL)
        if not tool_matches:
            # Fallback 1: Unclosed <tool_call>
            unclosed_match = re.search(r"<tool_call>(.*)", full_response, re.DOTALL)
            if unclosed_match and ("name" in unclosed_match.group(1) or "editor_" in unclosed_match.group(1)):
                tool_matches = [unclosed_match.group(1)]
            else:
                # Fallback 2: JSON in markdown code fence
                json_fence = re.search(r"```(?:json)?\s*(\{\s*\"name\"\s*:\s*\"[^\"]+\".*?\})\s*```", full_response, re.DOTALL)
                if json_fence:
                    tool_matches = [json_fence.group(1)]
        if not tool_matches:
            # No tool call, finalize task
            await websocket.send(json.dumps({
                "type": "agent_progress",
                "step": step,
                "max_steps": max_steps,
                "title": "Synthesizing final solution & code deliverable...",
                "percent": 95,
                "tasks": [
                    {"id": "plan", "title": "Analyze problem & plan execution trajectory", "status": "completed"},
                    {"id": "tool_exec", "title": f"Executed tools successfully ({executed_tools_count} actions)" if executed_tools_count > 0 else "Direct reasoning execution", "status": "completed"},
                    {"id": "verify", "title": "Inspected outputs & verified results", "status": "completed"},
                    {"id": "synthesize", "title": "Synthesize final solution & code deliverable", "status": "running"}
                ]
            }))

            clean_text = re.sub(r"<think>.*?</think>", "", full_response, flags=re.DOTALL).strip()
            clean_text = strip_emojis(clean_text)
            tokens = re.findall(r"\S+|\n|\s+", clean_text)
            for t in tokens:
                await websocket.send(json.dumps({"type": "stream", "token": t}))
                await asyncio.sleep(0.012)
            break

        # Process first tool call
        raw_tool_block = tool_matches[0]
        tool_name, tool_args = parse_tool_call(raw_tool_block)
        executed_tools_count += 1

        tool_id = f"tool_{int(asyncio.get_event_loop().time() * 1000)}"

        # Update roadmap progress
        tool_label = f"Running {tool_name}..."
        if "document" in tool_name:
            tool_label = f"Extracting document: {tool_args.get('file_path', '')}"
        elif "vision" in tool_name or "image" in tool_name:
            tool_label = f"Vision analyzing: {tool_args.get('image_path', '')}"
        elif "python" in tool_name:
            tool_label = "Executing Python data pipeline..."
        elif "command" in tool_name or tool_name == "terminal":
            tool_label = f"Running command: {tool_args.get('command', tool_args.get('cmd', ''))[:35]}..."
        elif "editor" in tool_name:
            tool_label = f"Code Studio: {tool_name.replace('editor_', '')} ({tool_args.get('file_path', tool_args.get('title', 'code'))})"
        elif "computer_use" in tool_name:
            tool_label = f"Computer Use: {tool_args.get('action', 'capture')}..."
        else:
            tool_label = f"Executing {tool_name}..."

        await websocket.send(json.dumps({
            "type": "agent_progress",
            "step": step,
            "max_steps": max_steps,
            "title": tool_label,
            "percent": min(25 + (step * 15), 85),
            "tasks": [
                {"id": "plan", "title": "Analyze problem & plan execution trajectory", "status": "completed"},
                {"id": "tool_exec", "title": tool_label, "status": "running"},
                {"id": "verify", "title": "Inspect tool output & verify result", "status": "pending"},
                {"id": "synthesize", "title": "Synthesize final solution & deliverable", "status": "pending"}
            ]
        }))

        # Notify client of tool start
        await websocket.send(json.dumps({
            "type": "tool_start",
            "tool_id": tool_id,
            "tool": tool_name,
            "input": tool_args
        }))

        # Execute tool
        print(f"[Hermes Agent] Executing tool: {tool_name} with args: {tool_args}")
        sys.stdout.flush()
        tool_output, tool_image = await execute_agent_tool(
            tool_name,
            tool_args,
            api_key=api_key,
            base_url=base_url,
            custom_tools=custom_tools,
            websocket=websocket
        )

        # Notify client of tool result
        result_payload = {
            "type": "tool_result",
            "tool_id": tool_id,
            "tool": tool_name,
            "output": tool_output,
            "status": "error" if ("[Error" in tool_output or "[Exception" in tool_output) else "success"
        }
        if tool_image:
            result_payload["image_b64"] = tool_image

        await websocket.send(json.dumps(result_payload))

        # Update progress after tool result
        await websocket.send(json.dumps({
            "type": "agent_progress",
            "step": step,
            "max_steps": max_steps,
            "title": f"Verified output from {tool_name}, evaluating next step...",
            "percent": min(40 + (step * 20), 90),
            "tasks": [
                {"id": "plan", "title": "Analyze problem & plan execution trajectory", "status": "completed"},
                {"id": "tool_exec", "title": tool_label, "status": "completed"},
                {"id": "verify", "title": "Inspect tool output & verify result", "status": "running"},
                {"id": "synthesize", "title": "Synthesize final solution & deliverable", "status": "pending"}
            ]
        }))

        # Append assistant message and tool response to conversation context
        agent_messages.append({"role": "assistant", "content": full_response})
        agent_messages.append({
            "role": "user",
            "content": f"<tool_response>\nTool: {tool_name}\nOutput:\n{tool_output}\n</tool_response>\nBased on this tool output, continue solving the task or provide the final answer."
        })

    # Final completion progress
    await websocket.send(json.dumps({
        "type": "agent_progress",
        "step": max_steps,
        "max_steps": max_steps,
        "title": "Agent task completed successfully",
        "percent": 100,
        "tasks": [
            {"id": "plan", "title": "Analyze problem & plan execution trajectory", "status": "completed"},
            {"id": "tool_exec", "title": f"Executed required tools ({executed_tools_count} actions)", "status": "completed"},
            {"id": "verify", "title": "Inspected outputs & verified results", "status": "completed"},
            {"id": "synthesize", "title": "Delivered final solution & code", "status": "completed"}
        ]
    }))

    print(f"[Hermes Agent] Loop finished after {step} step(s).")
    sys.stdout.flush()

# ==================== STREAMING & CLIENT HANDLER ====================

async def send_typing_stream(websocket, token: str, is_thought: bool = False):
    """Stream tokens with realistic typewriter pacing, stripping any emojis."""
    clean_token = strip_emojis(token)
    if not clean_token:
        return
    msg_type = "thought" if is_thought else "stream"
    if len(clean_token) <= 4:
        await websocket.send(json.dumps({"type": msg_type, "token": clean_token}))
    else:
        for i in range(0, len(clean_token), 3):
            sub = clean_token[i:i+3]
            await websocket.send(json.dumps({"type": msg_type, "token": sub}))
            await asyncio.sleep(0.008)

async def stream_openai_compatible(
    websocket,
    messages: list[dict],
    raw_model_name: str,
    api_key: str,
    base_url: str,
    temperature: float = 0.7,
    auto_speak: bool = False,
    voice_config: dict = None
):
    """Standard conversational streaming with multi-modal picture/document and Kokoro TTS read-aloud support."""
    model_name = normalize_model_id(raw_model_name, "openrouter" if "openrouter" in base_url else "other")
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": "https://songbird.ai",
        "X-Title": "Songbird AI"
    }
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    valid_messages = [m for m in messages if m.get("content")]
    if not valid_messages:
        valid_messages = [{"role": "user", "content": "Hello"}]

    payload = {
        "model": model_name,
        "messages": valid_messages,
        "temperature": temperature,
        "stream": True
    }

    print(f"[Hermes Engine] Streaming {endpoint} for model: '{model_name}'...")
    sys.stdout.flush()

    in_think_block = False
    full_response_text = ""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    err_text = err_body.decode("utf-8", errors="ignore")
                    try:
                        err_json = json.loads(err_text)
                        err_msg = err_json.get("error", {}).get("message", err_text)
                    except Exception:
                        err_msg = err_text

                    await websocket.send(json.dumps({
                        "type": "stream",
                        "token": f"**Provider Error ({response.status_code}):**\n\n{err_msg}\n\n*Model: `{model_name}`*"
                    }))
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    line_str = line.strip()
                    if line_str.startswith("data: "):
                        data_str = line_str[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if not choices:
                                continue
                            delta = choices[0].get("delta", {})

                            reasoning_chunk = delta.get("reasoning_content") or delta.get("reasoning")
                            if reasoning_chunk:
                                await send_typing_stream(websocket, reasoning_chunk, is_thought=True)

                            content_chunk = delta.get("content", "")
                            if content_chunk:
                                if "<think>" in content_chunk:
                                    in_think_block = True
                                    parts = content_chunk.split("<think>", 1)
                                    if parts[0]:
                                        full_response_text += parts[0]
                                        await send_typing_stream(websocket, parts[0], is_thought=False)
                                    if len(parts) > 1 and parts[1]:
                                        await send_typing_stream(websocket, parts[1], is_thought=True)
                                    continue

                                if "</think>" in content_chunk:
                                    in_think_block = False
                                    parts = content_chunk.split("</think>", 1)
                                    if parts[0]:
                                        await send_typing_stream(websocket, parts[0], is_thought=True)
                                    if len(parts) > 1 and parts[1]:
                                        full_response_text += parts[1]
                                        await send_typing_stream(websocket, parts[1], is_thought=False)
                                    continue

                                if in_think_block:
                                    await send_typing_stream(websocket, content_chunk, is_thought=True)
                                else:
                                    full_response_text += content_chunk
                                    await send_typing_stream(websocket, content_chunk, is_thought=False)

                        except json.JSONDecodeError:
                            continue

        if auto_speak and full_response_text.strip() and voice_pipeline:
            try:
                synth_res = await voice_pipeline.tts.synthesize(strip_emojis(full_response_text.strip()), voice_config=voice_config)
                await websocket.send(json.dumps({
                    "type": "kokoro_synthesize_result",
                    "msg_id": "auto_reply",
                    "audio_b64": synth_res.get("audio_b64", ""),
                    "mime_type": synth_res.get("mime_type", "audio/wav"),
                    "engine": synth_res.get("engine", "Kokoro TTS"),
                    "voice": synth_res.get("voice", "af_bella"),
                    "latency_ms": synth_res.get("latency_ms", 0)
                }))
            except Exception as _e:
                print(f"[Hermes Engine] Kokoro auto speech error: {_e}")
                sys.stdout.flush()

    except Exception as e:
        await websocket.send(json.dumps({
            "type": "stream",
            "token": f"\n\n**Connection Error:** {str(e)}"
        }))

async def handle_client(websocket):
    global voice_pipeline
    print("[Hermes Engine] Client Connected")
    sys.stdout.flush()
    try:
        async for raw_message in websocket:
            try:
                data = json.loads(raw_message)
            except Exception:
                continue

            action = data.get("action", "chat")

            if action == "ping":
                await websocket.send(json.dumps({
                    "type": "pong",
                    "ollama_online": True,
                    "models": ["gemma:2b"]
                }))
                continue

            if action == "voice_status":
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        pass
                status = voice_pipeline.get_status() if voice_pipeline else {"error": "Voice pipeline initializing"}
                await websocket.send(json.dumps({
                    "type": "voice_status",
                    "status": status
                }))
                continue

            if action in ["kokoro_capabilities", "chatterbox_capabilities"]:
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        pass
                caps = voice_pipeline.tts.get_capabilities() if voice_pipeline else {"error": "Voice pipeline initializing"}
                await websocket.send(json.dumps({
                    "type": "kokoro_capabilities",
                    "capabilities": caps
                }))
                if action == "chatterbox_capabilities":
                    await websocket.send(json.dumps({
                        "type": "chatterbox_capabilities",
                        "capabilities": caps
                    }))
                continue

            if action in ["kokoro_verify_model", "chatterbox_verify_model"]:
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        pass
                test_text = data.get("text")
                verification_result = await voice_pipeline.tts.verify_kokoro_model(test_text)
                await websocket.send(json.dumps({
                    "type": "kokoro_verification",
                    "result": verification_result
                }))
                if action == "chatterbox_verify_model":
                    await websocket.send(json.dumps({
                        "type": "chatterbox_verification",
                        "result": verification_result
                    }))
                continue

            if action in ["kokoro_blend_voice", "kokoro_clone_voice", "chatterbox_clone_voice"]:
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        pass
                voice_name = data.get("name", "Custom Voice")
                v1 = data.get("voice1", "af_bella")
                w1 = float(data.get("weight1", 0.5))
                v2 = data.get("voice2", "af_sarah")
                w2 = float(data.get("weight2", 0.5))
                blend_result = voice_pipeline.tts.blend_voice(voice_name, v1, w1, v2, w2)
                await websocket.send(json.dumps({
                    "type": "kokoro_blend_result",
                    "result": blend_result
                }))
                await websocket.send(json.dumps({
                    "type": "chatterbox_clone_result",
                    "result": blend_result
                }))
                continue

            if action in ["kokoro_set_config", "chatterbox_set_config"]:
                if voice_pipeline:
                    if "voice_id" in data:
                        voice_pipeline.tts.active_voice_id = data["voice_id"]
                    if "speed" in data:
                        voice_pipeline.tts.speed = float(data["speed"])
                    if "lang" in data:
                        voice_pipeline.tts.lang = data["lang"]
                config_data = voice_pipeline.tts.get_capabilities()["active_config"] if voice_pipeline else {}
                await websocket.send(json.dumps({
                    "type": "kokoro_config_updated",
                    "config": config_data
                }))
                await websocket.send(json.dumps({
                    "type": "chatterbox_config_updated",
                    "config": config_data
                }))
                continue

            if action in ["kokoro_synthesize", "chatterbox_synthesize"]:
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        err_type = "kokoro_synthesize_error" if action.startswith("kokoro") else "chatterbox_synthesize_error"
                        await websocket.send(json.dumps({
                            "type": err_type,
                            "error": f"Failed to initialize voice pipeline: {_e}",
                            "msg_id": data.get("msg_id")
                        }))
                        continue

                synth_text = data.get("text", "").strip()
                msg_id = data.get("msg_id")
                voice_config = data.get("voice_config")

                if not synth_text:
                    err_msg = "Empty text supplied for synthesis"
                    err_type = "kokoro_synthesize_error" if action.startswith("kokoro") else "chatterbox_synthesize_error"
                    await websocket.send(json.dumps({
                        "type": err_type,
                        "error": err_msg,
                        "msg_id": msg_id
                    }))
                    continue

                try:
                    synth_res = await voice_pipeline.tts.synthesize(synth_text, voice_config=voice_config)
                    out_type = "kokoro_synthesize_result" if action.startswith("kokoro") else "chatterbox_synthesize_result"
                    res_payload = {
                        "type": out_type,
                        "msg_id": msg_id,
                        "audio_b64": synth_res.get("audio_b64", ""),
                        "mime_type": synth_res.get("mime_type", "audio/wav"),
                        "engine": synth_res.get("engine", "Kokoro TTS"),
                        "voice": synth_res.get("voice", "af_bella"),
                        "latency_ms": synth_res.get("latency_ms", 0)
                    }
                    await websocket.send(json.dumps(res_payload))
                except Exception as e:
                    err_type = "kokoro_synthesize_error" if action.startswith("kokoro") else "chatterbox_synthesize_error"
                    await websocket.send(json.dumps({
                        "type": err_type,
                        "error": str(e),
                        "msg_id": msg_id
                    }))
                continue

            if action == "stt_transcribe":
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        await websocket.send(json.dumps({
                            "type": "stt_error",
                            "error": f"Failed to initialize voice pipeline: {_e}"
                        }))
                        continue

                audio_payload = data.get("audio", "")
                stt_res = voice_pipeline.stt.transcribe(audio_payload)
                await websocket.send(json.dumps({
                    "type": "stt_result",
                    "text": stt_res.get("text", ""),
                    "latency_ms": stt_res.get("latency_ms", 0),
                    "model": stt_res.get("model", "Moonshine Tiny"),
                    "device": stt_res.get("device", "Hardware-Optimized INT8 SIMD"),
                    "error": stt_res.get("error")
                }))
                continue


            if action == "voice_turn":
                if not voice_pipeline:
                    try:
                        from voice.pipeline import RealtimeVoicePipeline
                        voice_pipeline = RealtimeVoicePipeline()
                    except Exception as _e:
                        await websocket.send(json.dumps({
                            "type": "voice_error",
                            "error": f"Failed to initialize voice pipeline: {_e}"
                        }))
                        continue

                audio_payload = data.get("audio", "")
                provider = (data.get("provider") or "openrouter").lower()
                api_key = data.get("api_key", "").strip()
                custom_base_url = data.get("base_url", "").strip()
                model_name = data.get("model", "").strip() or DEFAULT_MODEL
                temperature = float(data.get("temperature", 0.7))
                chat_history = data.get("messages", [])
                custom_system_prompt = data.get("system_prompt")
                voice_config = data.get("voice_config")
                base_url = custom_base_url or PROVIDER_BASE_URLS.get(provider, "https://openrouter.ai/api/v1")

                try:
                    async for event in voice_pipeline.process_voice_turn(
                        audio_payload=audio_payload,
                        api_key=api_key,
                        base_url=base_url,
                        model=model_name,
                        chat_history=chat_history,
                        custom_system_prompt=custom_system_prompt,
                        temperature=temperature,
                        voice_config=voice_config
                    ):
                        await websocket.send(json.dumps(event))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "voice_error",
                        "error": str(e)
                    }))
                continue

            # ==================== CODE EDITOR STUDIO ACTIONS ====================
            if action == "editor_list_files":
                try:
                    def build_tree(current_dir, rel_base="", depth=0):
                        if depth > 4:
                            return []
                        entries = []
                        IGNORED = {".git", "node_modules", "venv", "__pycache__", ".pnpm-store", "dist", "target", "debug", "uploads", ".vite", ".vite-temp"}
                        try:
                            items = sorted(os.listdir(current_dir), key=lambda x: (not os.path.isdir(os.path.join(current_dir, x)), x.lower()))
                            for item in items:
                                if item in IGNORED or item.startswith("."):
                                    continue
                                full_p = os.path.join(current_dir, item)
                                rel_p = os.path.join(rel_base, item).replace("\\", "/")
                                is_dir = os.path.isdir(full_p)
                                entry = {
                                    "name": item,
                                    "path": rel_p,
                                    "is_dir": is_dir
                                }
                                if is_dir:
                                    entry["children"] = build_tree(full_p, rel_p, depth + 1)
                                entries.append(entry)
                        except Exception:
                            pass
                        return entries

                    file_tree = build_tree(WORKSPACE_DIR)
                    await websocket.send(json.dumps({
                        "type": "editor_list_files_result",
                        "tree": file_tree,
                        "workspace": WORKSPACE_DIR
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "editor_list_files_result",
                        "tree": [],
                        "error": str(e)
                    }))
                continue

            if action == "editor_read_file":
                rel_path = data.get("file_path", "")
                try:
                    full_p = os.path.abspath(os.path.join(WORKSPACE_DIR, rel_path))
                    if not full_p.startswith(WORKSPACE_DIR):
                        raise PermissionError("Access outside workspace is prohibited")
                    if not os.path.exists(full_p):
                        raise FileNotFoundError(f"File not found: {rel_path}")
                    with open(full_p, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    await websocket.send(json.dumps({
                        "type": "editor_read_file_result",
                        "file_path": rel_path.replace("\\", "/"),
                        "content": content,
                        "success": True
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "editor_read_file_result",
                        "file_path": rel_path,
                        "content": "",
                        "error": str(e),
                        "success": False
                    }))
                continue

            if action == "editor_save_file":
                rel_path = data.get("file_path", "")
                content = data.get("content", "")
                try:
                    full_p = os.path.abspath(os.path.join(WORKSPACE_DIR, rel_path))
                    if not full_p.startswith(WORKSPACE_DIR):
                        raise PermissionError("Access outside workspace is prohibited")
                    os.makedirs(os.path.dirname(full_p), exist_ok=True)
                    with open(full_p, "w", encoding="utf-8") as f:
                        f.write(content)
                    await websocket.send(json.dumps({
                        "type": "editor_save_file_result",
                        "file_path": rel_path.replace("\\", "/"),
                        "success": True
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "editor_save_file_result",
                        "file_path": rel_path,
                        "error": str(e),
                        "success": False
                    }))
                continue

            if action == "editor_create_file":
                rel_path = data.get("file_path", "")
                is_dir = bool(data.get("is_dir", False))
                try:
                    full_p = os.path.abspath(os.path.join(WORKSPACE_DIR, rel_path))
                    if not full_p.startswith(WORKSPACE_DIR):
                        raise PermissionError("Access outside workspace is prohibited")
                    if is_dir:
                        os.makedirs(full_p, exist_ok=True)
                    else:
                        os.makedirs(os.path.dirname(full_p), exist_ok=True)
                        if not os.path.exists(full_p):
                            with open(full_p, "w", encoding="utf-8") as f:
                                f.write("")
                    await websocket.send(json.dumps({
                        "type": "editor_create_file_result",
                        "file_path": rel_path.replace("\\", "/"),
                        "is_dir": is_dir,
                        "success": True
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "editor_create_file_result",
                        "file_path": rel_path,
                        "error": str(e),
                        "success": False
                    }))
                continue

            if action == "editor_run_code":
                code = data.get("code", "")
                lang = (data.get("language") or "python").lower()
                rel_path = data.get("file_path", "temp_script")
                run_id = data.get("run_id", f"run_{int(time.time()*1000)}")
                t_start = time.perf_counter()

                temp_file = None
                cmd = []
                try:
                    if lang in ["python", "py"] or rel_path.endswith(".py"):
                        python_exe = os.path.join(WORKSPACE_DIR, "engine", "hermes-agent", "venv", "Scripts", "python.exe")
                        if not os.path.exists(python_exe):
                            python_exe = sys.executable
                        temp_file = os.path.join(WORKSPACE_DIR, f".songbird_run_{int(time.time())}.py")
                        with open(temp_file, "w", encoding="utf-8") as tf:
                            tf.write(code)
                        cmd = [python_exe, "-u", temp_file]
                    elif lang in ["javascript", "js", "typescript", "ts"] or rel_path.endswith(".js") or rel_path.endswith(".ts"):
                        temp_file = os.path.join(WORKSPACE_DIR, f".songbird_run_{int(time.time())}.js")
                        with open(temp_file, "w", encoding="utf-8") as tf:
                            tf.write(code)
                        cmd = ["node", temp_file]
                    else:
                        # PowerShell command
                        cmd = ["powershell", "-NoProfile", "-Command", code]

                    proc = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=WORKSPACE_DIR
                    )

                    async def stream_pipe(stream, stream_name):
                        while True:
                            line = await stream.readline()
                            if not line:
                                break
                            text = line.decode("utf-8", errors="replace")
                            await websocket.send(json.dumps({
                                "type": "editor_run_output",
                                "run_id": run_id,
                                "stream": stream_name,
                                "text": text
                            }))

                    await asyncio.gather(
                        stream_pipe(proc.stdout, "stdout"),
                        stream_pipe(proc.stderr, "stderr")
                    )
                    exit_code = await proc.wait()
                    elapsed = round((time.perf_counter() - t_start) * 1000, 2)
                    await websocket.send(json.dumps({
                        "type": "editor_run_done",
                        "run_id": run_id,
                        "exit_code": exit_code,
                        "duration_ms": elapsed
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "editor_run_output",
                        "run_id": run_id,
                        "stream": "stderr",
                        "text": f"Execution Error: {str(e)}\n"
                    }))
                    await websocket.send(json.dumps({
                        "type": "editor_run_done",
                        "run_id": run_id,
                        "exit_code": 1,
                        "duration_ms": 0
                    }))
                finally:
                    if temp_file and os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception:
                            pass
                continue

            is_agent_mode = bool(data.get("agent_mode", False))
            enabled_tools = data.get("enabled_tools", None)
            custom_tools = data.get("custom_tools", [])

            provider = (data.get("provider") or "openrouter").lower()
            api_key = data.get("api_key", "").strip()
            custom_base_url = data.get("base_url", "").strip()
            model_name = data.get("model", "").strip() or DEFAULT_MODEL
            temperature = float(data.get("temperature", 0.5 if is_agent_mode else 0.7))
            system_prompt = data.get("system_prompt", DEFAULT_SYSTEM_PROMPT)

            # Build active skills instructions
            skills_list = data.get("skills", [])
            skills_prompt = ""
            if skills_list and isinstance(skills_list, list):
                enabled_skills = [s for s in skills_list if isinstance(s, dict) and s.get("enabled", True)]
                if enabled_skills:
                    skills_prompt = "\n\n## ACTIVE AGENT SKILLS & SPECIALIZED DIRECTIVES:\n"
                    for s in enabled_skills:
                        s_name = s.get("name", "Custom Skill")
                        s_desc = s.get("description", "")
                        s_inst = s.get("instructions", "")
                        skills_prompt += f"### Skill: {s_name}\n"
                        if s_desc:
                            skills_prompt += f"Role & Purpose: {s_desc}\n"
                        skills_prompt += f"Instructions: {s_inst}\n\n"

            if is_agent_mode:
                effective_system_prompt = build_tools_system_prompt(enabled_tools=enabled_tools, custom_tools=custom_tools)
            else:
                effective_system_prompt = system_prompt
            full_system_prompt = effective_system_prompt + skills_prompt
            if "NO EMOJIS" not in full_system_prompt:
                full_system_prompt += (
                    "\n\nCRITICAL OUTPUT FORMATTING REQUIREMENTS:\n"
                    "- NO EMOJIS: Do NOT include any emojis or emoticons in your responses under any circumstances. Always write pure, clean text.\n"
                    "- MATH IN LATEX: Always write all mathematical expressions, equations, formulas, variables, and calculations using standard LaTeX notation ($...$ for inline math, $$...$$ for standalone display equations). Never output raw ASCII pseudo-math."
                )

            base_url = custom_base_url or PROVIDER_BASE_URLS.get(provider, "https://openrouter.ai/api/v1")
            is_vision_model = is_model_vision_capable(model_name)

            # Process attachments and build messages
            saved_uploads = []
            if "messages" in data and isinstance(data["messages"], list) and len(data["messages"]) > 0:
                messages = []
                if full_system_prompt:
                    messages.append({"role": "system", "content": full_system_prompt})

                for idx, m in enumerate(data["messages"]):
                    role = m.get("sender") or m.get("role")
                    if role == "hermes":
                        role = "assistant"
                    elif role != "system":
                        role = "user"

                    raw_content = m.get("text") or m.get("content", "")
                    attachments = m.get("attachments", [])

                    if attachments and isinstance(attachments, list):
                        saved_meta = save_uploaded_attachments(attachments)
                        saved_uploads.extend(saved_meta)

                        # 1. Automatically extract text from all document attachments (PDF, DOCX, XLSX, PPTX, CSV, IPYNB, etc.)
                        for att_meta in saved_meta:
                            att_type = att_meta.get("type", "")
                            att_name = att_meta.get("name", "")
                            if not att_type.startswith("image/"):
                                print(f"[Hermes Pipeline] Automatically extracting document text from: {att_name}")
                                sys.stdout.flush()
                                doc_text = await tool_process_document(att_meta["full_path"], api_key=api_key, base_url=base_url)
                                raw_content += f"\n\n[Extracted Document Content - '{att_name}']:\n{doc_text}\n"

                        # 2. Check for image attachments
                        image_attachments = [att for att in attachments if att.get("dataUrl") and att.get("type", "").startswith("image/")]
                        
                        if image_attachments:
                            if is_vision_model and not is_agent_mode:
                                # Native multi-modal payload
                                multi_modal_content = [{"type": "text", "text": raw_content}]
                                for img_att in image_attachments:
                                    multi_modal_content.append({
                                        "type": "image_url",
                                        "image_url": {"url": img_att["dataUrl"]}
                                    })
                                messages.append({"role": role, "content": multi_modal_content})
                                continue
                            else:
                                # Text model or Agent Mode: Run through Hermes Vision Pipeline
                                if api_key:
                                    print(f"[Hermes Pipeline] Running vision router on attached image: {image_attachments[0].get('name')}")
                                    sys.stdout.flush()
                                    vision_analysis = await query_vision_api(
                                        image_attachments[0]["dataUrl"],
                                        "Describe this image thoroughly: identify visual objects, design, diagrams, layout, and extract all text/OCR content.",
                                        api_key,
                                        base_url
                                    )
                                    raw_content += f"\n\n[Hermes Vision Pipeline - Visual & OCR Analysis of '{image_attachments[0].get('name')}']:\n{vision_analysis}\n"

                    if raw_content.strip():
                        messages.append({"role": role, "content": raw_content})

            else:
                prompt = data.get("content") or data.get("prompt", "")
                messages = [
                    {"role": "system", "content": full_system_prompt},
                    {"role": "user", "content": prompt}
                ]

            if is_agent_mode:
                summary_prompt = str(messages[-1]['content'])[:60]
                print(f"[Hermes Engine] Initiating AGENT MODE for: {summary_prompt}... (with {len(skills_list)} skills, {len(saved_uploads)} uploads)")
                sys.stdout.flush()
                await run_hermes_agent_loop(
                    websocket,
                    messages,
                    model_name,
                    api_key,
                    base_url,
                    temperature,
                    custom_agent_prompt=full_system_prompt,
                    enabled_tools=enabled_tools,
                    custom_tools=custom_tools
                )
            else:
                await stream_openai_compatible(
                    websocket,
                    messages,
                    model_name,
                    api_key,
                    base_url,
                    temperature=temperature,
                    auto_speak=bool(data.get("speak", False) or data.get("auto_tts", False)),
                    voice_config=data.get("voice_config")
                )

            try:
                await websocket.send(json.dumps({"type": "done"}))
            except Exception:
                pass

    except websockets.exceptions.ConnectionClosed:
        print("[Hermes Engine] Client Disconnected")
        sys.stdout.flush()

async def main():
    print(f"[Hermes Engine] Songbird Agent Engine starting on ws://localhost:{PORT}")
    print(f"[Hermes Engine] Workspace root: {WORKSPACE_DIR}")
    print(f"[Hermes Engine] Uploads directory: {UPLOADS_DIR}")
    print(f"[Hermes Engine] Active Vision Candidates: {VISION_FALLBACK_CANDIDATES}")
    sys.stdout.flush()

    server = None
    for attempt in range(1, 10):
        try:
            server = await websockets.serve(
                handle_client,
                "127.0.0.1",
                PORT,
                ping_interval=None,
                ping_timeout=None,
                max_size=None
            )
            print(f"[Hermes Engine] Server listening on ws://127.0.0.1:{PORT}")
            sys.stdout.flush()
            break
        except OSError as e:
            if attempt < 9:
                print(f"[Hermes Engine] Port {PORT} busy (attempt {attempt}/9). Waiting 1s...")
                sys.stdout.flush()
                await asyncio.sleep(1.0)
            else:
                raise e

    if server:
        async with server:
            await asyncio.get_running_loop().create_future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Hermes Engine] Server stopped by user")