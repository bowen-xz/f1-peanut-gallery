import type { Message } from "../shared/messages";

// AudioWorklet processor source — runs in a separate AudioWorkletGlobalScope
const PROCESSOR_SOURCE = `
class PCMExtractorProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const float32 = input[0];
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}
registerProcessor('pcm-extractor', PCMExtractorProcessor);
`;

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let deepgramSocket: WebSocket | null = null;
let workletNode: AudioWorkletNode | null = null;

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "INIT_STREAM") {
    initStream(message.streamId, message.apiKey).catch((err) => {
      console.error("Offscreen INIT_STREAM error:", err);
      chrome.runtime.sendMessage({
        type: "CAPTURE_STATUS",
        status: "error",
        error: String(err),
      } satisfies Message);
    });
  }

  if (message.type === "STOP_STREAM") {
    stopStream();
  }
});

async function initStream(streamId: string, apiKey: string): Promise<void> {
  // Capture tab audio via chromeMediaSource
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error — Chrome-specific constraint
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // AudioContext at 16 kHz (Deepgram prefers 16 kHz for Nova-2)
  audioContext = new AudioContext({ sampleRate: 16000 });

  // Load the worklet processor from a blob URL
  const blob = new Blob([PROCESSOR_SOURCE], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  await audioContext.audioWorklet.addModule(blobUrl);
  URL.revokeObjectURL(blobUrl);

  const source = audioContext.createMediaStreamSource(mediaStream);
  workletNode = new AudioWorkletNode(audioContext, "pcm-extractor");

  // Open Deepgram WebSocket
  const params = new URLSearchParams({
    model: "nova-2",
    language: "en",
    interim_results: "true",
    punctuate: "true",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  });
  deepgramSocket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params.toString()}`,
    ["token", apiKey]
  );
  deepgramSocket.binaryType = "arraybuffer";

  deepgramSocket.onopen = () => {
    console.log("Deepgram WebSocket opened");
    // Wire up audio → Deepgram only after socket is open
    workletNode!.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (deepgramSocket?.readyState === WebSocket.OPEN) {
        deepgramSocket.send(event.data);
      }
    };
    source.connect(workletNode!);
    workletNode!.connect(audioContext!.destination);
  };

  deepgramSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      const transcript: string =
        data?.channel?.alternatives?.[0]?.transcript ?? "";
      const isFinal: boolean = data?.is_final ?? false;
      if (transcript.trim()) {
        chrome.runtime.sendMessage({
          type: "TRANSCRIPT_RESULT",
          text: transcript,
          isFinal,
          timestamp: Date.now(),
        } satisfies Message);
      }
    } catch (e) {
      console.warn("Failed to parse Deepgram message", e);
    }
  };

  deepgramSocket.onerror = (err) => {
    console.error("Deepgram WebSocket error:", err);
    chrome.runtime.sendMessage({
      type: "CAPTURE_STATUS",
      status: "error",
      error: "Deepgram WebSocket error",
    } satisfies Message);
  };

  deepgramSocket.onclose = () => {
    console.log("Deepgram WebSocket closed");
  };
}

function stopStream(): void {
  // Disconnect worklet
  workletNode?.disconnect();
  workletNode = null;

  // Stop media tracks
  mediaStream?.getTracks().forEach((t) => t.stop());
  mediaStream = null;

  // Close AudioContext
  audioContext?.close();
  audioContext = null;

  // Close Deepgram WebSocket
  if (deepgramSocket && deepgramSocket.readyState !== WebSocket.CLOSED) {
    deepgramSocket.close();
  }
  deepgramSocket = null;
}
