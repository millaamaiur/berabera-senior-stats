/** Fires a short vibration if the device/browser supports it (most desktop browsers and iOS Safari don't — this is a silent no-op there). */
export function vibrate(pattern: number | readonly number[]): void {
  try {
    navigator.vibrate?.(pattern as number | number[]);
  } catch {
    // unsupported — ignore
  }
}

export const HAPTIC = {
  tap: 12,
  goal: [20, 60, 20, 60, 30],
  undo: [10, 40, 10],
} as const;
