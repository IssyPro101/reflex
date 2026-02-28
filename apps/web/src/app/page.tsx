"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type AuthMeResponse = {
  app: {
    authenticated: boolean;
    userId?: string;
    email?: string | null;
  };
  github: {
    connected: boolean;
    login?: string;
    name?: string | null;
    scope?: string | null;
    discordUserId?: string | null;
    target?: {
      repoUrl: string;
      baseBranch: string;
    } | null;
  };
};

type ObservabilityResponse = {
  counts: {
    messagesTotal: number;
    complaintsTotal: number;
    complaintsPending: number;
    complaintsManual: number;
    prsOpen: number;
    prsMerged: number;
  };
  recentComplaints: Array<{
    id: string;
    summary: string;
    severity: string;
    status: string;
    intent: string;
    created_at: string;
    username: string;
    message_text: string;
    pr_url: string | null;
    pr_number: number | null;
    pr_status: string | null;
  }>;
  recentPrs: Array<{
    id: string;
    repo: string;
    pr_number: number;
    pr_url: string;
    status: string;
    created_at: string;
    summary: string | null;
    severity: string | null;
  }>;
  generatedAt: string;
};

type Repo = {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function toGitUrl(htmlUrl: string): string {
  const trimmed = htmlUrl.replace(/\/+$/, "");
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
}

export default function Home() {
  const missingSupabaseEnvMessage =
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  const supabaseConfigured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (supabaseConfigured ? getSupabaseClient() : null),
    [supabaseConfigured],
  );

  const [loading, setLoading] = useState(supabaseConfigured);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthMeResponse | null>(null);
  const [overview, setOverview] = useState<ObservabilityResponse | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [targetRepoUrl, setTargetRepoUrl] = useState("");
  const [targetBaseBranch, setTargetBaseBranch] = useState("main");
  const [discordUserId, setDiscordUserId] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingDiscordLink, setSavingDiscordLink] = useState(false);
  const [error, setError] = useState<string>(supabaseConfigured ? "" : missingSupabaseEnvMessage);

  const userLabel = useMemo(() => {
    const email = authState?.app.email;
    if (email) {
      return email;
    }
    if (authState?.github.login) {
      return `@${authState.github.login}`;
    }
    return "Unknown";
  }, [authState]);

  const loadBackendData = useCallback(async (token: string | null) => {
      if (!token) {
        setAuthState({
          app: { authenticated: false },
          github: { connected: false },
        });
        setOverview(null);
        setRepos([]);
        setTargetRepoUrl("");
        setTargetBaseBranch("main");
        setDiscordUserId("");
        return;
      }

    try {
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!meResponse.ok) {
        setAuthState({
          app: { authenticated: false },
          github: { connected: false },
        });
        setOverview(null);
        setRepos([]);
        return;
      }

      const meJson = (await meResponse.json()) as AuthMeResponse;
      setAuthState(meJson);

      if (!meJson.app.authenticated) {
        setOverview(null);
        setRepos([]);
        setTargetRepoUrl("");
        setTargetBaseBranch("main");
        setDiscordUserId("");
        return;
      }

      if (meJson.github.target) {
        setTargetRepoUrl(meJson.github.target.repoUrl);
        setTargetBaseBranch(meJson.github.target.baseBranch);
      } else {
        setTargetRepoUrl("");
        setTargetBaseBranch("main");
      }
      setDiscordUserId(meJson.github.discordUserId ?? "");

      const overviewResponse = await fetch(`${API_URL}/observability/overview?limit=15`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (overviewResponse.ok) {
        setOverview((await overviewResponse.json()) as ObservabilityResponse);
      } else {
        setOverview(null);
      }

      if (meJson.github.connected) {
        const reposResponse = await fetch(`${API_URL}/auth/github/repos`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (reposResponse.ok) {
          const reposJson = (await reposResponse.json()) as { repos: Repo[] };
          setRepos(reposJson.repos.slice(0, 8));
        }
      } else {
        setRepos([]);
      }
    } catch {
      setError("Unable to reach backend.");
      setOverview(null);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const token = data.session?.access_token ?? null;
        setAccessToken(token);
        await loadBackendData(token);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      void loadBackendData(token);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadBackendData, supabase]);

  async function signInWithGoogle() {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    setError("");
    await supabase.auth.signOut();
    setAccessToken(null);
    setAuthState({
      app: { authenticated: false },
      github: { connected: false },
    });
    setOverview(null);
    setRepos([]);
    setTargetRepoUrl("");
    setTargetBaseBranch("main");
    setDiscordUserId("");
  }

  async function connectGithub() {
    if (!accessToken) {
      setError("Sign in first.");
      return;
    }

    setError("");

    const response = await fetch(`${API_URL}/auth/github/url?next=/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      setError("Failed to start GitHub authorization.");
      return;
    }

    const body = (await response.json()) as { url: string };
    window.location.assign(body.url);
  }

  async function disconnectGithub() {
    if (!accessToken) {
      return;
    }

    setError("");

    const response = await fetch(`${API_URL}/auth/github/disconnect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      setError("Failed to disconnect GitHub.");
      return;
    }

    await loadBackendData(accessToken);
  }

  async function saveGithubTarget() {
    if (!accessToken) {
      setError("Sign in first.");
      return;
    }

    if (!targetRepoUrl.trim()) {
      setError("Select a target repository.");
      return;
    }

    if (!targetBaseBranch.trim()) {
      setError("Enter a base branch.");
      return;
    }

    setSavingTarget(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/github/target`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl: targetRepoUrl,
          baseBranch: targetBaseBranch,
        }),
      });

      if (!response.ok) {
        setError("Failed to save target repository settings.");
        return;
      }

      const payload = (await response.json()) as {
        target: { repoUrl: string; baseBranch: string };
      };
      setTargetRepoUrl(payload.target.repoUrl);
      setTargetBaseBranch(payload.target.baseBranch);
      await loadBackendData(accessToken);
    } finally {
      setSavingTarget(false);
    }
  }

  async function linkDiscordUser() {
    if (!accessToken) {
      setError("Sign in first.");
      return;
    }

    const normalized = discordUserId.trim();
    if (!normalized) {
      setError("Enter your Discord user ID.");
      return;
    }

    setSavingDiscordLink(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/discord/link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ discordUserId: normalized }),
      });

      if (!response.ok) {
        setError("Failed to link Discord user ID.");
        return;
      }

      await loadBackendData(accessToken);
    } finally {
      setSavingDiscordLink(false);
    }
  }

  async function unlinkDiscordUser() {
    if (!accessToken) {
      return;
    }

    setSavingDiscordLink(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/discord/link`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setError("Failed to unlink Discord user ID.");
        return;
      }

      setDiscordUserId("");
      await loadBackendData(accessToken);
    } finally {
      setSavingDiscordLink(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-3xl font-semibold tracking-tight">CFCA Observability</h1>
          <p className="mt-2 text-sm text-slate-300">
            Sign in with Google (Supabase), connect GitHub, and monitor system activity.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-xl font-semibold">Account</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-300">Loading...</p>
          ) : authState?.app.authenticated ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">
                Signed in: {userLabel}
              </span>
              <button
                onClick={signOut}
                className="rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              disabled={!supabaseConfigured}
              className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
            >
              Sign in with Google
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-xl font-semibold">GitHub Connection</h2>
          {!authState?.app.authenticated ? (
            <p className="mt-3 text-sm text-slate-300">Sign in first.</p>
          ) : authState.github.connected ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">
                Connected as @{authState.github.login}
              </span>
              <button
                onClick={disconnectGithub}
                className="rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800"
              >
                Disconnect GitHub
              </button>
            </div>
          ) : (
            <button
              onClick={connectGithub}
              className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
            >
              Connect GitHub
            </button>
          )}

          {repos.length > 0 ? (
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p className="text-slate-200">Recent writable repositories</p>
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between gap-3 rounded border border-slate-800 px-3 py-2"
                >
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {repo.full_name} ({repo.default_branch})
                  </a>
                  <button
                    onClick={() => {
                      setTargetRepoUrl(toGitUrl(repo.html_url));
                      if (!targetBaseBranch.trim()) {
                        setTargetBaseBranch(repo.default_branch);
                      }
                    }}
                    className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {authState?.github.connected ? (
            <div className="mt-5 grid gap-3 rounded border border-slate-800 bg-slate-950/40 p-4 text-sm">
              <p className="font-medium text-slate-200">PR target settings (per user)</p>
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Target repository URL</span>
                <input
                  value={targetRepoUrl}
                  onChange={(event) => setTargetRepoUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo.git"
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Base branch</span>
                <input
                  value={targetBaseBranch}
                  onChange={(event) => setTargetBaseBranch(event.target.value)}
                  placeholder="main"
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
              <button
                onClick={saveGithubTarget}
                disabled={savingTarget}
                className="w-fit rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800 disabled:opacity-60"
              >
                {savingTarget ? "Saving..." : "Save target"}
              </button>

              <div className="mt-2 border-t border-slate-800 pt-3">
                <p className="font-medium text-slate-200">Discord identity link</p>
                <p className="mt-1 text-xs text-slate-400">
                  Link your Discord user ID so inbound Discord complaints use your saved repo target.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={discordUserId}
                    onChange={(event) => setDiscordUserId(event.target.value)}
                    placeholder="Discord user ID"
                    className="min-w-[220px] rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                  <button
                    onClick={linkDiscordUser}
                    disabled={savingDiscordLink}
                    className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingDiscordLink ? "Saving..." : "Link Discord ID"}
                  </button>
                  <button
                    onClick={unlinkDiscordUser}
                    disabled={savingDiscordLink}
                    className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800 disabled:opacity-60"
                  >
                    Unlink
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-xl font-semibold">System Overview</h2>
          {!authState?.app.authenticated ? (
            <p className="mt-3 text-sm text-slate-300">Sign in to view observability data.</p>
          ) : !overview ? (
            <p className="mt-3 text-sm text-slate-300">No data available yet.</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Messages" value={overview.counts.messagesTotal} />
                <StatCard label="Complaints" value={overview.counts.complaintsTotal} />
                <StatCard label="Pending Complaints" value={overview.counts.complaintsPending} />
                <StatCard label="Needs Manual" value={overview.counts.complaintsManual} />
                <StatCard label="PRs Open" value={overview.counts.prsOpen} />
                <StatCard label="PRs Merged" value={overview.counts.prsMerged} />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Recent Complaints</h3>
                  <div className="space-y-2">
                    {overview.recentComplaints.map((item) => (
                      <div key={item.id} className="rounded border border-slate-800 p-3 text-sm">
                        <p className="font-medium">{item.summary}</p>
                        <p className="mt-1 text-slate-400">{item.message_text}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {item.status} • {item.severity} • {item.intent}
                        </p>
                        {item.pr_url ? (
                          <a
                            href={item.pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs text-emerald-300 hover:underline"
                          >
                            PR #{item.pr_number} ({item.pr_status})
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Recent PRs</h3>
                  <div className="space-y-2">
                    {overview.recentPrs.map((item) => (
                      <a
                        key={item.id}
                        href={item.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded border border-slate-800 p-3 text-sm hover:bg-slate-800"
                      >
                        <p className="font-medium">
                          {item.repo} #{item.pr_number}
                        </p>
                        <p className="mt-1 text-slate-400">{item.summary ?? "No summary"}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {item.status} • {item.severity ?? "n/a"}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {error ? (
          <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
