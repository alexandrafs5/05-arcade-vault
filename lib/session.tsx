"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type User = { name: string };
export type NewScore = { game: string; score: number; name: string };

type SessionValue = {
  user: User | null;
  login: (user: User | null) => void;
  signOut: () => void;
  // Rejects when the insert fails so the caller can show an error and retry.
  saveScore: (entry: NewScore) => Promise<void>;
};

const USER_KEY = "av_user";

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

  const saveScore = useCallback(async (entry: NewScore) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("scores")
      .insert({ game_id: entry.game, name: entry.name, score: entry.score });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({ user, login, signOut, saveScore }),
    [user, login, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
