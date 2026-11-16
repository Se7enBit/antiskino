import { fireEvent, render, screen } from '@testing-library/react-native';

import { useRequestCode, useVerifyCode } from '@/api/auth';
import { LanguageProvider, i18n } from '@/i18n';

import { SignInForm } from '../SignInForm';

jest.mock('@/api/auth', () => ({
  useRequestCode: jest.fn(),
  useVerifyCode: jest.fn(),
}));

type Callbacks = { onSuccess?: () => void; onError?: (e: unknown) => void };

function mockMutation(outcome: { error?: unknown } = {}) {
  const mutate = jest.fn((_vars: unknown, callbacks?: Callbacks) => {
    if (outcome.error) callbacks?.onError?.(outcome.error);
    else callbacks?.onSuccess?.();
  });
  return { mutate, isPending: false };
}

async function setup({
  requestError,
  verifyError,
}: { requestError?: unknown; verifyError?: unknown } = {}) {
  const request = mockMutation({ error: requestError });
  const verify = mockMutation({ error: verifyError });
  jest
    .mocked(useRequestCode)
    .mockReturnValue(request as unknown as ReturnType<typeof useRequestCode>);
  jest.mocked(useVerifyCode).mockReturnValue(verify as unknown as ReturnType<typeof useVerifyCode>);
  await render(
    <LanguageProvider>
      <SignInForm />
    </LanguageProvider>,
  );
  return { request, verify };
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('SignInForm', () => {
  it('asks for a valid email before sending a code', async () => {
    const { request } = await setup();
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('sign-in-send-code'));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(request.mutate).not.toHaveBeenCalled();
  });

  it('sends the code to the normalised email with the UI language', async () => {
    const { request } = await setup();
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), '  Maria@Example.GR ');
    await fireEvent.press(screen.getByTestId('sign-in-send-code'));
    expect(request.mutate).toHaveBeenCalledWith(
      { email: 'maria@example.gr', language: 'en' },
      expect.any(Object),
    );
    expect(
      screen.getByText('We sent a code to maria@example.gr. It can take a minute to arrive.'),
    ).toBeOnTheScreen();
  });

  it('signs in with the emailed code', async () => {
    const { verify } = await setup();
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'maria@example.gr');
    await fireEvent.press(screen.getByTestId('sign-in-send-code'));

    await fireEvent.changeText(screen.getByTestId('sign-in-code'), '12');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(screen.getByText('Enter the code from the email.')).toBeOnTheScreen();
    expect(verify.mutate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('sign-in-code'), '123 456');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(verify.mutate).toHaveBeenCalledWith(
      { email: 'maria@example.gr', code: '123456' },
      expect.any(Object),
    );
  });

  it('explains a wrong or expired code', async () => {
    await setup({ verifyError: { status: 403, code: 'otp_expired' } });
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'maria@example.gr');
    await fireEvent.press(screen.getByTestId('sign-in-send-code'));
    await fireEvent.changeText(screen.getByTestId('sign-in-code'), '123456');
    await fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(
      screen.getByText('That code is wrong or has expired. Ask for a new one.'),
    ).toBeOnTheScreen();
  });

  it('explains the rate limit and stays on the email step', async () => {
    await setup({ requestError: { status: 429 } });
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'maria@example.gr');
    await fireEvent.press(screen.getByTestId('sign-in-send-code'));
    expect(screen.getByText('Too many attempts. Wait a minute and try again.')).toBeOnTheScreen();
    expect(screen.getByTestId('sign-in-email')).toBeOnTheScreen();
  });

  it('goes back to change the email', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('sign-in-email'), 'maria@example.gr');
    await fireEvent.press(screen.getByTestId('sign-in-send-code'));
    await fireEvent.press(screen.getByText('Use another email'));
    expect(screen.getByTestId('sign-in-email')).toBeOnTheScreen();
  });
});
