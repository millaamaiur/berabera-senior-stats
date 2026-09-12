import { create } from 'zustand';

interface SyncStatusState {
  /** Number of writes made locally that haven't reached Supabase yet. */
  pendingCount: number;
  /** True while a flush of the pending queue is in progress. */
  syncing: boolean;
  setPendingCount: (n: number) => void;
  setSyncing: (v: boolean) => void;
}

/** Reactive view of the offline write queue, for showing a "sin conexión" indicator. */
export const useSyncStatus = create<SyncStatusState>((set) => ({
  pendingCount: 0,
  syncing: false,
  setPendingCount: (n) => set({ pendingCount: n }),
  setSyncing: (v) => set({ syncing: v }),
}));
