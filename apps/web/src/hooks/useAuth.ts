"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { AuthMeResponse, Repo } from "@/lib/types";

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

export function useAuth() {
  const supabaseConfigured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (supabaseConfigured ? getSupabaseClient() : null),
    [supabaseConfigured],
  );

  const [status, setStatus] = useState<AuthStatus>(
    supabaseConfigured ? "loading" : "unauthenticated",
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthMeResponse | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);

  const needsOnboarding = !!authState?.app.authenticated && (
    !authState.github.connected ||
    !authState.github.target ||
    authState.discord.guildIds.length === 0 ||
    !authState.telegram.chatId
  );

  const loadBackendData = useCallback(async (token: string | null) => {
    if (!token) {
      setAuthState(null);
      setRepos([]);
      setStatus("unauthenticated");
      return;
    }

    try {
      const me = await api.getMe(token);
      setAuthState(me);

      if (!me.app.authenticated) {
        setStatus("unauthenticated");
        return;
      }

      if (me.github.connected) {
        try {
          const reposData = await api.getRepos(token);
          setRepos(reposData.repos.slice(0, 12));
        } catch {
          /* silent */
        }
      }

      setStatus("authenticated");
    } catch {
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const token = data.session?.access_token ?? null;
        setAccessToken(token);
        await loadBackendData(token);
      })
      .catch(() => {
        setStatus("unauthenticated");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      void loadBackendData(token);
    });

    return () => subscription.unsubscribe();
  }, [loadBackendData, supabase]);

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAccessToken(null);
    setAuthState(null);
    setRepos([]);
    setStatus("unauthenticated");
  }

  async function connectGithub() {
    if (!accessToken) return;
    try {
      const { url } = await api.getGitHubUrl(accessToken);
      window.location.assign(url);
    } catch {
      /* silent */
    }
  }

  async function saveTarget(repoUrl: string, baseBranch: string) {
    if (!accessToken) return;
    await api.saveTarget(accessToken, repoUrl, baseBranch);
    setAuthState((prev) =>
      prev
        ? {
            ...prev,
            github: { ...prev.github, target: { repoUrl, baseBranch } },
          }
        : prev,
    );
  }

  async function linkDiscord(guildId: string) {
    if (!accessToken) return;
    await api.linkDiscord(accessToken, guildId);
    setAuthState((prev) =>
      prev
        ? {
            ...prev,
            discord: { guildIds: [...prev.discord.guildIds, guildId] },
          }
        : prev,
    );
  }

  async function linkTelegram(chatId: string) {
    if (!accessToken) return;
    await api.linkTelegram(accessToken, chatId);
    setAuthState((prev) =>
      prev
        ? {
            ...prev,
            telegram: { chatId },
          }
        : prev,
    );
  }

  function refresh() {
    if (accessToken) void loadBackendData(accessToken);
  }

  return {
    status,
    accessToken,
    authState,
    repos,
    needsOnboarding,
    signInWithGoogle,
    signOut,
    connectGithub,
    saveTarget,
    linkDiscord,
    linkTelegram,
    refresh,
  };
}
