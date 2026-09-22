import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useEventsRepository } from '@/db/react';
import { createEventsRepository } from '@/db/repositories/events';
import { createMemoryDb, testDeps } from '@/db/testing/memoryDb';
import '@/i18n';
import { ThemeProvider } from '@/ui/theme';

import { DatabaseGate } from './DatabaseGate';

function Child() {
  useEventsRepository();
  return <Text>app</Text>;
}

const renderGate = (open: () => Promise<ReturnType<typeof createEventsRepository>>) =>
  render(
    <ThemeProvider scheme="light">
      <DatabaseGate open={open}>
        <Child />
      </DatabaseGate>
    </ThemeProvider>,
  );

describe('DatabaseGate', () => {
  it('renders the app with a repository once the database is open and migrated', async () => {
    const { db } = await createMemoryDb();
    await renderGate(() => Promise.resolve(createEventsRepository(db, testDeps())));
    expect(await screen.findByText('app')).toBeOnTheScreen();
  });

  it('renders nothing from the app while migrations run', async () => {
    await renderGate(() => new Promise(() => {}));
    expect(screen.queryByText('app')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a message instead of the app if opening fails', async () => {
    await renderGate(() => Promise.reject(new Error('migration failed')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t open its data/);
    expect(screen.queryByText('app')).toBeNull();
  });
});
