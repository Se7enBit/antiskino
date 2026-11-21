import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { LanguageProvider, i18n } from '@/i18n';

import { PrivacyScreen } from '../PrivacyScreen';
import { TermsScreen } from '../TermsScreen';

async function renderPages(initialUrl: string) {
  await renderRouter(
    {
      terms: () => (
        <LanguageProvider>
          <TermsScreen />
        </LanguageProvider>
      ),
      privacy: () => (
        <LanguageProvider>
          <PrivacyScreen />
        </LanguageProvider>
      ),
    },
    { initialUrl },
  );
}

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('legal pages', () => {
  it('fill in the business details and number the sections', async () => {
    await renderPages('/terms');
    expect(
      screen.getByText(/^Antiskino is run by \[Business name\], \[Address\], Tax ID \[Tax ID\]\./),
    ).toBeOnTheScreen();
    expect(screen.getByText('10. Changes')).toBeOnTheScreen();
    expect(screen.getByText('Last updated 21/11/2026')).toBeOnTheScreen();
  });

  it('show list items as separate lines', async () => {
    await renderPages('/privacy');
    expect(screen.getByText(/^• The camping you book, for your stay\.$/)).toBeOnTheScreen();
  });

  it('link to each other', async () => {
    await renderPages('/privacy');
    await act(() => fireEvent.press(screen.getByText('Terms of use')));
    expect(screen).toHavePathname('/terms');
  });

  it('are in Greek too', async () => {
    await act(() => i18n.changeLanguage('el'));
    await renderPages('/terms');
    expect(
      screen.getByText(/^Το Antiskino το λειτουργεί η επιχείρηση \[Business name\]/),
    ).toBeOnTheScreen();
  });
});
