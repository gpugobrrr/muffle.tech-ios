import { nextSimulationBeat } from '@/lib/audio/transcription-adapter';
import type {
  StreamingPartialCallback,
  StreamingPartialEvent,
  StreamingSession,
} from '@/lib/audio/streaming-types';

/**
 * Deterministic canned streaming session for explicit tests / local demos.
 * Must never be selected by the production PTT path.
 */
export function createSimulationStreamingSession(
  activeRoom: string = 'roof void',
): StreamingSession {
  const fullText = nextSimulationBeat(activeRoom);
  const words = fullText.split(' ');
  let currentWordIndex = 0;
  let accumulatedText = '';
  const listeners = new Set<StreamingPartialCallback>();
  const errorListeners = new Set<(err: Error) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const emit = (event: StreamingPartialEvent) => {
    for (const listener of listeners) listener(event);
  };

  timer = setInterval(() => {
    if (currentWordIndex < words.length) {
      accumulatedText = words.slice(0, currentWordIndex + 1).join(' ');
      currentWordIndex += 1;
      emit({
        text: accumulatedText,
        isFinal: currentWordIndex === words.length,
      });
    }
  }, 100);

  if (words.length > 0) {
    accumulatedText = words[0];
    currentWordIndex = 1;
    queueMicrotask(() => {
      emit({
        text: accumulatedText,
        isFinal: currentWordIndex === words.length,
      });
    });
  }

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return {
    onPartial(callback: StreamingPartialCallback) {
      listeners.add(callback);
      if (accumulatedText) {
        callback({
          text: accumulatedText,
          isFinal: currentWordIndex === words.length,
        });
      }
      return () => {
        listeners.delete(callback);
      };
    },
    onError(callback) {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    async stop() {
      clearTimer();
      accumulatedText = fullText;
      emit({ text: fullText, isFinal: true });
      return fullText;
    },
    abort() {
      clearTimer();
      listeners.clear();
      errorListeners.clear();
    },
  };
}
