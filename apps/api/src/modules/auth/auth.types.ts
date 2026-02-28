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
