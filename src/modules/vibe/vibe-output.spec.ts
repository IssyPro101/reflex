import { extractPrNumber, parseVibeOutput } from './vibe-output';

describe('parseVibeOutput', () => {
  it('extracts PR URL from JSON output', () => {
    const output = JSON.stringify({
      result: {
        pr_url: 'https://github.com/acme/api/pull/142',
      },
    });

    const parsed = parseVibeOutput(output);

    expect(parsed.prUrl).toBe('https://github.com/acme/api/pull/142');
  });

  it('extracts PR URL from non-JSON output', () => {
    const parsed = parseVibeOutput(
      'All done. PR: https://github.com/acme/api/pull/9\n',
    );

    expect(parsed.prUrl).toBe('https://github.com/acme/api/pull/9');
  });

  it('extracts PR number', () => {
    expect(extractPrNumber('https://github.com/acme/api/pull/77')).toBe(77);
    expect(extractPrNumber('https://github.com/acme/api/issues/77')).toBeNull();
  });
});
