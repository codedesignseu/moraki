import type { Event } from '../activities';
import { describeEntry } from './describeEntry';

const NOW = Date.parse('2026-10-25T10:00:00Z');
const TZ = 'Europe/Nicosia';

const event = (type: Event<unknown>['type'], payload: unknown): Event<unknown> => ({
  id: 'e1',
  householdId: 'h',
  babyId: 'b',
  type,
  occurredAt: NOW - 3_600_000,
  endedAt: null,
  payload,
  groupId: null,
  createdBy: 'u2',
  updatedBy: 'u2',
  clientCreatedAt: 0,
  deletedAt: null,
});

describe('describeEntry', () => {
  it('carries the module badge, label, summary, local time and author', () => {
    const row = describeEntry(
      event('diaper', { kind: 'wet' }),
      NOW,
      TZ,
      'u1',
      new Map([['u2', 'Makis']]),
    );
    expect(row).toEqual({
      id: 'e1',
      type: 'diaper',
      labelKey: 'activity.diaper.label',
      icon: 'diaper',
      tone: 'diaper',
      summary: { key: 'activity.diaper.summary.wet' },
      time: '11:00',
      daysAgo: 0,
      byYou: false,
      by: 'Makis',
    });
  });

  it('gives each type its own badge from the activity module', () => {
    const bottle = describeEntry(event('feed_bottle', { ml: 90, milk: 'formula' }), NOW, TZ, 'u2');
    expect([bottle.icon, bottle.tone, bottle.byYou, bottle.by]).toEqual([
      'feed',
      'feed',
      true,
      null,
    ]);
  });
});
