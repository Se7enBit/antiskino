import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { i18n } from '@/i18n';

// Renders the real app/ directory, so a missing or broken route fails here.
describe('routes', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('en'));
  });

  it.each([
    ['/', 'Find a camping pitch'],
    ['/favorites', 'Campings you save with the heart will appear here.'],
    ['/bookings', 'Sign in to see your bookings here.'],
    // No Supabase settings in Jest: sign-in shows a notice and the areas ask to sign in.
    ['/account', "Sign-in isn't available in this build yet."],
    ['/partner', 'Sign in to continue'],
    ['/admin', 'Sign in to continue'],
    ['/admin/new-partner', 'Sign in to continue'],
    ['/admin/partner', 'Sign in to continue'],
    ['/invite', "Sign-in isn't available in this build yet."],
  ])('%s renders', async (url, text) => {
    await renderRouter('./app', { initialUrl: url });
    expect(screen).toHavePathname(url);
    expect(await screen.findByText(text)).toBeOnTheScreen();
  });

  it('shows the four customer tabs', async () => {
    await renderRouter('./app', { initialUrl: '/' });
    for (const tab of ['Explore', 'Favorites', 'Bookings', 'Account']) {
      expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
    }
  });

  it('switches the UI language from the Account tab', async () => {
    await renderRouter('./app', { initialUrl: '/account' });
    await act(() => fireEvent.press(screen.getByTestId('language-el')));
    expect(i18n.language).toBe('el');
    expect(await screen.findByText('Γλώσσα')).toBeOnTheScreen();
  });
});
