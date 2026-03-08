import type { TranscriptEntry } from "../../shared/types";

interface Props {
  entries: TranscriptEntry[];
}

export default function TranscriptView({ entries }: Props) {
  const last = entries.at(-1);

  return (
    <div className="flex-shrink-0 px-4 py-3 rounded border border-gray-800 bg-gray-900">
      {last ? (
        <p
          className={`text-sm truncate ${last.isFinal ? "text-gray-300" : "text-gray-500 italic"}`}
        >
          {last.text}
        </p>
      ) : (
        <p className="text-sm text-gray-600 italic">—</p>
      )}
    </div>
  );
}
