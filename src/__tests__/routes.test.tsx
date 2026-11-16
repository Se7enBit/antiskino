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
    ['/account', 'Sign in with an email code will appear here.'],
    ['/partner', 'Today, bookings, availability and rates for your campings will appear here.'],
    ['/admin', 'Partners, campings, bookings and reviews will appear here.'],
  ])('%s renders its placeholder', async (url, text) => {
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
