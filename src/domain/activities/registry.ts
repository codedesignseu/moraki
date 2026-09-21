import type { ActivityModule, EventType } from './contract';

export type ActivityRegistry = {
  /** Adds a module. Registering the same type twice is a wiring bug and throws. */
  registerActivity<P>(module: ActivityModule<P>): void;
  getActivity(type: EventType): ActivityModule<unknown> | undefined;
  /** Every registered module, in registration order. */
  listActivities(): ActivityModule<unknown>[];
};

export function createRegistry(): ActivityRegistry {
  const modules = new Map<EventType, ActivityModule<unknown>>();
  return {
    registerActivity(module) {
      if (modules.has(module.type)) {
        throw new Error(`Activity already registered: ${module.type}`);
      }
      modules.set(module.type, module);
    },
    getActivity: (type) => modules.get(type),
    listActivities: () => [...modules.values()],
  };
}

/** The app's registry, filled by ./index. */
export const { registerActivity, getActivity, listActivities } = createRegistry();
