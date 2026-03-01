"use client";

import { useState } from "react";
import {
  CheckCircle2,
  GitPullRequest,
  Github,
  Plus,
  Trash2,
} from "lucide-react";
import { DiscordIcon, TelegramIcon } from "@/components/icons/BrandIcons";
import type { AuthMeResponse } from "@/lib/types";
import { api } from "@/lib/api";

type Props = {
  accessToken: string;
  authState: AuthMeResponse;
  onRefresh: () => void;
  onFeedback: (message: string) => void;
};

export function DashboardSettings({
  accessToken,
  authState,
  onRefresh,
  onFeedback,
}: Props) {
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

  async function saveTarget() {
    const repoUrl = targetRepoUrl.trim();
    const baseBranch = targetBranch.trim();
    if (!repoUrl || !baseBranch) return;

    setSaving(true);
    try {
      await api.saveTarget(accessToken, repoUrl, baseBranch);
      onFeedback("Target saved");
      onRefresh();
    } catch {
      onFeedback("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function linkDiscord() {
    const guildId = discordGuildInput.trim();
    if (!guildId) return;

    setSaving(true);
    try {
      await api.linkDiscord(accessToken, guildId);
      setDiscordGuilds((prev) => [...prev, guildId]);
      setDiscordGuildInput("");
      onFeedback("Discord linked");
      onRefresh();
    } catch {
      onFeedback("Failed to link");
    } finally {
      setSaving(false);
    }
  }

  async function unlinkDiscord(guildId: string) {
    setSaving(true);
    try {
      await api.unlinkDiscord(accessToken, guildId);
      setDiscordGuilds((prev) => prev.filter((id) => id !== guildId));
      onFeedback("Discord unlinked");
      onRefresh();
    } catch {
      onFeedback("Failed to unlink");
    } finally {
      setSaving(false);
    }
  }

  async function saveTelegram() {
    const chatId = telegramChatId.trim();
    if (!chatId) return;

    setSaving(true);
    try {
      await api.linkTelegram(accessToken, chatId);
      onFeedback("Telegram linked");
      onRefresh();
    } catch {
      onFeedback("Failed to link");
    } finally {
      setSaving(false);
    }
  }

  async function removeTelegram() {
    setSaving(true);
    try {
      await api.unlinkTelegram(accessToken);
      setTelegramChatId("");
      onFeedback("Telegram unlinked");
      onRefresh();
    } catch {
      onFeedback("Failed to unlink");
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGithub() {
    try {
      await api.disconnectGitHub(accessToken);
      onRefresh();
    } catch {
      /* silent */
    }
  }

  const inputClass =
    "w-full px-3 py-2 rounded-md bg-[#0A0A0A] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.2] transition-colors text-[14px]";

  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
          <Github className="w-4 h-4 text-zinc-400" />
          GitHub Integration
        </h3>
        {authState.github.connected ? (
          <div className="flex items-center justify-between text-[14px] p-3 rounded-lg border border-white/[0.08] bg-[#0A0A0A]">
            <span className="text-zinc-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              Connected to @{authState.github.login}
            </span>
            <button
              onClick={disconnectGithub}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-zinc-500">Not connected.</p>
        )}
      </section>

      <section>
        <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
          <GitPullRequest className="w-4 h-4 text-zinc-400" />
          Target Repository
        </h3>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-zinc-500 mb-1.5">
                Repository URL
              </label>
              <input
                value={targetRepoUrl}
                onChange={(e) => setTargetRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo.git"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-500 mb-1.5">
                Base Branch
              </label>
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
            className="bg-white text-black px-4 py-1.5 rounded-md text-[14px] font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            Save changes
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
          <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
          Discord Servers
        </h3>
        <div className="space-y-3">
          {discordGuilds.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between text-[14px] p-2.5 rounded-md border border-white/[0.08] bg-[#0A0A0A]"
            >
              <span className="font-mono text-zinc-400">{id}</span>
              <button
                onClick={() => unlinkDiscord(id)}
                className="text-zinc-600 hover:text-red-400 transition-colors"
              >
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
              className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-medium mb-4 flex items-center gap-2 border-b border-white/[0.08] pb-2">
          <TelegramIcon className="w-4 h-4 text-[#26A5E4]" />
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
            className="bg-white text-black px-4 py-2 rounded-md text-[14px] font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors shrink-0"
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
  );
}
