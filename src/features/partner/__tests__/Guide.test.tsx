import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { LanguageProvider, i18n } from '@/i18n';

import { GuideScreen } from '../GuideScreen';
import { HeaderLinks } from '../HeaderLinks';

async function renderGuide(initialUrl: string) {
  await renderRouter(
    {
      'partner/index': () => (
        <LanguageProvider>
          <HeaderLinks />
        </LanguageProvider>
      ),
      'partner/guide': () => (
        <LanguageProvider>
          <GuideScreen />
        </LanguageProvider>
      ),
    },
    { initialUrl },
  );
}

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('partner guide', () => {
  it('opens from the "?" in the header', async () => {
    await renderGuide('/partner');
    await fireEvent.press(screen.getByLabelText('Guide for campings'));
    expect(
      await screen.findByText('Short instructions for each screen. Tap a topic to open it.'),
    ).toBeOnTheScreen();
  });

  it('starts with every topic closed and opens one at a time', async () => {
    await renderGuide('/partner/guide');
    expect(await screen.findByText('Today at reception')).toBeOnTheScreen();
    expect(screen.queryByText('1. When the guest arrives, tap Check in.')).toBeNull();

    await fireEvent.press(screen.getByTestId('guide-reception'));
    expect(screen.getByText('1. When the guest arrives, tap Check in.')).toBeOnTheScreen();
    expect(screen.getByTestId('guide-reception')).toBeExpanded();

    await fireEvent.press(screen.getByTestId('guide-bookings'));
    expect(screen.queryByText('1. When the guest arrives, tap Check in.')).toBeNull();
    expect(screen.getByText('The nights are held from the moment of booking.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('guide-bookings'));
    expect(screen.queryByText('The nights are held from the moment of booking.')).toBeNull();
  });

  it('fills in the contact email and speaks Greek', async () => {
    await act(() => i18n.changeLanguage('el'));
    await renderGuide('/partner/guide');
    await fireEvent.press(await screen.findByTestId('guide-payment'));
    expect(screen.getByText(/κωδικό της κράτησης: \[Contact email\]$/)).toBeOnTheScreen();
  });
});
