import { useEffect, useRef, useState } from "react";
import type { InsightEntry, InsightType } from "../../shared/types";
import { INSIGHT_TYPE_LABELS } from "../constants";

const INSIGHT_TYPES: InsightType[] = ["engineer", "story", "drama", "news", "strategy", "meme"];

interface Props {
  insights: InsightEntry[];
  onAsk: (type: InsightType) => void;
  capturing: boolean;
}

function timeAgo(timestamp: number): string {
  const secs = Math.floor((Date.now() - timestamp) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export default function InsightsView({ insights, onAsk, capturing }: Props) {
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [insights.length]);

  const hasInFlight = insights.some((e) => e.loading);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <span className="text-sm text-gray-400 font-medium uppercase tracking-wide flex-shrink-0">
        Paddock Intelligence
      </span>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto chat-scroll flex flex-col gap-5 pr-2">
        {insights.length === 0 && (
          <p className="text-sm text-gray-600 italic text-center mt-4">
            Comments will appear every minute
          </p>
        )}
        {insights.map((entry) => (
          <div key={entry.id} className="bubble-in flex flex-col items-start gap-3">
            {/* Type label above bubble */}
            <span className="text-xs text-gray-500 font-medium pl-1">
              {INSIGHT_TYPE_LABELS[entry.type]}
            </span>

            {/* iMessage-style bubble: rounded-2xl, flat top-left corner for "tail" */}
            <div className="bg-gray-800 rounded-2xl rounded-tl-md px-5 py-4 max-w-[92%] flex flex-col gap-3">
              {entry.loading ? (
                <div className="flex items-center gap-1.5 py-1 px-1">
                  <span className="thinking-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  <span className="thinking-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  <span className="thinking-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
                </div>
              ) : (
                <>
                  {entry.imageUrl && (
                    <img
                      src={entry.imageUrl}
                      alt="meme"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      className="w-full rounded-xl object-contain max-h-48"
                    />
                  )}
                  <p className="text-sm text-gray-100 leading-relaxed">{entry.text}</p>
                  {entry.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-red-400 hover:text-red-300 underline break-all"
                    >
                      View on Reddit →
                    </a>
                  )}
                </>
              )}
            </div>

            {/* Timestamp below bubble */}
            {!entry.loading && (
              <span className="text-xs text-gray-600 pl-1">{timeAgo(entry.timestamp)}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Prompt chips */}
      <div className="flex-shrink-0 pb-6">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide block mb-3">
          I want to learn more
        </span>
        <div className="flex flex-wrap gap-3 justify-center">
          {INSIGHT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onAsk(type)}
              disabled={!capturing || hasInFlight}
              title={!capturing ? "Press Start to use" : undefined}
              className="px-4 py-1.5 text-sm rounded-full bg-gray-800 border border-gray-700 hover:border-red-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {INSIGHT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
