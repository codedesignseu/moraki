import { WEB_STAND_IN } from './standIn';

it('is off in iOS and Android builds', () => {
  expect(WEB_STAND_IN).toBe(false);
});
