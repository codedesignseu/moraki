import { randomBytes } from 'node:crypto';

import { newId } from './ids';

const random16 = () => new Uint8Array(randomBytes(16));
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('makes a UUID v7', () => {
    expect(newId(Date.UTC(2026, 9, 25), random16)).toMatch(V7);
  });

  it('encodes the given time in the first 48 bits', () => {
    const now = Date.UTC(2026, 9, 25, 0, 30);
    const id = newId(now, random16);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(now);
  });

  it('sorts by creation time', () => {
    const ids = [3, 1, 2].map((minute) => newId(Date.UTC(2026, 0, 1, 0, minute), random16));
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('uses the random source it is given', () => {
    const fixed = () => new Uint8Array(16).fill(0xab);
    expect(newId(0, fixed)).toBe(newId(0, fixed));
    expect(newId(0, random16)).not.toBe(newId(0, random16));
  });
});
