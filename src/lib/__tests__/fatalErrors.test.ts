import { describeError, installFatalErrorAlert, type ErrorUtilsLike } from '../fatalErrors';

function fakeErrorUtils() {
  const previous = jest.fn();
  let handler: ((error: unknown, isFatal?: boolean) => void) | undefined;
  const utils: ErrorUtilsLike = {
    getGlobalHandler: () => previous,
    setGlobalHandler: (h) => {
      handler = h;
    },
  };
  return {
    utils,
    previous,
    raise: (error: unknown, isFatal: boolean) => handler?.(error, isFatal),
  };
}

describe('fatal error alert', () => {
  it('shows a fatal error, then lets the app close', () => {
    const { utils, previous, raise } = fakeErrorUtils();
    const alert = jest.fn();
    installFatalErrorAlert(utils, alert);
    const error = new TypeError('Cannot assign to read-only property');
    raise(error, true);
    expect(previous).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      'Antiskino preview: the app hit an error',
      expect.stringContaining('TypeError: Cannot assign to read-only property'),
      [expect.objectContaining({ text: 'Close' })],
    );
    (alert.mock.calls[0][2] as { onPress: () => void }[])[0]!.onPress();
    expect(previous).toHaveBeenCalledWith(error, true);
  });

  it('passes other errors on unchanged', () => {
    const { utils, previous, raise } = fakeErrorUtils();
    const alert = jest.fn();
    installFatalErrorAlert(utils, alert);
    raise('soft', false);
    expect(alert).not.toHaveBeenCalled();
    expect(previous).toHaveBeenCalledWith('soft', false);
  });

  it('does nothing without ErrorUtils (web)', () => {
    expect(() => installFatalErrorAlert(undefined, jest.fn())).not.toThrow();
  });

  it('keeps the description short', () => {
    expect(describeError('x'.repeat(5000))).toHaveLength(1500);
  });
});
