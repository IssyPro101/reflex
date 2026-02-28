import type { AuthMeResponse, ObservabilityResponse, Repo } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  getMe: (token: string) => request<AuthMeResponse>("/auth/me", token),

  getGitHubUrl: (token: string) =>
    request<{ url: string }>("/auth/github/url?next=/", token),

  disconnectGitHub: (token: string) =>
    request<void>("/auth/github/disconnect", token, { method: "POST" }),

  getRepos: (token: string) =>
    request<{ repos: Repo[] }>("/auth/github/repos", token),

  saveTarget: (token: string, repoUrl: string, baseBranch: string) =>
    request<{ target: { repoUrl: string; baseBranch: string } }>(
      "/auth/github/target",
      token,
      { method: "PUT", body: JSON.stringify({ repoUrl, baseBranch }) },
    ),

  getOverview: (token: string, limit = 15) =>
    request<ObservabilityResponse>(
      `/observability/overview?limit=${limit}`,
      token,
    ),

  linkDiscord: (token: string, guildId: string) =>
    request<void>("/auth/discord/guild-link", token, {
      method: "POST",
      body: JSON.stringify({ guildId }),
    }),

  unlinkDiscord: (token: string, guildId: string) =>
    request<void>("/auth/discord/guild-link", token, {
      method: "DELETE",
      body: JSON.stringify({ guildId }),
    }),

  linkTelegram: (token: string, chatId: string) =>
    request<void>("/auth/telegram/link", token, {
      method: "POST",
      body: JSON.stringify({ telegramChatId: chatId }),
    }),

  unlinkTelegram: (token: string) =>
    request<void>("/auth/telegram/link", token, { method: "DELETE" }),
};
