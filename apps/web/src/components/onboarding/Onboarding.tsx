"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Globe,
  Sparkles,
} from "lucide-react";
import { DiscordIcon, TelegramIcon } from "@/components/icons/BrandIcons";
import type { Repo } from "@/lib/types";

type Props = {
  githubConnected: boolean;
  githubLogin?: string;
  repos: Repo[];
  onConnectGithub: () => void;
  onSaveTarget: (repoUrl: string, baseBranch: string) => Promise<void>;
  onLinkDiscord: (guildId: string) => Promise<void>;
  onLinkTelegram: (chatId: string) => Promise<void>;
  onComplete: () => void;
  hasTarget: boolean;
  hasDiscord: boolean;
  hasTelegram: boolean;
};

function toGitUrl(htmlUrl: string): string {
  const trimmed = htmlUrl.replace(/\/+$/, "");
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
}

const stepsMeta = [
  { id: "github", label: "Connect", icon: Github },
  { id: "repo", label: "Repository", icon: GitBranch },
  { id: "discord", label: "Discord", icon: DiscordIcon },
  { id: "telegram", label: "Telegram", icon: TelegramIcon },
  { id: "done", label: "Done", icon: CheckCircle2 },
];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0 }),
};

export function Onboarding(props: Props) {
  const initialStep = !props.githubConnected
    ? 0
    : !props.hasTarget
      ? 1
      : !props.hasDiscord
        ? 2
        : !props.hasTelegram
          ? 3
          : 4;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [targetRepoUrl, setTargetRepoUrl] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [discordLinked, setDiscordLinked] = useState(props.hasDiscord);
  const [telegramLinked, setTelegramLinked] = useState(props.hasTelegram);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, 4));
  };
  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  async function handleSaveTarget() {
    const repoUrl = targetRepoUrl.trim();
    const baseBranch = targetBranch.trim() || "main";
    if (!repoUrl) return;
    setSaving(true);
    try {
      await props.onSaveTarget(repoUrl, baseBranch);
      setTargetBranch(baseBranch);
      goNext();
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkDiscord() {
    const guildId = discordGuildId.trim();
    if (!guildId) return;
    setSaving(true);
    try {
      await props.onLinkDiscord(guildId);
      setDiscordLinked(true);
      setDiscordGuildId("");
      goNext();
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkTelegram() {
    const chatId = telegramChatId.trim();
    if (!chatId) return;
    setSaving(true);
    try {
      await props.onLinkTelegram(chatId);
      setTelegramLinked(true);
      setTelegramChatId("");
      goNext();
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-[#0A0A0A] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.2] transition-colors text-[14px]";
  
  const labelClass = "text-[13px] text-zinc-400 mb-2 block font-medium";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 h-16 flex items-center justify-center border-b border-white/[0.08] bg-black/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Reflex" className="w-4 h-4" />
          <span className="font-semibold tracking-tight text-[15px]">Reflex Setup</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 w-full max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-12">
          {stepsMeta.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    i === currentStep
                      ? "bg-white text-black"
                      : i < currentStep
                        ? "bg-zinc-800 text-zinc-300"
                        : "border border-white/[0.1] text-zinc-600"
                  }`}
                >
                  {i < currentStep ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                {i < stepsMeta.length - 1 && (
                  <div
                    className={`w-8 h-[1px] ${i < currentStep ? "bg-zinc-800" : "bg-white/[0.08]"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="w-full">
          <AnimatePresence mode="wait" custom={direction}>
            {currentStep === 0 && (
              <motion.div
                key="github"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <Github className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    Connect GitHub
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Authorize Reflex to open pull requests automatically.
                  </p>
                </div>

                {props.githubConnected ? (
                  <div className="flex flex-col items-center gap-6 mt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A0A0A] border border-white/[0.08] text-[13px] text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      Connected as @{props.githubLogin}
                    </div>
                    <button
                      onClick={goNext}
                      className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-medium text-[14px] hover:bg-zinc-200 transition-colors cursor-pointer"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={props.onConnectGithub}
                      className="group flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-black font-medium text-[14px] hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
                    >
                      <Github className="w-4 h-4" />
                      Continue with GitHub
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="repo"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <GitBranch className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    Target Repository
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Which repository should we open PRs against?
                  </p>
                </div>

                <div className="space-y-6">
                  {props.repos.length > 0 && (
                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar border border-white/[0.08] rounded-xl p-1 bg-[#0A0A0A]">
                      {props.repos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => {
                            setTargetRepoUrl(toGitUrl(repo.html_url));
                            setTargetBranch(repo.default_branch);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[13px] transition-colors cursor-pointer ${
                            targetRepoUrl === toGitUrl(repo.html_url)
                              ? "bg-white/[0.08] text-white"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          {repo.private ? (
                            <Lock className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <span className="font-medium truncate">{repo.full_name}</span>
                            <span className="text-[12px] opacity-60 ml-2 shrink-0">{repo.default_branch}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block">
                      <span className={labelClass}>Repository URL</span>
                      <input
                        value={targetRepoUrl}
                        onChange={(e) => setTargetRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo.git"
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Base branch</span>
                      <input
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(e.target.value)}
                        placeholder="main"
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.08]">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={handleSaveTarget}
                    disabled={saving || !targetRepoUrl.trim()}
                    className="group flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-medium text-[13px] hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {saving ? "Saving..." : "Continue"}
                    <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="discord"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center">
                    <DiscordIcon className="w-7 h-7 text-[#5865F2]" />
                  </div>
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    Link Discord
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Optional: add your server ID so Reflex can monitor community feedback.
                  </p>
                </div>

                {discordLinked ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[13px] text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      Discord already linked
                    </div>
                    <p className="text-[13px] text-zinc-500 mt-3">
                      You can update connected servers later in Dashboard Settings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block">
                      <span className={labelClass}>Discord Server (Guild) ID</span>
                      <input
                        value={discordGuildId}
                        onChange={(e) => setDiscordGuildId(e.target.value)}
                        placeholder="e.g. 1234567890"
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.08]">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    {!discordLinked && (
                      <button
                        onClick={goNext}
                        className="px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                      >
                        Skip
                      </button>
                    )}
                    <button
                      onClick={discordLinked ? goNext : handleLinkDiscord}
                      disabled={saving || (!discordLinked && !discordGuildId.trim())}
                      className="group flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-medium text-[13px] hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {discordLinked ? "Continue" : saving ? "Linking..." : "Link & Continue"}
                      <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="telegram"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[#26A5E4]/10 border border-[#26A5E4]/20 flex items-center justify-center">
                    <TelegramIcon className="w-7 h-7 text-[#26A5E4]" />
                  </div>
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    Link Telegram
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Optional: add a chat ID to receive update notifications.
                  </p>
                </div>

                {telegramLinked ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[13px] text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      Telegram already linked
                    </div>
                    <p className="text-[13px] text-zinc-500 mt-3">
                      You can update the chat ID later in Dashboard Settings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block">
                      <span className={labelClass}>Telegram Chat ID</span>
                      <input
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        placeholder="e.g. 1234567890"
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.08]">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    {!telegramLinked && (
                      <button
                        onClick={goNext}
                        className="px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                      >
                        Skip
                      </button>
                    )}
                    <button
                      onClick={telegramLinked ? goNext : handleLinkTelegram}
                      disabled={saving || (!telegramLinked && !telegramChatId.trim())}
                      className="group flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-medium text-[13px] hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {telegramLinked ? "Continue" : saving ? "Linking..." : "Link & Continue"}
                      <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="done"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    You're all set
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Everything is configured. You can configure any integration in Settings.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-[14px] font-medium text-zinc-200">Setup complete</p>
                      <p className="text-[13px] text-zinc-500 mt-1">
                        {props.githubLogin ? `@${props.githubLogin}` : "GitHub account"} is connected and ready.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 text-[13px]">
                    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 bg-black/40">
                      <span className="flex items-center gap-2 text-zinc-500">
                        <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
                        Discord
                      </span>
                      <span className={discordLinked ? "text-zinc-200" : "text-zinc-500"}>
                        {discordLinked ? "Linked" : "Skipped"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 bg-black/40">
                      <span className="flex items-center gap-2 text-zinc-500">
                        <TelegramIcon className="w-4 h-4 text-[#26A5E4]" />
                        Telegram
                      </span>
                      <span className={telegramLinked ? "text-zinc-200" : "text-zinc-500"}>
                        {telegramLinked ? "Linked" : "Skipped"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.08]">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={props.onComplete}
                    className="group flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-medium text-[13px] hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    Open Dashboard
                    <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
