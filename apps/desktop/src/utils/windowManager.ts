// Songbird Window Manager for Standalone Code Studio Window
// Supports Tauri v2 WebviewWindow, Chromium/Edge App Mode, and browser popups

export interface ExternalOpenFilePayload {
  path: string;
  content?: string;
  language?: string;
}

let editorWindowRef: Window | null = null;
let broadcastChannel: BroadcastChannel | null = null;

export function getEditorBroadcastChannel(): BroadcastChannel {
  if (!broadcastChannel && typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("songbird_editor_channel");
  }
  return broadcastChannel!;
}

export async function openCodeEditorWindow(externalFile?: ExternalOpenFilePayload): Promise<void> {
  if (externalFile) {
    try {
      localStorage.setItem("songbird_editor_pending_file", JSON.stringify(externalFile));
      const channel = getEditorBroadcastChannel();
      if (channel) {
        channel.postMessage({ type: "open_file", file: externalFile });
      }
    } catch (e) {
      console.warn("Failed to stage pending file for editor window:", e);
    }
  }

  // 1. If running under Tauri v2, use Tauri's native WebviewWindow API
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel("code-editor");
      if (existing) {
        await existing.show();
        await existing.setFocus();
        if (externalFile) {
          const channel = getEditorBroadcastChannel();
          if (channel) {
            channel.postMessage({ type: "open_file", file: externalFile });
          }
        }
        return;
      }

      const webview = new WebviewWindow("code-editor", {
        url: "?view=editor",
        title: "Songbird Code Studio IDE",
        width: 1440,
        height: 900,
        minWidth: 800,
        minHeight: 600,
      });

      webview.once("tauri://created", () => {
        // Window created successfully
      });

      webview.once("tauri://error", (err) => {
        console.warn("Tauri WebviewWindow error, falling back to window.open:", err);
        openBrowserPopup();
      });

      return;
    } catch (err) {
      console.warn("Error invoking Tauri WebviewWindow:", err);
      // Fall through to window.open
    }
  }

  // 2. Browser / Edge / Chrome App Mode fallback
  openBrowserPopup();

  function openBrowserPopup() {
    const url = `${window.location.origin}${window.location.pathname}?view=editor`;

    if (editorWindowRef && !editorWindowRef.closed) {
      editorWindowRef.focus();
      if (externalFile) {
        const channel = getEditorBroadcastChannel();
        if (channel) {
          channel.postMessage({ type: "open_file", file: externalFile });
        }
      }
      return;
    }

    const screenW = window.screen.availWidth || 1600;
    const screenH = window.screen.availHeight || 900;
    const width = Math.min(1440, screenW - 60);
    const height = Math.min(920, screenH - 60);
    const left = Math.max(30, Math.round((screenW - width) / 2));
    const top = Math.max(30, Math.round((screenH - height) / 2));

    const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
    editorWindowRef = window.open(url, "SongbirdCodeStudio", features);

    if (editorWindowRef) {
      editorWindowRef.focus();
    }
  }
}
