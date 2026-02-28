export interface ParsedVibeOutput {
  prUrl: string | null;
  branch: string | null;
  rawJson: unknown | null;
}

const PR_URL_REGEX = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/[0-9]+/;
const BRANCH_REGEX = /fix\/[a-z0-9-]+/i;

function findStringMatch(value: unknown, regex: RegExp): string | null {
  if (typeof value === 'string') {
    const match = value.match(regex);
    return match ? match[0] : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findStringMatch(item, regex);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const result = findStringMatch(nested, regex);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

export function parseVibeOutput(rawOutput: string): ParsedVibeOutput {
  let rawJson: unknown | null = null;

  try {
    rawJson = JSON.parse(rawOutput);
  } catch {
    // ignore; fallback to regex over raw text
  }

  const textSource = rawJson ?? rawOutput;
  const prUrl = findStringMatch(textSource, PR_URL_REGEX);
  const branch = findStringMatch(textSource, BRANCH_REGEX);

  return {
    prUrl,
    branch,
    rawJson,
  };
}

export function extractPrNumber(prUrl: string): number | null {
  const match = prUrl.match(/\/pull\/([0-9]+)/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}
