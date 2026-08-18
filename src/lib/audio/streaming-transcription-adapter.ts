import { nextSimulationBeat } from '@/lib/audio/transcription-adapter';
import type {
  StreamingPartialCallback,
  StreamingPartialEvent,
  StreamingSession,
} from '@/lib/audio/streaming-types';

export function createStreamingSession(
  activeRoom: string = 'roof void',
  _apiKey?: string | null,
): StreamingSession {
  const fullText = nextSimulationBeat(activeRoom);
  const words = fullText.split(' ');
  let currentWordIndex = 0;
  let accumulatedText = '';
  const listeners = new Set<StreamingPartialCallback>();

  const emit = (event: StreamingPartialEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const timer = setInterval(() => {
    if (currentWordIndex < words.length) {
      accumulatedText = words.slice(0, currentWordIndex + 1).join(' ');
      currentWordIndex += 1;
      emit({ text: accumulatedText, isFinal: currentWordIndex === words.length });
    }
  }, 100);

  if (words.length > 0) {
    accumulatedText = words[0];
    currentWordIndex = 1;
    queueMicrotask(() => {
      emit({ text: accumulatedText, isFinal: currentWordIndex === words.length });
    });
  }

  return {
    onPartial(callback: StreamingPartialCallback) {
      listeners.add(callback);
      if (accumulatedText) {
        callback({ text: accumulatedText, isFinal: currentWordIndex === words.length });
      }
      return () => {
        listeners.delete(callback);
      };
    },
    async stop() {
      clearInterval(timer);
      accumulatedText = fullText;
      emit({ text: fullText, isFinal: true });
      return fullText;
    },
    abort() {
      clearInterval(timer);
      listeners.clear();
    },
  };
}
