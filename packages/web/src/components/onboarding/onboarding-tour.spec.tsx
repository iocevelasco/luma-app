import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingTour } from './onboarding-tour';

const currentUser = vi.hoisted(() => ({ value: { user: { id: 'user-1', terms_pending: true } } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/admin' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/auth/use-auth-queries', () => ({
  useCurrentUser: () => ({ data: currentUser.value }),
}));
vi.mock('@/hooks/projects/use-current-project-id', () => ({
  useCurrentProjectId: () => undefined,
}));
vi.mock('@/hooks/projects/use-project-queries', () => ({
  useProject: () => ({ data: undefined }),
  useProjects: () => ({ data: { firstProjectPrompt: false } }),
}));
vi.mock('@/lib/onboarding-seen', () => ({
  hasSeenTour: () => false,
  markTourSeen: vi.fn(),
}));
vi.mock('@/components/onboarding/spotlight-tour', () => ({
  SpotlightTour: () => <div data-testid="onboarding-tour" />,
}));

describe('OnboardingTour', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { webdriver: false });
    currentUser.value = { user: { id: 'user-1', terms_pending: true } };
  });

  it('no se abre encima de los Términos pendientes', () => {
    render(<OnboardingTour />);
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
  });

  it('arranca solo cuando se aceptan los Términos, sin recargar', () => {
    const { rerender } = render(<OnboardingTour />);
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();

    currentUser.value = { user: { id: 'user-1', terms_pending: false } };
    rerender(<OnboardingTour />);

    expect(screen.getByTestId('onboarding-tour')).toBeTruthy();
  });
});
