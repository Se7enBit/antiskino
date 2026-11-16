import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { LanguageProvider } from '@/i18n';

/** Fake TanStack mutation that resolves (or fails) synchronously. */
export function fakeMutation<T>(outcome: { data?: T; error?: unknown } = {}) {
  const mutate = jest.fn(
    (
      _vars: unknown,
      callbacks?: { onSuccess?: (data: T) => void; onError?: (e: unknown) => void },
    ) => {
      if (outcome.error) callbacks?.onError?.(outcome.error);
      else callbacks?.onSuccess?.(outcome.data as T);
    },
  );
  return {
    mutate,
    isPending: false,
    isError: Boolean(outcome.error),
    isSuccess: false,
    error: outcome.error ?? null,
  };
}

export function renderWithLanguage(element: ReactElement) {
  return render(<LanguageProvider>{element}</LanguageProvider>);
}
