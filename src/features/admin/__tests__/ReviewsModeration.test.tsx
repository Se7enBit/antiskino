import { fireEvent, screen } from '@testing-library/react-native';

import { useAdminReviews, useSetReviewHidden, type AdminReview } from '@/api/adminReviews';
import { i18n } from '@/i18n';
import { fakeMutation, renderWithLanguage } from '@/test/utils';

import { ReviewsModeration } from '../ReviewsModeration';

jest.mock('@/api/adminReviews', () => ({
  useAdminReviews: jest.fn(),
  useSetReviewHidden: jest.fn(),
}));

const review = (id: string, patch: Partial<AdminReview> = {}): AdminReview => ({
  id,
  rating: 2,
  body: 'Call me on 690…',
  author_name: 'Nikos',
  author_country: 'GR',
  stay_month: '2026-08-01',
  partner_reply: null,
  hidden: false,
  hidden_reason: null,
  created_at: '2026-08-20T10:00:00Z',
  camping: { name: 'Camping Thalassa' },
  ...patch,
});

function setup(list: AdminReview[]) {
  jest.mocked(useAdminReviews).mockReturnValue({
    isPending: false,
    isError: false,
    data: list,
  } as unknown as ReturnType<typeof useAdminReviews>);
  const setHidden = fakeMutation();
  jest
    .mocked(useSetReviewHidden)
    .mockReturnValue(setHidden as unknown as ReturnType<typeof useSetReviewHidden>);
  return setHidden;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('Review moderation', () => {
  it('hides a review only with a reason', async () => {
    const setHidden = setup([review('r1')]);
    await renderWithLanguage(<ReviewsModeration />);
    expect(screen.getByText('Camping Thalassa')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('hide-r1'));
    await fireEvent.press(screen.getByTestId('hide-confirm-r1'));
    expect(screen.getByText('Write a short reason.')).toBeTruthy();
    expect(setHidden.mutate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('hide-reason-r1'), ' Personal data ');
    await fireEvent.press(screen.getByTestId('hide-confirm-r1'));
    expect(setHidden.mutate).toHaveBeenCalledWith({
      reviewId: 'r1',
      hidden: true,
      reason: 'Personal data',
    });
  });

  it('shows a hidden review again, and lists only hidden ones on demand', async () => {
    const setHidden = setup([review('r1', { hidden: true, hidden_reason: 'Personal data' })]);
    await renderWithLanguage(<ReviewsModeration />);
    expect(useAdminReviews).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('Reason: Personal data')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('show-r1'));
    expect(setHidden.mutate).toHaveBeenCalledWith({ reviewId: 'r1', hidden: false, reason: '' });
    await fireEvent.press(screen.getByTestId('only-hidden'));
    expect(useAdminReviews).toHaveBeenLastCalledWith(true);
  });
});
