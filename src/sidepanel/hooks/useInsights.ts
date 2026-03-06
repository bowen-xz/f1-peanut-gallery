import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightEntry, InsightType, TranscriptEntry } from "../../shared/types";
import {
  GEMINI_MODEL,
  INSIGHT_INTERVAL_MS,
  INSIGHT_PROMPTS,
  TRANSCRIPT_WINDOW_MS,
} from "../constants";

export function useInsights(
  geminiKey: string,
  transcript: TranscriptEntry[],
  active: boolean,
) {
  const [insights, setInsights] = useState<InsightEntry[]>([]);
  const lastSentTextRef = useRef("");
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const triggerNow = useCallback(async (type: InsightType) => {
    const cutoff = Date.now() - TRANSCRIPT_WINDOW_MS;
    const text = transcriptRef.current
      .filter((e) => e.isFinal && e.timestamp >= cutoff)
      .map((e) => e.text)
      .join(" ")
      .trim();

    if (!text) return;
    lastSentTextRef.current = text;

    const prompt = INSIGHT_PROMPTS[type](text);
    console.log(`[Insights] type=${type}\n--- prompt ---\n${prompt}\n--------------`);

    const id = `${Date.now()}-${Math.random()}`;
    setInsights((prev) => [...prev, { id, text: "", timestamp: Date.now(), loading: true, type }]);

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ googleSearch: {} } as any],
      });

      const result = await model.generateContent(prompt);
      setInsights((prev) =>
        prev.map((e) => (e.id === id ? { ...e, text: result.response.text(), loading: false } : e)),
      );
    } catch (err) {
      setInsights((prev) =>
        prev.map((e) => (e.id === id ? { ...e, text: `Error: ${String(err)}`, loading: false } : e)),
      );
    }
  }, [geminiKey]);

  const autoPoll = useCallback(() => {
    const cutoff = Date.now() - TRANSCRIPT_WINDOW_MS;
    const text = transcriptRef.current
      .filter((e) => e.isFinal && e.timestamp >= cutoff)
      .map((e) => e.text)
      .join(" ")
      .trim();
    if (text && text !== lastSentTextRef.current) {
      const types = Object.keys(INSIGHT_PROMPTS) as InsightType[];
      triggerNow(types[Math.floor(Math.random() * types.length)]);
    }
  }, [triggerNow]);

  useEffect(() => {
    if (!active || !geminiKey) return;
    const id = setInterval(autoPoll, INSIGHT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, geminiKey, autoPoll]);

  return { insights, triggerNow };
}
