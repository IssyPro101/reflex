"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Terminal,
  Activity,
  MessageSquare,
  AlertTriangle,
  Clock,
  Hand,
  GitPullRequest,
  GitMerge,
  ExternalLink,
  Github,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Menu,
  X,
  Lock,
  Globe,
  Save,
  Send,
  MoreHorizontal,
} from "lucide-react";
import type {
  AuthMeResponse,
  ObservabilityResponse,
  Repo,
} from "@/lib/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ActiveSessions } from "@/components/sessions/ActiveSessions";

type Props = {
  accessToken: string;
  authState: AuthMeResponse;
  onSignOut: () => void;
  onRefresh: () => void;
};

type Tab = "overview" | "sessions" | "settings";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "text-yellow-400 border-yellow-400/20 bg-yellow-400/10",
    pr_created: "text-blue-400 border-blue-400/20 bg-blue-400/10",
    resolved: "text-emerald-400 border-emerald-400/20 bg-emerald-400/10",
    needs_manual: "text-red-400 border-red-400/20 bg-red-400/10",
    ignored: "text-zinc-400 border-zinc-400/20 bg-zinc-400/10",
    open: "text-emerald-400 border-emerald-400/20 bg-emerald-400/10",
    merged: "text-purple-400 border-purple-400/20 bg-purple-400/10",
    closed: "text-zinc-400 border-zinc-400/20 bg-zinc-400/10",
    blocked: "text-red-400 border-red-400/20 bg-red-400/10",
  };
  return map[status] ?? "text-zinc-400 border-zinc-400/20 bg-zinc-400/10";
}

function toGitUrl(htmlUrl: string): string {
  const trimmed = htmlUrl.replace(/\/+$/, "");
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
}

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export function Dashboard({
  accessToken,
  authState,
  onSignOut,
  onRefresh,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<ObservabilityResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [targetRepoUrl, setTargetRepoUrl] = useState(
    authState.github.target?.repoUrl ?? "",
  );
  const [targetBranch, setTargetBranch] = useState(
    authState.github.target?.baseBranch ?? "main",
  );
  const [discordGuildInput, setDiscordGuildInput] = useState("");
  const [discordGuilds, setDiscordGuilds] = useState<string[]>(
    authState.discord.guildIds ?? [],
  );
  const [telegramChatId, setTelegramChatId] = useState(
    authState.telegram.chatId ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState("");

  const userLabel = authState.github.login
    ? `@${authState.github.login}`
    : (authState.app.email ?? "User");

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const data = await api.getOverview(accessToken);
      setOverview(data);
    } catch {
      /* silent */
    }
    setLoadingOverview(false);
  }, [accessToken]);

  const loadRepos = useCallback(async () => {
    if (!authState.github.connected) return;
    try {
      const data = await api.getRepos(accessToken);
      setRepos(data.repos.slice(0, 12));
    } catch {
      /* silent */
    }
  }, [accessToken, authState.github.connected]);

  useEffect(() => {
    loadOverview();
    loadRepos();
  }, [loadOverview, loadRepos]);

  function showFeedback(msg: string) {
    setSavedFeedback(msg);
    setTimeout(() => setSavedFeedback(""), 2500);
  }

  async function saveTarget() {
    if (!targetRepoUrl.trim() || !targetBranch.trim()) return;
    setSaving(true);
    try {
      await api.saveTarget(accessToken, targetRepoUrl, targetBranch);
      showFeedback("Target saved");
      onRefresh();
    } catch {
      showFeedback("Failed to save");
    }
    setSaving(false);
  }

  async function linkDiscord() {
    if (!discordGuildInput.trim()) return;
    setSaving(true);
    try {
      await api.linkDiscord(accessToken, discordGuildInput.trim());
      setDiscordGuilds((prev) => [...prev, discordGuildInput.trim()]);
      setDiscordGuildInput("");
      showFeedback("Discord linked");
      onRefresh();
    } catch {
      showFeedback("Failed to link");
    }
    setSaving(false);
  }

  async function unlinkDiscord(guildId: string) {
    setSaving(true);
    try {
      await api.unlinkDiscord(accessToken, guildId);
      setDiscordGuilds((prev) => prev.filter((g) => g !== guildId));
      showFeedback("Discord unlinked");
      onRefresh();
    } catch {
      showFeedback("Failed to unlink");
    }
    setSaving(false);
  }

  async function saveTelegram() {
    if (!telegramChatId.trim()) return;
    setSaving(true);
    try {
      await api.linkTelegram(accessToken, telegramChatId.trim());
      showFeedback("Telegram linked");
      onRefresh();
    } catch {
      showFeedback("Failed to link");
    }
    setSaving(false);
  }

  async function removeTelegram() {
    setSaving(true);
    try {
      await api.unlinkTelegram(accessToken);
      setTelegramChatId("");
      showFeedback("Telegram unlinked");
      onRefresh();
    } catch {
      showFeedback("Failed to unlink");
    }
    setSaving(false);
  }

  async function disconnectGithub() {
    try {
      await api.disconnectGitHub(accessToken);
      onRefresh();
    } catch {
      /* silent */
    }
  }

  const stats = overview
    ? [
        { label: "Messages", value: overview.counts.messagesTotal, icon: MessageSquare },
        { label: "Issues", value: overview.counts.complaintsTotal, icon: AlertTriangle },
        { label: "Pending", value: overview.counts.complaintsPending, icon: Clock },
        { label: "Manual", value: overview.counts.complaintsManual, icon: Hand },
        { label: "PRs Open", value: overview.counts.prsOpen, icon: GitPullRequest },
        { label: "PRs Merged", value: overview.counts.prsMerged, icon: GitMerge },
      ]
    : [];

  const navItems = [
    { id: "overview" as Tab, label: "Overview", icon: LayoutDashboard },
    { id: "sessions" as Tab, label: "Sessions", icon: Activity },
    { id: "settings" as Tab, label: "Settings", icon: Settings },
  ];

  const inputClass =
    "w-full px-3 py-2 rounded-md bg-[#0A0A0A] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.2] transition-colors text-[13px]";

  return (
    <div className="min-h-screen bg-black text-white flex font-sans selection:bg-white/20">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-[240px] border-r border-white/[0.08] bg-[#0A0A0A] flex flex-col transition-transform duration-300 shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2 text-[14px] font-medium text-white">
            <Terminal className="w-4 h-4" />
            Workspace
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer",
                tab === item.id
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]",
              )}
            >
              <item.icon className="w-[14px] h-[14px]" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User profile section */}
        <div className="p-3 border-t border-white/[0.04]">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/[0.1] flex items-center justify-center text-[10px] font-medium shrink-0">
                {userLabel.replace("@", "").charAt(0).toUpperCase()}
              </div>
              <p className="text-[13px] font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{userLabel}</p>
            </div>
            <MoreHorizontal className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 mt-1 rounded-md text-[13px] text-zinc-500 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <LogOut className="w-[14px] h-[14px]" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col bg-black">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-white/[0.08] bg-black/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-zinc-500 hover:text-white cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-[14px] font-medium text-zinc-200">
              {tab === "overview" ? "Overview" : tab === "sessions" ? "Agent Sessions" : "Settings"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {savedFeedback && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-[13px] text-zinc-400 bg-white/[0.08] px-2 py-0.5 rounded-md"
                >
                  {savedFeedback}
                </motion.span>
              )}
            </AnimatePresence>
            {tab === "overview" && (
              <button
                onClick={loadOverview}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer border border-transparent hover:border-white/[0.1]"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    loadingOverview && "animate-spin",
                  )}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          <div className="max-w-[1000px] mx-auto">
            <AnimatePresence mode="wait">
              {tab === "overview" ? (
                <motion.div
                  key="overview"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={fadeIn}
                  transition={{ duration: 0.2 }}
                >
                  {/* Stats line */}
                  {loadingOverview && !overview ? (
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="min-w-[140px] border-l-2 border-white/[0.04] pl-4 animate-pulse"
                        >
                          <div className="w-16 h-3 bg-white/[0.08] rounded mb-2" />
                          <div className="w-8 h-6 bg-white/[0.08] rounded" />
                        </div>
                      ))}
                    </div>
                  ) : overview ? (
                    <div className="flex flex-wrap gap-8 mb-12">
                      {stats.map((stat) => (
                        <div key={stat.label} className="border-l-2 border-white/[0.08] pl-4">
                          <p className="text-[12px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-semibold tracking-tight text-white">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[13px] text-zinc-500">No data available yet.</div>
                  )}

                  {/* Activity Lists */}
                  {overview && (
                    <div className="grid lg:grid-cols-2 gap-10">
                      {/* Complaints */}
                      <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-white/[0.08] pb-2">
                          <AlertTriangle className="w-4 h-4 text-zinc-500" />
                          <h2 className="text-[13px] font-medium text-zinc-300">Issues</h2>
                          <span className="text-[11px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-sm ml-auto">{overview.recentComplaints.length}</span>
                        </div>
                        <div className="space-y-[1px] max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                          {overview.recentComplaints.length === 0 ? (
                            <p className="text-[13px] text-zinc-600">No issues yet.</p>
                          ) : (
                            overview.recentComplaints.map((item) => (
                              <div
                                key={item.id}
                                className="group flex flex-col p-3 hover:bg-white/[0.04] rounded-lg transition-colors"
                              >
                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                  <p className="text-[14px] font-medium text-zinc-200 line-clamp-1">{item.summary}</p>
                                  <span className="text-[12px] text-zinc-600 shrink-0 mt-0.5">{timeAgo(item.created_at)}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider ${statusBadge(item.status)}`}>
                                    {item.status.replace("_", " ")}
                                  </span>
                                  <span className="text-[12px] text-zinc-500">
                                    <span className="text-zinc-600 mr-1">@</span>{item.username}
                                  </span>
                                  <span className="text-[12px] text-zinc-600 ml-auto flex items-center gap-1">
                                    {item.intent.replace("_", " ")}
                                  </span>
                                </div>
                                {item.pr_url && (
                                  <a href={item.pr_url} target="_blank" rel="noreferrer" className="mt-2 text-[12px] flex items-center gap-1 text-zinc-400 hover:text-white transition-colors w-fit group/link">
                                    <GitPullRequest className="w-3.5 h-3.5" />
                                    <span>PR #{item.pr_number}</span>
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                  </a>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* PRs */}
                      <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-white/[0.08] pb-2">
                          <GitPullRequest className="w-4 h-4 text-zinc-500" />
                          <h2 className="text-[13px] font-medium text-zinc-300">Pull Requests</h2>
                          <span className="text-[11px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-sm ml-auto">{overview.recentPrs.length}</span>
                        </div>
                        <div className="space-y-[1px] max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                          {overview.recentPrs.length === 0 ? (
                            <p className="text-[13px] text-zinc-600">No pull requests yet.</p>
                          ) : (
                            overview.recentPrs.map((item) => (
                              <a
                                key={item.id}
                                href={item.pr_url}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex flex-col p-3 hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
                              >
                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                  <p className="text-[14px] font-medium text-zinc-200 line-clamp-1 flex items-center gap-2">
                                    <span className="text-zinc-500">#{item.pr_number}</span>
                                    {item.repo}
                                  </p>
                                  <span className="text-[12px] text-zinc-600 shrink-0 mt-0.5 group-hover:hidden">{timeAgo(item.created_at)}</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500 hidden group-hover:block mt-0.5 shrink-0" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider ${statusBadge(item.status)}`}>
                                    {item.status}
                                  </span>
                                  <span className="text-[12px] text-zinc-500 truncate max-w-[200px]">
                                    {item.summary || "Automated fix"}
                                  </span>
                                </div>
                              </a>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : tab === "sessions" ? (
                <motion.div
                  key="sessions"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={fadeIn}
                  transition={{ duration: 0.2 }}
                >
                  <ActiveSessions accessToken={accessToken} />
                </motion.div>
              ) : (
                <motion.div
                  key="settings"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={fadeIn}
                  transition={{ duration: 0.2 }}
                  className="max-w-2xl"
                >
                  <div className="space-y-10">
                    {/* Settings Sections */}
                    <section>
                      <h3 className="text-[14px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
                        <Github className="w-4 h-4 text-zinc-400" />
                        GitHub Integration
                      </h3>
                      {authState.github.connected ? (
                        <div className="flex items-center justify-between text-[13px] p-3 rounded-lg border border-white/[0.08] bg-[#0A0A0A]">
                          <span className="text-zinc-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            Connected to @{authState.github.login}
                          </span>
                          <button onClick={disconnectGithub} className="text-zinc-500 hover:text-white transition-colors">Disconnect</button>
                        </div>
                      ) : (
                        <p className="text-[13px] text-zinc-500">Not connected.</p>
                      )}
                    </section>

                    <section>
                      <h3 className="text-[14px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
                        <GitPullRequest className="w-4 h-4 text-zinc-400" />
                        Target Repository
                      </h3>
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[12px] font-medium text-zinc-500 mb-1.5">Repository URL</label>
                            <input
                              value={targetRepoUrl}
                              onChange={(e) => setTargetRepoUrl(e.target.value)}
                              placeholder="https://github.com/owner/repo.git"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[12px] font-medium text-zinc-500 mb-1.5">Base Branch</label>
                            <input
                              value={targetBranch}
                              onChange={(e) => setTargetBranch(e.target.value)}
                              placeholder="main"
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <button
                          onClick={saveTarget}
                          disabled={saving || !targetRepoUrl || !targetBranch}
                          className="bg-white text-black px-4 py-1.5 rounded-md text-[13px] font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                        >
                          Save changes
                        </button>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[14px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
                        <MessageSquare className="w-4 h-4 text-zinc-400" />
                        Discord Servers
                      </h3>
                      <div className="space-y-3">
                        {discordGuilds.map((id) => (
                          <div key={id} className="flex items-center justify-between text-[13px] p-2.5 rounded-md border border-white/[0.08] bg-[#0A0A0A]">
                            <span className="font-mono text-zinc-400">{id}</span>
                            <button onClick={() => unlinkDiscord(id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <input
                            value={discordGuildInput}
                            onChange={(e) => setDiscordGuildInput(e.target.value)}
                            placeholder="Add server ID..."
                            className={inputClass}
                          />
                          <button
                            onClick={linkDiscord}
                            disabled={saving || !discordGuildInput}
                            className="bg-white text-black px-3 py-2 rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[14px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
                        <Send className="w-4 h-4 text-zinc-400" />
                        Telegram Notifications
                      </h3>
                      <div className="flex items-center gap-2">
                        <input
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder="Telegram Chat ID"
                          className={inputClass}
                        />
                        <button
                          onClick={saveTelegram}
                          disabled={saving || !telegramChatId}
                          className="bg-white text-black px-4 py-2 rounded-md text-[13px] font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors shrink-0"
                        >
                          Save
                        </button>
                        {authState.telegram.chatId && (
                          <button
                            onClick={removeTelegram}
                            className="text-zinc-600 hover:text-red-400 transition-colors px-2 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </section>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
