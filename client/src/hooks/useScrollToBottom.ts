import { useEffect, type MutableRefObject } from 'react';

export function useScrollToBottom(
  ref: MutableRefObject<HTMLElement | null>,
  deps: unknown[],
  enabled: boolean
) {
  useEffect(() => {
    if (enabled) {
      ref.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [enabled, ...deps]);
}
