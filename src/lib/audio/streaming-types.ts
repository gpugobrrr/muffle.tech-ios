export type StreamingPartialEvent = {
  text: string;
  isFinal?: boolean;
  confidence?: number;
};

export type StreamingTranscriptEvent = StreamingPartialEvent;

export type StreamingPartialCallback = (event: StreamingPartialEvent) => void;

export type StreamingSession = {
  onPartial: (callback: StreamingPartialCallback) => () => void;
  stop: () => Promise<string>;
  abort?: () => void;
  sendAudioChunk?: (chunk: ArrayBuffer | string) => void;
  onError?: (cb: (err: Error) => void) => () => void;
};

export type StreamingTranscriptionSession = StreamingSession;

