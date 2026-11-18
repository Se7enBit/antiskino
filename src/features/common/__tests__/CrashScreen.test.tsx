import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { CrashScreen } from '../CrashScreen';
import { ErrorState } from '../ErrorState';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('error screens', () => {
  it('offers a retry and a way back after a crash', async () => {
    const retry = jest.fn();
    await renderWithLanguage(<CrashScreen onRetry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('crash-retry'));
    expect(retry).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Go to the start'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('offers a retry after a failed load', async () => {
    const retry = jest.fn();
    await renderWithLanguage(<ErrorState onRetry={retry} />);
    expect(
      screen.getByText('Something went wrong. Check your connection and try again.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('retry'));
    expect(retry).toHaveBeenCalled();
  });
});
