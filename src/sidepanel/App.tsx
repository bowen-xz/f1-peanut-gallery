import { useState } from "react";
import type { AudioSource } from "../shared/types";
import Controls from "./components/Controls";
import InsightsView from "./components/InsightsView";
import TranscriptView from "./components/TranscriptView";
import { useCapture } from "./hooks/useCapture";
import { useInsights } from "./hooks/useInsights";

const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY ?? "";
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";

export default function App() {
  const [audioSource, setAudioSource] = useState<AudioSource>("screen");
  const { status, transcript, error, start, stop } = useCapture(DEEPGRAM_KEY, audioSource);
  const { insights, triggerNow } = useInsights(GEMINI_KEY, transcript, status === "capturing");

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans">
      <header className="px-5 py-4 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
        <span className="text-red-500 font-bold text-xl">F1</span>
        <span className="text-gray-300 text-base font-medium">Peanut Gallery</span>
      </header>

      <div className="flex flex-col gap-5 p-5 flex-1 overflow-hidden">
        <Controls
          status={status}
          disabled={!DEEPGRAM_KEY}
          audioSource={audioSource}
          onSourceChange={setAudioSource}
          onStart={start}
          onStop={stop}
        />

        {error && (
          <p className="text-red-400 text-xs px-2 py-1 bg-red-950 rounded border border-red-800">
            {error}
          </p>
        )}

        <TranscriptView entries={transcript} />

        <InsightsView
          insights={insights}
          onAsk={triggerNow}
          capturing={status === "capturing"}
        />
      </div>
    </div>
  );
}
