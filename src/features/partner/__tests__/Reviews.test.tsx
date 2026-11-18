import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { useReplyToReview, useTeamReviews, type TeamReview } from '@/api/partnerReviews';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { ReviewsScreen } from '../ReviewsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api/partnerReviews', () => ({
  useTeamReviews: jest.fn(),
  useReplyToReview: jest.fn(),
}));
jest.mock('../PartnerScreen', () => ({
  PartnerScreen: ({
    children,
  }: {
    children: (c: { camping: { id: string }; canEdit: boolean }) => ReactNode;
  }) => children({ camping: { id: 'c1' }, canEdit: false }),
}));

const review = (id: string, patch: Partial<TeamReview> = {}): TeamReview => ({
  id,
  rating: 5,
  body: 'Lovely shade.',
  author_name: 'Maria',
  author_country: 'GR',
  stay_month: '2026-07-01',
  partner_reply: null,
  partner_replied_at: null,
  hidden: false,
  hidden_reason: null,
  created_at: '2026-07-20T10:00:00Z',
  booking: { ref: `ANT-${id.toUpperCase()}`, guest_name: 'Maria Papadopoulou' },
  ...patch,
});

function setup(list: TeamReview[]) {
  jest.mocked(useTeamReviews).mockReturnValue({
    isPending: false,
    isError: false,
    data: list,
  } as unknown as ReturnType<typeof useTeamReviews>);
  const reply = fakeMutation();
  jest
    .mocked(useReplyToReview)
    .mockReturnValue(reply as unknown as ReturnType<typeof useReplyToReview>);
  return { reply, render: () => renderWithLanguage(<ReviewsScreen />) };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Partner reviews', () => {
  it('replies to a review, publicly', async () => {
    const { reply, render } = setup([review('r1')]);
    await render();
    expect(useTeamReviews).toHaveBeenCalledWith('c1');
    expect(screen.getByText('Lovely shade.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reply-r1'));
    await fireEvent.changeText(screen.getByTestId('reply-text-r1'), 'Thank you, Maria!');
    await fireEvent.press(screen.getByTestId('reply-save-r1'));
    expect(reply.mutate).toHaveBeenCalledWith({ reviewId: 'r1', reply: 'Thank you, Maria!' });
  });

  it('edits an existing reply and opens the booking', async () => {
    const { render } = setup([review('r1', { partner_reply: 'Thanks!' })]);
    await render();
    expect(screen.getByText('Thanks!')).toBeTruthy();
    expect(screen.getByText('Edit reply')).toBeTruthy();
    await fireEvent.press(screen.getByText('Booking ANT-R1 · Maria Papadopoulou'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/partner/bookings/detail',
      params: { ref: 'ANT-R1' },
    });
  });

  it('shows hidden reviews with the reason, outside the rating', async () => {
    const { render } = setup([
      review('r1', { rating: 4 }),
      review('r2', { rating: 5 }),
      review('r3', { rating: 1, hidden: true, hidden_reason: 'Personal data' }),
    ]);
    await render();
    expect(screen.getByText('Hidden by Antiskino: Personal data')).toBeTruthy();
    expect(screen.getByText('The rating is shown from 3 visible reviews (now: 2).')).toBeTruthy();
  });

  it('shows the rating from 3 visible reviews', async () => {
    const { render } = setup([review('r1'), review('r2', { rating: 4 }), review('r3')]);
    await render();
    expect(screen.getByText('4.7 · reviews: 3')).toBeTruthy();
  });

  it('says when there are no reviews yet', async () => {
    const { render } = setup([]);
    await render();
    expect(screen.getByText('No reviews yet. Guests can review after their stay.')).toBeTruthy();
  });
});
