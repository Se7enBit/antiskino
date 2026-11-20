import { act, fireEvent, screen } from '@testing-library/react-native';

import { useMessagePreviews } from '@/api/messagePreviews';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { MessagePreviews } from '../MessagePreviews';

jest.mock('@/api/messagePreviews', () => ({ useMessagePreviews: jest.fn() }));

const email = (subject: string) => ({
  subject,
  text: `${subject} text`,
  html: `<p>${subject}</p>`,
});

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
  jest.mocked(useMessagePreviews).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      previews: [
        {
          kind: 'booking_confirmed',
          audience: 'guest',
          locale: 'el',
          email: email('Η κράτηση επιβεβαιώθηκε'),
          push: { title: 'Επιβεβαίωση', body: 'Camping Thalassa' },
        },
        {
          kind: 'booking_confirmed',
          audience: 'guest',
          locale: 'en',
          email: email('Booking confirmed'),
          push: null,
        },
        {
          kind: 'request_expiring',
          audience: 'partner',
          locale: 'el',
          email: null,
          push: { title: 'Αίτημα λήγει', body: 'Απάντησε έως 15:30' },
        },
      ],
    },
  } as unknown as ReturnType<typeof useMessagePreviews>);
});

describe('MessagePreviews', () => {
  it('shows the guest messages in Greek first, with push and email', async () => {
    await renderWithLanguage(<MessagePreviews />);
    expect(screen.getByText('Booking confirmed')).toBeOnTheScreen(); // the kind's name
    expect(screen.getByText('Η κράτηση επιβεβαιώθηκε')).toBeOnTheScreen();
    expect(screen.getByText('Η κράτηση επιβεβαιώθηκε text')).toBeOnTheScreen();
    expect(screen.getByText('Επιβεβαίωση')).toBeOnTheScreen();
    expect(screen.queryByText('Αίτημα λήγει')).toBeNull();
  });

  it('switches language and audience', async () => {
    await renderWithLanguage(<MessagePreviews />);
    await act(() => fireEvent.press(screen.getByTestId('messages-locale-en')));
    expect(screen.getByText('Booking confirmed text')).toBeOnTheScreen();
    await act(() => fireEvent.press(screen.getByTestId('messages-locale-el')));
    await act(() => fireEvent.press(screen.getByTestId('messages-audience-partner')));
    expect(screen.getByText('Request about to expire')).toBeOnTheScreen();
    expect(screen.getByText('Απάντησε έως 15:30')).toBeOnTheScreen();
  });
});
