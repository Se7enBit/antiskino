import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { titledScreens } from '../titledScreens';

// The real PageHead renders <title> on web and nothing in the apps; here it
// shows the title so the test can see it.
jest.mock('../PageHead', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PageHead: ({ title }: { title: string }) => <MockText>{`head: ${title}`}</MockText> };
});

const Layout = titledScreens(['index']);

function screenWith(name: string, title?: string) {
  return (
    <Layout route={{ name }} options={{ title }}>
      <Text>content</Text>
    </Layout>
  );
}

describe('titledScreens', () => {
  it('gives a screen a page title from its header title', async () => {
    await render(screenWith('bookings', 'Κρατήσεις'));
    expect(screen.getByText('head: Κρατήσεις · Antiskino')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('leaves screens with their own head, and untitled ones, alone', async () => {
    await render(screenWith('index', 'Αναζήτηση'));
    expect(screen.queryByText(/^head:/)).toBeNull();
    await render(screenWith('c/[slug]/index', ''));
    expect(screen.queryByText(/^head:/)).toBeNull();
    expect(screen.getByText('content')).toBeTruthy();
  });
});
