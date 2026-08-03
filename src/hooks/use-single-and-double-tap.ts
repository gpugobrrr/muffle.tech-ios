import { useCallback, useEffect, useRef, useState } from 'react';

export const DEFAULT_DOUBLE_TAP_DELAY = 300;
export type TapFeedback = 'idle' | 'single' | 'double';

type TapOptions = {
  onSingleTap: () => void;
  onDoubleTap: () => void;
  delay?: number;
};

export function useSingleAndDoubleTap({
  onSingleTap,
  onDoubleTap,
  delay = DEFAULT_DOUBLE_TAP_DELAY,
}: TapOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onSingleTap, onDoubleTap });
  const [feedback, setFeedback] = useState<TapFeedback>('idle');

  useEffect(() => {
    callbacksRef.current = { onSingleTap, onDoubleTap };
  }, [onDoubleTap, onSingleTap]);

  const showFeedback = useCallback((nextFeedback: TapFeedback) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(nextFeedback);
    feedbackTimerRef.current = setTimeout(() => setFeedback('idle'), 180);
  }, []);

  const onPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      callbacksRef.current.onDoubleTap();
      showFeedback('double');
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      callbacksRef.current.onSingleTap();
      showFeedback('single');
    }, delay);
  }, [delay, showFeedback]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  return { onPress, feedback };
}
