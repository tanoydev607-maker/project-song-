export interface ToolExecution {
  id: string;
  tool: string;
  input: string | Record<string, any>;
  output?: string;
  status: "running" | "success" | "error";
  timestamp: number;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  textContent?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "hermes" | "system";
  text: string;
  thought?: string;
  toolExecutions?: ToolExecution[];
  attachments?: AttachedFile[];
  timestamp: number;
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
}

export class MemoryEngine {
  private storageKey = "songbird_agent_sessions_v1";
  private activeSessionIdKey = "songbird_active_session_id_v1";

  public getSessions(): ChatSession[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveSessions(sessions: ChatSession[]): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    } catch (err) {
      console.error("Failed to persist sessions to local storage:", err);
    }
  }

  public getSession(id: string): ChatSession | undefined {
    return this.getSessions().find((s) => s.id === id);
  }

  public saveSession(session: ChatSession): void {
    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    this.saveSessions(sessions);
  }

  public deleteSession(id: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== id);
    this.saveSessions(sessions);
    if (this.getActiveSessionId() === id) {
      if (sessions.length > 0) {
        this.setActiveSessionId(sessions[0].id);
      } else {
        localStorage.removeItem(this.activeSessionIdKey);
      }
    }
  }

  public getActiveSessionId(): string | null {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return localStorage.getItem(this.activeSessionIdKey);
  }

  public setActiveSessionId(id: string): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.setItem(this.activeSessionIdKey, id);
  }

  public createNewSession(title = "New Chat", model = "gemma:2b"): ChatSession {
    const newSession: ChatSession = {
      id: "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model,
    };
    this.saveSession(newSession);
    this.setActiveSessionId(newSession.id);
    return newSession;
  }

  public exportSessionToMarkdown(session: ChatSession): string {
    let md = `# ${session.title}\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (const msg of session.messages) {
      const senderName = msg.sender === "user" ? "User" : "Songbird";
      const time = new Date(msg.timestamp).toLocaleTimeString();
      md += `### **${senderName}** (${time})\n\n`;
      if (msg.attachments && msg.attachments.length > 0) {
        md += `*Attached Files:* ${msg.attachments.map(a => a.name).join(", ")}\n\n`;
      }
      if (msg.thought) {
        md += `> **Thought Process:**\n> ${msg.thought.split("\n").join("\n> ")}\n\n`;
      }
      md += `${msg.text}\n\n---\n\n`;
    }

    return md;
  }
}

export const memoryEngine = new MemoryEngine();
