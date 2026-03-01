"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  GitPullRequest,
  BarChart3,
  Bot,
  MessageSquare,
  Code2,

  LayoutDashboard,
  Activity,
  Settings,
  AlertTriangle,
  Clock,
  Hand,
  GitMerge,
  Github,
  ExternalLink,
} from "lucide-react";
import { DiscordIcon, TelegramIcon } from "@/components/icons/BrandIcons";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: DiscordIcon,
    title: "Community Listening",
    description:
      "Connect your Discord server and surface real user feedback in real time.",
  },
  {
    icon: Bot,
    title: "AI Triage",
    description:
      "Mistral AI reads every message, classifying bugs, feature requests, and noise.",
  },
  {
    icon: GitPullRequest,
    title: "Automated PRs",
    description:
      "Code fixes are generated and opened as pull requests — ready for review.",
  },
  {
    icon: BarChart3,
    title: "Observability",
    description:
      "Track PR merge rates, community sentiment, and system health at a glance.",
  },
];

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Listen",
    description: "Reflex monitors your Discord for bug reports and feedback.",
  },
  {
    number: "02",
    icon: Code2,
    title: "Fix",
    description: "Mistral AI analyzes the issue and generates a code patch.",
  },
  {
    number: "03",
    icon: GitPullRequest,
    title: "Ship",
    description: "A pull request is opened on your repo, ready to merge.",
  },
];

export function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center">
          <div className="flex items-center gap-2.5 flex-1">
            <img src="/logo.png" alt="Reflex" className="w-7 h-7" />
            <span className="font-semibold tracking-tight text-[16px]">
              Reflex
            </span>
          </div>

          <div className="hidden md:flex items-center justify-center gap-8 text-[14px] text-zinc-500 font-medium">
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors duration-200"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hover:text-white transition-colors duration-200"
            >
              Features
            </a>
          </div>

          <div className="flex items-center justify-end gap-3 text-[14px] font-medium flex-1">
            <button
              onClick={onSignIn}
              className="hidden sm:block text-zinc-500 hover:text-white transition-colors duration-200"
            >
              Log in
            </button>
            <button
              onClick={onSignIn}
              className="bg-white text-black px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors duration-200"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="relative pt-32 md:pt-40 pb-20 px-6 overflow-hidden">
          <div className="hero-glow-refined" />

          <motion.div
            className="relative max-w-[720px] mx-auto text-center flex flex-col items-center"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-flex items-center gap-2 text-[13px] font-medium tracking-wide uppercase text-zinc-500 border border-white/[0.08] rounded-full px-3.5 py-1.5 mb-8 bg-white/[0.02]">
                <img src="/mistral-logo.png" alt="Mistral AI" className="w-4 h-4" />
                Powered by Mistral AI
              </span>
            </motion.div>

            <motion.h1
              className="text-[41px] sm:text-[57px] md:text-[69px] leading-[1.08] tracking-[-0.035em] font-semibold bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent"
              variants={fadeUp}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              Community feedback,
              <br />
              fixed automatically
            </motion.h1>

            <motion.p
              className="mt-6 text-[18px] sm:text-[20px] text-zinc-400 leading-[1.65] max-w-[520px]"
              variants={fadeUp}
              transition={{
                duration: 0.6,
                delay: 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              Reflex listens to your Discord, triages bug reports with AI, and
              opens pull requests with fixes — so you can ship faster.
            </motion.p>

            <motion.div
              className="mt-10 flex items-center gap-4"
              variants={fadeUp}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <button
                onClick={onSignIn}
                className="group inline-flex items-center gap-2.5 bg-white text-black px-6 py-3 rounded-full text-[15px] font-semibold hover:bg-zinc-100 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Get started free
                <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* App Preview — mirrors actual dashboard */}
        <motion.section
          className="px-6 pb-32"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-[1000px] mx-auto relative">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
            <div className="rounded-2xl border border-white/[0.06] bg-[#08080A] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                <span className="text-[12px] text-zinc-600 ml-3 font-mono">
                  reflex — dashboard
                </span>
              </div>

              <div className="flex flex-col md:flex-row min-h-[420px]">
                {/* Sidebar — matches real Dashboard.tsx */}
                <div className="w-full md:w-[200px] border-r border-white/[0.04] flex flex-col">
                  <div className="h-12 flex items-center px-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 text-[14px] font-medium text-zinc-300">
                      <img src="/logo.png" alt="Reflex" className="w-3.5 h-3.5" />
                      Workspace
                    </div>
                  </div>
                  <nav className="flex-1 p-2 space-y-0.5">
                    {[
                      { name: "Overview", icon: LayoutDashboard, active: true },
                      { name: "Sessions", icon: Activity, active: false },
                      { name: "Settings", icon: Settings, active: false },
                    ].map((item) => (
                      <div
                        key={item.name}
                        className={`flex items-center gap-2.5 text-[14px] px-3 py-1.5 rounded-md ${
                          item.active
                            ? "bg-white/[0.06] text-white font-medium"
                            : "text-zinc-500"
                        }`}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.name}
                      </div>
                    ))}
                  </nav>
                  <div className="p-3 border-t border-white/[0.04]">
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-white/[0.1] flex items-center justify-center text-[11px] font-medium shrink-0">
                        J
                      </div>
                      <span className="text-[14px] text-zinc-400 truncate">@johndoe</span>
                    </div>
                  </div>
                </div>

                {/* Main content — Overview tab */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Top bar */}
                  <div className="h-12 flex items-center justify-between px-6 border-b border-white/[0.04] shrink-0">
                    <span className="text-[14px] font-medium text-zinc-300">Overview</span>
                    <span className="text-[13px] text-zinc-600 flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/[0.06]">
                      Refresh
                    </span>
                  </div>

                  <div className="flex-1 p-6 overflow-hidden">
                    {/* Listening On indicators */}
                    <div className="flex flex-wrap items-center gap-4 mb-5 pb-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Listening On</span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                          <DiscordIcon className="w-3 h-3 text-[#5865F2]" />
                          <span className="text-[12px] text-zinc-400">2 Servers</span>
                        </div>
                      </div>
                      <div className="w-px h-3 bg-white/[0.06] hidden sm:block" />
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Modifying</span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                          <Github className="w-3 h-3 text-zinc-500" />
                          <span className="text-[12px] text-zinc-400">acme/api-server</span>
                        </div>
                      </div>
                      <div className="w-px h-3 bg-white/[0.06] hidden sm:block" />
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Notifying</span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                          <TelegramIcon className="w-3 h-3 text-[#26A5E4]" />
                          <span className="text-[12px] text-zinc-400">Active</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-6 mb-6">
                      {[
                        { label: "Messages", value: "142", icon: MessageSquare },
                        { label: "Issues", value: "23", icon: AlertTriangle },
                        { label: "Pending", value: "3", icon: Clock },
                        { label: "Manual", value: "1", icon: Hand },
                        { label: "PRs Open", value: "4", icon: GitPullRequest },
                        { label: "PRs Merged", value: "16", icon: GitMerge },
                      ].map((stat) => (
                        <div key={stat.label} className="border-l-2 border-white/[0.06] pl-3">
                          <p className="text-[11px] font-medium text-zinc-600 mb-0.5">{stat.label}</p>
                          <p className="text-[19px] font-semibold tracking-tight text-white">{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Two-column: Issues and PRs */}
                    <div className="grid lg:grid-cols-2 gap-6">
                      {/* Issues */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-white/[0.06] pb-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-[13px] font-medium text-zinc-400">Issues</span>
                          <span className="text-[11px] text-zinc-700 bg-white/[0.04] px-1.5 py-0.5 rounded-sm ml-auto">3</span>
                        </div>
                        <div className="space-y-px">
                          {[
                            { summary: "Connection pool timeout under load", status: "pr_created", user: "alex", time: "12m", pr: "#247" },
                            { summary: "Auth token not refreshing on mobile", status: "pending", user: "mika", time: "1h" },
                            { summary: "Webhook payload missing user ID", status: "resolved", user: "chan", time: "3h", pr: "#244" },
                          ].map((item) => (
                            <div key={item.summary} className="p-2.5 rounded-md hover:bg-white/[0.02]">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-[13px] font-medium text-zinc-300 line-clamp-1">{item.summary}</span>
                                <span className="text-[11px] text-zinc-700 shrink-0">{item.time}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider ${
                                  item.status === "pr_created" ? "text-blue-400 border-blue-400/20 bg-blue-400/10"
                                    : item.status === "pending" ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/10"
                                    : "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                                }`}>
                                  {item.status.replace("_", " ")}
                                </span>
                                <span className="text-[11px] text-zinc-600">@{item.user}</span>
                                {item.pr && (
                                  <span className="text-[11px] text-zinc-500 ml-auto flex items-center gap-1">
                                    <GitPullRequest className="w-2.5 h-2.5" />
                                    PR {item.pr}
                                    <ExternalLink className="w-2 h-2" />
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pull Requests */}
                      <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-white/[0.06] pb-1.5">
                          <GitPullRequest className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-[13px] font-medium text-zinc-400">Pull Requests</span>
                          <span className="text-[11px] text-zinc-700 bg-white/[0.04] px-1.5 py-0.5 rounded-sm ml-auto">3</span>
                        </div>
                        <div className="space-y-px">
                          {[
                            { number: "#247", repo: "acme/api-server", summary: "Add connection timeout", status: "open" },
                            { number: "#246", repo: "acme/api-server", summary: "Fix webhook user ID mapping", status: "merged" },
                            { number: "#244", repo: "acme/api-server", summary: "Retry failed auth refresh", status: "merged" },
                          ].map((item) => (
                            <div key={item.number} className="p-2.5 rounded-md hover:bg-white/[0.02]">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-[13px] font-medium text-zinc-300 line-clamp-1 flex items-center gap-1.5">
                                  <span className="text-zinc-600">{item.number}</span>
                                  {item.repo}
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-zinc-700 shrink-0 mt-0.5" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider ${
                                  item.status === "open" ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                                    : "text-purple-400 border-purple-400/20 bg-purple-400/10"
                                }`}>
                                  {item.status}
                                </span>
                                <span className="text-[11px] text-zinc-600 truncate">{item.summary}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="px-6 pb-32 max-w-[1100px] mx-auto"
        >
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-[29px] sm:text-[37px] font-semibold tracking-[-0.02em]">
              Three steps. Zero effort.
            </h2>
            <p className="mt-3 text-zinc-500 text-[17px] max-w-md mx-auto">
              From a Discord message to a merged pull request — fully automated.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            {steps.map((step) => (
              <motion.div
                key={step.number}
                variants={fadeUp}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#08080A] p-8 md:p-10 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[13px] font-mono text-zinc-600 tabular-nums">
                    {step.number}
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <step.icon className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>
                <h3 className="text-[18px] font-semibold mb-2 tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="text-[15px] text-zinc-500 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 pb-32 max-w-[1100px] mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-[29px] sm:text-[37px] font-semibold tracking-[-0.02em]">
              Everything you need
            </h2>
            <p className="mt-3 text-zinc-500 text-[17px] max-w-md mx-auto">
              Built for teams that ship fast and care about their community.
            </p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="group p-6 rounded-xl border border-white/[0.06] bg-[#08080A] hover:border-white/[0.1] hover:bg-white/[0.02] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:bg-white/[0.06] transition-colors duration-300">
                  <feature.icon className="w-[18px] h-[18px] text-zinc-500 group-hover:text-zinc-300 transition-colors duration-300" />
                </div>
                <h3 className="text-[16px] font-semibold mb-2 tracking-[-0.01em]">
                  {feature.title}
                </h3>
                <p className="text-[14px] text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Bottom CTA */}
        <motion.section
          className="px-6 pb-32"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-[600px] mx-auto text-center">
            <h2 className="text-[29px] sm:text-[37px] font-semibold tracking-[-0.02em] mb-4">
              Start fixing bugs
              <br />
              before your users notice
            </h2>
            <p className="text-zinc-500 text-[17px] mb-8 max-w-sm mx-auto">
              Connect your GitHub, Discord and Telegram. Reflex handles the rest.
            </p>
            <button
              onClick={onSignIn}
              className="group inline-flex items-center gap-2.5 bg-white text-black px-7 py-3 rounded-full text-[15px] font-semibold hover:bg-zinc-100 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Get started free
              <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
            </button>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] text-zinc-600">
            <img src="/logo.png" alt="Reflex" className="w-3 h-3" />
            <span>Reflex</span>
          </div>
          <span className="text-[13px] text-zinc-700">
            Built for the Mistral AI Hackathon
          </span>
        </div>
      </footer>
    </div>
  );
}
