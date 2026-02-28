"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  GitPullRequest,
  BarChart3,
  MessageSquare,
  Bot,
  Terminal,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const features = [
  {
    icon: MessageSquare,
    title: "Community Listening",
    description: "Connect Discord and monitor community feedback automatically.",
  },
  {
    icon: Bot,
    title: "AI Triage",
    description: "Mistral AI instantly classifies issues, bugs, and features.",
  },
  {
    icon: GitPullRequest,
    title: "Automated PRs",
    description: "Generates code fixes and opens pull requests autonomously.",
  },
  {
    icon: BarChart3,
    title: "Observability",
    description: "Track system health, PR merge rates, and community intent.",
  },
];

export function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Terminal className="w-4 h-4 text-white" />
            <span className="font-semibold tracking-tight text-[15px]">CFCA</span>
          </div>

          <div className="hidden md:flex items-center justify-center gap-6 text-[13px] text-zinc-400 font-medium">
            <a href="#product" className="hover:text-white transition-colors">
              Product
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#workflow" className="hover:text-white transition-colors">
              Workflow
            </a>
          </div>

          <div className="flex items-center justify-end gap-3 text-[13px] font-medium flex-1">
            <button
              onClick={onSignIn}
              className="hidden sm:block text-zinc-400 hover:text-white transition-colors"
            >
              Log in
            </button>
            <button
              onClick={onSignIn}
              className="bg-white text-black px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              Sign up
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 px-6 max-w-[1200px] mx-auto hero-glow">
        {/* Hero Section */}
        <motion.section
          className="max-w-3xl mx-auto text-center pt-8 md:pt-12 pb-16 flex flex-col items-center"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.h1
            className="text-[44px] sm:text-[64px] md:text-[80px] leading-[1.05] tracking-[-0.02em] font-medium"
            variants={fadeUp}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            CFCA is a purpose-built tool for automating bug fixes
          </motion.h1>

          <motion.p
            className="mt-6 text-[19px] sm:text-[21px] text-zinc-400 leading-relaxed max-w-2xl font-normal"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Meet the system for modern community-driven development.
            <br className="hidden sm:block" />
            Streamline bug reports, triage, and automated code generation.
          </motion.p>

          <motion.div
            className="mt-10"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              onClick={onSignIn}
              className="group inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-[15px] font-medium hover:bg-zinc-200 transition-colors"
            >
              Start building
              <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          </motion.div>
        </motion.section>

        {/* Mock App Image / Interface Visualization */}
        <motion.section
          className="relative w-full rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden shadow-2xl mt-12 mb-32"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Mac window controls */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04] bg-[#0A0A0A]">
            <div className="w-3 h-3 rounded-full bg-zinc-800" />
            <div className="w-3 h-3 rounded-full bg-zinc-800" />
            <div className="w-3 h-3 rounded-full bg-zinc-800" />
          </div>
          {/* Mock content representing the app */}
          <div className="flex flex-col md:flex-row min-h-[400px]">
            <div className="w-full md:w-64 border-r border-white/[0.04] p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-6">
                <Terminal className="w-4 h-4" />
                Workspace
              </div>
              <div className="space-y-1">
                {["Overview", "Complaints", "Pull Requests", "Settings"].map((item, i) => (
                  <div
                    key={item}
                    className={`text-[13px] px-2 py-1.5 rounded-md ${
                      i === 0 ? "bg-white/[0.08] text-white" : "text-zinc-500"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 p-6 lg:p-10 bg-[#000000]">
              <div className="max-w-2xl">
                <h3 className="text-xl font-medium mb-1">Refactor connection handler</h3>
                <p className="text-[13px] text-zinc-500 mb-8">Generated by Mistral AI from Discord feedback</p>
                
                <div className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-4 font-mono text-[13px] text-zinc-400 leading-relaxed overflow-x-hidden">
                  <div className="text-zinc-500 mb-2">// The handler is throwing undefined errors under heavy load</div>
                  <div className="mb-1"><span className="text-blue-400">export async function</span> <span className="text-yellow-200">handleConnection</span>(req, res) {"{"}</div>
                  <div className="ml-4"><span className="text-blue-400">try</span> {"{"}</div>
                  <div className="ml-8">const client = await pool.connect();</div>
                  <div className="ml-8">...</div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Features Grid */}
        <motion.section
          id="features"
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pt-12 border-t border-white/[0.08]"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={fadeUp} className="group cursor-default">
              <div className="w-10 h-10 rounded-lg border border-white/[0.08] bg-[#0A0A0A] flex items-center justify-center mb-5 group-hover:bg-white/[0.04] transition-colors">
                <feature.icon className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-[15px] font-medium mb-2">{feature.title}</h3>
              <p className="text-[14px] text-zinc-500 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-8 text-center text-[13px] text-zinc-600">
        <div className="flex items-center justify-center gap-2">
          <Terminal className="w-3 h-3" />
          <span>CFCA — Built for the Mistral AI Hackathon</span>
        </div>
      </footer>
    </div>
  );
}
