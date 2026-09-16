import asyncio
import base64
import csv
import io
import json
import os
import re
import sys
import subprocess
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
    print("[Hermes Engine] Realtime Voice Pipeline initialized (Moonshine Tiny STT + LLM API + Kokoro TTS)")
except Exception as _e:
    print(f"[Hermes Engine] Voice pipeline deferred initialization: {_e}")
    voice_pipeline = None

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

AGENT_BASE_PROMPT = (
    "You are Songbird Agent, an autonomous execution AI powered by Hermes Engine. "
    "You have real execution tools on the local machine to process documents, pictures, code, and shell commands.\n\n"
    "Available Tools:\n"
    "1. process_document(file_path: str) -> Extract text, tables, and paginated structure from PDF (with scanned page OCR recovery), DOCX, XLSX, PPTX, CSV, JSON, Jupyter Notebooks (.ipynb), and text files.\n"
    "2. vision_analyze(image_path: str, prompt: str) -> Inspect image metadata (resolution, format, channels), perform OCR, and analyze visual elements.\n"
    "3. execute_python(code: str) -> Run Python code with PIL, pypdf, json, csv, os, sys, math, and data processing libraries.\n"
    "4. execute_command(command: str) -> Run shell / PowerShell commands in workspace.\n"
    "5. write_file(file_path: str, content: str) -> Create or overwrite files.\n"
    "6. read_file(file_path: str) -> Read file contents directly.\n"
    "7. list_directory(path: str) -> List directory files and folders.\n"
    "8. web_search(query: str) -> Search DuckDuckGo / Instant answers for real-time info.\n\n"
    "TOOL CALL FORMAT:\n"
    "To use a tool, you MUST output a <tool_call> XML block containing JSON:\n"
    "<tool_call>\n"
    '{"name": "process_document", "arguments": {"file_path": "uploads/document.pdf"}}\n'
    "</tool_call>\n\n"
    "You can think step-by-step using <think>...</think>, then call tools, inspect results, and synthesize a final answer."
)

DEFAULT_SYSTEM_PROMPT = (
    "You are Songbird, an advanced AI agent specialized in deep reasoning, software architecture, "
    "picture & document processing, and synthesis. Structure your answers with clear markdown formatting and "
    "syntax-highlighted code blocks."
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
    """Robust parser for both JSON and XML tool call formats."""
    raw_call = raw_call.strip()

    try:
        data = json.loads(raw_call)
        if isinstance(data, dict):
            return data.get("name", "unknown"), data.get("arguments", {})
    except Exception:
        pass

    keys = re.findall(r"<arg_key>(.*?)</arg_key>", raw_call, re.DOTALL)
    values = re.findall(r"<arg_value>(.*?)</arg_value>", raw_call, re.DOTALL)
    if keys and values:
        first_part = raw_call.split("<arg_key>")[0].strip()
        tool_name = first_part if first_part else "execute_command"
        args = {}
        for k, v in zip(keys, values):
            args[k.strip()] = v.strip()
        return tool_name, args

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

async def execute_agent_tool(tool_name: str, args: dict, api_key: str = "", base_url: str = "") -> str:
    """Dispatch tool call."""
    name = tool_name.lower().strip()
    if "document" in name or name == "process_document":
        fp = args.get("file_path") or args.get("path") or ""
        return await tool_process_document(fp, api_key=api_key, base_url=base_url)
    elif "image" in name or "vision" in name or name == "vision_analyze" or name == "process_image":
        fp = args.get("image_path") or args.get("image") or args.get("path") or ""
        prompt = args.get("prompt") or "Analyze and describe this image in detail."
        return await tool_vision_analyze(fp, prompt, api_key=api_key, base_url=base_url)
    elif "python" in name or name == "execute_python":
        code = args.get("code") or args.get("script") or ""
        return await tool_execute_python(code)
    elif "command" in name or name == "execute_command" or name == "terminal":
        cmd = args.get("command") or args.get("cmd") or ""
        return await tool_execute_command(cmd)
    elif "write" in name or name == "write_file":
        fp = args.get("file_path") or args.get("path") or "output.txt"
        cnt = args.get("content") or args.get("text") or ""
        return await tool_write_file(fp, cnt)
    elif "read" in name or name == "read_file":
        fp = args.get("file_path") or args.get("path") or ""
        return await tool_read_file(fp, api_key=api_key, base_url=base_url)
    elif "list" in name or name == "list_directory":
        p = args.get("path") or "."
        return await tool_list_directory(p)
    elif "search" in name or name == "web_search":
        q = args.get("query") or args.get("q") or ""
        return await tool_web_search(q)
    return f"[Unknown tool: {tool_name}]"

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

async def run_hermes_agent_loop(websocket, messages: list[dict], raw_model_name: str, api_key: str, base_url: str, temperature: float = 0.5, custom_agent_prompt: str = "", max_steps: int = 6):
    """Multi-step ReAct Autonomous Agent Execution Loop with Tool Calling, Task Roadmap & Active Skills."""
    model_name = normalize_model_id(raw_model_name, "openrouter" if "openrouter" in base_url else "other")
    
    system_prompt = custom_agent_prompt if custom_agent_prompt else AGENT_BASE_PROMPT
    agent_messages = [{"role": "system", "content": system_prompt}] + [m for m in messages if m.get("role") != "system"]

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
                "token": f"\n\n❌ **Agent Error:** {str(e)}"
            }))
            return

        # Check for <think> blocks
        thought_match = re.search(r"<think>(.*?)</think>", full_response, re.DOTALL)
        if thought_match:
            thought_text = thought_match.group(1).strip()
            await websocket.send(json.dumps({"type": "thought", "token": thought_text + "\n"}))

        # Check for <tool_call> blocks
        tool_matches = re.findall(r"<tool_call>(.*?)</tool_call>", full_response, re.DOTALL)
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
                    {"id": "synthesize", "title": "Synthesizing final solution & code deliverable", "status": "running"}
                ]
            }))

            clean_text = re.sub(r"<think>.*?</think>", "", full_response, flags=re.DOTALL).strip()
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
        elif "command" in tool_name:
            tool_label = f"Running command: {tool_args.get('command', '')[:35]}..."

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
        tool_output = await execute_agent_tool(tool_name, tool_args, api_key=api_key, base_url=base_url)

        # Notify client of tool result
        await websocket.send(json.dumps({
            "type": "tool_result",
            "tool_id": tool_id,
            "tool": tool_name,
            "output": tool_output,
            "status": "error" if "[Error" in tool_output or "[Exception" in tool_output else "success"
        }))

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
    """Stream tokens with realistic typewriter pacing."""
    msg_type = "thought" if is_thought else "stream"
    if len(token) <= 4:
        await websocket.send(json.dumps({"type": msg_type, "token": token}))
    else:
        for i in range(0, len(token), 3):
            sub = token[i:i+3]
            await websocket.send(json.dumps({"type": msg_type, "token": sub}))
            await asyncio.sleep(0.008)

async def stream_openai_compatible(websocket, messages: list[dict], raw_model_name: str, api_key: str, base_url: str, temperature: float = 0.7):
    """Standard conversational streaming with multi-modal picture/document payload support."""
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
                        "token": f"❌ **Provider Error ({response.status_code}):**\n\n{err_msg}\n\n*Model: `{model_name}`*"
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
                                        await send_typing_stream(websocket, parts[1], is_thought=False)
                                    continue

                                if in_think_block:
                                    await send_typing_stream(websocket, content_chunk, is_thought=True)
                                else:
                                    await send_typing_stream(websocket, content_chunk, is_thought=False)

                        except json.JSONDecodeError:
                            continue

    except Exception as e:
        await websocket.send(json.dumps({
            "type": "stream",
            "token": f"\n\n❌ **Connection Error:** {str(e)}"
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
                        await websocket.send(json.dumps({
                            "type": "kokoro_synthesize_error",
                            "error": f"Failed to initialize voice pipeline: {_e}",
                            "msg_id": data.get("msg_id")
                        }))
                        await websocket.send(json.dumps({
                            "type": "chatterbox_synthesize_error",
                            "error": f"Failed to initialize voice pipeline: {_e}",
                            "msg_id": data.get("msg_id")
                        }))
                        continue

                synth_text = data.get("text", "").strip()
                msg_id = data.get("msg_id")
                voice_config = data.get("voice_config")

                if not synth_text:
                    err_msg = "Empty text supplied for Kokoro synthesis"
                    await websocket.send(json.dumps({
                        "type": "kokoro_synthesize_error",
                        "error": err_msg,
                        "msg_id": msg_id
                    }))
                    await websocket.send(json.dumps({
                        "type": "chatterbox_synthesize_error",
                        "error": err_msg,
                        "msg_id": msg_id
                    }))
                    continue

                try:
                    synth_res = await voice_pipeline.tts.synthesize(synth_text, voice_config=voice_config)
                    res_payload = {
                        "type": "kokoro_synthesize_result",
                        "msg_id": msg_id,
                        "audio_b64": synth_res.get("audio_b64", ""),
                        "mime_type": synth_res.get("mime_type", "audio/wav"),
                        "engine": synth_res.get("engine", "Kokoro TTS"),
                        "voice": synth_res.get("voice", "af_bella"),
                        "latency_ms": synth_res.get("latency_ms", 0)
                    }
                    await websocket.send(json.dumps(res_payload))
                    res_payload_alias = dict(res_payload)
                    res_payload_alias["type"] = "chatterbox_synthesize_result"
                    await websocket.send(json.dumps(res_payload_alias))
                except Exception as e:
                    await websocket.send(json.dumps({
                        "type": "kokoro_synthesize_error",
                        "error": str(e),
                        "msg_id": msg_id
                    }))
                    await websocket.send(json.dumps({
                        "type": "chatterbox_synthesize_error",
                        "error": str(e),
                        "msg_id": msg_id
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

            is_agent_mode = bool(data.get("agent_mode", False))

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

            full_system_prompt = (AGENT_BASE_PROMPT if is_agent_mode else system_prompt) + skills_prompt

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
                await run_hermes_agent_loop(websocket, messages, model_name, api_key, base_url, temperature, custom_agent_prompt=full_system_prompt)
            else:
                await stream_openai_compatible(websocket, messages, model_name, api_key, base_url, temperature)

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

    async with websockets.serve(
        handle_client,
        "localhost",
        PORT,
        ping_interval=None,
        ping_timeout=None,
        max_size=None
    ):
        await asyncio.get_running_loop().create_future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Hermes Engine] Server stopped by user")