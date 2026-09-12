import { useEffect, useRef, useState, type ReactNode } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 90;

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  /** Disables the gesture entirely (e.g. on the live-scoring screen) while still rendering the same scroll container. */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** Wraps a scrollable area with a native-style "pull down at the top to refresh" gesture. */
export function PullToRefresh({ onRefresh, disabled, className, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    function onTouchStart(e: TouchEvent) {
      startY.current = el!.scrollTop <= 0 && !refreshingRef.current ? e.touches[0].clientY : null;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        e.preventDefault();
        setPull(Math.min(delta * 0.5, MAX_PULL));
      }
    }

    function onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current > THRESHOLD) {
        setRefreshing(true);
        setPull(56);
        onRefresh().finally(() => {
          setRefreshing(false);
          setPull(0);
        });
      } else {
        setPull(0);
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [disabled, onRefresh]);

  return (
    <div ref={containerRef} className={className}>
      {!disabled && (pull > 0 || refreshing) && (
        <div
          className="pointer-events-none sticky top-0 z-10 -mb-10 flex justify-center transition-[height]"
          style={{ height: pull }}
        >
          <div
            className="mt-2 h-6 w-6 rounded-full border-2 border-amber-400 border-t-transparent"
            style={{
              transform: `rotate(${pull * 3}deg)`,
              animation: refreshing ? 'ptr-spin 0.6s linear infinite' : undefined,
              opacity: Math.min(pull / THRESHOLD, 1),
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
