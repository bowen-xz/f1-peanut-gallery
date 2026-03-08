import type { AudioSource, CaptureStatus } from "../../shared/types";

interface Props {
  status: CaptureStatus;
  disabled: boolean;
  audioSource: AudioSource;
  onSourceChange: (source: AudioSource) => void;
  onStart: () => void;
  onStop: () => void;
}

const statusLabel: Record<CaptureStatus, string> = {
  idle: "Ready",
  capturing: "Live",
  error: "Error",
};

const statusColor: Record<CaptureStatus, string> = {
  idle: "bg-gray-500",
  capturing: "bg-green-400 animate-pulse",
  error: "bg-red-500",
};

export default function Controls({ status, disabled, audioSource, onSourceChange, onStart, onStop }: Props) {
  const isCapturing = status === "capturing";

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor[status]}`} />
        <span className="text-sm text-gray-400">{statusLabel[status]}</span>
      </div>

      <div className="flex rounded overflow-hidden border border-gray-700">
        <button
            key="screen"
            onClick={() => onSourceChange("screen")}
            disabled={isCapturing}
            title="Share your screen's audio"
            className={`px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              audioSource === "screen"
                ? "bg-gray-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Screen
          </button>
          <button
            key="microphone"
            onClick={() => onSourceChange("microphone")}
            disabled={isCapturing}
            title="Share mic to hear live TV audio"
            className={`px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              audioSource === "microphone"
                ? "bg-gray-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Mic
          </button>
      </div>

      {!isCapturing ? (
        <button
          onClick={onStart}
          disabled={disabled}
          className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Start
        </button>
      ) : (
        <button
          onClick={onStop}
          className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 transition-colors font-medium"
        >
          Stop
        </button>
      )}
    </div>
  );
}
