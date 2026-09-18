# 🦅 Songbird AI

An autonomous, multi-modal desktop AI assistant and agent engine powered by **Tauri v2**, **React 19**, the **Hermes Agent Engine**, and **Kokoro-82M TTS**.

---

## 🌟 Key Features

- **🤖 Autonomous Hermes Agent Loop**:
  - ReAct multi-step execution loop with local system tools: in-process Python execution (`PIL`, `pypdf`, data processing), PowerShell / Bash command execution, file manipulation, and live web research.
  - Real-time interactive execution roadmap and task milestone tracking.

- **🗣️ Kokoro-82M Neural Text-to-Speech**:
  - Powered by **Kokoro-82M** via [`nazdridoy/kokoro-tts`](https://github.com/nazdridoy/kokoro-tts.git) and high-speed ONNX runtime (24,000 Hz studio-quality audio).
  - **10 Native Voice Presets**: American & British accents (Bella, Sarah, Nicole, Sky, Heart, Adam, Michael, Echo, Emma, George).
  - **Voice Blending Studio**: Interpolate and mix any two speaker style embeddings with customizable weight ratios (e.g. 50% Bella + 50% Sarah).
  - **Dual Failover Pipeline**: Seamless zero-latency fallback to Edge Neural voice and harmonic tone generation so vocal playback never fails.

- **🎙️ 3-Stage Realtime Voice Pipeline**:
  - **Stage 1 (STT)**: Moonshine Tiny fast on-device Speech-to-Text transcription.
  - **Stage 2 (LLM)**: Cloud LLM completion with sentence-boundary detection.
  - **Stage 3 (TTS)**: Kokoro-82M streaming voice synthesis.

- **🖼️ Multimodal Vision & Resilient Failover Router**:
  - Native image analysis for vision-capable models (Claude 3.5 Sonnet, GPT-4o, Google Gemma 4 Vision).
  - **Intelligent Vision Router** for text-only models (DeepSeek-R1, Ling 3.0 Flash, Llama 3.3): automatically extracts visual breakdown and OCR text with a 5-model failover chain (`Gemma 4 26B` → `Gemma 4 31B` → `MiniMax M3` → `Nemotron Omni` → `Inkling`).

- **📄 Universal Document Processing & Scanned Page Recovery**:
  - Extracts text, tables, and structures from `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.csv`, `.ipynb`, and code files into clean paginated Markdown.
  - **Scanned Page Recovery**: Automatically detects zero-text scanned PDF pages, extracts embedded page images, and transcribes handwritten/printed text via Vision OCR.

- **⌨️ 60 FPS Client-Side Typewriter Streaming**:
  - High-precision `requestAnimationFrame` token queue decouples network bursts from display, producing a fluid character-by-character typing effect.
  - Collapsible `<think>` accordion for reasoning models (DeepSeek-R1, Nemotron).

- **🌓 Dynamic Dark & Light Modes**:
  - Instant theme switching with tailored glassmorphic styling and responsive layouts.
  - Multi-session local storage and conversational history persistence with Markdown transcript export.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Desktop Application                  │
│       Tauri v2 + React 19 + 60 FPS Token Queue         │
│          Kokoro Voice Studio & Roadmap Tracker         │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ WebSocket (ws://localhost:18789)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Hermes Engine (server.py)                │
│                                                        │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  Agent ReAct     │  │  3-Stage Voice Pipeline    │  │
│  │  Execution Loop  │  │  - Moonshine STT           │  │
│  │  - Python Exec   │  │  - LLM Sentence Chunking   │  │
│  │  - Shell / Pwsh  │  │  - Kokoro-82M ONNX TTS     │  │
│  │  - Documents     │  └────────────────────────────┘  │
│  │  - Vision OCR    │  ┌────────────────────────────┐  │
│  └──────────────────┘  │  Multi-Provider Gateway    │  │
│                        │  OpenRouter, Ollama, Groq, │  │
│                        │  OpenAI, DeepSeek, Claude  │  │
│                        └────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ & **pnpm**: `npm install -g pnpm`
- **Python**: 3.10 - 3.12
- *(Optional for native Rust build)*: **Rust & Cargo** (`rustup`) + **Microsoft C++ Build Tools**

### 2. Install Dependencies
```bash
# Clone the repository
git clone https://github.com/tanoydev607-maker/project-song-.git
cd project-song-

# Install Node monorepo packages
pnpm install
```

### 3. Setup Hermes Agent Environment & Kokoro Models
```bash
cd engine/hermes-agent

# Create virtual environment
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
.\venv\Scripts\pip install httpx websockets Pillow pypdf kokoro-onnx soundfile edge-tts

# Download Kokoro ONNX model and voices
.\venv\Scripts\python download_kokoro_models.py

cd ../..
```

### 4. Running Songbird

#### Option A: One-Click Desktop Launcher (Windows)
Double-click **`run-desktop.bat`** in the repository root to start the backend engine, frontend, and open a borderless native desktop window.

#### Option B: Terminal Command
```bash
# Start the Hermes Engine daemon (Terminal 1)
pnpm dev:engine

# Launch Standalone Desktop Window (Terminal 2)
pnpm dev:window

# Or run in standard web development mode
pnpm dev:frontend
```

#### Option C: Native Tauri C++ Desktop Build
```bash
# Run with live Tauri dev reload
pnpm dev:desktop

# Build standalone production executable (.exe / .msi)
pnpm --filter orca-app build:tauri
```
---

## 📄 License
MIT
