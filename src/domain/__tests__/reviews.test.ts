import { formatRating, reviewInputSchema, shownRating, visibleRating } from '../reviews';

describe('shownRating', () => {
  it('shows the average from 3 reviews', () => {
    expect(shownRating({ average: 4.5, count: 2 })).toBeNull();
    expect(shownRating({ average: 4.5, count: 3 })).toEqual({ average: 4.5, count: 3 });
    expect(shownRating(null)).toBeNull();
    expect(shownRating(undefined)).toBeNull();
  });

  it('formats with one decimal in the language', () => {
    expect(formatRating(4.5, 'en')).toBe('4.5');
    expect(formatRating(4, 'el')).toBe('4,0');
  });
});

describe('reviewInputSchema', () => {
  it('needs a rating of 1 to 5 and at most 1000 characters', () => {
    expect(reviewInputSchema.safeParse({ rating: 5, body: '  Great  ' }).data).toEqual({
      rating: 5,
      body: 'Great',
    });
    expect(reviewInputSchema.safeParse({ rating: 0, body: '' }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 3, body: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('visibleRating', () => {
  it('averages visible reviews to one decimal', () => {
    expect(
      visibleRating([
        { rating: 5, hidden: false },
        { rating: 4, hidden: false },
        { rating: 4, hidden: false },
        { rating: 1, hidden: true },
      ]),
    ).toEqual({ average: 4.3, count: 3 });
    expect(visibleRating([{ rating: 2, hidden: true }])).toBeNull();
    expect(visibleRating([])).toBeNull();
  });
});
