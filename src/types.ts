export interface DailyRecord {
  date: string;            // "YYYY-MM-DD" in local timezone
  manualTokens: number;
  aiTokens: number;        // estimated: large insertions (AI completions / paste)
  limitReachedAt?: number; // unix timestamp (ms) when limit was first hit today
}

export interface ExtensionConfig {
  dailyTokenLimit: number;
  tokensPerExtraNotification: number;
  manualTypingMaxChunkSize: number;
  showStatusBar: boolean;
}
