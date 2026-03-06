import { useCallback, useRef, useState } from "react";
import type { AudioSource, CaptureStatus, TranscriptEntry } from "../../shared/types";
import { DEEPGRAM_PARAMS, F1_KEYWORDS, RECORDER_CHUNK_MS } from "../constants";

// Defined at module level so chrome.scripting can serialize it (no closure deps).
function injectMicOverlay(frameUrl: string): void {
  if (document.getElementById("f1-mic-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "f1-mic-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;";
  const frame = document.createElement("iframe");
  frame.src = frameUrl;
  frame.allow = "microphone";
  frame.style.cssText = "width:320px;height:140px;border:none;border-radius:10px;";
  overlay.appendChild(frame);
  document.body.appendChild(overlay);
  window.addEventListener("message", function handler(e) {
    if (e.data && e.data.type === "F1_MIC_DONE") {
      document.getElementById("f1-mic-overlay")?.remove();
      window.removeEventListener("message", handler);
    }
  });
}

/** Returns a promise that resolves when the mic-request iframe responds. */
function waitForMicPermission(): Promise<"granted" | "cancelled"> {
  return new Promise((resolve) => {
    const handler = (msg: { type: string }) => {
      if (msg.type === "MIC_PERMISSION_GRANTED") {
        chrome.runtime.onMessage.removeListener(handler);
        resolve("granted");
      } else if (msg.type === "MIC_PERMISSION_CANCELLED") {
        chrome.runtime.onMessage.removeListener(handler);
        resolve("cancelled");
      }
    };
    chrome.runtime.onMessage.addListener(handler);
  });
}

export function useCapture(apiKey: string, audioSource: AudioSource) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingInterimIdRef = useRef<string | null>(null);
  // Stable ref so WS event handlers can always call the latest `stop`
  const stopRef = useRef<() => void>(() => {});

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    wsRef.current = null;

    setStatus("idle");
  }, []);

  // Keep ref in sync so closures inside `start` always see the latest `stop`
  stopRef.current = stop;

  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string);
      const text: string = data?.channel?.alternatives?.[0]?.transcript ?? "";
      const isFinal: boolean = data?.is_final ?? false;
      if (!text.trim()) return;

      const entry: TranscriptEntry = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        isFinal,
        timestamp: Date.now(),
      };

      setTranscript((prev) => {
        if (!isFinal && pendingInterimIdRef.current) {
          return prev.map((e) => (e.id === pendingInterimIdRef.current ? entry : e));
        }
        pendingInterimIdRef.current = isFinal ? null : entry.id;
        return [...prev, entry];
      });
    } catch {
      // ignore malformed messages
    }
  }, []);

  const start = useCallback(async () => {
    setTranscript([]);
    setError(null);
    pendingInterimIdRef.current = null;

    try {
      let stream: MediaStream;
      if (audioSource === "microphone") {
        // getUserMedia never shows a permission prompt in a side panel (Chrome limitation).
        // If not yet granted, inject an iframe into the active tab — the only context
        // where Chrome will show the mic permission prompt for an extension.
        const permStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (permStatus.state !== "granted") {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id || !(tab.url ?? "").startsWith("http")) {
            setError("Open any webpage in the tab behind this panel, then click Start.");
            return;
          }

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectMicOverlay,
            args: [chrome.runtime.getURL("mic-request.html")],
          });

          const result = await waitForMicPermission();
          if (result === "cancelled") return;
          // Permission granted — fall through to getUserMedia below
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        stream.getVideoTracks().forEach((t) => t.stop());
      }
      streamRef.current = stream;

      const params = new URLSearchParams(DEEPGRAM_PARAMS);
      F1_KEYWORDS.forEach((kw) => params.append("keywords", kw));

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params}`,
        ["token", apiKey],
      );
      wsRef.current = ws;

      ws.onmessage = handleWsMessage;
      ws.onerror = () => {
        setStatus("error");
        setError("Deepgram connection error — check your API key");
        stopRef.current();
      };
      ws.onclose = () => setStatus((s) => (s === "capturing" ? "idle" : s));
      ws.onopen = () => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (ws.readyState === WebSocket.OPEN && e.data.size > 0) ws.send(e.data);
        };
        stream.getAudioTracks()[0]?.addEventListener("ended", () => stopRef.current());

        recorder.start(RECORDER_CHUNK_MS);
        setStatus("capturing");
      };
    } catch (err) {
      setStatus("error");
      setError(String(err));
    }
  }, [apiKey, audioSource, handleWsMessage]);

  return { status, transcript, error, start, stop };
}
