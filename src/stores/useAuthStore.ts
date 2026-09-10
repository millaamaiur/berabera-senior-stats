import { create } from 'zustand';
import { supabase } from '../data/supabase/client';

/**
 * There's no per-person login — everyone who can anotar shares one Supabase
 * Auth account, unlocked with a 4-digit PIN instead of a real password.
 * Viewing (matches, players, stats) never requires this at all; it's gated
 * purely by Supabase RLS letting anyone read but only an authenticated
 * session write.
 */
const SHARED_EMAIL = 'equipo@berabera-app.local';

interface AuthState {
  unlocked: boolean;
  ready: boolean;
  init: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  unlocked: false,
  ready: false,
  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ unlocked: !!data.session, ready: true });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ unlocked: !!session });
    });
  },
  unlock: async (pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: SHARED_EMAIL, password: `bbs-${pin}` });
    if (error) return false;
    set({ unlocked: true });
    return true;
  },
  lock: async () => {
    await supabase.auth.signOut();
    set({ unlocked: false });
  },
}));
