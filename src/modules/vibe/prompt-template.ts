export function buildCreatePrPrompt(summary: string, originalMessage: string): string {
  return [
    'Fix the following bug:',
    '',
    summary,
    '',
    'User report:',
    originalMessage,
    '',
    'Constraints:',
    '- minimal safe fix',
    '- do not modify .env, secrets, or config credentials',
    '- do not modify CI/CD or deployment workflows',
    '- keep changes small and focused',
    '- add a test if trivial to do so',
    '',
    'After fixing, create a PR with a clear title and description',
    'that references the original user report.',
  ].join('\n');
}
