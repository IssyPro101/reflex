"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { AuthMeResponse, Repo } from "@/lib/types";
import { Landing } from "@/components/landing/Landing";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { Dashboard } from "@/components/dashboard/Dashboard";

type AppView = "loading" | "landing" | "onboarding" | "dashboard";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6"
      >
        <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-[#0A0A0A] flex items-center justify-center shadow-2xl">
          <Terminal className="w-5 h-5 text-white" />
        </div>
        <div className="w-40 h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full w-1/3 bg-white/[0.8] rounded-full animate-loading-bar" />
        </div>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const supabaseConfigured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (supabaseConfigured ? getSupabaseClient() : null),
    [supabaseConfigured],
  );

  const [view, setView] = useState<AppView>(
    supabaseConfigured ? "loading" : "landing",
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthMeResponse | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const loadBackendData = useCallback(
    async (token: string | null) => {
      if (!token) {
        setAuthState(null);
        setRepos([]);
        setView("landing");
        return;
      }

      try {
        const me = await api.getMe(token);
        setAuthState(me);

        if (!me.app.authenticated) {
          setView("landing");
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

        if (!me.github.connected || !me.github.target) {
          setView("onboarding");
        } else {
          setView("dashboard");
        }
      } catch {
        setView("landing");
      }
    },
    [],
  );

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
        setView("landing");
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
    setOnboardingDismissed(false);
    setView("landing");
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

  async function handleSaveTarget(repoUrl: string, baseBranch: string) {
    if (!accessToken) return;
    await api.saveTarget(accessToken, repoUrl, baseBranch);
    await loadBackendData(accessToken);
  }

  async function handleLinkDiscord(guildId: string) {
    if (!accessToken) return;
    await api.linkDiscord(accessToken, guildId);
    await loadBackendData(accessToken);
  }

  function handleOnboardingComplete() {
    setOnboardingDismissed(true);
    setView("dashboard");
  }

  if (view === "loading") {
    return <LoadingScreen />;
  }

  if (view === "landing" || !authState?.app.authenticated) {
    return <Landing onSignIn={signInWithGoogle} />;
  }

  if (view === "onboarding" && !onboardingDismissed) {
    return (
      <Onboarding
        githubConnected={authState.github.connected}
        githubLogin={authState.github.login}
        repos={repos}
        onConnectGithub={connectGithub}
        onSaveTarget={handleSaveTarget}
        onLinkDiscord={handleLinkDiscord}
        onComplete={handleOnboardingComplete}
        hasTarget={!!authState.github.target}
      />
    );
  }

  return (
    <Dashboard
      accessToken={accessToken!}
      authState={authState}
      onSignOut={signOut}
      onRefresh={() => {
        if (accessToken) void loadBackendData(accessToken);
      }}
    />
  );
}
