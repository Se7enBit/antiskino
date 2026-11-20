import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/api/auth';
import {
  useBookingContext,
  useCreateBooking,
  useMyDetails,
  useQuote,
  type BookingContext,
  type QuoteResponse,
} from '@/api/booking';
import { EMPTY_GUEST } from '@/domain/booking';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { useBookingDraft } from '../bookingDraft';
import { BookingScreen } from '../BookingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(),
  Link: jest.requireActual<typeof import('react-native')>('react-native').Text,
}));
jest.mock('@/api/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/booking', () => ({
  useBookingContext: jest.fn(),
  useQuote: jest.fn(),
  useCreateBooking: jest.fn(),
  useMyDetails: jest.fn(),
}));

const PITCH = '0b3f6a3c-5a8e-4c79-9f43-2b7b3a2c1d10';
const PARAMS = {
  pitchType: PITCH,
  arrival: '2027-07-10',
  departure: '2027-07-12',
  adults: '2',
  children: '6',
  equipment: 'tent',
};

const context = (patch: Partial<BookingContext['camping']> = {}): BookingContext => ({
  pitchType: { id: PITCH, name: { en: 'Tent pitch' } },
  camping: {
    id: 'c1',
    slug: 'thalassa',
    name: 'Camping Thalassa',
    status: 'live',
    confirmationMode: 'instant',
    requestExpiryHours: 24,
    paymentMode: 'on_site',
    cancellationPolicy: 'moderate',
    ...patch,
  },
  extras: [
    { id: 'car', name: { en: 'Car' }, unit: 'per_night', max_qty: 2, active: true, sort: 0 },
    { id: 'wood', name: { en: 'Firewood' }, unit: 'per_stay', max_qty: 3, active: true, sort: 1 },
  ],
  guestCategories: [
    { id: 'adult', name: { en: 'Adult' }, min_age: 12, max_age: null, sort: 0 },
    { id: 'child', name: { en: 'Child' }, min_age: 4, max_age: 11, sort: 1 },
  ],
  fees: [{ id: 'tax', name: { en: 'Tourist tax' }, unit: 'per_person_night' }],
});

const QUOTE: QuoteResponse = {
  available: true,
  offeredExtras: ['car'],
  quote: {
    nights: [],
    lines: [
      { kind: 'pitch', id: PITCH, quantity: 1, per: 'night', totalCents: 3000 },
      { kind: 'guest', id: 'adult', quantity: 2, per: 'night', totalCents: 3200 },
      { kind: 'guest', id: 'child', quantity: 1, per: 'night', totalCents: 800 },
      { kind: 'fee', id: 'tax', quantity: 3, per: 'night', totalCents: 300 },
    ],
    totalCents: 7300,
  },
};

type Options = {
  camping?: Partial<BookingContext['camping']>;
  quote?: QuoteResponse;
  result?: unknown;
  signedIn?: boolean;
};

async function setup({ camping, quote = QUOTE, result, signedIn = false }: Options = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue(PARAMS);
  jest.mocked(useAuth).mockReturnValue({
    status: signedIn ? 'signedIn' : 'signedOut',
    session: signedIn ? ({ user: { id: 'u1', email: 'maria@example.com' } } as never) : null,
  });
  jest.mocked(useMyDetails).mockReturnValue({
    data: signedIn
      ? { full_name: 'Maria Papadopoulou', phone: '+30 690 123 4567', country: 'CY', locale: 'en' }
      : undefined,
  } as unknown as ReturnType<typeof useMyDetails>);
  jest.mocked(useBookingContext).mockReturnValue({
    isPending: false,
    isError: false,
    data: context(camping),
  } as unknown as ReturnType<typeof useBookingContext>);
  jest
    .mocked(useQuote)
    .mockReturnValue({ data: quote, isError: false } as unknown as ReturnType<typeof useQuote>);
  const create = fakeMutation({
    data: result ?? {
      booked: true,
      ref: 'ANT-7K3P9Q',
      status: 'confirmed',
      requestExpiresAt: null,
      manageToken: 'tok',
      totalCents: 7300,
    },
  });
  jest
    .mocked(useCreateBooking)
    .mockReturnValue(create as unknown as ReturnType<typeof useCreateBooking>);
  await renderWithLanguage(<BookingScreen />);
  return { create };
}

async function fillDetails() {
  await fireEvent.changeText(screen.getByTestId('guest-name'), 'Maria Papadopoulou');
  await fireEvent.changeText(screen.getByTestId('guest-email'), 'maria@example.com');
  await fireEvent.changeText(screen.getByTestId('guest-phone'), '+30 690 123 4567');
}

beforeEach(async () => {
  jest.clearAllMocks();
  useBookingDraft.setState({ key: null, extras: {}, guest: EMPTY_GUEST, accepted: false });
  await i18n.changeLanguage('en');
});

describe('Booking flow', () => {
  it('shows the party by the camping categories, the extras on offer and the price', async () => {
    await setup();
    expect(screen.getByText('Step 1 of 3: Stay')).toBeTruthy();
    expect(screen.getByText('Adult: 2')).toBeTruthy();
    expect(screen.getByText('Child: 1')).toBeTruthy();
    // only the car is offered for these dates
    expect(screen.getByText('Car · Per night')).toBeTruthy();
    expect(screen.queryByText(/Firewood/)).toBeNull();
    expect(screen.getByText('Tent pitch · nights: 2')).toBeTruthy();
    expect(screen.getByText('Adult × 2 · nights: 2')).toBeTruthy();
    expect(screen.getByText('Tourist tax × 3 · nights: 2')).toBeTruthy();
    expect(screen.getByTestId('booking-total').props.children).toMatch(/73[.,]00/);

    await fireEvent.press(screen.getByTestId('extra-car-plus'));
    expect(jest.mocked(useQuote).mock.lastCall?.[0]).toEqual({
      arrival: '2027-07-10',
      departure: '2027-07-12',
      adults: 2,
      childAges: [6],
      equipment: 'tent',
      pitchTypeId: PITCH,
      extras: { car: 1 },
    });
  });

  it('checks the details, then books with the terms accepted and no price sent', async () => {
    const { create } = await setup();
    await fireEvent.press(screen.getByTestId('booking-continue'));
    await fireEvent.press(screen.getByTestId('booking-continue'));
    expect(screen.getByText('Enter your full name.')).toBeTruthy();
    expect(
      screen.getByText('Enter the number with the country code, e.g. +30 690 123 4567.'),
    ).toBeTruthy();

    await fillDetails();
    await fireEvent.press(screen.getByTestId('booking-continue'));
    expect(screen.getByText('Step 3 of 3: Review')).toBeTruthy();
    expect(
      screen.getByText(/You pay €73\.00 at reception|You pay 73,00 € at reception/),
    ).toBeTruthy();
    expect(screen.getByText(/Moderate cancellation/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('booking-submit'));
    expect(screen.getByText('Please accept the terms to continue.')).toBeTruthy();
    expect(create.mutate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('booking-terms'));
    await fireEvent.press(screen.getByTestId('booking-submit'));
    expect(create.mutate).toHaveBeenCalledWith(
      {
        arrival: '2027-07-10',
        departure: '2027-07-12',
        adults: 2,
        childAges: [6],
        equipment: 'tent',
        pitchTypeId: PITCH,
        extras: {},
        guest: {
          name: 'Maria Papadopoulou',
          email: 'maria@example.com',
          phone: '+30 690 123 4567',
          country: 'GR',
          locale: 'en',
          vehiclePlate: undefined,
          arrivalEta: undefined,
          note: undefined,
        },
        acceptTerms: true,
      },
      expect.anything(),
    );
    expect(screen.getByText('Booking confirmed')).toBeTruthy();
    expect(screen.getByText('Reference: ANT-7K3P9Q')).toBeTruthy();
    expect(
      screen.getByText('Keep this link: it lets you view or cancel your booking.'),
    ).toBeTruthy();
  });

  it('goes back to the first step when the pitch was just taken', async () => {
    await setup({ result: { booked: false, reason: 'unavailable' } });
    await fireEvent.press(screen.getByTestId('booking-continue'));
    await fillDetails();
    await fireEvent.press(screen.getByTestId('booking-continue'));
    await fireEvent.press(screen.getByTestId('booking-terms'));
    await fireEvent.press(screen.getByTestId('booking-submit'));
    expect(
      screen.getByText('Sorry, this pitch was just taken. Pick another pitch type or other dates.'),
    ).toBeTruthy();
    expect(screen.getByText('Step 1 of 3: Stay')).toBeTruthy();
  });

  it('explains when the email already holds too many bookings', async () => {
    await setup({ result: { booked: false, reason: 'too_many' } });
    await fireEvent.press(screen.getByTestId('booking-continue'));
    await fillDetails();
    await fireEvent.press(screen.getByTestId('booking-continue'));
    await fireEvent.press(screen.getByTestId('booking-terms'));
    await fireEvent.press(screen.getByTestId('booking-submit'));
    expect(screen.getByText(/already has several bookings at this camping/)).toBeTruthy();
    // Still on the last step, with nothing lost.
    expect(screen.getByText('Step 3 of 3: Review')).toBeTruthy();
  });

  it('sends a request to request-mode campings', async () => {
    await setup({
      camping: { confirmationMode: 'request', requestExpiryHours: 12 },
      result: {
        booked: true,
        ref: 'ANT-AAAAAA',
        status: 'requested',
        requestExpiresAt: '2027-07-01T12:00:00Z',
        manageToken: 't',
        totalCents: 7300,
      },
    });
    await fireEvent.press(screen.getByTestId('booking-continue'));
    await fillDetails();
    await fireEvent.press(screen.getByTestId('booking-continue'));
    expect(screen.getByText(/answers your request within 12 hours/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('booking-terms'));
    await fireEvent.press(screen.getByText('Send request'));
    expect(screen.getByText('Request sent')).toBeTruthy();
    expect(
      screen.getByText('Camping Thalassa answers within 12 hours. Nothing is booked until then.'),
    ).toBeTruthy();
  });

  it('prefills a signed-in guest', async () => {
    await setup({ signedIn: true });
    await fireEvent.press(screen.getByTestId('booking-continue'));
    expect(screen.getByTestId('guest-name').props.value).toBe('Maria Papadopoulou');
    expect(screen.getByTestId('guest-email').props.value).toBe('maria@example.com');
    expect(screen.getByTestId('guest-phone').props.value).toBe('+30 690 123 4567');
    expect(useBookingDraft.getState().guest).toMatchObject({ country: 'CY', locale: 'en' });
  });

  it('says when the price is not available', async () => {
    await setup({ quote: { available: false, reason: 'no_price' } });
    expect(screen.getByText("The camping hasn't set all prices for these dates.")).toBeTruthy();
    expect(screen.getByTestId('booking-continue').props.accessibilityState.disabled).toBe(true);
  });

  it('explains an incomplete link', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ pitchType: PITCH });
    jest.mocked(useAuth).mockReturnValue({ status: 'signedOut', session: null });
    await renderWithLanguage(<BookingScreen />);
    expect(
      screen.getByText("This booking link is incomplete. Start from the camping's page."),
    ).toBeTruthy();
  });
});
