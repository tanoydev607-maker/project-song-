export interface TTSOptions {
  rate?: number; // 0.1 to 10 (default 1)
  pitch?: number; // 0 to 2 (default 1)
  volume?: number; // 0 to 1 (default 1)
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export class LocalTTSManager {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  /**
   * Cleans text to make it suitable for speech synthesis by removing code blocks,
   * markdown syntax, markdown links, and HTML tags.
   */
  public cleanTextForSpeech(text: string): string {
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, " [code block omitted] ")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // Remove links, keep text
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      // Remove Markdown headers and list symbols
      .replace(/^[#*>\s-]+/gm, "")
      // Remove XML / HTML tags
      .replace(/<[^>]*>/g, "")
      // Clean duplicate whitespace
      .replace(/\s+/g, " ")
      .trim();
  }

  public speak(text: string, options: TTSOptions = {}): boolean {
    if (!this.synth) return false;

    this.stop();

    const cleaned = this.cleanTextForSpeech(text);
    if (!cleaned) return false;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (options.voiceURI) {
      const voices = this.getVoices();
      const match = voices.find((v) => v.voiceURI === options.voiceURI);
      if (match) {
        utterance.voice = match;
      }
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      options.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options.onError?.(e);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    return true;
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const localTTS = new LocalTTSManager();
