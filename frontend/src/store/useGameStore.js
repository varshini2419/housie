import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useGameStore = create(
  persist(
    (set) => ({
      session: null,
      ticket: null,
      connected: false,
      setSession: (session) => set({ session }),
      setTicket: (ticket) => set({ ticket }),
      setConnected: (connected) => set({ connected }),
      reset: () => set({ session: null, ticket: null, connected: false }),
    }),
    {
      name: 'tambola-game-storage',
    }
  )
);

export default useGameStore;
