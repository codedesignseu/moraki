import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useDevicePref, useEventsRepository, type AppRepositories } from '@/db/react';
import { createDevicePrefsRepository } from '@/db/repositories/devicePrefs';
import { createEventsRepository } from '@/db/repositories/events';
import { createMemoryDb, testDeps } from '@/db/testing/memoryDb';
import '@/i18n';
import { ThemeProvider } from '@/ui/theme';

import { DatabaseGate } from './DatabaseGate';

function Child() {
  useEventsRepository();
  useDevicePref('nightMode');
  return <Text>app</Text>;
}

const renderGate = (open: () => Promise<AppRepositories>) =>
  render(
    <ThemeProvider scheme="light">
      <DatabaseGate open={open}>
        <Child />
      </DatabaseGate>
    </ThemeProvider>,
  );

describe('DatabaseGate', () => {
  it('renders the app with its repositories once the database is open and migrated', async () => {
    const { db } = await createMemoryDb();
    const events = createEventsRepository(db, testDeps());
    const devicePrefs = createDevicePrefsRepository(db);
    await renderGate(() => Promise.resolve({ events, devicePrefs }));
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
