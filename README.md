# 🦅 Songbird AI

An autonomous, multi-modal desktop AI assistant and agent engine powered by **Tauri v2**, **React 19**, and the **Hermes Agent Engine**.

---

## 🌟 Key Features

- **🤖 Autonomous Hermes Agent Mode**:
  - ReAct execution loop with local system tools: Python execution (`PIL`, `pypdf`, data processing), PowerShell / Bash command execution, file manipulation, and web research.
  - Real-time interactive execution roadmap and task progress tracking.

- **🖼️ Multimodal Vision & Resilient Failover Router**:
  - Native image analysis for vision models (Claude 3.5 Sonnet, GPT-4o, Google Gemma 4 Vision).
  - **Intelligent Vision Router** for text-only models (DeepSeek-R1, Ling 3.0 Flash, Llama 3.3): automatically extracts visual breakdown and OCR text with a 5-model failover chain (`Gemma 4 26B` → `Gemma 4 31B` → `MiniMax M3` → `Nemotron Omni`).

- **📄 Universal Document Processing Pipeline**:
  - Extracts and converts `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.csv`, `.ipynb`, and source code into clean paginated Markdown.
  - **Scanned Page Recovery**: Automatically detects zero-text scanned PDF pages, extracts the embedded page images, and transcribes handwritten/printed text via Vision OCR.

- **⌨️ 60 FPS Client-Side Typewriter Streaming**:
  - High-precision `requestAnimationFrame` token queue decouples network bursts from display, producing a fluid character-by-character typing effect.
  - Glowing neon rose typing cursor (`│`) with real-time word tracking.

- **🌓 Dynamic Dark & Light Modes**:
  - Instant theme switching with custom red pixel-art bird logos for both Dark and Light themes.
  - Pinned, stable bottom chat composer that stays anchored in place while text streams.

- **🧠 Local Memory Engine & Voice**:
  - Multi-session local storage and conversational history persistence.
  - Built-in Text-to-Speech (TTS) for read-aloud responses.

---

## 🏗️ Architecture

```
[Desktop UI (Tauri v2 + React + TS)]
        │
        │ WebSocket (:18789)
        ▼
[Hermes Engine (Python Daemon)]
  ├── Multimodal Vision Router (Failover Chain)
  ├── Document Pipeline (pypdf, docx, pptx, xlsx)
  ├── Local Subprocess Sandboxes (Python, Shell)
  └── Multi-Provider LLM Gateway (OpenRouter, Ollama, OpenAI)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ & **pnpm**: `npm install -g pnpm`
- **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Python**: 3.10+

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Setup Hermes Agent Environment
```bash
cd engine/hermes-agent
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
cd ../..
```

### 4. Run Locally
```bash
# Start desktop app & dev server
pnpm dev:desktop

# In a separate terminal, start the Hermes Engine daemon
cd engine/hermes-agent
.\venv\Scripts\python server.py
```

---

## 📄 License
MIT
