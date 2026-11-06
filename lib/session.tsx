"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type User = { name: string };
export type SavedScore = { game: string; score: number; name: string; at: number };

type SessionValue = {
  user: User | null;
  login: (user: User | null) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Read after mount so the first render matches the server (logged out).
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(USER_KEY) || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setUser(stored);
    } catch {}
  }, []);

  const login = useCallback((next: User | null) => {
    setUser(next);
    try {
      if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const signOut = useCallback(() => login(null), [login]);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    try {
      const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const value = useMemo(() => ({ user, login, signOut, saveScore }), [user, login, signOut, saveScore]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
