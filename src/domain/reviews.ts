import { z } from 'zod';

/** A camping's average is shown from this many visible reviews (SPEC F9). */
export const MIN_REVIEWS_FOR_RATING = 3;

export type Rating = { average: number; count: number };

/** The rating to show, or null while there are too few reviews. */
export function shownRating(rating: Rating | null | undefined): Rating | null {
  return rating && rating.count >= MIN_REVIEWS_FOR_RATING ? rating : null;
}

/** "4.6" with the decimal mark of the language. */
export function formatRating(average: number, language: 'el' | 'en'): string {
  return new Intl.NumberFormat(language === 'el' ? 'el-GR' : 'en-GB', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

export const REVIEW_MAX_LENGTH = 1000;

/** What the guest submits; the server checks it again. */
export const reviewInputSchema = z.object({
  rating: z.int().min(1).max(5),
  body: z.string().trim().max(REVIEW_MAX_LENGTH),
});
export type ReviewInput = z.output<typeof reviewInputSchema>;

/** The stay can't be reviewed (not completed, or already reviewed): SQL error ANT03. */
export const CANNOT_REVIEW = 'ANT03';

/** The rating of the visible reviews in a list (the team's list includes hidden ones). */
export function visibleRating(reviews: { rating: number; hidden: boolean }[]): Rating | null {
  const visible = reviews.filter((r) => !r.hidden);
  if (visible.length === 0) return null;
  const sum = visible.reduce((total, r) => total + r.rating, 0);
  return { average: Math.round((sum / visible.length) * 10) / 10, count: visible.length };
}
