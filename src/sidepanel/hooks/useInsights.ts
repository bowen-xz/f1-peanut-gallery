import { useCallback, useEffect, useRef, useState } from "react";
import type { InsightEntry, InsightType, TranscriptEntry } from "../../shared/types";
import {
  GEMINI_MODEL,
  INSIGHT_INTERVAL_MS,
  INSIGHT_PROMPTS,
  INSIGHT_TYPE_LABELS,
  TRANSCRIPT_WINDOW_MS,
} from "../constants";

type RedditPost = { title: string; redditUrl: string; imageUrl?: string; createdUtc: number };

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
async function fetchPostComments(redditUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${redditUrl}.json?limit=10&sort=top`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = await res.json();
    // json[1] is the comments listing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = json[1]?.data?.children ?? [];
    return children
      .map((c) => c.data?.body as string)
      .filter((b) => b && b !== "[deleted]" && b !== "[removed]")
      .slice(0, 4);
  } catch {
    return [];
  }
}

function formatDate(utcSecs: number): string {
  return new Date(utcSecs * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRedditPosts(children: any[]): RedditPost[] {
  const nowSecs = Date.now() / 1000;
  const ONE_MONTH_SECS = 30 * 24 * 3600;

  const posts = children
    .map((c) => c.data)
    .filter((p) => !p.is_video && !p.stickied)
    .map((p) => ({
      title: p.title as string,
      redditUrl: `https://www.reddit.com${p.permalink}`,
      imageUrl: (p.post_hint === "image" ? p.url : undefined)
        ?? p.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") as string | undefined,
      score: (p.score as number) ?? 0,
      createdUtc: (p.created_utc as number) ?? 0,
    }))
    .filter((p): p is typeof p & { imageUrl: string } => !!p.imageUrl);

  if (posts.length === 0) return [];

  const maxScore = Math.max(...posts.map((p) => p.score), 1);

  // Rank by 70% normalised score + 30% recency (1-month window)
  const ranked = posts
    .map((p) => ({
      ...p,
      weight: 0.7 * (p.score / maxScore)
        + 0.3 * Math.max(0, 1 - (nowSecs - p.createdUtc) / ONE_MONTH_SECS),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 9); // quality pool: top 9 by combined score

  // Shuffle within the pool for variety, then take 3
  ranked.sort(() => Math.random() - 0.5);

  return ranked.slice(0, 3).map(({ title, redditUrl, imageUrl, createdUtc }) => ({ title, redditUrl, imageUrl, createdUtc }));
}

export function useInsights(
  geminiKey: string,
  transcript: TranscriptEntry[],
  active: boolean,
) {
  const [insights, setInsights] = useState<InsightEntry[]>(() => {
    try {
      const saved = localStorage.getItem("f1_insights");
      return saved ? (JSON.parse(saved) as InsightEntry[]) : [];
    } catch {
      return [];
    }
  });
  const lastSentTextRef = useRef("");
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    localStorage.setItem("f1_insights", JSON.stringify(insights.slice(-50)));
  }, [insights]);

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
      const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          generationConfig: { thinkingConfig: { thinkingBudget: 512 } } as any,
        });

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
          `https://www.reddit.com/r/formuladank/search.json?q=${encodeURIComponent(searchQuery)}&sort=top&t=month&restrict_sr=1&limit=10`,
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

        // Step 3: fetch images and top comments for all candidates in parallel
        const [imageData, commentsData] = await Promise.all([
          Promise.all(candidates.map((p) => fetchImageBase64(p.imageUrl!))),
          Promise.all(candidates.map((p) => fetchPostComments(p.redditUrl))),
        ]);

        // Step 4: ask Gemini Vision to pick the most relevant, with enriched context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [{
          text:
            `F1 live broadcast transcript:\n${text}\n\n` +
            `Here are ${candidates.length} memes from r/formuladank. ` +
            `Pick the one that pairs best with what is happening right now, prioritize memes that are picture heavy (not mainly text).\n` +
            `Each meme includes its post date and top comments to help you understand its F1 context — use these alongside a web search to write an accurate caption.\n` +
            `Reply with ONLY two lines (INDEX and CAPTION):\n` +
            `INDEX: <number 0-${candidates.length - 1}>\n` +
            `CAPTION: <use under 20 words to accurately describe the F1 origin and context of the meme (use comments and web search to ensure accuracy), then under 20 words providing a funny comment on it based on the meme and the race>`,
        }];

        candidates.forEach((p, i) => {
          const img = imageData[i];
          if (img) {
            const comments = commentsData[i];
            let context = `Meme ${i}: "${p.title}" — posted ${formatDate(p.createdUtc)}`;
            if (comments.length > 0) {
              context += `\nTop comments:\n${comments.map((c, j) => `  ${j + 1}. "${c}"`).join("\n")}`;
            }
            parts.push({ text: context });
            parts.push({ inlineData: img });
          }
        });

        const visionModel = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [{ googleSearch: {} } as any],
        });
        const pickResult = await visionModel.generateContent({ contents: [{ role: "user", parts }] });
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = result.response as any;
        console.log(`[Insights:${type}] finishReason=${raw.candidates?.[0]?.finishReason} text="${result.response.text()}"`);
        console.log(`[Insights:${type}] full response:`, raw);

        const responseText = raw.candidates?.[0]?.content?.parts
          ?.filter((p: { text?: string }) => p.text)
          .map((p: { text: string }) => p.text)
          .join("") || result.response.text();

        setInsights((prev) =>
          prev.map((e) => (e.id === id ? { ...e, text: responseText, loading: false } : e)),
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

  const deleteInsight = useCallback((id: string) => {
    setInsights((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearInsights = useCallback(() => {
    setInsights([]);
  }, []);

  return { insights, triggerNow, deleteInsight, clearInsights };
}
