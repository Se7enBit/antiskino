import { screen } from '@testing-library/react-native';

import { useCampingReviews } from '@/api/reviews';
import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { CampingReviews } from '../CampingReviews';

jest.mock('@/api/reviews', () => ({ useCampingReviews: jest.fn() }));

const review = (id: string, rating: number, patch: object = {}) => ({
  id,
  rating,
  body: null,
  author_name: 'Maria',
  author_country: 'GR',
  stay_month: '2026-07-01',
  partner_reply: null,
  created_at: '2026-07-20T10:00:00Z',
  ...patch,
});

function setup(
  reviews: ReturnType<typeof review>[],
  rating: { average: number; count: number } | null,
) {
  jest.mocked(useCampingReviews).mockReturnValue({
    isError: false,
    data: { reviews, rating },
  } as unknown as ReturnType<typeof useCampingReviews>);
  return renderWithLanguage(<CampingReviews campingId="c1" />);
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('CampingReviews', () => {
  it('shows reviews with name, country, month and the camping reply', async () => {
    await setup(
      [review('r1', 5, { body: 'Lovely shade.', partner_reply: 'Thank you!' }), review('r2', 3)],
      { average: 4, count: 2 },
    );
    expect(useCampingReviews).toHaveBeenCalledWith('c1');
    expect(screen.getByText('Lovely shade.')).toBeTruthy();
    expect(screen.getAllByText('Maria · Greece · July 2026')).toHaveLength(2);
    expect(screen.getByText('Reply from the camping')).toBeTruthy();
    expect(screen.getByLabelText('3 of 5 stars')).toBeTruthy();
    // Two reviews: no average yet.
    expect(screen.queryByText(/reviews: 2/)).toBeNull();
  });

  it('shows the average from 3 reviews', async () => {
    await setup([review('r1', 5), review('r2', 4), review('r3', 5)], { average: 4.7, count: 3 });
    expect(screen.getByText('4.7 · reviews: 3')).toBeTruthy();
  });

  it('says when there are none yet', async () => {
    await setup([], null);
    expect(screen.getByText('No reviews yet.')).toBeTruthy();
  });
});
