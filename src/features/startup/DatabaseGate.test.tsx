import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useDevicePref, useEventsRepository, type AppRepositories } from '@/db/react';
import { adoptHousehold, localOnlyCount } from '@/db/adoptHousehold';
import { readLinkedIdentity } from '@/db/identity';
import { createDevicePrefsRepository } from '@/db/repositories/devicePrefs';
import { createCaregiversRepository } from '@/db/repositories/caregivers';
import { createOutboxRepository } from '@/db/repositories/outbox';
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

const renderGate = (open: () => Promise<AppRepositories>, hold = false) =>
  render(
    <ThemeProvider scheme="light">
      <DatabaseGate open={open} hold={hold}>
        <Child />
      </DatabaseGate>
    </ThemeProvider>,
  );

async function openRepositories(): Promise<AppRepositories> {
  const { db } = await createMemoryDb();
  return {
    events: createEventsRepository(db, testDeps()),
    devicePrefs: createDevicePrefsRepository(db),
    outbox: createOutboxRepository(db),
    caregivers: createCaregiversRepository(db),
    linked: () => readLinkedIdentity(db),
    localOnly: () => localOnlyCount(db),
    adopt: (target, now) => adoptHousehold(db, target, now),
    resetPhone: () => {},
  };
}

describe('DatabaseGate', () => {
  it('stays blank while held (fonts loading), even once the database is open', async () => {
    const repositories = await openRepositories();
    const opened = Promise.resolve(repositories);
    await renderGate(() => opened, true);
    await act(async () => {
      await opened;
    });
    expect(screen.queryByText('app')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('holds back the failure message too until released', async () => {
    const failed = Promise.reject(new Error('migration failed'));
    failed.catch(() => {});
    await renderGate(() => failed, true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the app with its repositories once the database is open and migrated', async () => {
    await renderGate(openRepositories);
    expect(await screen.findByText('app')).toBeOnTheScreen();
  });

  it('renders nothing from the app while migrations run', async () => {
    await renderGate(() => new Promise(() => {}));
    expect(screen.queryByText('app')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a message instead of the app if opening fails', async () => {
    await renderGate(() => Promise.reject(new Error('migration failed')));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Your log could not open/);
    expect(alert).toHaveTextContent(/couldn.t open its data/);
    // No retry: opening again is new behaviour (G3).
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('app')).toBeNull();
  });
});
