export interface FileSafetyResult {
  forbidden: string[];
  warnings: string[];
}

const forbiddenMatchers: Array<(path: string) => boolean> = [
  (path) => /^\.env(\..+)?$/i.test(path),
  (path) => /secret/i.test(path),
  (path) => /credential/i.test(path),
  (path) => path.startsWith('.github/workflows/'),
  (path) => /^docker-compose.*\.yml$/i.test(path.split('/').pop() ?? ''),
];

const warningMatchers: Array<(path: string) => boolean> = [
  (path) => /auth/i.test(path),
  (path) => /migrations?/i.test(path),
  (path) => /package(-lock)?\.json$/.test(path),
  (path) => /pnpm-lock\.yaml$/.test(path),
  (path) => /yarn\.lock$/.test(path),
];

export function evaluateChangedFiles(paths: string[]): FileSafetyResult {
  const normalized = paths
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/^\.\//, ''));

  const forbidden = normalized.filter((path) =>
    forbiddenMatchers.some((matcher) => matcher(path)),
  );
  const warnings = normalized.filter((path) =>
    warningMatchers.some((matcher) => matcher(path)),
  );

  return {
    forbidden: Array.from(new Set(forbidden)),
    warnings: Array.from(new Set(warnings)),
  };
}
