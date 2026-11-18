import { pushTarget } from '../push';

describe('pushTarget', () => {
  it('opens the guest or partner booking a push is about', () => {
    expect(pushTarget({ url: '/bookings/detail?ref=ANT-7KQ2XM' })).toBe(
      '/bookings/detail?ref=ANT-7KQ2XM',
    );
    expect(pushTarget({ url: '/partner/bookings/detail?ref=ANT-7KQ2XM' })).toBe(
      '/partner/bookings/detail?ref=ANT-7KQ2XM',
    );
    expect(pushTarget({ url: '/partner/reviews' })).toBe('/partner/reviews');
  });

  it('ignores anything else', () => {
    for (const data of [
      null,
      'x',
      {},
      { url: 42 },
      { url: 'https://evil.example/bookings/detail?ref=ANT-7KQ2XM' },
      { url: '/admin' },
      { url: '/bookings/detail?ref=ANT-7KQ2XM&next=/admin' },
    ]) {
      expect(pushTarget(data)).toBeNull();
    }
  });
});
