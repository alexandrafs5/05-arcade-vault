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

export type User = { id: string; name: string }; // name = profiles.username
export type NewScore = { game: string; score: number; name: string };

type SessionState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "needs-username"; user: null }
  | { status: "user"; user: User };

type SessionValue = {
  user: User | null;
  // "loading" until the first session read after mount (matches the server).
  status: SessionState["status"];
  signOut: () => Promise<void>;
  // Rejects when the insert fails so the caller can show an error and retry.
  // Logged-in users store `user_id` and their profile username as `name`.
  saveScore: (entry: NewScore) => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Stale key from the SPEC 01 mock login.
    try {
      localStorage.removeItem("av_user");
    } catch {}

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setState({ status: "guest", user: null });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setState(
        profile
          ? { status: "user", user: { id: user.id, name: profile.username } }
          : { status: "needs-username", user: null },
      );
    }

    load();

    // Do not call Supabase inside this callback (it can deadlock): defer.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      setTimeout(load, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setState({ status: "guest", user: null });
  }, []);

  const loggedUser = state.user;
  const saveScore = useCallback(
    async (entry: NewScore) => {
      const supabase = createClient();
      const { error } = await supabase.from("scores").insert({
        game_id: entry.game,
        name: loggedUser ? loggedUser.name : entry.name,
        score: entry.score,
        user_id: loggedUser ? loggedUser.id : null,
      });
      if (error) throw new Error(error.message);
    },
    [loggedUser],
  );

  const value = useMemo(
    () => ({ user: state.user, status: state.status, signOut, saveScore }),
    [state.user, state.status, signOut, saveScore],
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
