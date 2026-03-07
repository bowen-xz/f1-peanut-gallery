import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightEntry, InsightType, TranscriptEntry } from "../../shared/types";
import {
  GEMINI_MODEL,
  INSIGHT_INTERVAL_MS,
  INSIGHT_PROMPTS,
  INSIGHT_TYPE_LABELS,
  TRANSCRIPT_WINDOW_MS,
} from "../constants";

type RedditPost = { title: string; redditUrl: string; imageUrl?: string };

async function fetchImageBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return { mimeType, data: btoa(binary) };
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRedditPosts(children: any[]): RedditPost[] {
  return children
    .map((c) => c.data)
    .filter((p) => !p.is_video && !p.stickied)
    .map((p) => ({
      title: p.title,
      redditUrl: `https://www.reddit.com${p.permalink}`,
      imageUrl: (p.post_hint === "image" ? p.url : undefined)
        ?? p.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&"),
    }))
    .filter((p): p is RedditPost & { imageUrl: string } => !!p.imageUrl)
    .slice(0, 5);
}

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

    const id = `${Date.now()}-${Math.random()}`;
    setInsights((prev) => [...prev, { id, text: "", timestamp: Date.now(), loading: true, type }]);

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      if (type === "meme") {
        // Step 1: extract search keywords from the transcript
        const keywordResult = await model.generateContent(
          `Current F1 broadcast transcript:\n${text}\n\n` +
          `I want a F1 key word to search for a reddit meme based off of the current situation (prioritize driver names, and team names)` +
          `Reply with ONLY the keyword, e.g. "Verstappen", "Mercedes"`,
        );
        const searchQuery = keywordResult.response.text().trim().replace(/^["']|["']$/g, "");
        console.log(`[Insights:meme] search query: "${searchQuery}"`);

        // Step 2: search r/formuladank with keywords
        const searchRes = await fetch(
          `https://www.reddit.com/r/formuladank/search.json?q=${encodeURIComponent(searchQuery)}&sort=top&t=year&restrict_sr=1&limit=10`,
          { headers: { Accept: "application/json" } },
        );
        if (!searchRes.ok) throw new Error(`Reddit search failed: ${searchRes.status}`);
        const searchJson = await searchRes.json();
        let candidates = parseRedditPosts(searchJson.data.children);

        // Fallback to top posts if fewer than 3 relevant results
        if (candidates.length < 3) {
          console.log(`[Insights:meme] search "${searchQuery}" returned only ${candidates.length} image post(s) — falling back to top posts from r/formuladank`);
          const fallbackRes = await fetch(
            "https://www.reddit.com/r/formuladank/top.json?t=month&limit=50",
            { headers: { Accept: "application/json" } },
          );
          if (!fallbackRes.ok) throw new Error(`Reddit fallback failed: ${fallbackRes.status}`);
          const fallbackJson = await fallbackRes.json();
          candidates = parseRedditPosts(fallbackJson.data.children);
        }

        if (candidates.length === 0) throw new Error("No image posts found");

        // Step 3: fetch images and ask Gemini Vision to pick the most relevant
        const imageData = await Promise.all(candidates.map((p) => fetchImageBase64(p.imageUrl!)));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [{
          text:
            `F1 broadcast transcript:\n${text}\n\n` +
            `Here are ${candidates.length} memes from r/formuladank. ` +
            `Pick the one that pairs funniest with what is happening right now.\n` +
            `Reply with ONLY two lines (INDEX and CAPTION):\n` +
            `INDEX: <number 0-${candidates.length - 1}>\n` +
            `CAPTION: <10-20 words explaining the F1 related origin / context of the meme, then 10-20 words connecting it back to the current situation>`,
        }];

        candidates.forEach((p, i) => {
          const img = imageData[i];
          if (img) {
            parts.push({ text: `Meme ${i}: "${p.title}"` });
            parts.push({ inlineData: img });
          }
        });

        const pickResult = await model.generateContent({ contents: [{ role: "user", parts }] });
        const raw = pickResult.response.text();
        console.log(`[Insights:meme] vision pick response:\n${raw}`);

        const idxMatch = raw.match(/INDEX:\s*(\d+)/i);
        const capMatch = raw.match(/CAPTION:\s*(.+)/i);
        const idx = Math.min(parseInt(idxMatch?.[1] ?? "0", 10), candidates.length - 1);
        const chosen = candidates[isNaN(idx) ? 0 : idx];
        const caption = capMatch?.[1]?.trim() ?? chosen.title;

        setInsights((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, loading: false, sourceUrl: chosen.redditUrl, imageUrl: chosen.imageUrl, text: caption } : e,
          ),
        );
      } else {
        const prompt = INSIGHT_PROMPTS[type](text);
        console.log(`[Insights] type=${type}\n--- prompt ---\n${prompt}\n--------------`);

        const result = await genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [{ googleSearch: {} } as any],
        }).generateContent(prompt);

        setInsights((prev) =>
          prev.map((e) => (e.id === id ? { ...e, text: result.response.text(), loading: false } : e)),
        );
      }
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
      const types = Object.keys(INSIGHT_TYPE_LABELS) as InsightType[];
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
