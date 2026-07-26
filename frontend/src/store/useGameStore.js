import { create } from 'zustand';

const useGameStore = create((set) => ({
  session: null,
  ticket: null,
  connected: false,
  setSession: (session) => set({ session }),
  setTicket: (ticket) => set({ ticket }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ session: null, ticket: null, connected: false }),
}));

export default useGameStore;
