import { fireEvent, screen } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { renderWithLanguage } from '@/test/utils';

import { StayReview } from '../StayReview';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('StayReview', () => {
  it('asks for a rating, then posts it with the text', async () => {
    const onSubmit = jest.fn();
    await renderWithLanguage(
      <StayReview
        booking={{ can_review: true, review: null }}
        onSubmit={onSubmit}
        submitting={false}
        submitError={null}
      />,
    );
    expect(screen.getByText('How was your stay?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('review-submit'));
    expect(screen.getByText('Tap a star to rate your stay.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('review-stars-4'));
    await fireEvent.changeText(screen.getByTestId('review-body'), '  Quiet and shady.  ');
    await fireEvent.press(screen.getByTestId('review-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, body: 'Quiet and shady.' });
  });

  it('explains a stay that cannot be reviewed', async () => {
    await renderWithLanguage(
      <StayReview
        booking={{ can_review: true, review: null }}
        onSubmit={jest.fn()}
        submitting={false}
        submitError={{ code: 'ANT03' }}
      />,
    );
    expect(
      screen.getByText("This stay can't be reviewed. It may already have a review."),
    ).toBeTruthy();
  });

  it('shows the guest their review, the reply and whether it is hidden', async () => {
    await renderWithLanguage(
      <StayReview
        booking={{
          can_review: false,
          review: { rating: 5, body: 'Lovely', partner_reply: 'Thank you!', hidden: true },
        }}
        onSubmit={jest.fn()}
        submitting={false}
        submitError={null}
      />,
    );
    expect(screen.getByText('Your review')).toBeTruthy();
    expect(screen.getByLabelText('5 of 5 stars')).toBeTruthy();
    expect(screen.getByText('Reply from the camping: Thank you!')).toBeTruthy();
    expect(screen.getByText('Antiskino has hidden this review.')).toBeTruthy();
  });

  it('shows nothing before the stay is completed', async () => {
    await renderWithLanguage(
      <StayReview
        booking={{ can_review: false, review: null }}
        onSubmit={jest.fn()}
        submitting={false}
        submitError={null}
      />,
    );
    expect(screen.queryByText('How was your stay?')).toBeNull();
  });
});
