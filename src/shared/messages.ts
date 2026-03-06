export type Message =
  | { type: "START_CAPTURE"; apiKey: string; streamId: string }
  | { type: "STOP_CAPTURE" }
  | { type: "INIT_STREAM"; streamId: string; apiKey: string }
  | { type: "STOP_STREAM" }
  | { type: "TRANSCRIPT_RESULT"; text: string; isFinal: boolean; timestamp: number }
  | { type: "CAPTURE_STATUS"; status: "capturing" | "stopped" | "error"; error?: string };
