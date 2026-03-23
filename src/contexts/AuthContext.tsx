import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  isFetchFailure,
  xhrAuthRequest,
  SIGN_IN_TRANSPORTS,
  SIGN_UP_TRANSPORTS,
  AuthTransportOptions,
} from "@/lib/auth-transport";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  access_level: number | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Profile fetching ──────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch profile:", error.message);
      setProfile(null);
      return;
    }

    if (data) {
      setProfile(data as Profile);
      return;
    }

    // Auto-create profile if missing (fallback for existing users)
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({ user_id: userId })
      .select("*")
      .single();

    if (createError) {
      console.error("Failed to create profile:", createError.message);
      setProfile(null);
      return;
    }

    setProfile(created as Profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // ── Session management ────────────────────────────────────
  const syncSession = useCallback(
    (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
      }
    },
    [fetchProfile]
  );

  useEffect(() => {
    // Safety timeout: If auth takes more than 5 seconds, stop the loading spinner
    // This prevents a blank screen if Supabase is slow or the connection hangs.
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("Auth initialization timed out. Releasing loading state.");
          return false;
        }
        return prev;
      });
    }, 5000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        syncSession(session);
      } else {
        syncSession(session);
      }
      setLoading(false);
      clearTimeout(timeout);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        syncSession(session);
      })
      .catch((err) => {
        console.error("Auth session retrieval error:", err);
      })
      .finally(() => {
        setLoading(false);
        clearTimeout(timeout);
      });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [syncSession]);

  // ── Fallback sign-up (XHR) ────────────────────────────────
  const signUpWithFallback = useCallback(
    async (email: string, password: string, displayName?: string) => {
      let lastError: { message: string } | null = null;

      for (const transport of SIGN_UP_TRANSPORTS) {
        const { error } = await xhrAuthRequest(
          `signup?redirect_to=${encodeURIComponent(window.location.origin)}`,
          { email, password, data: { display_name: displayName || email } },
          transport
        );

        if (!error) return { error: null };
        lastError = error;
        if (!isFetchFailure(error)) return { error };
      }

      return { error: lastError };
    },
    []
  );

  // ── Fallback sign-in (XHR) ────────────────────────────────
  const signInWithFallback = useCallback(
    async (email: string, password: string) => {
      let lastError: { message: string } | null = null;

      for (const transport of SIGN_IN_TRANSPORTS) {
        const { data, error } = await xhrAuthRequest(
          "token?grant_type=password",
          { email, password },
          transport
        );

        if (error) {
          lastError = error;
          if (!isFetchFailure(error)) return { error };
          continue;
        }

        if (!data?.access_token || !data?.refresh_token) {
          return { error: { message: "Authentication service did not return a valid session." } };
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (!sessionError) {
          const { data: sessionData } = await supabase.auth.getSession();
          syncSession(sessionData.session ?? null);
        }

        return { error: sessionError };
      }

      return {
        error: lastError || {
          message:
            "Unable to reach authentication service from this network. Please try another connection or Google sign-in.",
        },
      };
    },
    [syncSession]
  );

  // ── Public auth methods ───────────────────────────────────
  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth-verify`,
            data: { display_name: displayName || email },
          },
        });

        if (error && isFetchFailure(error)) {
          return await signUpWithFallback(email, password, displayName);
        }

        return { error };
      } catch (error: any) {
        if (isFetchFailure(error)) {
          return await signUpWithFallback(email, password, displayName);
        }
        return { error: { message: error?.message || "Unable to reach the authentication service." } };
      }
    },
    [signUpWithFallback]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error && isFetchFailure(error)) {
          return await signInWithFallback(email, password);
        }

        if (!error && data.session) {
          syncSession(data.session);
        }

        return { error };
      } catch (error: any) {
        if (isFetchFailure(error)) {
          return await signInWithFallback(email, password);
        }
        return { error: { message: error?.message || "Unable to reach the authentication service." } };
      }
    },
    [signInWithFallback, syncSession]
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during sign out:", error);
    } finally {
      // Always clear state manually to be safe
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
