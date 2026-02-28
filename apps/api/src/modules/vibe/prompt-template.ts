export function buildCreatePrPrompt(
  complaintId: string,
  summary: string,
  originalMessage: string,
): string {
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
    'After fixing, stop when local code changes are complete.',
    'Do not create a pull request, do not push to remote, and do not run PR helper scripts.',
    'The backend workflow will commit, push, and open the PR automatically.',
    '',
    'Complaint ID for backend metadata:',
    complaintId,
  ].join('\n');
}
