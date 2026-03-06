export interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export type CaptureStatus = "idle" | "capturing" | "error";

export type AudioSource = "screen" | "microphone";

export type InsightType = "engineering" | "driver-drama" | "drama" | "standings" | "strategy";

export interface InsightEntry {
  id: string;
  text: string;
  timestamp: number;
  loading: boolean;
  type: InsightType;
}
