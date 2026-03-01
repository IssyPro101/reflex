import { render, screen } from '@testing-library/react';
import { DashboardSettings } from './Settings';
import type { AuthMeResponse } from '@/lib/types';

describe('DashboardSettings', () => {
  const mockAuthState: AuthMeResponse = {
    app: { email: 'test@example.com' },
    github: {
      connected: true,
      login: 'testuser',
      target: { repoUrl: 'https://github.com/test/repo', baseBranch: 'main' }
    },
    discord: { guildIds: [] },
    telegram: { chatId: '' }
  };

  it('should render Add button with blue color', () => {
    render(
      <DashboardSettings
        accessToken="test-token"
        authState={mockAuthState}
        onRefresh={() => {}}
        onFeedback={() => {}}
      />
    );

    const addButton = screen.getByLabelText('Add Discord server');
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveClass('bg-blue-600');
  });
});