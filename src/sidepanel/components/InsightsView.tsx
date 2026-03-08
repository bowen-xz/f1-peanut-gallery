import { useEffect, useRef, useState } from "react";
import type { InsightEntry, InsightType } from "../../shared/types";
import { INSIGHT_TYPE_LABELS } from "../constants";

const INSIGHT_TYPES: InsightType[] = ["engineering", "driver-drama", "news", "strategy", "meme"];

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
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide flex-shrink-0">
        Paddock Intelligence
      </span>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {insights.length === 0 && (
          <p className="text-xs text-gray-600 italic text-center mt-4">
            Comments will appear every minute
          </p>
        )}
        {insights.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 flex flex-col gap-1"
          >
            <span className="text-[10px] text-gray-500 font-medium">
              {INSIGHT_TYPE_LABELS[entry.type]}
            </span>
            {entry.loading ? (
              <div className="flex flex-col gap-1.5 animate-pulse py-1">
                <div className="h-2 bg-gray-700 rounded w-3/4" />
                <div className="h-2 bg-gray-700 rounded w-full" />
                <div className="h-2 bg-gray-700 rounded w-5/6" />
              </div>
            ) : (
              <>
                {entry.imageUrl && (
                  <img
                    src={entry.imageUrl}
                    alt="meme"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    className="w-full rounded-md mt-1 object-contain max-h-48"
                  />
                )}
                <p className="text-xs text-gray-200 leading-relaxed">{entry.text}</p>
                {entry.sourceUrl && (
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-red-400 hover:text-red-300 underline break-all"
                  >
                    View on Reddit →
                  </a>
                )}
              </>
            )}
            {!entry.loading && (
              <span className="text-[10px] text-gray-600 text-right">{timeAgo(entry.timestamp)}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Prompt chips */}
      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
        {INSIGHT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onAsk(type)}
            disabled={!capturing || hasInFlight}
            className="px-2 py-1 text-[11px] rounded-full bg-gray-800 border border-gray-700 hover:border-red-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {INSIGHT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
