import { Alert, type AlertButton } from 'react-native';

type Handler = (error: unknown, isFatal?: boolean) => void;
export type ErrorUtilsLike = {
  getGlobalHandler(): Handler;
  setGlobalHandler(handler: Handler): void;
};
type ShowAlert = (title: string, message: string, buttons: AlertButton[]) => void;

/** The error's name, message and first stack lines, short enough for an alert. */
export function describeError(error: unknown): string {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}\n\n${(error.stack ?? '').split('\n').slice(0, 8).join('\n')}`
      : String(error);
  return text.slice(0, 1500);
}

/**
 * Shows a fatal error on screen before the app closes, so a screenshot from the
 * phone says what broke. Preview builds only (EXPO_PUBLIC_SHOW_FATAL_ERRORS=1
 * in eas.json); the text is a developer diagnostic, not app copy, so it is not
 * translated.
 */
export function installFatalErrorAlert(errorUtils: ErrorUtilsLike | undefined, alert: ShowAlert) {
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return previous(error, isFatal);
    alert('Antiskino preview: the app hit an error', describeError(error), [
      { text: 'Close', onPress: () => previous(error, isFatal) },
    ]);
  });
}

if (process.env.EXPO_PUBLIC_SHOW_FATAL_ERRORS === '1') {
  installFatalErrorAlert(
    (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils,
    (title, message, buttons) => Alert.alert(title, message, buttons),
  );
}
