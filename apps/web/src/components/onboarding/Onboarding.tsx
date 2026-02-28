"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Terminal,
  Lock,
  Globe,
} from "lucide-react";
import { DiscordIcon } from "@/components/icons/BrandIcons";
import type { Repo } from "@/lib/types";

type Props = {
  githubConnected: boolean;
  githubLogin?: string;
  repos: Repo[];
  onConnectGithub: () => void;
  onSaveTarget: (repoUrl: string, baseBranch: string) => Promise<void>;
  onLinkDiscord: (guildId: string) => Promise<void>;
  onComplete: () => void;
  hasTarget: boolean;
};

function toGitUrl(htmlUrl: string): string {
  const trimmed = htmlUrl.replace(/\/+$/, "");
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
}

const stepsMeta = [
  { id: "github", label: "Connect", icon: Github },
  { id: "repo", label: "Repository", icon: GitBranch },
  { id: "discord", label: "Discord", icon: DiscordIcon },
];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0 }),
};

export function Onboarding(props: Props) {
  const initialStep = !props.githubConnected ? 0 : !props.hasTarget ? 1 : 2;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [targetRepoUrl, setTargetRepoUrl] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, 2));
  };
  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  async function handleSaveTarget() {
    if (!targetRepoUrl.trim()) return;
    setSaving(true);
    try {
      await props.onSaveTarget(targetRepoUrl, targetBranch);
      goNext();
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkDiscord() {
    if (!discordGuildId.trim()) return;
    setSaving(true);
    try {
      await props.onLinkDiscord(discordGuildId);
      props.onComplete();
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
          <Terminal className="w-4 h-4 text-white" />
          <span className="font-semibold tracking-tight text-[15px]">CFCA Setup</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 w-full max-w-xl mx-auto">
        {/* Minimal Step Indicator */}
        <div className="flex items-center gap-2 mb-12">
          {stepsMeta.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-medium transition-colors ${
                  i === currentStep
                    ? "bg-white text-black"
                    : i < currentStep
                      ? "bg-zinc-800 text-zinc-300"
                      : "border border-white/[0.1] text-zinc-600"
                }`}
              >
                {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < stepsMeta.length - 1 && (
                <div
                  className={`w-8 h-[1px] ${i < currentStep ? "bg-zinc-800" : "bg-white/[0.08]"}`}
                />
              )}
            </div>
          ))}
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
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    Connect GitHub
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Authorize CFCA to open pull requests automatically.
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
                  <h2 className="text-[24px] font-medium tracking-tight mb-2">
                    Link Discord Server
                  </h2>
                  <p className="text-[15px] text-zinc-500">
                    Monitor your community feedback automatically.
                  </p>
                </div>

                <div className="mt-8 space-y-4">
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

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.08]">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={props.onComplete}
                      className="px-4 py-2 rounded-full text-[13px] text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handleLinkDiscord}
                      disabled={saving || !discordGuildId.trim()}
                      className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-medium text-[13px] hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {saving ? "Linking..." : "Complete Setup"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
