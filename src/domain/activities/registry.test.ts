import { z } from 'zod';

import type { ActivityModule } from './contract';
import { createRegistry } from './registry';

const sleepLike: ActivityModule<{ place?: string | undefined }> = {
  type: 'sleep',
  schema: z.object({ place: z.string().optional() }),
  i18nKey: 'activity.sleep.label',
};

describe('activity registry', () => {
  it('returns a registered module by type', () => {
    const { registerActivity, getActivity, listActivities } = createRegistry();
    registerActivity(sleepLike);
    expect(getActivity('sleep')).toBe(sleepLike);
    expect(listActivities()).toEqual([sleepLike]);
  });

  it('returns undefined for a type nobody registered', () => {
    expect(createRegistry().getActivity('weight')).toBeUndefined();
  });

  it('throws when a type is registered twice', () => {
    const { registerActivity } = createRegistry();
    registerActivity(sleepLike);
    expect(() => registerActivity(sleepLike)).toThrow('Activity already registered: sleep');
  });
});
