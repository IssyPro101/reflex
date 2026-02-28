import { z } from 'zod';

export interface GithubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

export interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
}

export interface GithubRepoResponse {
  id: number;
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
}

export interface SupabaseUserResponse {
  id: string;
  email?: string | null;
}

export interface GithubTargetResponse {
  repoUrl: string;
  baseBranch: string;
}

export const githubTargetSchema = z.object({
  repoUrl: z.string().min(1),
  baseBranch: z.string().min(1).default('main'),
});

export type GithubTargetInput = z.infer<typeof githubTargetSchema>;

export const discordLinkSchema = z.object({
  discordUserId: z.string().min(1),
});

export type DiscordLinkInput = z.infer<typeof discordLinkSchema>;
