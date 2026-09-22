import { WEB_STAND_IN } from './standIn.web';

it('is on in the web build', () => {
  expect(WEB_STAND_IN).toBe(true);
});
