import type { ReactElement, ReactNode } from 'react';

import { PageHead } from './PageHead';

type ScreenArgs = {
  route: { name: string };
  options: { title?: string };
  children: ReactNode;
};

/**
 * A navigator's `screenLayout` that gives each screen a page title from its
 * header title ("Κρατήσεις · Antiskino"), so browser tabs and history don't show
 * bare addresses (web only; PageHead renders nothing in the apps). Pass the
 * screens that set their own head (home, camping and legal pages) and the
 * nested navigators, whose own screens are titled, as `skip`.
 */
export function titledScreens(skip: readonly string[] = []) {
  return function TitledScreen({ route, options, children }: ScreenArgs): ReactElement {
    const title = skip.includes(route.name) ? undefined : options.title;
    return (
      <>
        {title ? <PageHead title={`${title} · Antiskino`} /> : null}
        {children}
      </>
    );
  };
}
