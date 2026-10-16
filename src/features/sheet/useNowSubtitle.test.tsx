import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { DevicePrefsProvider, SyncRepositoriesProvider, type AppRepositories } from '@/db/react';
import { createDevicePrefsRepository } from '@/db/repositories/devicePrefs';
import { createMemoryDb } from '@/db/testing/memoryDb';
import '@/i18n';

import { useNowSubtitle } from './useNowSubtitle';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-07-01T19:40:00Z'); // 22:40 in Nicosia
const ME = '0190a0b0-0000-7000-8000-000000000001';

async function subtitle(names: Record<string, string>, household: boolean) {
  const { db } = await createMemoryDb();
  jest.useFakeTimers({ now: NOW });
  const prefs = createDevicePrefsRepository(db);
  if (household) {
    prefs.set('accountHousehold', {
      userId: ME,
      householdId: '0190a0b0-0000-7000-8000-000000000a01',
      babyId: '0190a0b0-0000-7000-8000-000000000b01',
      babyName: 'Ella',
      role: 'owner',
    });
  }
  const caregivers = {
    names: () => new Map(Object.entries(names)),
    subscribe: () => () => {},
    version: () => 0,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DevicePrefsProvider repository={prefs}>
      <SyncRepositoriesProvider repositories={{ caregivers } as unknown as AppRepositories}>
        {children}
      </SyncRepositoriesProvider>
    </DevicePrefsProvider>
  );
  const { result } = await renderHook(() => useNowSubtitle(), { wrapper });
  return result.current;
}

afterEach(() => {
  jest.useRealTimers();
});

describe('useNowSubtitle', () => {
  it('says when and who (G: "Now · 22:40 · Parent 1")', async () => {
    expect(await subtitle({ [ME]: 'Makis' }, true)).toBe('Now · 22:40 · Makis');
  });

  it('leaves the name out when the account has none', async () => {
    expect(await subtitle({}, true)).toBe('Now · 22:40');
  });

  it('leaves the name out on a phone with no household', async () => {
    expect(await subtitle({ [ME]: 'Makis' }, false)).toBe('Now · 22:40');
  });
});
