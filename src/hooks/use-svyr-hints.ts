import { useCallback, useEffect, useState } from 'react';

import {
  createEmptyHintState,
  hintRepository,
  type SvyrHintId,
  type SvyrHintState,
} from '@/lib/hint-repository';

/**
 * Device-local interaction hint completion. Independent of the live job
 * record — surveying never depends on whether a tip has been seen.
 */
export function useSvyrHints() {
  const [completed, setCompleted] = useState<SvyrHintState>(
    createEmptyHintState,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hintRepository.load().then((state) => {
      if (cancelled) return;
      setCompleted(state);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isHintVisible = useCallback(
    (id: SvyrHintId) => ready && !completed[id],
    [completed, ready],
  );

  const completeHint = useCallback(
    (id: SvyrHintId) => {
      setCompleted((current) => {
        if (current[id]) return current;
        const next = { ...current, [id]: true };
        void hintRepository.save(next);
        return next;
      });
    },
    [],
  );

  const dismissHint = useCallback(
    (id: SvyrHintId) => {
      completeHint(id);
    },
    [completeHint],
  );

  const resetHints = useCallback(async () => {
    const empty = await hintRepository.reset();
    setCompleted(empty);
  }, []);

  return {
    ready,
    completed,
    isHintVisible,
    completeHint,
    dismissHint,
    resetHints,
  };
}

export type SvyrHints = ReturnType<typeof useSvyrHints>;
