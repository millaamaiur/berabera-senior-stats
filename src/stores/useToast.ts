import { create } from 'zustand';

interface ToastState {
  message: string | null;
  toastId: number;
  show: (message: string) => void;
}

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

/** A short-lived confirmation pill — `show("Gol de Ander")` — auto-dismisses itself. */
export const useToast = create<ToastState>((set) => ({
  message: null,
  toastId: 0,
  show: (message: string) => {
    const id = nextId++;
    if (timer) clearTimeout(timer);
    set({ message, toastId: id });
    timer = setTimeout(() => {
      set((s) => (s.toastId === id ? { message: null } : {}));
    }, 1800);
  },
}));
