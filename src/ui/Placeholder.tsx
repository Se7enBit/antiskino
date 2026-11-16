import type { ReactNode } from 'react';

import { BodyText, Card } from './Card';
import { Screen } from './Screen';

type Props = {
  title: string;
  body: string;
  children?: ReactNode;
};

/** Temporary screen body for routes whose feature lands in a later milestone. */
export function Placeholder({ title, body, children }: Props) {
  return (
    <Screen>
      <Card title={title}>
        <BodyText>{body}</BodyText>
      </Card>
      {children}
    </Screen>
  );
}
